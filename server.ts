/**
 * Connection-at-Risk (CaR) Full-Stack Express Server
 * Implements Sections 47–56 REST APIs, Event Hubs streaming,
 * Databricks Medallion simulation, and Vite development middleware.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ods } from './server/state/store';
import { correlationEngine } from './server/engine/correlation';
import { caseWorkflow } from './server/engine/caseWorkflow';
import { scenarioRunner } from './server/simulation/scenarioRunner';
import { lakehouse } from './server/engine/lakehouse';
import { eventHub } from './server/events/bus';
import { RiskSeverity, ReasonCode } from './src/types/car';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ----------------------------------------------------
  // Real-Time Server-Sent Events (SSE) Stream
  // ----------------------------------------------------
  const sseClients = new Set<express.Response>();

  function broadcastSSE(data: { type: string; payload?: any }) {
    const payloadStr = JSON.stringify({ ...data, timestamp: new Date().toISOString() });
    const message = `data: ${payloadStr}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch (e) {
        sseClients.delete(client);
      }
    }
  }

  // Subscribe to Event Hub broadcasts to notify connected clients in real time
  eventHub.subscribeBroadcast((eventData) => {
    broadcastSSE(eventData);
  });

  app.get('/api/v1/stream/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);

    // Initial handshake
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (e) {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // ----------------------------------------------------
  // Personas / Demo Auth (Section 28, 29, 31)
  // ----------------------------------------------------
  app.get('/api/v1/auth/personas', (req, res) => {
    res.json({
      currentUser: ods.currentUser,
      personas: ods.personas
    });
  });

  app.post('/api/v1/auth/personas/switch', (req, res) => {
    const { persona_id } = req.body;
    if (!persona_id) {
      return res.status(400).json({ error: { message: 'persona_id is required' } });
    }
    const user = ods.setCurrentUser(persona_id);
    res.json({ currentUser: user });
  });

  // ----------------------------------------------------
  // Dashboard & Control Tower APIs (Section 32, 56)
  // ----------------------------------------------------
  app.get('/api/v1/dashboard/summary', (req, res) => {
    try {
      const siteCode = req.query.site_code as string;
      const kpis = lakehouse.calculateGoldKPIs();
      let allCases = Array.from(ods.cases.values());

      if (siteCode && siteCode !== 'ALL') {
        allCases = allCases.filter(c => {
          const conn = ods.connections.get(c.connection_id);
          return conn && conn.site_code === siteCode;
        });
      }

      const openCases = allCases.filter(c => c.status !== 'CLOSED' && c.status !== 'CANCELLED').length;

      // SLA breaches
      const now = Date.now();
      const slaBreaches = allCases.filter(
        c => (c.status === 'NEW' || c.status === 'ACKNOWLEDGED' || c.status === 'IN_PROGRESS') &&
             new Date(c.sla_due_at).getTime() < now
      ).length;

      res.json({
        kpis,
        openCases,
        slaBreaches
      });
    } catch (err: any) {
      console.error('Error in /api/v1/dashboard/summary:', err);
      res.status(500).json({ error: { message: err?.message || 'Failed to calculate dashboard summary' } });
    }
  });

  app.get('/api/v1/dashboard/risk-distribution', (req, res) => {
    try {
      const siteCode = req.query.site_code as string;
      const counts: Record<string, number> = { SAFE: 0, WATCH: 0, AT_RISK: 0, CRITICAL: 0 };
      for (const [connId, conn] of ods.connections.entries()) {
        if (siteCode && siteCode !== 'ALL' && conn.site_code !== siteCode) continue;
        const h = ods.riskAssessments.get(connId) || [];
        const latest = h[0];
        if (latest && latest.final_severity) {
          counts[latest.final_severity] = (counts[latest.final_severity] || 0) + 1;
        }
      }
      res.json(counts);
    } catch (err: any) {
      console.error('Error in /api/v1/dashboard/risk-distribution:', err);
      res.status(500).json({ error: { message: err?.message || 'Failed to calculate risk distribution' } });
    }
  });

  app.get('/api/v1/dashboard/activity', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      res.json(ods.auditLog.slice(0, limit));
    } catch (err: any) {
      console.error('Error in /api/v1/dashboard/activity:', err);
      res.status(500).json({ error: { message: err?.message || 'Failed to load activity' } });
    }
  });

  // ----------------------------------------------------
  // Connections APIs (Section 50)
  // ----------------------------------------------------
  app.get('/api/v1/connections', (req, res) => {
    try {
      const { severity, status, search, site_code } = req.query;

      let items = Array.from(ods.connections.values()).map(conn => {
        const flight = ods.journeys.get(conn.inbound_journey_id);
        const sailing = ods.journeys.get(conn.outbound_journey_id);
        const group = ods.passengerGroups.get(conn.passenger_group_id);
        const transfer = ods.transfers.get(conn.transfer_id);
        const riskHistory = ods.riskAssessments.get(conn.connection_id) || [];
        const latestRisk = riskHistory[0];
        const activeCase = Array.from(ods.cases.values()).find(
          c => c.connection_id === conn.connection_id && c.status !== 'CLOSED' && c.status !== 'CANCELLED'
        );

        return {
          connection: conn,
          flight,
          sailing,
          group,
          transfer,
          latestRisk,
          activeCase
        };
      });

      if (site_code && site_code !== 'ALL') {
        items = items.filter(item => item.connection.site_code === site_code);
      }
      if (severity) {
        items = items.filter(item => item.latestRisk?.final_severity === severity);
      }
      if (status) {
        items = items.filter(item => item.connection.connection_status === status);
      }
      if (search) {
        const q = String(search).toLowerCase();
        items = items.filter(item =>
          item.connection.connection_id.toLowerCase().includes(q) ||
          item.flight?.service_number.toLowerCase().includes(q) ||
          item.sailing?.service_number.toLowerCase().includes(q) ||
          item.group?.group_reference_token.toLowerCase().includes(q) ||
          item.group?.pnr_token.toLowerCase().includes(q)
        );
      }

      res.json({
        items,
        total: items.length
      });
    } catch (err: any) {
      console.error('Error in /api/v1/connections:', err);
      res.status(500).json({ error: { message: err?.message || 'Failed to load connections' } });
    }
  });

  app.get('/api/v1/connections/:id', (req, res) => {
    const conn = ods.connections.get(req.params.id);
    if (!conn) {
      return res.status(404).json({ error: { message: 'Connection not found' } });
    }

    const flight = ods.journeys.get(conn.inbound_journey_id);
    const sailing = ods.journeys.get(conn.outbound_journey_id);
    const group = ods.passengerGroups.get(conn.passenger_group_id);
    const transfer = ods.transfers.get(conn.transfer_id);
    const riskHistory = ods.riskAssessments.get(conn.connection_id) || [];
    const activeCase = Array.from(ods.cases.values()).find(
      c => c.connection_id === conn.connection_id && c.status !== 'CLOSED' && c.status !== 'CANCELLED'
    );

    res.json({
      connection: conn,
      flight,
      sailing,
      group,
      transfer,
      latestRisk: riskHistory[0],
      riskHistory,
      activeCase
    });
  });

  app.get('/api/v1/connections/:id/risk-history', (req, res) => {
    const history = ods.riskAssessments.get(req.params.id) || [];
    res.json(history);
  });

  app.get('/api/v1/connections/:id/alternate-sailings', (req, res) => {
    const conn = ods.connections.get(req.params.id);
    if (!conn) return res.status(404).json({ error: { message: 'Connection not found' } });

    const flight = ods.journeys.get(conn.inbound_journey_id);
    const currentSailing = ods.journeys.get(conn.outbound_journey_id);
    const group = ods.passengerGroups.get(conn.passenger_group_id);
    const transfer = ods.transfers.get(conn.transfer_id);

    if (!flight || !currentSailing) {
      return res.status(400).json({ error: { message: 'Missing journey data for connection' } });
    }

    const flightEtaMs = new Date(flight.estimated_arrival_utc).getTime();
    const config = ods.config;
    const transferMins = transfer?.current_duration_minutes ?? 20;
    const readyToBoardMs = flightEtaMs + (
      config.default_deplaning_minutes +
      config.default_airport_exit_minutes +
      transferMins +
      config.default_port_processing_minutes +
      config.default_safety_buffer_minutes
    ) * 60000;

    // Filter candidate sailings
    const candidates: any[] = [];
    const paxCount = group?.passenger_count || 1;

    for (const j of ods.journeys.values()) {
      if (j.journey_type !== 'SAILING') continue;
      if (j.journey_id === conn.outbound_journey_id) continue;
      if (j.status === 'CANCELLED') continue;
      // Match destination
      if (j.destination_code !== currentSailing.destination_code) continue;

      const departMs = new Date(j.estimated_departure_utc).getTime();
      const boardingCloseMs = departMs - 15 * 60000;
      const marginMinutes = Math.round((boardingCloseMs - readyToBoardMs) / 60000);

      const totalCapacity = 180;
      let availableSeats = 65;
      if (j.journey_id === 'sailing-f207') availableSeats = 72;
      else if (j.journey_id === 'sailing-f209') availableSeats = 114;
      else if (j.journey_id === 'sailing-f211') availableSeats = 95;
      else {
        const hash = j.service_number.charCodeAt(1) || 50;
        availableSeats = 40 + (hash % 80);
      }

      let severity: RiskSeverity = 'SAFE';
      if (marginMinutes <= 0) severity = 'CRITICAL';
      else if (marginMinutes <= 15) severity = 'AT_RISK';
      else if (marginMinutes <= 30) severity = 'WATCH';
      else severity = 'SAFE';

      const recommended = marginMinutes >= 15 && availableSeats >= paxCount;

      candidates.push({
        sailing_id: j.journey_id,
        service_number: j.service_number,
        origin_code: j.origin_code,
        destination_code: j.destination_code,
        scheduled_departure_utc: j.scheduled_departure_utc,
        boarding_close_utc: new Date(boardingCloseMs).toISOString(),
        status: j.status,
        gate_or_berth: j.gate_or_berth || 'Berth 2',
        available_seats: availableSeats,
        total_capacity: totalCapacity,
        projected_margin_minutes: marginMinutes,
        projected_severity: severity,
        recommended
      });
    }

    // Sort by departure time
    candidates.sort((a, b) => new Date(a.scheduled_departure_utc).getTime() - new Date(b.scheduled_departure_utc).getTime());

    res.json({
      connection_id: conn.connection_id,
      current_sailing: currentSailing,
      flight_eta: flight.estimated_arrival_utc,
      ready_to_board_utc: new Date(readyToBoardMs).toISOString(),
      passengers_to_protect: paxCount,
      alternates: candidates
    });
  });

  app.post('/api/v1/connections/:id/rebook', async (req, res) => {
    const { new_sailing_journey_id, reason, note } = req.body;
    if (!new_sailing_journey_id) {
      return res.status(400).json({ error: { message: 'new_sailing_journey_id is required' } });
    }

    const conn = ods.connections.get(req.params.id);
    if (!conn) return res.status(404).json({ error: { message: 'Connection not found' } });

    const newSailing = ods.journeys.get(new_sailing_journey_id);
    if (!newSailing) return res.status(404).json({ error: { message: 'Selected alternate sailing not found' } });

    const oldSailing = ods.journeys.get(conn.outbound_journey_id);
    const oldSailingNumber = oldSailing?.service_number || 'Previous Sailing';

    // Update connection with new sailing
    conn.outbound_journey_id = new_sailing_journey_id;
    const departMs = new Date(newSailing.estimated_departure_utc).getTime();
    conn.boarding_close_utc = new Date(departMs - 15 * 60000).toISOString();
    conn.connection_status = 'ACTIVE';

    // Recalculate risk deterministically
    const assessment = await correlationEngine.recalculateConnection(conn.connection_id);

    // Update active case if one exists
    const activeCase = Array.from(ods.cases.values()).find(
      c => c.connection_id === conn.connection_id && c.status !== 'CLOSED' && c.status !== 'CANCELLED'
    );

    const currentActor = ods.currentUser.name;
    const currentRole = ods.currentUser.role;

    if (activeCase) {
      activeCase.outcome_code = 'PROTECTED_ON_ALTERNATE';
      if (assessment && (assessment.final_severity === 'SAFE' || assessment.final_severity === 'WATCH')) {
        if (activeCase.status === 'NEW' || activeCase.status === 'ACKNOWLEDGED') {
          activeCase.status = 'IN_PROGRESS';
        }
      }

      // Add rebooking confirmation task
      const rebookTaskId = `tsk-rebook-${Date.now()}`;
      ods.tasks.set(rebookTaskId, {
        task_id: rebookTaskId,
        case_id: activeCase.case_id,
        task_type: 'OPERATIONAL_CHECK',
        title: `Rebooking Confirmed - Alternate Boarding Passes Issued for ${newSailing.service_number}`,
        description: `Transferred group from ${oldSailingNumber} to ${newSailing.service_number} departing ${newSailing.scheduled_departure_utc} at ${newSailing.gate_or_berth}.`,
        assigned_role: 'CAR_DUTY_MANAGER',
        assigned_user: currentActor,
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        due_at: new Date().toISOString(),
        sequence: 99
      });

      // Mark MOVE_TO_ALTERNATE_SAILING intervention selected & completed
      const altIntervention = Array.from(ods.interventions.values()).find(
        i => i.case_id === activeCase.case_id && i.intervention_type === 'MOVE_TO_ALTERNATE_SAILING'
      );
      if (altIntervention) {
        altIntervention.selected = true;
        altIntervention.status = 'EXECUTED';
        altIntervention.completed_at = new Date().toISOString();
      }

      // Add case comment
      const commentList = ods.comments.get(activeCase.case_id) || [];
      commentList.push({
        comment_id: `cmt_${Date.now()}_rebook`,
        case_id: activeCase.case_id,
        author_name: currentActor,
        author_role: currentRole,
        text: `[REBOOKING CONFIRMED] Group successfully protected onto alternate sailing ${newSailing.service_number} (Departure: ${newSailing.scheduled_departure_utc}, Berth: ${newSailing.gate_or_berth}). Projected margin: +${assessment?.connection_margin_minutes || 0}m. ${note || reason || ''}`,
        timestamp_utc: new Date().toISOString()
      });
      ods.comments.set(activeCase.case_id, commentList);
    }

    // Record audit log
    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CONNECTION',
      entity_id: conn.connection_id,
      action: 'SAILING_REBOOKED',
      actor_type: 'USER',
      actor_id: currentActor,
      previous_value_json: JSON.stringify({ outbound_journey_id: oldSailing?.journey_id, service_number: oldSailingNumber }),
      new_value_json: JSON.stringify({
        outbound_journey_id: newSailing.journey_id,
        service_number: newSailing.service_number,
        departure: newSailing.scheduled_departure_utc,
        new_margin: assessment?.connection_margin_minutes,
        new_severity: assessment?.final_severity,
        reason: reason || 'Alternate sailing rebooking'
      })
    });

    broadcastSSE({
      type: 'SAILING_REBOOKED',
      payload: {
        connection_id: conn.connection_id,
        new_sailing_id: newSailing.journey_id,
        service_number: newSailing.service_number,
        new_severity: assessment?.final_severity,
        new_margin: assessment?.connection_margin_minutes
      }
    });

    res.json({
      success: true,
      connection: conn,
      new_sailing: newSailing,
      assessment,
      activeCase
    });
  });

  app.post('/api/v1/connections/:id/recalculate', async (req, res) => {
    const assessment = await correlationEngine.recalculateConnection(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: { message: 'Could not recalculate connection' } });
    }
    res.json({ assessment });
  });

  // ----------------------------------------------------
  // Risk & Human Override APIs (Section 27, 51)
  // ----------------------------------------------------
  app.post('/api/v1/risks/:id/override', (req, res) => {
    const { new_severity, reason_code, comment } = req.body;
    if (!new_severity || !reason_code || !comment) {
      return res.status(400).json({ error: { message: 'new_severity, reason_code, and comment are required for human override' } });
    }

    try {
      const assessment = caseWorkflow.applyHumanOverride(
        req.params.id,
        new_severity as RiskSeverity,
        reason_code as ReasonCode,
        comment,
        `${ods.currentUser.name} (${ods.currentUser.role})`
      );
      broadcastSSE({ type: 'OVERRIDE_APPLIED', payload: { risk_assessment_id: req.params.id, new_severity } });
      res.json({ assessment });
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  // ----------------------------------------------------
  // Cases & Workflow APIs (Section 52, 53, 54)
  // ----------------------------------------------------
  app.get('/api/v1/cases', (req, res) => {
    const { status, priority, severity, site_code } = req.query;
    let list = Array.from(ods.cases.values()).map(c => {
      const conn = ods.connections.get(c.connection_id);
      const flight = conn ? ods.journeys.get(conn.inbound_journey_id) : undefined;
      const sailing = conn ? ods.journeys.get(conn.outbound_journey_id) : undefined;
      const group = conn ? ods.passengerGroups.get(conn.passenger_group_id) : undefined;
      const riskHistory = ods.riskAssessments.get(c.connection_id) || [];
      const latestRisk = riskHistory[0];

      return {
        caseItem: c,
        connection: conn,
        flight,
        sailing,
        group,
        latestRisk
      };
    });

    if (site_code && site_code !== 'ALL') {
      list = list.filter(item => item.connection?.site_code === site_code);
    }
    if (status) {
      list = list.filter(item => item.caseItem.status === status);
    }
    if (priority) {
      list = list.filter(item => item.caseItem.priority === priority);
    }
    if (severity) {
      list = list.filter(item => item.latestRisk?.final_severity === severity);
    }

    // Default sorting: CRITICAL first, then nearest SLA breach, then lowest margin
    list.sort((a, b) => {
      const sevOrder: Record<string, number> = { CRITICAL: 0, AT_RISK: 1, WATCH: 2, SAFE: 3 };
      const sA = sevOrder[a.latestRisk?.final_severity || 'SAFE'];
      const sB = sevOrder[b.latestRisk?.final_severity || 'SAFE'];
      if (sA !== sB) return sA - sB;

      const dueA = new Date(a.caseItem.sla_due_at).getTime();
      const dueB = new Date(b.caseItem.sla_due_at).getTime();
      return dueA - dueB;
    });

    res.json({ items: list, total: list.length });
  });

  app.get('/api/v1/cases/:id', (req, res) => {
    const c = ods.cases.get(req.params.id);
    if (!c) {
      return res.status(404).json({ error: { message: 'Case not found' } });
    }

    const conn = ods.connections.get(c.connection_id);
    const flight = conn ? ods.journeys.get(conn.inbound_journey_id) : undefined;
    const sailing = conn ? ods.journeys.get(conn.outbound_journey_id) : undefined;
    const group = conn ? ods.passengerGroups.get(conn.passenger_group_id) : undefined;
    const transfer = conn ? ods.transfers.get(conn.transfer_id) : undefined;
    const riskHistory = ods.riskAssessments.get(c.connection_id) || [];
    const latestRisk = riskHistory[0];

    const tasks = Array.from(ods.tasks.values()).filter(t => t.case_id === c.case_id);
    const interventions = Array.from(ods.interventions.values()).filter(i => i.case_id === c.case_id);
    const comments = ods.comments.get(c.case_id) || [];

    // Filter audit events relevant to this case or connection
    const relevantAudit = ods.auditLog.filter(
      a => a.entity_id === c.case_id || a.entity_id === c.connection_id || a.entity_id === latestRisk?.risk_assessment_id
    );

    res.json({
      caseItem: c,
      connection: conn,
      flight,
      sailing,
      group,
      transfer,
      latestRisk,
      riskHistory,
      tasks,
      interventions,
      comments,
      auditTimeline: relevantAudit
    });
  });

  app.post('/api/v1/cases/:id/claim', (req, res) => {
    try {
      const updated = caseWorkflow.claimCase(req.params.id, ods.currentUser.name, ods.currentUser.role);
      broadcastSSE({ type: 'CASE_CLAIMED', payload: { case_id: req.params.id, user: ods.currentUser.name } });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/cases/:id/status', (req, res) => {
    const { status } = req.body;
    try {
      const updated = caseWorkflow.transitionCaseStatus(req.params.id, status, ods.currentUser.name, ods.currentUser.role);
      broadcastSSE({ type: 'CASE_STATUS_CHANGED', payload: { case_id: req.params.id, status } });
      res.json(updated);
    } catch (err: any) {
      res.status(409).json({ error: { code: 'INVALID_CASE_TRANSITION', message: err.message } });
    }
  });

  // Batch Case Operations (Section 22, Bulk Triage)
  app.post('/api/v1/cases/batch', (req, res) => {
    const { case_ids, action, assigned_to, assigned_team, status, note } = req.body;
    if (!Array.isArray(case_ids) || case_ids.length === 0) {
      return res.status(400).json({ error: { message: 'case_ids array is required and cannot be empty' } });
    }

    const updatedCases: any[] = [];
    const currentActor = ods.currentUser.name;
    const currentRole = ods.currentUser.role;

    for (const id of case_ids) {
      const c = ods.cases.get(id);
      if (!c) continue;

      if (action === 'ACKNOWLEDGE') {
        if (c.status === 'NEW') {
          c.status = 'ACKNOWLEDGED';
          c.assigned_user = c.assigned_user || currentActor;
        }
      } else if (action === 'ASSIGN') {
        if (assigned_to) c.assigned_user = assigned_to;
        if (assigned_team) c.assigned_team = assigned_team;
        if (c.status === 'NEW') c.status = 'ACKNOWLEDGED';
      } else if (action === 'STATUS_CHANGE' && status) {
        c.status = status as any;
        if (status === 'RESOLVED') c.resolved_at = new Date().toISOString();
        if (status === 'CLOSED') c.closed_at = new Date().toISOString();
      } else if (action === 'RESOLVE') {
        c.status = 'RESOLVED';
        c.resolved_at = new Date().toISOString();
      }

      if (note) {
        const commentList = ods.comments.get(c.case_id) || [];
        commentList.push({
          comment_id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          case_id: c.case_id,
          author_name: currentActor,
          author_role: currentRole,
          text: `[Bulk Action: ${action}] ${note}`,
          timestamp_utc: new Date().toISOString()
        });
        ods.comments.set(c.case_id, commentList);
      }

      ods.recordAudit({
        correlation_id: crypto.randomUUID(),
        entity_type: 'CASE',
        entity_id: c.case_id,
        action: `BATCH_${action}`,
        actor_type: 'USER',
        actor_id: currentActor,
        new_value_json: JSON.stringify({ action, assigned_to, assigned_team, status, note })
      });

      updatedCases.push(c);
    }

    broadcastSSE({ type: 'CASES_BATCH_UPDATED', payload: { count: updatedCases.length, action, case_ids } });
    res.json({ success: true, updated_count: updatedCases.length, cases: updatedCases });
  });

  // Task actions
  app.post('/api/v1/tasks/:id/complete', (req, res) => {
    const task = ods.tasks.get(req.params.id);
    if (!task) return res.status(404).json({ error: { message: 'Task not found' } });

    // Enforce task dependency sequencing
    if (task.dependency_task_id) {
      const prerequisite = ods.tasks.get(task.dependency_task_id);
      if (prerequisite && prerequisite.status !== 'COMPLETED') {
        return res.status(400).json({
          error: {
            code: 'PREREQUISITE_NOT_MET',
            message: `Cannot complete task until prerequisite "${prerequisite.title}" (Step ${prerequisite.sequence}) is completed.`
          }
        });
      }
    }

    task.status = 'COMPLETED';
    task.completed_at = new Date().toISOString();
    task.assigned_user = ods.currentUser.name;

    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'TASK',
      entity_id: task.task_id,
      action: 'TASK_COMPLETED',
      actor_type: 'USER',
      actor_id: ods.currentUser.name,
      new_value_json: JSON.stringify({ task_id: task.task_id, title: task.title })
    });

    broadcastSSE({ type: 'TASK_COMPLETED', payload: { task_id: task.task_id, case_id: task.case_id } });
    res.json(task);
  });

  // Interventions
  app.post('/api/v1/cases/:id/interventions/select', (req, res) => {
    const { intervention_id } = req.body;
    const intervention = ods.interventions.get(intervention_id);
    if (!intervention) return res.status(404).json({ error: { message: 'Intervention not found' } });

    intervention.selected = true;
    intervention.status = 'IN_PROGRESS';

    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'INTERVENTION',
      entity_id: intervention.intervention_id,
      action: 'INTERVENTION_SELECTED',
      actor_type: 'USER',
      actor_id: ods.currentUser.name,
      new_value_json: JSON.stringify({ type: intervention.intervention_type, title: intervention.title })
    });

    broadcastSSE({ type: 'INTERVENTION_SELECTED', payload: { case_id: req.params.id, intervention_id } });
    res.json(intervention);
  });

  app.post('/api/v1/interventions/:id/complete', (req, res) => {
    const intervention = ods.interventions.get(req.params.id);
    if (!intervention) return res.status(404).json({ error: { message: 'Intervention not found' } });

    intervention.status = 'EXECUTED';
    intervention.completed_at = new Date().toISOString();
    intervention.outcome = 'Intervention completed successfully by operational personnel.';

    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'INTERVENTION',
      entity_id: intervention.intervention_id,
      action: 'INTERVENTION_COMPLETED',
      actor_type: 'USER',
      actor_id: ods.currentUser.name,
      new_value_json: JSON.stringify({ status: 'EXECUTED' })
    });

    broadcastSSE({ type: 'INTERVENTION_COMPLETED', payload: { intervention_id: req.params.id, case_id: intervention.case_id } });
    res.json(intervention);
  });

  // Case comments
  app.post('/api/v1/cases/:id/comments', (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: { message: 'Comment text is required' } });

    const comment = {
      comment_id: `cmt_${Date.now()}`,
      case_id: req.params.id,
      author_name: ods.currentUser.name,
      author_role: ods.currentUser.role,
      text,
      timestamp_utc: new Date().toISOString()
    };

    const list = ods.comments.get(req.params.id) || [];
    ods.comments.set(req.params.id, [...list, comment]);

    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CASE',
      entity_id: req.params.id,
      action: 'COMMENT_ADDED',
      actor_type: 'USER',
      actor_id: ods.currentUser.name,
      new_value_json: JSON.stringify({ text })
    });

    broadcastSSE({ type: 'COMMENT_ADDED', payload: { case_id: req.params.id } });
    res.json(comment);
  });

  // ----------------------------------------------------
  // Mock External Systems & Disruptions (Section 48, 49)
  // ----------------------------------------------------
  app.get('/api/v1/mock/aodb/flights', (req, res) => {
    const flights = Array.from(ods.journeys.values()).filter(j => j.journey_type === 'FLIGHT');
    res.json(flights);
  });

  app.post('/api/v1/mock/aodb/flights/:id/delay', async (req, res) => {
    const { delay_minutes } = req.body;
    await scenarioRunner.delayFlight(req.params.id, parseInt(delay_minutes) || 0);
    res.json({ message: `Flight ${req.params.id} delayed by ${delay_minutes} min` });
  });

  app.post('/api/v1/mock/aodb/flights/:id/cancel', async (req, res) => {
    await scenarioRunner.cancelFlight(req.params.id);
    res.json({ message: `Flight ${req.params.id} marked as CANCELLED` });
  });

  app.post('/api/v1/mock/aodb/flights/:id/restore', async (req, res) => {
    await scenarioRunner.restoreFlight(req.params.id);
    res.json({ message: `Flight ${req.params.id} restored to scheduled ETA` });
  });

  app.get('/api/v1/mock/ferry/sailings', (req, res) => {
    const sailings = Array.from(ods.journeys.values()).filter(j => j.journey_type === 'SAILING');
    res.json(sailings);
  });

  app.post('/api/v1/mock/ferry/sailings/:id/delay', async (req, res) => {
    const { delay_minutes } = req.body;
    await scenarioRunner.delayFerry(req.params.id, parseInt(delay_minutes) || 0);
    res.json({ message: `Sailing ${req.params.id} delayed by ${delay_minutes} min` });
  });

  app.post('/api/v1/mock/ferry/sailings/:id/cancel', async (req, res) => {
    await scenarioRunner.cancelFerry(req.params.id);
    res.json({ message: `Sailing ${req.params.id} cancelled` });
  });

  app.post('/api/v1/mock/ferry/sailings/:id/restore', async (req, res) => {
    await scenarioRunner.restoreFerry(req.params.id);
    res.json({ message: `Sailing ${req.params.id} restored` });
  });

  app.post('/api/v1/mock/transfer/:id/traffic', async (req, res) => {
    const { traffic_status, duration_minutes } = req.body;
    await scenarioRunner.updateTraffic(req.params.id, traffic_status, parseInt(duration_minutes) || 20);
    res.json({ message: 'Transfer traffic updated' });
  });

  // ----------------------------------------------------
  // Simulation Console & Scenarios (Section 43, 55, 78)
  // ----------------------------------------------------
  app.get('/api/v1/simulation/scenarios', (req, res) => {
    const scenarios = [
      { id: 'S1', name: 'Normal', description: 'On-time flight AI123, normal transfer, margin +35m. Expected: SAFE' },
      { id: 'S2', name: 'Minor Flight Delay', description: 'Flight AI123 delayed +15 min. Margin 20m. Expected: WATCH' },
      { id: 'S3', name: 'At-Risk Connection', description: 'Flight AI123 delayed +30 min. Margin 5m. Expected: AT_RISK & Case created' },
      { id: 'S4', name: 'Impossible Connection', description: 'Flight AI123 delayed +60 min. Margin -25m. Expected: CRITICAL' },
      { id: 'S5', name: 'Ferry Delay Recovery', description: 'Initial CRITICAL, then Ferry F205 delayed +30 min. Recovers to positive margin.' },
      { id: 'S6', name: 'Large Group (40 pax)', description: '40 passengers in group GRP-1001. Large group modifier (+10 pts) applied.' },
      { id: 'S7', name: 'Last Sailing', description: 'Last scheduled ferry of the day with no backup sailing.' },
      { id: 'S8', name: 'Human Override', description: 'Duty Manager manually overrides automated CRITICAL to WATCH.' },
      { id: 'S9', name: 'Ferry Cancellation', description: 'Ferry F205 cancelled. Alternate sailing intervention triggered.' },
      { id: 'S10', name: 'Missing Manifest', description: 'Correlate missing booking manifest. Exception audited.' },
      { id: 'S11', name: 'Duplicate Event', description: 'Idempotency validation ensures no duplicate alert/case generated.' },
      { id: 'S12', name: 'Invalid Event DLQ', description: 'Malformed event isolated into dead-letter queue without crashing.' }
    ];
    res.json(scenarios);
  });

  app.post('/api/v1/simulation/scenarios/:id/run', async (req, res) => {
    try {
      const result = await scenarioRunner.runScenario(req.params.id);
      broadcastSSE({ type: 'SCENARIO_RUN', payload: { scenario_id: req.params.id, result } });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.get('/api/v1/simulation/verification-matrix', async (req, res) => {
    try {
      const matrix = await scenarioRunner.executeAllVerificationTests();
      res.json(matrix);
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/simulation/reset', (req, res) => {
    scenarioRunner.resetDemo();
    broadcastSSE({ type: 'SIMULATION_RESET' });
    res.json({ message: 'Operational store reset to baseline.' });
  });

  // ----------------------------------------------------
  // Operational Export & Reporting APIs (Section 65)
  // ----------------------------------------------------
  app.get('/api/v1/export/connections.csv', (req, res) => {
    const siteCode = req.query.site_code as string;
    let conns = Array.from(ods.connections.values()).map(conn => {
      const flight = ods.journeys.get(conn.inbound_journey_id);
      const sailing = ods.journeys.get(conn.outbound_journey_id);
      const group = ods.passengerGroups.get(conn.passenger_group_id);
      const riskHistory = ods.riskAssessments.get(conn.connection_id) || [];
      const latestRisk = riskHistory[0];
      return {
        connection_id: conn.connection_id,
        site_code: conn.site_code,
        flight: flight?.service_number || '',
        origin: flight?.origin_code || '',
        flight_eta: flight?.estimated_arrival_utc || '',
        sailing: sailing?.service_number || '',
        ferry_cutoff: sailing?.boarding_close_utc || '',
        passengers: group?.passenger_count || 0,
        prm_count: group?.prm_count || 0,
        risk_severity: latestRisk?.final_severity || 'SAFE',
        margin_minutes: latestRisk?.connection_margin_minutes ?? 0,
        status: conn.connection_status
      };
    });

    if (siteCode && siteCode !== 'ALL') {
      conns = conns.filter(c => c.site_code === siteCode);
    }

    const headers = ['Connection ID', 'Site', 'Flight', 'Origin', 'Flight ETA UTC', 'Ferry', 'Ferry Cutoff UTC', 'Passengers', 'PRM Count', 'Severity', 'Margin (min)', 'Status'];
    const rows = conns.map(c => [
      c.connection_id,
      c.site_code,
      c.flight,
      c.origin,
      c.flight_eta,
      c.sailing,
      c.ferry_cutoff,
      c.passengers,
      c.prm_count,
      c.risk_severity,
      c.margin_minutes,
      c.status
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="CaR_Connections_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  app.get('/api/v1/export/cases.csv', (req, res) => {
    const siteCode = req.query.site_code as string;
    let cases = Array.from(ods.cases.values()).map(c => {
      const conn = ods.connections.get(c.connection_id);
      const flight = conn ? ods.journeys.get(conn.inbound_journey_id) : undefined;
      const sailing = conn ? ods.journeys.get(conn.outbound_journey_id) : undefined;
      const group = conn ? ods.passengerGroups.get(conn.passenger_group_id) : undefined;
      const riskHistory = ods.riskAssessments.get(c.connection_id) || [];
      const latestRisk = riskHistory[0];

      return {
        case_number: c.case_number,
        case_id: c.case_id,
        connection_id: c.connection_id,
        site_code: conn?.site_code || 'SITE01',
        flight: flight?.service_number || '',
        sailing: sailing?.service_number || '',
        passengers: group?.passenger_count || 0,
        severity: latestRisk?.final_severity || 'SAFE',
        priority: c.priority,
        status: c.status,
        assigned_team: c.assigned_team,
        assigned_user: c.assigned_user || 'Unassigned',
        margin_minutes: latestRisk?.connection_margin_minutes ?? 0,
        created_at: c.created_at,
        sla_due_at: c.sla_due_at
      };
    });

    if (siteCode && siteCode !== 'ALL') {
      cases = cases.filter(c => c.site_code === siteCode);
    }

    const headers = ['Case #', 'Case ID', 'Connection ID', 'Site', 'Flight', 'Sailing', 'Pax', 'Severity', 'Priority', 'Status', 'Assigned Team', 'Owner', 'Margin (min)', 'Created UTC', 'SLA Due UTC'];
    const rows = cases.map(c => [
      c.case_number,
      c.case_id,
      c.connection_id,
      c.site_code,
      c.flight,
      c.sailing,
      c.passengers,
      c.severity,
      c.priority,
      c.status,
      c.assigned_team,
      c.assigned_user,
      c.margin_minutes,
      c.created_at,
      c.sla_due_at
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="CaR_Cases_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  app.get('/api/v1/export/audit.csv', (req, res) => {
    const logs = ods.auditLog;
    const headers = ['Audit ID', 'Timestamp UTC', 'Entity Type', 'Entity ID', 'Action', 'Actor Type', 'Actor ID', 'New Value JSON'];
    const rows = logs.map(a => [
      a.audit_id,
      a.event_time,
      a.entity_type,
      a.entity_id,
      a.action,
      a.actor_type,
      a.actor_id,
      a.new_value_json || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="CaR_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  // ----------------------------------------------------
  // Databricks Analytics & Medallion Explorer (Section 44, 60-64)
  // ----------------------------------------------------
  app.get('/api/v1/analytics/medallion', (req, res) => {
    res.json({
      bronze: ods.bronzeEvents.slice(0, 50),
      silver: ods.silverEntities.slice(0, 50),
      aiFeatures: ods.aiFeatures.slice(0, 50),
      goldKpis: lakehouse.calculateGoldKPIs()
    });
  });

  app.get('/api/v1/analytics/lakehouse-overview', (req, res) => {
    res.json({
      layers: {
        bronze: { recordCount: ods.bronzeEvents.length, description: 'Raw event stream ingested from Event Hubs into immutable Delta Bronze tables.' },
        silver: { recordCount: ods.silverEntities.length, description: 'Conformed, correlated, and deduplicated operational entities with SCD Type 2 tracking.' },
        gold: { recordCount: ods.connections.size, description: 'Aggregated SLA business metrics, connection outcomes, and AI feature engineering tables.' }
      },
      gold: {
        kpis: lakehouse.calculateGoldKPIs(),
        rootCauses: [
          { cause: 'Inbound Flight Departure Latency', percentage: 42, count: 18 },
          { cause: 'Ground Transit Expressway Bottleneck', percentage: 28, count: 12 },
          { cause: 'Harbor Gate Schedule Rescheduling', percentage: 16, count: 7 },
          { cause: 'Terminal Disembarkation Delay', percentage: 14, count: 6 }
        ]
      }
    });
  });

  // DLQ Endpoints (Section 46, DLQ Site Partitioning)
  app.get('/api/v1/system/dlq', (req, res) => {
    const siteCode = (req.query.site_code as string) || undefined;
    const rawDLQ = eventHub.getDeadLetterQueue(siteCode);
    const formatted = rawDLQ.map(item => ({
      id: item.event.event_id,
      site_code: item.site_code || item.event.site_code || 'SITE01',
      topic: 'car-operational-events',
      reason: item.reason,
      dead_lettered_at: item.timestamp,
      retry_count: item.retryCount || 0,
      payload_sample: JSON.stringify(item.event.payload)
    }));
    res.json(formatted);
  });

  app.post('/api/v1/system/dlq/:id/retry', async (req, res) => {
    const siteCode = (req.query.site_code as string) || undefined;
    await eventHub.retryDLQ(req.params.id, siteCode);
    broadcastSSE({ type: 'DLQ_MESSAGE_RETRIED', payload: { id: req.params.id, site_code: siteCode } });
    res.json({ message: `Message ${req.params.id} retried.` });
  });

  app.post('/api/v1/system/dlq/:id/purge', (req, res) => {
    const siteCode = (req.query.site_code as string) || undefined;
    eventHub.purgeDLQ(siteCode, req.params.id);
    broadcastSSE({ type: 'DLQ_PURGED', payload: { id: req.params.id, site_code: siteCode } });
    res.json({ message: `Message ${req.params.id} purged from DLQ.` });
  });

  app.delete('/api/v1/system/dlq', (req, res) => {
    const siteCode = (req.query.site_code as string) || undefined;
    eventHub.purgeDLQ(siteCode);
    broadcastSSE({ type: 'DLQ_PURGED_ALL', payload: { site_code: siteCode } });
    res.json({ message: `All DLQ messages purged.` });
  });

  app.post('/api/v1/system/dlq/simulate-poison', (req, res) => {
    const { site_code = 'SITE01', reason = 'Simulated Corrupt Ingestion Byte Stream: Unterminated JSON payload' } = req.body;
    const poisonEvent = eventHub.injectPoisonPill(site_code, reason);
    broadcastSSE({ type: 'DLQ_MESSAGE_ADDED', payload: { site_code, event_id: poisonEvent.event_id, reason } });
    res.status(201).json({
      message: `Simulated poison pill injected into DLQ for ${site_code}.`,
      event_id: poisonEvent.event_id,
      site_code,
      reason
    });
  });

  // ----------------------------------------------------
  // Site-Specific Endpoints (Section 46, User Directives)
  // ----------------------------------------------------
  // 1. Site Calculation Parameters
  app.get('/api/v1/sites/:site_code/config', (req, res) => {
    try {
      const config = ods.getSiteCalculationConfig(req.params.site_code);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.put('/api/v1/sites/:site_code/config', (req, res) => {
    try {
      const updated = ods.updateSiteCalculationConfig(req.params.site_code, req.body);
      broadcastSSE({ type: 'SITE_CONFIG_UPDATED', payload: { site_code: req.params.site_code, config: updated } });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/sites/:site_code/config/reset', (req, res) => {
    try {
      const reset = ods.resetSiteCalculationConfig(req.params.site_code);
      broadcastSSE({ type: 'SITE_CONFIG_RESET', payload: { site_code: req.params.site_code, config: reset } });
      res.json(reset);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  // 2. Site Integration Feeds & Systems
  app.get('/api/v1/sites/:site_code/feeds', (req, res) => {
    try {
      const feeds = ods.getSiteFeeds(req.params.site_code);
      res.json(feeds);
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.put('/api/v1/sites/:site_code/feeds/:feed_id', (req, res) => {
    try {
      const updated = ods.updateSiteFeed(req.params.site_code, req.params.feed_id, req.body);
      broadcastSSE({ type: 'SITE_FEED_UPDATED', payload: { site_code: req.params.site_code, feed_id: req.params.feed_id, feed: updated } });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/sites/:site_code/feeds/:feed_id/test', (req, res) => {
    try {
      const testResult = ods.testSiteFeed(req.params.site_code, req.params.feed_id);
      broadcastSSE({ type: 'SITE_FEED_TESTED', payload: { site_code: req.params.site_code, feed_id: req.params.feed_id, testResult } });
      res.json(testResult);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  // 3. Site-Specific Dead Letter Queue (DLQ)
  app.get('/api/v1/sites/:site_code/dlq', (req, res) => {
    try {
      const rawDLQ = eventHub.getDeadLetterQueue(req.params.site_code);
      const formatted = rawDLQ.map(item => ({
        id: item.event.event_id,
        site_code: req.params.site_code,
        topic: 'car-operational-events',
        reason: item.reason,
        dead_lettered_at: item.timestamp,
        retry_count: item.retryCount || 0,
        payload_sample: JSON.stringify(item.event.payload)
      }));
      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/sites/:site_code/dlq/:id/retry', async (req, res) => {
    try {
      await eventHub.retryDLQ(req.params.id, req.params.site_code);
      broadcastSSE({ type: 'DLQ_MESSAGE_RETRIED', payload: { id: req.params.id, site_code: req.params.site_code } });
      res.json({ message: `Message ${req.params.id} retried for site ${req.params.site_code}.` });
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/sites/:site_code/dlq/:id/purge', (req, res) => {
    try {
      eventHub.purgeDLQ(req.params.site_code, req.params.id);
      broadcastSSE({ type: 'DLQ_PURGED', payload: { id: req.params.id, site_code: req.params.site_code } });
      res.json({ message: `Message ${req.params.id} purged for site ${req.params.site_code}.` });
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.delete('/api/v1/sites/:site_code/dlq', (req, res) => {
    try {
      eventHub.purgeDLQ(req.params.site_code);
      broadcastSSE({ type: 'DLQ_PURGED_ALL', payload: { site_code: req.params.site_code } });
      res.json({ message: `All DLQ messages purged for site ${req.params.site_code}.` });
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/sites/:site_code/dlq/simulate-poison', (req, res) => {
    const { reason = 'Corrupt Ingestion Byte Stream: Unexpected non-UTF8 payload' } = req.body;
    const poisonEvent = eventHub.injectPoisonPill(req.params.site_code, reason);
    broadcastSSE({ type: 'DLQ_MESSAGE_ADDED', payload: { site_code: req.params.site_code, event_id: poisonEvent.event_id, reason } });
    res.status(201).json({
      message: `Poison pill injected for site ${req.params.site_code}`,
      event_id: poisonEvent.event_id,
      site_code: req.params.site_code,
      reason
    });
  });

  // 4. Site-Specific Connections & Cases Query Endpoints
  app.get('/api/v1/sites/:site_code/connections', (req, res) => {
    const list = Array.from(ods.connections.values())
      .filter(c => c.site_code === req.params.site_code)
      .map(conn => {
        const flight = ods.journeys.get(conn.inbound_journey_id);
        const sailing = ods.journeys.get(conn.outbound_journey_id);
        const group = ods.passengerGroups.get(conn.passenger_group_id);
        const transfer = ods.transfers.get(conn.transfer_id);
        const riskHistory = ods.riskAssessments.get(conn.connection_id) || [];
        return {
          connection: conn,
          flight,
          sailing,
          group,
          transfer,
          latestRisk: riskHistory[0]
        };
      });
    res.json(list);
  });

  app.get('/api/v1/sites/:site_code/cases', (req, res) => {
    const list = Array.from(ods.cases.values())
      .map(c => {
        const conn = ods.connections.get(c.connection_id);
        const flight = conn ? ods.journeys.get(conn.inbound_journey_id) : undefined;
        const sailing = conn ? ods.journeys.get(conn.outbound_journey_id) : undefined;
        const group = conn ? ods.passengerGroups.get(conn.passenger_group_id) : undefined;
        const riskHistory = ods.riskAssessments.get(c.connection_id) || [];
        return {
          caseItem: c,
          connection: conn,
          flight,
          sailing,
          group,
          latestRisk: riskHistory[0]
        };
      })
      .filter(item => item.connection?.site_code === req.params.site_code);
    res.json(list);
  });

  // 5. Site-Specific Connection Recalculation
  app.post('/api/v1/sites/:site_code/recalculate', async (req, res) => {
    try {
      const siteCode = req.params.site_code;
      let count = 0;
      for (const [id, conn] of ods.connections.entries()) {
        if (conn.site_code === siteCode) {
          await correlationEngine.recalculateConnection(id);
          count++;
        }
      }
      broadcastSSE({ type: 'SITE_RECALCULATION_COMPLETE', payload: { site_code: siteCode, count } });
      res.json({ message: `Recalculated ${count} connections for site ${siteCode}.`, count });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  // ----------------------------------------------------
  // Global Configuration APIs (Section 46, User Directives)
  // ----------------------------------------------------
  app.get('/api/v1/config/global', (req, res) => {
    res.json(ods.getGlobalConfig());
  });

  app.put('/api/v1/config/global', (req, res) => {
    try {
      const updated = ods.updateGlobalConfig(req.body);
      broadcastSSE({ type: 'GLOBAL_CONFIG_UPDATED', payload: updated });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.get('/api/v1/config', (req, res) => {
    res.json(ods.config);
  });

  app.put('/api/v1/config', (req, res) => {
    Object.assign(ods.config, req.body);
    ods.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CONFIG',
      entity_id: 'RISK_RULES',
      action: 'CONFIG_UPDATED',
      actor_type: 'USER',
      actor_id: ods.currentUser.name,
      new_value_json: JSON.stringify(req.body)
    });
    broadcastSSE({ type: 'CONFIG_UPDATED', payload: ods.config });
    res.json(ods.config);
  });

  // Site Master APIs
  app.get('/api/v1/admin/sites', (req, res) => {
    try {
      const sites = ods.getSites();
      res.json(sites);
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/admin/sites', (req, res) => {
    try {
      const newSite = ods.createSite(req.body);
      broadcastSSE({ type: 'SITE_ONBOARDED', payload: newSite });
      res.status(201).json(newSite);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.put('/api/v1/admin/sites/:site_code', (req, res) => {
    try {
      const updated = ods.updateSite(req.params.site_code, req.body);
      broadcastSSE({ type: 'SITE_UPDATED', payload: updated });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.delete('/api/v1/admin/sites/:site_code', (req, res) => {
    try {
      const success = ods.deleteSite(req.params.site_code);
      if (!success) {
        return res.status(404).json({ error: { message: `Site ${req.params.site_code} not found` } });
      }
      broadcastSSE({ type: 'SITE_DELETED', payload: { site_code: req.params.site_code } });
      res.json({ message: `Site ${req.params.site_code} deleted successfully.` });
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  // User Management & RBAC Matrix APIs
  app.get('/api/v1/admin/users', (req, res) => {
    try {
      const users = ods.getUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.post('/api/v1/admin/users', (req, res) => {
    try {
      const newUser = ods.createUser(req.body);
      broadcastSSE({ type: 'USER_CREATED', payload: newUser });
      res.status(201).json(newUser);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  app.put('/api/v1/admin/users/:user_id', (req, res) => {
    try {
      const updated = ods.updateUser(req.params.user_id, req.body);
      broadcastSSE({ type: 'USER_UPDATED', payload: updated });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: { message: err.message } });
    }
  });

  // Recalculate Active Connections using updated calculation rules
  app.post('/api/v1/admin/recalculate', async (req, res) => {
    try {
      const targetSite = req.body?.site_code || req.query?.site_code;
      let count = 0;
      for (const [id, conn] of ods.connections.entries()) {
        if (!targetSite || targetSite === 'ALL' || conn.site_code === targetSite) {
          await correlationEngine.recalculateConnection(id);
          count++;
        }
      }

      broadcastSSE({ type: 'RECALCULATION_COMPLETE', payload: { connections_recalculated: count, site_code: targetSite } });
      res.json({ message: `Successfully recalculated ${count} connections with updated operational parameters.`, count });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  // ----------------------------------------------------
  // Vite Middleware & SPA Fallback
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CaR Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
