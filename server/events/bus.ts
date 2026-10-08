/**
 * Event Backbone & Messaging Bus
 * Simulates Azure Event Hubs (streaming operational and audit topics with consumer groups)
 * and Azure Service Bus (command queues with DLQ & retry).
 */

import { CanonicalEventEnvelope } from '../../src/types/car';
import { ods } from '../state/store';

export type EventHandler = (event: CanonicalEventEnvelope) => Promise<void> | void;

export interface ConsumerGroupRegistration {
  groupName: string;
  handler: EventHandler;
}

export class EventHubsBroker {
  private topicOperational: CanonicalEventEnvelope[] = [];
  private topicAudit: CanonicalEventEnvelope[] = [];
  private consumerGroups: Map<string, ConsumerGroupRegistration[]> = new Map();
  private deadLetterQueue: { event: CanonicalEventEnvelope; reason: string; timestamp: string; retryCount: number; site_code: string }[] = [];
  private broadcastSubscribers: ((data: any) => void)[] = [];

  constructor() {
    this.consumerGroups.set('operational-state', []);
    this.consumerGroups.set('correlation-engine', []);
    this.consumerGroups.set('risk-engine', []);
    this.consumerGroups.set('databricks-bronze', []);
    this.consumerGroups.set('notification-engine', []);
  }

  registerConsumer(consumerGroup: string, handler: EventHandler) {
    if (!this.consumerGroups.has(consumerGroup)) {
      this.consumerGroups.set(consumerGroup, []);
    }
    this.consumerGroups.get(consumerGroup)!.push({ groupName: consumerGroup, handler });
  }

  async publish(event: CanonicalEventEnvelope, topic: 'operational' | 'audit' = 'operational'): Promise<void> {
    if (topic === 'operational') {
      this.topicOperational.unshift(event);
      if (this.topicOperational.length > 200) this.topicOperational.pop();
    } else {
      this.topicAudit.unshift(event);
      if (this.topicAudit.length > 200) this.topicAudit.pop();
    }

    // Broadcast to all consumer groups with idempotency validation
    for (const [groupName, consumers] of this.consumerGroups.entries()) {
      for (const consumer of consumers) {
        try {
          if (ods.isProcessed(event.event_id, groupName)) {
            // Already processed by this consumer group
            continue;
          }

          // Deserialization & schema validation check
          if (event.event_time_utc === 'INVALID_TIMESTAMP' || !event.event_type || event.event_type === 'MalformedVendorEvent' || (event.payload as any)?.corrupted) {
            throw new Error(`SchemaValidationFailed: Corrupted event syntax or invalid timestamp on ${event.event_id}`);
          }

          await consumer.handler(event);
          ods.markProcessed(event.event_id, groupName, 'SUCCESS');
        } catch (err) {
          console.error(`[EventHubs] Consumer ${groupName} failed for event ${event.event_id}:`, err);
          const site_code = event.site_code || 'SITE01';
          this.deadLetterQueue.unshift({
            event,
            reason: String(err),
            timestamp: new Date().toISOString(),
            retryCount: 0,
            site_code
          });
          this.emitBroadcast('DLQ_MESSAGE_ADDED', {
            site_code,
            event_id: event.event_id,
            reason: String(err)
          });
        }
      }
    }

    // Notify live streaming subscribers
    for (const sub of this.broadcastSubscribers) {
      try {
        sub({ type: 'EVENT_PUBLISHED', event, topic });
      } catch (err) {
        // Ignore subscriber error
      }
    }
  }

  subscribeBroadcast(callback: (data: any) => void): () => void {
    this.broadcastSubscribers.push(callback);
    return () => {
      this.broadcastSubscribers = this.broadcastSubscribers.filter(cb => cb !== callback);
    };
  }

  emitBroadcast(type: string, payload: any) {
    for (const sub of this.broadcastSubscribers) {
      try {
        sub({ type, payload, timestamp: new Date().toISOString() });
      } catch (err) {
        // Ignore subscriber error
      }
    }
  }

  getRecentEvents(limit: number = 50): CanonicalEventEnvelope[] {
    return this.topicOperational.slice(0, limit);
  }

  getDeadLetterQueue(site_code?: string) {
    if (!site_code || site_code === 'ALL') {
      return this.deadLetterQueue;
    }
    return this.deadLetterQueue.filter(item => (item.site_code || item.event.site_code) === site_code);
  }

  purgeDLQ(site_code?: string, id?: string) {
    if (id) {
      this.deadLetterQueue = this.deadLetterQueue.filter(item => item.event.event_id !== id);
    } else if (site_code && site_code !== 'ALL') {
      this.deadLetterQueue = this.deadLetterQueue.filter(item => (item.site_code || item.event.site_code) !== site_code);
    } else {
      this.deadLetterQueue = [];
    }
  }

  async retryDLQ(id: string, site_code?: string) {
    const itemIndex = this.deadLetterQueue.findIndex(i => {
      const matchId = i.event.event_id === id;
      if (!matchId) return false;
      if (site_code && site_code !== 'ALL') {
        return (i.site_code || i.event.site_code) === site_code;
      }
      return true;
    });

    if (itemIndex >= 0) {
      const item = this.deadLetterQueue[itemIndex];
      item.retryCount = (item.retryCount || 0) + 1;
      this.deadLetterQueue.splice(itemIndex, 1);
      await this.publish(item.event);
    }
  }

  injectPoisonPill(site_code: string, reason: string, rawPayload?: any) {
    const eventId = `evt_poison_${crypto.randomUUID().slice(0, 8)}`;
    const poisonEvent: CanonicalEventEnvelope = {
      event_id: eventId,
      event_type: 'CorruptIngestionPayload',
      event_version: '1.0',
      event_time_utc: new Date().toISOString(),
      received_time_utc: new Date().toISOString(),
      source_system: 'SITE_INGESTION_GATEWAY',
      source_entity_id: `CORRUPT_${site_code}_${Date.now()}`,
      site_code: site_code,
      correlation_id: `corr_poison_${Date.now()}`,
      payload: rawPayload || {
        raw_snippet: '{\x00\xFFMALFORMED_UTF8_BYTE_STREAM: UNEXPECTED_EOF}',
        corrupted_at: new Date().toISOString(),
        parser_error: reason
      }
    };

    this.deadLetterQueue.unshift({
      event: poisonEvent,
      reason,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      site_code
    });

    this.emitBroadcast('DLQ_MESSAGE_ADDED', {
      site_code,
      event_id: eventId,
      reason
    });

    return poisonEvent;
  }

  getQueueStats(site_code?: string) {
    const dlq = this.getDeadLetterQueue(site_code);
    return {
      operationalEventsCount: this.topicOperational.length,
      auditEventsCount: this.topicAudit.length,
      consumerGroupsCount: this.consumerGroups.size,
      dlqCount: dlq.length,
      status: dlq.length > 0 ? 'DEGRADED' : 'HEALTHY'
    };
  }
}

export const eventHub = new EventHubsBroker();
