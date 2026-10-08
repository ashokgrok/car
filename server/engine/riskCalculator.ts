/**
 * Deterministic Risk Engine & Connection Window Calculator
 * Implements Section 16, 17, 18, 19, 20
 * Strictly mathematical & deterministic (NO LLM for risk calculation)
 */

import {
  Connection,
  Journey,
  PassengerGroup,
  Transfer,
  RiskAssessment,
  RiskSeverity,
  ReasonCode
} from '../../src/types/car';
import { ods } from '../state/store';

export class RiskCalculator {
  evaluateConnection(
    connection: Connection,
    inboundFlight: Journey,
    outboundSailing: Journey,
    passengerGroup?: PassengerGroup,
    transfer?: Transfer
  ): RiskAssessment {
    const siteCode = connection.site_code || 'SITE01';
    const config = ods.getSiteCalculationConfig(siteCode);

    // Durations in minutes configured specifically for this site
    let deplaningMinutes = config.default_deplaning_minutes;
    const airportExitMinutes = config.default_airport_exit_minutes;
    let transferMinutes = transfer?.current_duration_minutes ?? 20;
    const portProcessingMinutes = config.default_port_processing_minutes;
    const safetyBufferMinutes = config.default_safety_buffer_minutes;

    // Apply site-specific PRM or Group adjustment if applicable
    if (passengerGroup) {
      if (passengerGroup.prm_count > 0 && config.prm_transfer_multiplier && config.prm_transfer_multiplier > 1.0) {
        transferMinutes = Math.round(transferMinutes * config.prm_transfer_multiplier);
      }
      if (passengerGroup.passenger_count >= (config.large_group_threshold || 15)) {
        deplaningMinutes += (config.large_group_deplane_penalty || 10);
      }
    }

    // Step 1: Flight ETA
    const flightEtaMs = new Date(inboundFlight.estimated_arrival_utc).getTime();

    // Step 2: Predicted Airport Ready Time = Flight ETA + Deplaning + Airport Exit
    const airportReadyMs = flightEtaMs + (deplaningMinutes + airportExitMinutes) * 60000;

    // Step 3: Predicted Port Arrival = Predicted Airport Ready Time + Transfer Duration
    const portArrivalMs = airportReadyMs + transferMinutes * 60000;

    // Step 4: Predicted Ready-to-Board = Predicted Port Arrival + Port Processing + Safety Buffer
    const readyToBoardMs = portArrivalMs + (portProcessingMinutes + safetyBufferMinutes) * 60000;
    const readyToBoardUtc = new Date(readyToBoardMs).toISOString();

    // Boarding Close
    const boardingCloseMs = new Date(connection.boarding_close_utc).getTime();

    // Step 5: Connection Margin = Boarding Close - Predicted Ready-to-Board
    const marginMinutes = Math.round((boardingCloseMs - readyToBoardMs) / 60000);

    // Step 6: Determine Base Severity from Site-Specific Configurable Thresholds
    let baseSeverity: RiskSeverity = 'SAFE';
    let baseScore = 10;
    const reasonCodes: ReasonCode[] = [];

    if (inboundFlight.status === 'CANCELLED') {
      baseSeverity = 'CRITICAL';
      baseScore = 100;
      reasonCodes.push('FLIGHT_CANCELLED');
    } else if (outboundSailing.status === 'CANCELLED') {
      baseSeverity = 'CRITICAL';
      baseScore = 100;
      reasonCodes.push('FERRY_CANCELLED');
    } else if (marginMinutes <= config.critical_maximum_margin) {
      baseSeverity = 'CRITICAL';
      baseScore = 90 + Math.min(Math.abs(marginMinutes), 10);
      reasonCodes.push('NEGATIVE_CONNECTION_MARGIN');
    } else if (marginMinutes < config.watch_minimum_margin) {
      baseSeverity = 'AT_RISK';
      baseScore = 70 + Math.max(0, config.watch_minimum_margin - marginMinutes);
      reasonCodes.push('SHORT_CONNECTION_WINDOW');
    } else if (marginMinutes < config.safe_minimum_margin) {
      baseSeverity = 'WATCH';
      baseScore = 40 + Math.max(0, config.safe_minimum_margin - marginMinutes);
    } else {
      baseSeverity = 'SAFE';
      baseScore = 15;
    }

    // Flight delay reason
    const schedFlightMs = new Date(inboundFlight.scheduled_arrival_utc).getTime();
    if (flightEtaMs > schedFlightMs) {
      reasonCodes.push('FLIGHT_DELAY');
    }

    // Ferry delay reason
    const schedFerryMs = new Date(outboundSailing.scheduled_departure_utc).getTime();
    const estFerryMs = new Date(outboundSailing.estimated_departure_utc).getTime();
    if (estFerryMs > schedFerryMs) {
      reasonCodes.push('FERRY_DELAY');
    }

    // Transfer delay reason
    if (transfer && transfer.current_duration_minutes > transfer.base_duration_minutes) {
      reasonCodes.push('TRANSFER_DELAY');
    }

    // Step 7: Modifiers (Section 18)
    let finalScore = baseScore;
    let finalSeverity = baseSeverity;

    if (passengerGroup) {
      if (passengerGroup.passenger_count > 20) {
        reasonCodes.push('LARGE_GROUP');
        finalScore += 10;
        // Large group can elevate WATCH to AT_RISK if margin is tight
        if (baseSeverity === 'WATCH' && marginMinutes <= 22) {
          finalSeverity = 'AT_RISK';
        }
      }
      if (passengerGroup.prm_count > 0) {
        reasonCodes.push('PRM_PRESENT');
        finalScore += 5;
      }
    }

    // Check if last sailing of the day or alternative sailings
    const otherSailings = Array.from(ods.journeys.values()).filter(
      j => j.journey_type === 'SAILING' &&
           j.journey_id !== outboundSailing.journey_id &&
           new Date(j.estimated_departure_utc).getTime() > estFerryMs
    );

    if (otherSailings.length === 0) {
      reasonCodes.push('LAST_SAILING');
      reasonCodes.push('NO_ALTERNATIVE');
      finalScore += 15;
      if (finalSeverity === 'AT_RISK') {
        finalSeverity = 'CRITICAL';
      }
    }

    finalScore = Math.min(Math.max(finalScore, 0), 100);

    // Retrieve previous assessment to check for recovery or existing manual override
    const history = ods.riskAssessments.get(connection.connection_id) || [];
    const prev = history[0];

    if (prev && (prev.final_severity === 'CRITICAL' || prev.final_severity === 'AT_RISK')) {
      if (finalSeverity === 'SAFE' || finalSeverity === 'WATCH') {
        reasonCodes.push('RISK_RECOVERED');
      }
    }

    const assessment: RiskAssessment = {
      risk_assessment_id: `risk_${connection.connection_id}_${Date.now()}`,
      connection_id: connection.connection_id,
      calculated_at_utc: new Date().toISOString(),
      flight_eta_utc: inboundFlight.estimated_arrival_utc,
      deplaning_minutes: deplaningMinutes,
      airport_exit_minutes: airportExitMinutes,
      transfer_minutes: transferMinutes,
      port_processing_minutes: portProcessingMinutes,
      safety_buffer_minutes: safetyBufferMinutes,
      ready_to_board_utc: readyToBoardUtc,
      boarding_close_utc: connection.boarding_close_utc,
      connection_margin_minutes: marginMinutes,
      base_severity: baseSeverity,
      final_severity: finalSeverity,
      risk_score: finalScore,
      reason_codes: Array.from(new Set(reasonCodes)),
      rule_version: 'CAR-RULESET-1.0',
      human_override: prev?.human_override
    };

    // If there is an active human override, respect it while preserving the automated severity
    if (prev?.human_override?.overridden && prev.human_override.override_severity) {
      assessment.final_severity = prev.human_override.override_severity;
      if (!assessment.reason_codes.includes('MANUAL_OVERRIDE')) {
        assessment.reason_codes.push('MANUAL_OVERRIDE');
      }
    }

    return assessment;
  }
}

export const riskCalculator = new RiskCalculator();
