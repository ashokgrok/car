/**
 * Case, Alert & Workflow Management Engine
 * Sections 21, 22, 23, 24, 25, 26, 27
 * Implements strict state machines, SLA tracking, task generation,
 * intervention execution, and human override logic.
 */

import {
  Case,
  Alert,
  RiskAssessment,
  Connection,
  CaseStatus,
  CaseTask,
  Intervention,
  CaseComment,
  UserRole,
  RiskSeverity,
  ReasonCode
} from '../../src/types/car';
import { ods } from '../state/store';
import { eventHub } from '../events/bus';

export class CaseWorkflowEngine {
  async handleRiskAssessment(
    assessment: RiskAssessment,
    connection: Connection,
    prevAssessment?: RiskAssessment
  ): Promise<void> {
    const isHighRisk = assessment.final_severity === 'CRITICAL' || assessment.final_severity === 'AT_RISK';
    const wasHighRisk = prevAssessment && (prevAssessment.final_severity === 'CRITICAL' || prevAssessment.final_severity === 'AT_RISK');

    // Find any existing active case for this connection
    const existingCase = Array.from(ods.cases.values()).find(
      c => c.connection_id === connection.connection_id && c.status !== 'CLOSED' && c.status !== 'CANCELLED'
    );

    // Case 1: High risk detected and NO active case exists -> Create Alert & Case
    if (isHighRisk && !existingCase) {
      await this.createAlertAndCase(assessment, connection);
    }
    // Case 2: High risk detected and active case ALREADY exists -> Update existing case (Escalate or sync)
    else if (isHighRisk && existingCase) {
      this.updateExistingCase(existingCase, assessment);
    }
    // Case 3: Risk recovered (was High Risk, now WATCH or SAFE)
    else if (!isHighRisk && wasHighRisk && existingCase) {
      this.handleRiskRecovery(existingCase, assessment);
    }
  }

  syncCaseDetails(connectionId: string, assessment: RiskAssessment) {
    const existingCase = Array.from(ods.cases.values()).find(
      c => c.connection_id === connectionId && c.status !== 'CLOSED' && c.status !== 'CANCELLED'
    );
    if (existingCase) {
      existingCase.row_version += 1;
    }
  }

  private async createAlertAndCase(assessment: RiskAssessment, connection: Connection): Promise<{ alert: Alert; caseObj: Case }> {
    const alertId = `alt_${connection.connection_id}_${Date.now()}`;
    const deduplicationKey = `${connection.connection_id}_${assessment.final_severity}`;

    const alert: Alert = {
      alert_id: alertId,
      connection_id: connection.connection_id,
      risk_assessment_id: assessment.risk_assessment_id,
      severity: assessment.final_severity,
      status: 'OPEN',
      detected_at: assessment.calculated_at_utc,
      deduplication_key: deduplicationKey,
      escalation_level: assessment.final_severity === 'CRITICAL' ? 2 : 1
    };
    ods.alerts.set(alertId, alert);

    const caseCount = ods.cases.size + 1;
    const caseId = `case_${connection.connection_id}_${Date.now()}`;
    const caseNumber = `CAR-CASE-${String(caseCount).padStart(3, '0')}`;
    const slaMinutes = assessment.final_severity === 'CRITICAL' 
      ? ods.config.sla_critical_minutes 
      : ods.config.sla_at_risk_minutes;

    const caseObj: Case = {
      case_id: caseId,
      case_number: caseNumber,
      connection_id: connection.connection_id,
      alert_id: alertId,
      priority: assessment.final_severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      status: 'NEW',
      assigned_team: 'Airport-Port Integrated Ops',
      created_at: new Date().toISOString(),
      sla_due_at: new Date(Date.now() + slaMinutes * 60000).toISOString(),
      row_version: 1
    };
    ods.cases.set(caseId, caseObj);

    // Create standard tasks & recommended interventions
    ods.createStandardTasks(caseObj, assessment.final_severity);

    // Record audit
    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CASE',
      entity_id: caseId,
      action: 'CASE_CREATED',
      actor_type: 'SYSTEM',
      actor_id: 'WORKFLOW_ENGINE',
      new_value_json: JSON.stringify({
        case_number: caseNumber,
        severity: assessment.final_severity,
        margin: assessment.connection_margin_minutes
      })
    });

    await eventHub.publish({
      event_id: `evt_case_${crypto.randomUUID().slice(0, 8)}`,
      event_type: 'CaseCreated',
      event_version: '1.0',
      event_time_utc: new Date().toISOString(),
      received_time_utc: new Date().toISOString(),
      source_system: 'CAR_CASE_SERVICE',
      source_entity_id: caseId,
      site_code: connection.site_code,
      correlation_id: crypto.randomUUID(),
      payload: {
        case_id: caseId,
        case_number: caseNumber,
        severity: assessment.final_severity,
        connection_id: connection.connection_id
      }
    });

    return { alert, caseObj };
  }

  private updateExistingCase(existingCase: Case, assessment: RiskAssessment) {
    const prevPriority = existingCase.priority;
    if (assessment.final_severity === 'CRITICAL' && existingCase.priority !== 'CRITICAL') {
      existingCase.priority = 'CRITICAL';
      existingCase.sla_due_at = new Date(Date.now() + ods.config.sla_critical_minutes * 60000).toISOString();
      existingCase.row_version += 1;

      ods.recordAudit({
        correlation_id: crypto.randomUUID(),
        entity_type: 'CASE',
        entity_id: existingCase.case_id,
        action: 'CASE_ESCALATED',
        actor_type: 'SYSTEM',
        actor_id: 'WORKFLOW_ENGINE',
        previous_value_json: JSON.stringify({ priority: prevPriority }),
        new_value_json: JSON.stringify({ priority: 'CRITICAL', margin: assessment.connection_margin_minutes })
      });
    }
  }

  private handleRiskRecovery(existingCase: Case, assessment: RiskAssessment) {
    // Risk de-escalated to SAFE or WATCH (e.g. Ferry held/delayed)
    existingCase.row_version += 1;

    // Add automated case comment
    const commentId = `cmt_${Date.now()}`;
    const comment: CaseComment = {
      comment_id: commentId,
      case_id: existingCase.case_id,
      author_name: 'Risk Engine',
      author_role: 'CAR_SUPERVISOR',
      text: `Operational condition improved. Connection margin recalculated to +${assessment.connection_margin_minutes} min (${assessment.final_severity}). Risk recovered.`,
      timestamp_utc: new Date().toISOString()
    };

    const currentComments = ods.comments.get(existingCase.case_id) || [];
    ods.comments.set(existingCase.case_id, [...currentComments, comment]);

    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CASE',
      entity_id: existingCase.case_id,
      action: 'RISK_RECOVERED',
      actor_type: 'SYSTEM',
      actor_id: 'RISK_ENGINE',
      new_value_json: JSON.stringify({
        new_severity: assessment.final_severity,
        margin: assessment.connection_margin_minutes
      })
    });
  }

  // Case State Transitions (Section 22)
  transitionCaseStatus(caseId: string, targetStatus: CaseStatus, actor: string, actorRole: UserRole): Case {
    const c = ods.cases.get(caseId);
    if (!c) throw new Error(`Case ${caseId} not found`);

    const validTransitions: Record<CaseStatus, CaseStatus[]> = {
      NEW: ['ACKNOWLEDGED', 'CANCELLED'],
      ACKNOWLEDGED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['RESOLVED', 'CANCELLED'],
      RESOLVED: ['CLOSED', 'IN_PROGRESS'],
      CLOSED: [],
      CANCELLED: []
    };

    const allowed = validTransitions[c.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new Error(`Invalid transition from ${c.status} to ${targetStatus}`);
    }

    const prevStatus = c.status;
    c.status = targetStatus;
    c.row_version += 1;

    if (targetStatus === 'RESOLVED') {
      c.resolved_at = new Date().toISOString();
      c.outcome_code = 'MADE_CONNECTION';
    } else if (targetStatus === 'CLOSED') {
      c.closed_at = new Date().toISOString();
    }

    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CASE',
      entity_id: c.case_id,
      action: `CASE_STATUS_${targetStatus}`,
      actor_type: 'USER',
      actor_id: actor,
      previous_value_json: JSON.stringify({ status: prevStatus }),
      new_value_json: JSON.stringify({ status: targetStatus, role: actorRole })
    });

    return c;
  }

  claimCase(caseId: string, userName: string, userRole: UserRole): Case {
    const c = ods.cases.get(caseId);
    if (!c) throw new Error(`Case ${caseId} not found`);

    c.assigned_user = userName;
    if (c.status === 'NEW') {
      c.status = 'ACKNOWLEDGED';
    }
    c.row_version += 1;

    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CASE',
      entity_id: c.case_id,
      action: 'CASE_CLAIMED',
      actor_type: 'USER',
      actor_id: userName,
      new_value_json: JSON.stringify({ assigned_user: userName, status: c.status })
    });

    return c;
  }

  // Human Override (Section 27)
  applyHumanOverride(
    connectionId: string,
    overrideSeverity: RiskSeverity,
    reasonCode: ReasonCode,
    commentText: string,
    actorName: string
  ): RiskAssessment {
    const history = ods.riskAssessments.get(connectionId) || [];
    const latest = history[0];
    if (!latest) throw new Error(`No risk assessment found for connection ${connectionId}`);

    const prevSeverity = latest.final_severity;

    const overrideAssessment: RiskAssessment = {
      ...latest,
      risk_assessment_id: `risk_ovr_${Date.now()}`,
      calculated_at_utc: new Date().toISOString(),
      final_severity: overrideSeverity,
      reason_codes: Array.from(new Set([...latest.reason_codes, 'MANUAL_OVERRIDE', reasonCode])),
      human_override: {
        overridden: true,
        original_severity: latest.base_severity,
        override_severity: overrideSeverity,
        reason_code: reasonCode,
        comment: commentText,
        actor_id: actorName,
        timestamp_utc: new Date().toISOString()
      }
    };

    ods.riskAssessments.set(connectionId, [overrideAssessment, ...history]);

    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'RISK',
      entity_id: overrideAssessment.risk_assessment_id,
      action: 'HUMAN_OVERRIDE_APPLIED',
      actor_type: 'USER',
      actor_id: actorName,
      previous_value_json: JSON.stringify({ automated_severity: latest.base_severity, previous_final: prevSeverity }),
      new_value_json: JSON.stringify({ override_severity: overrideSeverity, reason: reasonCode, comment: commentText })
    });

    // Also update any open case priority
    const activeCase = Array.from(ods.cases.values()).find(
      c => c.connection_id === connectionId && c.status !== 'CLOSED' && c.status !== 'CANCELLED'
    );
    if (activeCase) {
      if (overrideSeverity === 'CRITICAL') {
        activeCase.priority = 'CRITICAL';
      } else if (overrideSeverity === 'SAFE' || overrideSeverity === 'WATCH') {
        activeCase.priority = 'LOW';
      }
      activeCase.row_version += 1;
    }

    return overrideAssessment;
  }
}

export const caseWorkflow = new CaseWorkflowEngine();
