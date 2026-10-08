/**
 * Correlation Engine
 * Section 9.10, Section 20
 * Links Flight -> Passenger Group -> Transfer -> Sailing -> Connection
 * Identifies affected connections upon any operational change and re-evaluates risk.
 */

import { CanonicalEventEnvelope, RiskAssessment } from '../../src/types/car';
import { ods } from '../state/store';
import { riskCalculator } from './riskCalculator';
import { caseWorkflow } from './caseWorkflow';
import { eventHub } from '../events/bus';
import { lakehouse } from './lakehouse';

export class CorrelationEngine {
  constructor() {
    this.registerListeners();
  }

  registerListeners() {
    eventHub.registerConsumer('correlation-engine', async (event: CanonicalEventEnvelope) => {
      await this.handleOperationalEvent(event);
    });
  }

  async handleOperationalEvent(event: CanonicalEventEnvelope): Promise<void> {
    const payload = event.payload as Record<string, any>;

    let affectedConnectionIds: string[] = [];

    switch (event.event_type) {
      case 'FlightStatusChanged':
      case 'FlightScheduleUpdated': {
        const flightId = payload.flight_id;
        // Update flight in ODS
        const flight = ods.journeys.get(flightId);
        if (flight) {
          if (payload.estimated_arrival_utc) flight.estimated_arrival_utc = payload.estimated_arrival_utc;
          if (payload.status) flight.status = payload.status;
          if (payload.gate) flight.gate_or_berth = payload.gate;
          flight.last_updated_utc = new Date().toISOString();
        }

        // Find connections
        affectedConnectionIds = Array.from(ods.connections.values())
          .filter(c => c.inbound_journey_id === flightId)
          .map(c => c.connection_id);
        break;
      }

      case 'SailingScheduleUpdated':
      case 'SailingStatusChanged': {
        const sailingId = payload.sailing_id;
        const sailing = ods.journeys.get(sailingId);
        if (sailing) {
          if (payload.estimated_departure_utc) sailing.estimated_departure_utc = payload.estimated_departure_utc;
          if (payload.boarding_close_utc) sailing.boarding_close_utc = payload.boarding_close_utc;
          if (payload.status) sailing.status = payload.status;
          if (payload.berth) sailing.gate_or_berth = payload.berth;
          sailing.last_updated_utc = new Date().toISOString();
        }

        // Find connections
        affectedConnectionIds = Array.from(ods.connections.values())
          .filter(c => c.outbound_journey_id === sailingId)
          .map(c => c.connection_id);

        // Also update connection boarding_close_utc
        for (const connId of affectedConnectionIds) {
          const conn = ods.connections.get(connId);
          if (conn && payload.boarding_close_utc) {
            conn.boarding_close_utc = payload.boarding_close_utc;
          }
        }
        break;
      }

      case 'TransferConditionChanged': {
        const transferId = payload.transfer_id;
        const trf = ods.transfers.get(transferId);
        if (trf) {
          if (payload.duration_minutes) trf.current_duration_minutes = payload.duration_minutes;
          if (payload.traffic_status) trf.traffic_status = payload.traffic_status;
          trf.last_updated_utc = new Date().toISOString();
        }

        affectedConnectionIds = Array.from(ods.connections.values())
          .filter(c => c.transfer_id === transferId)
          .map(c => c.connection_id);
        break;
      }

      case 'PassengerConnectionUpdated': {
        const groupId = payload.group_id;
        affectedConnectionIds = Array.from(ods.connections.values())
          .filter(c => c.passenger_group_id === groupId)
          .map(c => c.connection_id);
        break;
      }

      default:
        break;
    }

    // Re-evaluate every affected connection
    for (const connId of affectedConnectionIds) {
      await this.recalculateConnection(connId, event.correlation_id);
    }
  }

  async recalculateConnection(connectionId: string, correlationId?: string): Promise<RiskAssessment | null> {
    const conn = ods.connections.get(connectionId);
    if (!conn) return null;

    const flight = ods.journeys.get(conn.inbound_journey_id);
    const sailing = ods.journeys.get(conn.outbound_journey_id);
    const group = ods.passengerGroups.get(conn.passenger_group_id);
    const transfer = ods.transfers.get(conn.transfer_id);

    if (!flight || !sailing) {
      ods.recordAudit({
        correlation_id: correlationId || crypto.randomUUID(),
        entity_type: 'CONNECTION',
        entity_id: connectionId,
        action: 'CORRELATION_FAILED',
        actor_type: 'SYSTEM',
        actor_id: 'CORRELATION_ENGINE',
        new_value_json: JSON.stringify({ reason: 'Missing journey mapping' })
      });
      return null;
    }

    const prevHistory = ods.riskAssessments.get(connectionId) || [];
    const prevAssessment = prevHistory[0];

    // Compute fresh risk assessment
    const assessment = riskCalculator.evaluateConnection(conn, flight, sailing, group, transfer);

    // Save to ODS history (latest first)
    ods.riskAssessments.set(connectionId, [assessment, ...prevHistory]);
    conn.last_evaluated_utc = assessment.calculated_at_utc;

    // Record audit of risk calculation
    ods.recordAudit({
      correlation_id: correlationId || crypto.randomUUID(),
      entity_type: 'RISK',
      entity_id: assessment.risk_assessment_id,
      action: 'RISK_CALCULATED',
      actor_type: 'SYSTEM',
      actor_id: 'RISK_ENGINE',
      previous_value_json: prevAssessment ? JSON.stringify({ severity: prevAssessment.final_severity, margin: prevAssessment.connection_margin_minutes }) : undefined,
      new_value_json: JSON.stringify({ severity: assessment.final_severity, margin: assessment.connection_margin_minutes, score: assessment.risk_score, reasons: assessment.reason_codes })
    });

    // Stream into Databricks Medallion
    lakehouse.ingestAssessment(assessment, conn, flight, sailing, group);

    // If severity changed
    const severityChanged = !prevAssessment || prevAssessment.final_severity !== assessment.final_severity;

    if (severityChanged) {
      await eventHub.publish({
        event_id: `evt_risk_${crypto.randomUUID().slice(0, 8)}`,
        event_type: 'ConnectionRiskChanged',
        event_version: '1.0',
        event_time_utc: new Date().toISOString(),
        received_time_utc: new Date().toISOString(),
        source_system: 'CAR_RISK_ENGINE',
        source_entity_id: connectionId,
        site_code: conn.site_code,
        correlation_id: correlationId || crypto.randomUUID(),
        payload: {
          connection_id: connectionId,
          previous_severity: prevAssessment?.final_severity,
          new_severity: assessment.final_severity,
          margin_minutes: assessment.connection_margin_minutes,
          reasons: assessment.reason_codes
        }
      });

      // Delegate workflow action to CaseWorkflow
      await caseWorkflow.handleRiskAssessment(assessment, conn, prevAssessment);
    } else {
      // Even if severity didn't change, update margin/ETA in any existing active case
      caseWorkflow.syncCaseDetails(connectionId, assessment);
    }

    return assessment;
  }
}

export const correlationEngine = new CorrelationEngine();
