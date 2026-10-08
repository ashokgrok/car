/**
 * Source Adapters
 * Encapsulate external raw formats and normalize them into Canonical Event Envelopes
 * Section 2, Section 8, Section 9.8
 */

import { CanonicalEventEnvelope } from '../../src/types/car';
import { eventHub } from '../events/bus';

export interface SourceAdapter<TIn, TOut = Record<string, unknown>> {
  sourceName: string;
  transform(raw: TIn): CanonicalEventEnvelope<TOut>;
  publish(event: CanonicalEventEnvelope<TOut>): Promise<void>;
}

export class AODBAdapter implements SourceAdapter<Record<string, unknown>> {
  sourceName = 'MOCK_AODB';

  transform(raw: {
    flight_id: string;
    flight_number: string;
    scheduled_arrival: string;
    estimated_arrival: string;
    delay_minutes?: number;
    status: string;
    gate?: string;
  }): CanonicalEventEnvelope {
    const eventId = `evt_aodb_${crypto.randomUUID().slice(0, 8)}`;
    const correlationId = `corr_${crypto.randomUUID().slice(0, 8)}`;

    return {
      event_id: eventId,
      event_type: 'FlightStatusChanged',
      event_version: '1.0',
      event_time_utc: new Date().toISOString(),
      received_time_utc: new Date().toISOString(),
      source_system: this.sourceName,
      source_entity_id: raw.flight_id,
      site_code: 'SITE01',
      correlation_id: correlationId,
      payload: {
        flight_id: raw.flight_id,
        service_number: raw.flight_number,
        scheduled_arrival_utc: raw.scheduled_arrival,
        estimated_arrival_utc: raw.estimated_arrival,
        delay_minutes: raw.delay_minutes || 0,
        status: raw.status,
        gate: raw.gate
      }
    };
  }

  async publish(event: CanonicalEventEnvelope): Promise<void> {
    await eventHub.publish(event);
  }
}

export class FerryAdapter implements SourceAdapter<Record<string, unknown>> {
  sourceName = 'MOCK_FERRY';

  transform(raw: {
    sailing_id: string;
    sailing_number: string;
    scheduled_departure: string;
    estimated_departure: string;
    boarding_close_utc: string;
    status: string;
    berth?: string;
    delay_minutes?: number;
  }): CanonicalEventEnvelope {
    const eventId = `evt_ferry_${crypto.randomUUID().slice(0, 8)}`;
    const correlationId = `corr_${crypto.randomUUID().slice(0, 8)}`;

    return {
      event_id: eventId,
      event_type: 'SailingScheduleUpdated',
      event_version: '1.0',
      event_time_utc: new Date().toISOString(),
      received_time_utc: new Date().toISOString(),
      source_system: this.sourceName,
      source_entity_id: raw.sailing_id,
      site_code: 'SITE01',
      correlation_id: correlationId,
      payload: {
        sailing_id: raw.sailing_id,
        service_number: raw.sailing_number,
        scheduled_departure_utc: raw.scheduled_departure,
        estimated_departure_utc: raw.estimated_departure,
        boarding_close_utc: raw.boarding_close_utc,
        status: raw.status,
        berth: raw.berth,
        delay_minutes: raw.delay_minutes || 0
      }
    };
  }

  async publish(event: CanonicalEventEnvelope): Promise<void> {
    await eventHub.publish(event);
  }
}

export class TransferAdapter implements SourceAdapter<Record<string, unknown>> {
  sourceName = 'MOCK_TRANSFER';

  transform(raw: {
    transfer_id: string;
    duration_minutes: number;
    traffic_status: string;
    reason?: string;
  }): CanonicalEventEnvelope {
    const eventId = `evt_trf_${crypto.randomUUID().slice(0, 8)}`;
    const correlationId = `corr_${crypto.randomUUID().slice(0, 8)}`;

    return {
      event_id: eventId,
      event_type: 'TransferConditionChanged',
      event_version: '1.0',
      event_time_utc: new Date().toISOString(),
      received_time_utc: new Date().toISOString(),
      source_system: this.sourceName,
      source_entity_id: raw.transfer_id,
      site_code: 'SITE01',
      correlation_id: correlationId,
      payload: {
        transfer_id: raw.transfer_id,
        duration_minutes: raw.duration_minutes,
        traffic_status: raw.traffic_status,
        reason: raw.reason
      }
    };
  }

  async publish(event: CanonicalEventEnvelope): Promise<void> {
    await eventHub.publish(event);
  }
}

export class PassengerAdapter implements SourceAdapter<Record<string, unknown>> {
  sourceName = 'MOCK_PASSENGER';

  transform(raw: {
    group_id: string;
    pnr_token: string;
    passenger_count: number;
    prm_count: number;
    priority: boolean;
  }): CanonicalEventEnvelope {
    return {
      event_id: `evt_pax_${crypto.randomUUID().slice(0, 8)}`,
      event_type: 'PassengerConnectionUpdated',
      event_version: '1.0',
      event_time_utc: new Date().toISOString(),
      received_time_utc: new Date().toISOString(),
      source_system: this.sourceName,
      source_entity_id: raw.group_id,
      site_code: 'SITE01',
      correlation_id: `corr_${crypto.randomUUID().slice(0, 8)}`,
      payload: raw
    };
  }

  async publish(event: CanonicalEventEnvelope): Promise<void> {
    await eventHub.publish(event);
  }
}

export const aodbAdapter = new AODBAdapter();
export const ferryAdapter = new FerryAdapter();
export const transferAdapter = new TransferAdapter();
export const passengerAdapter = new PassengerAdapter();
