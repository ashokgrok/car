/**
 * Operational Data Store (ODS) and Persistence Engine
 * Emulates Azure SQL transactional tables:
 * - ops.journey
 * - ops.passenger_group
 * - ops.transfer
 * - ops.connection
 * - ops.risk_assessment
 * - workflow.alert
 * - workflow.case
 * - workflow.task
 * - workflow.intervention
 * - workflow.comment
 * - audit.audit_event
 * - config.risk_rule
 * - platform.processed_event (Idempotency)
 */

import {
  Journey,
  PassengerGroup,
  Transfer,
  Connection,
  RiskAssessment,
  Alert,
  Case,
  CaseTask,
  Intervention,
  CaseComment,
  AuditEntry,
  RiskRuleConfig,
  DatabricksBronzeEvent,
  DatabricksSilverEntity,
  DatabricksGoldKPIs,
  DatabricksAIReadyFeature,
  UserPersona,
  SiteMasterConfig,
  UserPermissions,
  SiteCalculationConfig,
  GlobalConfig,
  SiteFeedConfig,
  SiteDeadLetterMessage
} from '../../src/types/car';

export interface ProcessedEvent {
  event_id: string;
  consumer_name: string;
  processed_at: string;
  status: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
}

export class OperationalStore {
  // ODS Tables
  journeys: Map<string, Journey> = new Map();
  passengerGroups: Map<string, PassengerGroup> = new Map();
  transfers: Map<string, Transfer> = new Map();
  connections: Map<string, Connection> = new Map();
  riskAssessments: Map<string, RiskAssessment[]> = new Map(); // connection_id -> history
  alerts: Map<string, Alert> = new Map();
  cases: Map<string, Case> = new Map();
  tasks: Map<string, CaseTask> = new Map();
  interventions: Map<string, Intervention> = new Map();
  comments: Map<string, CaseComment[]> = new Map();
  auditLog: AuditEntry[] = [];
  processedEvents: Map<string, ProcessedEvent> = new Map(); // key: `${event_id}_${consumer_name}`

  // Site Master Table
  sites: Map<string, SiteMasterConfig> = new Map();

  // Databricks Medallion Tables
  bronzeEvents: DatabricksBronzeEvent[] = [];
  silverEntities: DatabricksSilverEntity[] = [];
  aiFeatures: DatabricksAIReadyFeature[] = [];

  // Global Configuration Parameters (Section 46, Admin Governance)
  globalConfig: GlobalConfig = {
    rule_version: 'CAR-RULESET-1.2',
    maintenance_mode: false,
    telemetry_heartbeat_seconds: 30,
    dlq_max_retry_attempts: 3,
    default_feed_timeout_ms: 5000,
    global_notification_webhook: 'https://ops-gateway.car-cloud.internal/hooks/global-alerts',
    calculation_defaults: {
      safe_minimum_margin: 31,
      watch_minimum_margin: 16,
      at_risk_minimum_margin: 1,
      critical_maximum_margin: 0,
      default_deplaning_minutes: 15,
      default_airport_exit_minutes: 10,
      default_port_processing_minutes: 10,
      default_safety_buffer_minutes: 5,
      sla_critical_minutes: 5,
      sla_at_risk_minutes: 15,
      sla_watch_minutes: 30,
      prm_transfer_multiplier: 1.5,
      large_group_threshold: 15,
      large_group_deplane_penalty: 10,
      max_ferry_hold_minutes: 15,
      auto_trigger_rebook_threshold: -15,
      traffic_surge_alert_threshold: 1.4,
    }
  };

  // Site-specific calculation parameter overrides (Per-site calculation parameters)
  siteCalculationConfigs: Map<string, SiteCalculationConfig> = new Map();

  // Site-specific system feeds & external integrations (Flight, Marine, Traffic, PSS, Dispatch, Baggage)
  siteFeeds: Map<string, SiteFeedConfig[]> = new Map();

  // Deprecated backward-compatible accessor for legacy references
  get config(): RiskRuleConfig {
    return this.globalConfig.calculation_defaults;
  }
  set config(val: RiskRuleConfig) {
    this.globalConfig.calculation_defaults = val;
  }

  // Predefined Personas with Granular RBAC Permissions
  personas: UserPersona[] = [
    {
      id: 'usr_dm_01',
      name: 'Sarah Chen',
      role: 'CAR_DUTY_MANAGER',
      team: 'Airport-Port Integrated Ops',
      email: 'sarah.chen@car-ops.internal',
      description: 'Overall operational oversight, case claiming, high-level overrides, and ferry hold decisions.',
      avatar: 'SC',
      assigned_sites: ['SITE01', 'SITE02', 'SITE03'],
      status: 'ACTIVE',
      permissions: {
        can_override_risk: true,
        can_rebook_sailings: true,
        can_request_ferry_hold: true,
        can_manage_sites: false,
        can_edit_rules: false,
        can_assign_cases: true,
        can_access_admin: false,
      }
    },
    {
      id: 'usr_air_02',
      name: 'Marcus Vance',
      role: 'CAR_AIRPORT_OPS',
      team: 'Terminal 1 Airside Handling',
      email: 'marcus.vance@car-ops.internal',
      description: 'Dispatches priority deplaning, baggage express release, and terminal gate coordination.',
      avatar: 'MV',
      assigned_sites: ['SITE01'],
      status: 'ACTIVE',
      permissions: {
        can_override_risk: false,
        can_rebook_sailings: false,
        can_request_ferry_hold: false,
        can_manage_sites: false,
        can_edit_rules: false,
        can_assign_cases: false,
        can_access_admin: false,
      }
    },
    {
      id: 'usr_ferry_03',
      name: 'Elena Rostova',
      role: 'CAR_FERRY_OPS',
      team: 'Pier 4 Harbor Master & Dispatch',
      email: 'elena.rostova@car-ops.internal',
      description: 'Manages berth availability, boarding cutoffs, and authorizes sailing holds.',
      avatar: 'ER',
      assigned_sites: ['SITE01', 'SITE02'],
      status: 'ACTIVE',
      permissions: {
        can_override_risk: false,
        can_rebook_sailings: true,
        can_request_ferry_hold: true,
        can_manage_sites: false,
        can_edit_rules: false,
        can_assign_cases: false,
        can_access_admin: false,
      }
    },
    {
      id: 'usr_sup_04',
      name: 'David Okafor',
      role: 'CAR_SUPERVISOR',
      team: 'Cross-Modal Logistics Command',
      email: 'david.okafor@car-ops.internal',
      description: 'Oversees SLA breaches, case escalations, re-assignments, and team performance.',
      avatar: 'DO',
      assigned_sites: ['SITE01', 'SITE02', 'SITE03'],
      status: 'ACTIVE',
      permissions: {
        can_override_risk: true,
        can_rebook_sailings: true,
        can_request_ferry_hold: true,
        can_manage_sites: false,
        can_edit_rules: false,
        can_assign_cases: true,
        can_access_admin: false,
      }
    },
    {
      id: 'usr_adm_05',
      name: 'Priya Patel',
      role: 'CAR_ADMIN',
      team: 'Enterprise Platform Systems',
      email: 'priya.patel@car-ops.internal',
      description: 'Configures risk parameters, rulesets, SLA tiers, site onboarding, and simulation triggers.',
      avatar: 'PP',
      assigned_sites: ['ALL'],
      status: 'ACTIVE',
      permissions: {
        can_override_risk: true,
        can_rebook_sailings: true,
        can_request_ferry_hold: true,
        can_manage_sites: true,
        can_edit_rules: true,
        can_assign_cases: true,
        can_access_admin: true,
      }
    }
  ];

  currentUser: UserPersona;

  constructor() {
    this.currentUser = this.personas[0]; // Default: Duty Manager
    this.seedBaseline();
  }

  setCurrentUser(personaId: string): UserPersona {
    const found = this.personas.find(p => p.id === personaId);
    if (found) {
      this.currentUser = found;
      this.recordAudit({
        correlation_id: crypto.randomUUID(),
        entity_type: 'USER',
        entity_id: found.id,
        action: 'PERSONA_SWITCHED',
        actor_type: 'USER',
        actor_id: found.id,
        new_value_json: JSON.stringify({ name: found.name, role: found.role })
      });
    }
    return this.currentUser;
  }

  isProcessed(eventId: string, consumerName: string): boolean {
    const key = `${eventId}_${consumerName}`;
    return this.processedEvents.has(key);
  }

  markProcessed(eventId: string, consumerName: string, status: 'SUCCESS' | 'DUPLICATE' | 'ERROR' = 'SUCCESS') {
    const key = `${eventId}_${consumerName}`;
    this.processedEvents.set(key, {
      event_id: eventId,
      consumer_name: consumerName,
      processed_at: new Date().toISOString(),
      status
    });
  }

  recordAudit(entry: Omit<AuditEntry, 'audit_id' | 'event_time'>): AuditEntry {
    const fullEntry: AuditEntry = {
      audit_id: `aud_${crypto.randomUUID().slice(0, 8)}`,
      event_time: new Date().toISOString(),
      ...entry
    };
    this.auditLog.unshift(fullEntry);
    return fullEntry;
  }

  // Seed baseline scenario data (20 flights, 12 ferry sailings, 30 connections)
  seedBaseline() {
    this.journeys.clear();
    this.passengerGroups.clear();
    this.transfers.clear();
    this.connections.clear();
    this.riskAssessments.clear();
    this.alerts.clear();
    this.cases.clear();
    this.tasks.clear();
    this.interventions.clear();
    this.comments.clear();
    this.auditLog = [];
    this.processedEvents.clear();
    this.bronzeEvents = [];
    this.silverEntities = [];
    this.aiFeatures = [];

    this.sites.clear();

    const site1: SiteMasterConfig = {
      site_code: 'SITE01',
      site_name: 'Vancouver Metro Hub',
      region: 'Pacific Northwest (BC)',
      airport_code: 'YVR',
      airport_name: 'Vancouver International Airport (YVR)',
      port_code: 'TSA_FERRY',
      port_name: 'Tsawwassen Ferry Terminal',
      transfer_corridor: 'Hwy 99 Express Shuttle',
      base_transfer_minutes: 20,
      safety_buffer_minutes: 5,
      high_traffic_multiplier: 1.5,
      deplaning_window_minutes: 15,
      prm_deplaning_buffer_minutes: 10,
      port_processing_minutes: 10,
      ferry_cutoff_minutes: 15,
      max_ferry_hold_minutes: 15,
      dispatch_contact: 'yvr-ops@car-transit.internal',
      status: 'ACTIVE',
      created_at: '2026-01-10T00:00:00Z',
      updated_at: new Date().toISOString()
    };

    const site2: SiteMasterConfig = {
      site_code: 'SITE02',
      site_name: 'Puget Sound Gateway',
      region: 'Washington Maritime Corridor',
      airport_code: 'SEA',
      airport_name: 'Seattle-Tacoma International (SEA)',
      port_code: 'COLMAN_DOCK',
      port_name: 'Seattle Colman Dock Terminal',
      transfer_corridor: 'I-5 / Alaskan Way Intermodal Link',
      base_transfer_minutes: 25,
      safety_buffer_minutes: 8,
      high_traffic_multiplier: 1.6,
      deplaning_window_minutes: 18,
      prm_deplaning_buffer_minutes: 12,
      port_processing_minutes: 12,
      ferry_cutoff_minutes: 20,
      max_ferry_hold_minutes: 20,
      dispatch_contact: 'sea-dispatch@pugetops.internal',
      status: 'ACTIVE',
      created_at: '2026-01-15T00:00:00Z',
      updated_at: new Date().toISOString()
    };

    const site3: SiteMasterConfig = {
      site_code: 'SITE03',
      site_name: 'Strait Passage Intermodal',
      region: 'Vancouver Island Sound',
      airport_code: 'YYJ',
      airport_name: 'Victoria International (YYJ)',
      port_code: 'SWARTZ_BAY',
      port_name: 'Swartz Bay Ferry Terminal',
      transfer_corridor: 'Patricia Bay Hwy Transfer',
      base_transfer_minutes: 15,
      safety_buffer_minutes: 5,
      high_traffic_multiplier: 1.3,
      deplaning_window_minutes: 12,
      prm_deplaning_buffer_minutes: 8,
      port_processing_minutes: 8,
      ferry_cutoff_minutes: 15,
      max_ferry_hold_minutes: 10,
      dispatch_contact: 'yyj-ops@straitferry.internal',
      status: 'ACTIVE',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: new Date().toISOString()
    };

    this.sites.set(site1.site_code, site1);
    this.sites.set(site2.site_code, site2);
    this.sites.set(site3.site_code, site3);

    // Populate Site-Specific Calculation Parameters
    this.siteCalculationConfigs.clear();
    this.siteCalculationConfigs.set('SITE01', {
      ...this.globalConfig.calculation_defaults,
      site_code: 'SITE01',
      is_custom_override: false
    });

    this.siteCalculationConfigs.set('SITE02', {
      site_code: 'SITE02',
      safe_minimum_margin: 36,
      watch_minimum_margin: 20,
      at_risk_minimum_margin: 5,
      critical_maximum_margin: 0,
      default_deplaning_minutes: 18,
      default_airport_exit_minutes: 12,
      default_port_processing_minutes: 12,
      default_safety_buffer_minutes: 8,
      sla_critical_minutes: 5,
      sla_at_risk_minutes: 12,
      sla_watch_minutes: 25,
      prm_transfer_multiplier: 1.6,
      large_group_threshold: 12,
      large_group_deplane_penalty: 12,
      max_ferry_hold_minutes: 20,
      auto_trigger_rebook_threshold: -15,
      traffic_surge_alert_threshold: 1.5,
      is_custom_override: true
    });

    this.siteCalculationConfigs.set('SITE03', {
      site_code: 'SITE03',
      safe_minimum_margin: 25,
      watch_minimum_margin: 12,
      at_risk_minimum_margin: 0,
      critical_maximum_margin: -5,
      default_deplaning_minutes: 12,
      default_airport_exit_minutes: 8,
      default_port_processing_minutes: 8,
      default_safety_buffer_minutes: 5,
      sla_critical_minutes: 8,
      sla_at_risk_minutes: 20,
      sla_watch_minutes: 35,
      prm_transfer_multiplier: 1.3,
      large_group_threshold: 20,
      large_group_deplane_penalty: 8,
      max_ferry_hold_minutes: 10,
      auto_trigger_rebook_threshold: -10,
      traffic_surge_alert_threshold: 1.3,
      is_custom_override: true
    });

    // Populate Site-Specific Integration Feeds
    this.siteFeeds.clear();
    for (const s of [site1, site2, site3]) {
      this.siteFeeds.set(s.site_code, this.createDefaultSiteFeeds(s));
    }

    const now = new Date('2026-09-08T12:00:00Z');

    // 1. Primary PoC Flight: AI123 (Flight ETA 14:00)
    const flightAI123: Journey = {
      journey_id: 'flt-ai123',
      journey_type: 'FLIGHT',
      service_number: 'AI123',
      origin_code: 'DEL',
      destination_code: 'SIN_T1',
      scheduled_departure_utc: new Date(now.getTime()).toISOString(),
      scheduled_arrival_utc: '2026-09-08T14:00:00Z',
      estimated_departure_utc: new Date(now.getTime()).toISOString(),
      estimated_arrival_utc: '2026-09-08T14:00:00Z',
      status: 'SCHEDULED',
      gate_or_berth: 'Gate B14',
      source_system: 'MOCK_AODB',
      source_entity_id: 'FLT-001',
      last_updated_utc: new Date().toISOString()
    };
    this.journeys.set(flightAI123.journey_id, flightAI123);

    // 2. Primary PoC Ferry: F205 (Boarding Close 15:30, Departure 15:45)
    const ferryF205: Journey = {
      journey_id: 'sailing-f205',
      journey_type: 'SAILING',
      service_number: 'F205',
      origin_code: 'HARBOR_BERTH_2',
      destination_code: 'BATAM_CENTRE',
      scheduled_departure_utc: '2026-09-08T15:45:00Z',
      scheduled_arrival_utc: '2026-09-08T16:45:00Z',
      estimated_departure_utc: '2026-09-08T15:45:00Z',
      estimated_arrival_utc: '2026-09-08T16:45:00Z',
      status: 'SCHEDULED',
      gate_or_berth: 'Berth 2',
      source_system: 'MOCK_FERRY',
      source_entity_id: 'SLG-205',
      last_updated_utc: new Date().toISOString()
    };
    this.journeys.set(ferryF205.journey_id, ferryF205);

    // Dedicated Subsequent Alternate Sailings for BATAM_CENTRE
    const alternateSailings: Journey[] = [
      {
        journey_id: 'sailing-f207',
        journey_type: 'SAILING',
        service_number: 'F207',
        origin_code: 'HARBOR_BERTH_2',
        destination_code: 'BATAM_CENTRE',
        scheduled_departure_utc: '2026-09-08T16:30:00Z',
        scheduled_arrival_utc: '2026-09-08T17:30:00Z',
        estimated_departure_utc: '2026-09-08T16:30:00Z',
        estimated_arrival_utc: '2026-09-08T17:30:00Z',
        status: 'SCHEDULED',
        gate_or_berth: 'Berth 2',
        source_system: 'MOCK_FERRY',
        source_entity_id: 'SLG-207',
        last_updated_utc: new Date().toISOString()
      },
      {
        journey_id: 'sailing-f209',
        journey_type: 'SAILING',
        service_number: 'F209',
        origin_code: 'HARBOR_BERTH_3',
        destination_code: 'BATAM_CENTRE',
        scheduled_departure_utc: '2026-09-08T17:15:00Z',
        scheduled_arrival_utc: '2026-09-08T18:15:00Z',
        estimated_departure_utc: '2026-09-08T17:15:00Z',
        estimated_arrival_utc: '2026-09-08T18:15:00Z',
        status: 'SCHEDULED',
        gate_or_berth: 'Berth 3',
        source_system: 'MOCK_FERRY',
        source_entity_id: 'SLG-209',
        last_updated_utc: new Date().toISOString()
      },
      {
        journey_id: 'sailing-f211',
        journey_type: 'SAILING',
        service_number: 'F211',
        origin_code: 'HARBOR_BERTH_1',
        destination_code: 'BATAM_CENTRE',
        scheduled_departure_utc: '2026-09-08T18:00:00Z',
        scheduled_arrival_utc: '2026-09-08T19:00:00Z',
        estimated_departure_utc: '2026-09-08T18:00:00Z',
        estimated_arrival_utc: '2026-09-08T19:00:00Z',
        status: 'SCHEDULED',
        gate_or_berth: 'Berth 1',
        source_system: 'MOCK_FERRY',
        source_entity_id: 'SLG-211',
        last_updated_utc: new Date().toISOString()
      }
    ];
    alternateSailings.forEach(s => this.journeys.set(s.journey_id, s));

    // 3. Primary Passenger Group: 32 passengers, 1 PRM, 4 children
    const group1001: PassengerGroup = {
      passenger_group_id: 'grp-1001',
      group_reference_token: 'GRP-1001',
      pnr_token: 'PNR-X123',
      passenger_count: 32,
      prm_count: 1,
      children_count: 4,
      priority: true,
      source_system: 'MOCK_PASSENGER'
    };
    this.passengerGroups.set(group1001.passenger_group_id, group1001);

    // 4. Primary Transfer
    const transferAirportToPort: Transfer = {
      transfer_id: 'trf-t1-portA',
      origin_location: 'AIRPORT_TERMINAL_1',
      destination_location: 'FERRY_TERMINAL_A',
      base_duration_minutes: 20,
      current_duration_minutes: 20,
      buffer_minutes: 5,
      traffic_status: 'NORMAL',
      last_updated_utc: new Date().toISOString()
    };
    this.transfers.set(transferAirportToPort.transfer_id, transferAirportToPort);

    // 5. Primary Connection: AI123 -> F205
    const connectionPrimary: Connection = {
      connection_id: 'car-1001',
      inbound_journey_id: flightAI123.journey_id,
      outbound_journey_id: ferryF205.journey_id,
      passenger_group_id: group1001.passenger_group_id,
      transfer_id: transferAirportToPort.transfer_id,
      boarding_close_utc: '2026-09-08T15:30:00Z',
      connection_status: 'ACTIVE',
      site_code: 'SITE01',
      last_evaluated_utc: new Date().toISOString()
    };
    this.connections.set(connectionPrimary.connection_id, connectionPrimary);

    // Initial Risk Assessment for Primary Connection:
    // Flight ETA 14:00 + deplaning 15m + exit 10m = 14:25 + transfer 20m + port 10m = 14:55 ready to board
    // Boarding close = 15:30 => Margin = 15:30 - 14:55 = +35 min -> SAFE!
    const initialRisk: RiskAssessment = {
      risk_assessment_id: 'risk-1001-init',
      connection_id: connectionPrimary.connection_id,
      calculated_at_utc: new Date().toISOString(),
      flight_eta_utc: flightAI123.estimated_arrival_utc,
      deplaning_minutes: 15,
      airport_exit_minutes: 10,
      transfer_minutes: 20,
      port_processing_minutes: 10,
      safety_buffer_minutes: 0,
      ready_to_board_utc: '2026-09-08T14:55:00Z',
      boarding_close_utc: connectionPrimary.boarding_close_utc,
      connection_margin_minutes: 35,
      base_severity: 'SAFE',
      final_severity: 'SAFE',
      risk_score: 15,
      reason_codes: [],
      rule_version: 'CAR-RULESET-1.0'
    };
    this.riskAssessments.set(connectionPrimary.connection_id, [initialRisk]);

    // Seed 19 additional flights and 11 sailings for a rich operational catalog
    const flightDestinations = ['SIN_T1', 'SIN_T2', 'SIN_T3', 'SIN_T4'];
    const origins = ['LHR', 'HND', 'SYD', 'DXB', 'FRA', 'JFK', 'BKK', 'ICN', 'KUL', 'MEL'];

    for (let i = 2; i <= 20; i++) {
      const flightNum = `SQ${200 + i * 7}`;
      const flightId = `flt-gen-${i}`;
      const schedArrivalHours = 12 + Math.floor(i / 3);
      const schedArrivalMinutes = (i * 15) % 60;
      const arrivalIso = `2026-09-08T${String(schedArrivalHours).padStart(2, '0')}:${String(schedArrivalMinutes).padStart(2, '0')}:00Z`;

      // Distribute a few delays in the background
      let status: Journey['status'] = 'SCHEDULED';
      let delayMins = 0;
      if (i === 4) { delayMins = 18; status = 'DELAYED'; }
      if (i === 7) { delayMins = 45; status = 'DELAYED'; }
      if (i === 12) { delayMins = 10; status = 'DELAYED'; }
      if (i === 15) { delayMins = 55; status = 'DELAYED'; }

      const estArrivalDate = new Date(new Date(arrivalIso).getTime() + delayMins * 60000);

      this.journeys.set(flightId, {
        journey_id: flightId,
        journey_type: 'FLIGHT',
        service_number: flightNum,
        origin_code: origins[i % origins.length],
        destination_code: flightDestinations[i % flightDestinations.length],
        scheduled_departure_utc: '2026-09-08T08:00:00Z',
        scheduled_arrival_utc: arrivalIso,
        estimated_departure_utc: '2026-09-08T08:00:00Z',
        estimated_arrival_utc: estArrivalDate.toISOString(),
        status,
        gate_or_berth: `Gate C${i + 5}`,
        source_system: 'MOCK_AODB',
        source_entity_id: `FLT-AUTO-${i}`,
        last_updated_utc: new Date().toISOString()
      });
    }

    // Additional Ferry Sailings
    for (let j = 2; j <= 12; j++) {
      const sailingNum = `F${200 + j * 6}`;
      const sailingId = `sailing-gen-${j}`;
      const departHours = 14 + Math.floor(j / 2);
      const departMins = (j * 20) % 60;
      const departIso = `2026-09-08T${String(departHours).padStart(2, '0')}:${String(departMins).padStart(2, '0')}:00Z`;
      const boardingCloseDate = new Date(new Date(departIso).getTime() - 15 * 60000);

      this.journeys.set(sailingId, {
        journey_id: sailingId,
        journey_type: 'SAILING',
        service_number: sailingNum,
        origin_code: `HARBOR_BERTH_${(j % 4) + 1}`,
        destination_code: j % 2 === 0 ? 'BATAM_CENTRE' : 'BINTAN_RESORT',
        scheduled_departure_utc: departIso,
        scheduled_arrival_utc: new Date(new Date(departIso).getTime() + 60 * 60000).toISOString(),
        estimated_departure_utc: departIso,
        estimated_arrival_utc: new Date(new Date(departIso).getTime() + 60 * 60000).toISOString(),
        status: 'SCHEDULED',
        gate_or_berth: `Berth ${(j % 4) + 1}`,
        source_system: 'MOCK_FERRY',
        source_entity_id: `SLG-AUTO-${j}`,
        last_updated_utc: new Date().toISOString()
      });
    }

    // Additional Passenger Groups & Connections
    for (let k = 2; k <= 30; k++) {
      const grpId = `grp-gen-${k}`;
      const pnrToken = `PNR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const count = (k * 4) % 28 + 2;
      const prm = k % 5 === 0 ? 1 : 0;
      const children = k % 3 === 0 ? 2 : 0;

      this.passengerGroups.set(grpId, {
        passenger_group_id: grpId,
        group_reference_token: `GRP-${1000 + k}`,
        pnr_token: pnrToken,
        passenger_count: count,
        prm_count: prm,
        children_count: children,
        priority: count > 20 || prm > 0,
        source_system: 'MOCK_PASSENGER'
      });

      const flightId = `flt-gen-${((k - 2) % 19) + 2}`;
      const sailingId = `sailing-gen-${((k - 2) % 11) + 2}`;
      const flight = this.journeys.get(flightId)!;
      const sailing = this.journeys.get(sailingId)!;

      const connId = `car-${1000 + k}`;
      const boardingCloseDate = new Date(new Date(sailing.estimated_departure_utc).getTime() - 15 * 60000);

      const siteCode = k % 3 === 0 ? 'SITE02' : k % 3 === 1 ? 'SITE03' : 'SITE01';
      const conn: Connection = {
        connection_id: connId,
        inbound_journey_id: flightId,
        outbound_journey_id: sailingId,
        passenger_group_id: grpId,
        transfer_id: transferAirportToPort.transfer_id,
        boarding_close_utc: boardingCloseDate.toISOString(),
        connection_status: 'ACTIVE',
        site_code: siteCode,
        last_evaluated_utc: new Date().toISOString()
      };
      this.connections.set(connId, conn);

      // Evaluate initial margins
      const flightEta = new Date(flight.estimated_arrival_utc).getTime();
      const readyToBoard = flightEta + (15 + 10 + 20 + 10) * 60000;
      const margin = Math.round((boardingCloseDate.getTime() - readyToBoard) / 60000);

      let severity: RiskAssessment['final_severity'] = 'SAFE';
      let score = 20;
      const reasons: RiskAssessment['reason_codes'] = [];

      if (margin <= 0) {
        severity = 'CRITICAL';
        score = 92;
        reasons.push('NEGATIVE_CONNECTION_MARGIN', 'FLIGHT_DELAY');
      } else if (margin <= 15) {
        severity = 'AT_RISK';
        score = 75;
        reasons.push('SHORT_CONNECTION_WINDOW', 'FLIGHT_DELAY');
      } else if (margin <= 30) {
        severity = 'WATCH';
        score = 45;
      }

      if (count > 20) {
        reasons.push('LARGE_GROUP');
        score += 10;
      }
      if (prm > 0) {
        reasons.push('PRM_PRESENT');
        score += 5;
      }

      const risk: RiskAssessment = {
        risk_assessment_id: `risk-${connId}-init`,
        connection_id: connId,
        calculated_at_utc: new Date().toISOString(),
        flight_eta_utc: flight.estimated_arrival_utc,
        deplaning_minutes: 15,
        airport_exit_minutes: 10,
        transfer_minutes: 20,
        port_processing_minutes: 10,
        safety_buffer_minutes: 5,
        ready_to_board_utc: new Date(readyToBoard).toISOString(),
        boarding_close_utc: boardingCloseDate.toISOString(),
        connection_margin_minutes: margin,
        base_severity: severity,
        final_severity: severity,
        risk_score: Math.min(score, 100),
        reason_codes: reasons,
        rule_version: 'CAR-RULESET-1.0'
      };
      this.riskAssessments.set(connId, [risk]);

      // If initially AT_RISK or CRITICAL, pre-create alert and case
      if (severity === 'CRITICAL' || severity === 'AT_RISK') {
        const alertId = `alt-${connId}`;
        const alert: Alert = {
          alert_id: alertId,
          connection_id: connId,
          risk_assessment_id: risk.risk_assessment_id,
          severity,
          status: 'OPEN',
          detected_at: new Date(now.getTime() - 15 * 60000).toISOString(),
          deduplication_key: `${connId}_${severity}`,
          escalation_level: severity === 'CRITICAL' ? 2 : 1
        };
        this.alerts.set(alertId, alert);

        const caseId = `case-${connId}`;
        const caseNumber = `CAR-CASE-${String(k).padStart(3, '0')}`;
        const slaMinutes = severity === 'CRITICAL' ? this.config.sla_critical_minutes : this.config.sla_at_risk_minutes;

        const newCase: Case = {
          case_id: caseId,
          case_number: caseNumber,
          connection_id: connId,
          alert_id: alertId,
          priority: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          status: 'NEW',
          assigned_team: 'Airport-Port Integrated Ops',
          created_at: new Date(now.getTime() - 10 * 60000).toISOString(),
          sla_due_at: new Date(now.getTime() + slaMinutes * 60000).toISOString(),
          row_version: 1
        };
        this.cases.set(caseId, newCase);

        // Pre-create standard tasks for the case
        this.createStandardTasks(newCase, severity);
      }
    }

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CONFIG',
      entity_id: 'SYSTEM',
      action: 'BASELINE_DATA_SEEDED',
      actor_type: 'SYSTEM',
      actor_id: 'SYSTEM_BOOTSTRAP',
      new_value_json: JSON.stringify({
        flights: this.journeys.size,
        sailings: 12,
        connections: this.connections.size,
        cases: this.cases.size
      })
    });
  }

  createStandardTasks(c: Case, severity: RiskAssessment['final_severity']) {
    const taskDefs = [
      {
        title: 'Notify Airport Operations & Flag Gate Disembarkation',
        description: 'Ensure ground handling agents prioritize deplaning and baggage tags for transfer pax.',
        role: 'CAR_AIRPORT_OPS' as const,
        minsDue: 5
      },
      {
        title: 'Expedite Dedicated Transfer Coach',
        description: 'Confirm coach waiting at Bay 4 and bypass airport traffic bottleneck.',
        role: 'CAR_DUTY_MANAGER' as const,
        minsDue: 10
      },
      {
        title: 'Evaluate Ferry Hold Request with Harbor Master',
        description: 'Request 10-15 min boarding cutoff extension for connecting group.',
        role: 'CAR_FERRY_OPS' as const,
        minsDue: severity === 'CRITICAL' ? 5 : 12
      }
    ];

    const taskIds: string[] = [];
    taskDefs.forEach((def, index) => {
      const taskId = `tsk-${c.case_id}-${index + 1}`;
      taskIds.push(taskId);
      const dependencyTaskId = index > 0 ? taskIds[index - 1] : undefined;
      const task: CaseTask = {
        task_id: taskId,
        case_id: c.case_id,
        task_type: 'OPERATIONAL_CHECK',
        title: def.title,
        description: def.description,
        assigned_role: def.role,
        status: 'PENDING',
        due_at: new Date(Date.now() + def.minsDue * 60000).toISOString(),
        dependency_task_id: dependencyTaskId,
        sequence: index + 1
      };
      this.tasks.set(taskId, task);
    });

    // Generate recommended interventions
    const holdIntervention: Intervention = {
      intervention_id: `int-${c.case_id}-1`,
      case_id: c.case_id,
      intervention_type: 'REQUEST_FERRY_HOLD',
      title: 'Request Ferry Boarding Extension (15 min)',
      recommended: severity === 'CRITICAL' || severity === 'AT_RISK',
      selected: false,
      status: 'PENDING',
      reason: 'Saves group connection with minimal port turnaround disruption.',
      created_at: new Date().toISOString(),
      task_ids: [`tsk-${c.case_id}-3`]
    };

    const expediteIntervention: Intervention = {
      intervention_id: `int-${c.case_id}-2`,
      case_id: c.case_id,
      intervention_type: 'EXPEDITE_AIRPORT_EXIT',
      title: 'Expedite Airport Baggage & Fast-Track Exit',
      recommended: true,
      selected: false,
      status: 'PENDING',
      reason: 'Recovers 12 minutes of buffer during terminal transit.',
      created_at: new Date().toISOString(),
      task_ids: [`tsk-${c.case_id}-1`]
    };

    const alternateIntervention: Intervention = {
      intervention_id: `int-${c.case_id}-3`,
      case_id: c.case_id,
      intervention_type: 'MOVE_TO_ALTERNATE_SAILING',
      title: 'Protect Group onto Alternate Ferry Sailing',
      recommended: severity === 'CRITICAL',
      selected: false,
      status: 'PENDING',
      reason: 'Reassigns passengers to subsequent departure with guaranteed seating capacity.',
      created_at: new Date().toISOString(),
      task_ids: []
    };

    this.interventions.set(holdIntervention.intervention_id, holdIntervention);
    this.interventions.set(expediteIntervention.intervention_id, expediteIntervention);
    this.interventions.set(alternateIntervention.intervention_id, alternateIntervention);
  }

  // ----------------------------------------------------
  // Site Master Management (Section 46, User Request)
  // ----------------------------------------------------
  getSites(): SiteMasterConfig[] {
    const list = Array.from(this.sites.values());
    return list.map(site => {
      const activeCount = Array.from(this.connections.values()).filter(c => c.site_code === site.site_code).length;
      return { ...site, active_connections_count: activeCount };
    });
  }

  getSite(siteCode: string): SiteMasterConfig | undefined {
    const site = this.sites.get(siteCode);
    if (!site) return undefined;
    const activeCount = Array.from(this.connections.values()).filter(c => c.site_code === site.site_code).length;
    return { ...site, active_connections_count: activeCount };
  }

  createSite(siteData: Partial<SiteMasterConfig>): SiteMasterConfig {
    if (!siteData.site_code) {
      throw new Error('Site code is required (e.g. SITE04, ATH, OSL)');
    }
    const code = siteData.site_code.toUpperCase().trim();
    if (this.sites.has(code)) {
      throw new Error(`Site with code ${code} already exists in Site Master`);
    }

    const newSite: SiteMasterConfig = {
      site_code: code,
      site_name: siteData.site_name || `Intermodal Hub ${code}`,
      region: siteData.region || 'Regional Corridor',
      airport_code: siteData.airport_code || `${code}_AIR`,
      airport_name: siteData.airport_name || `${code} International Airport`,
      port_code: siteData.port_code || `${code}_PORT`,
      port_name: siteData.port_name || `${code} Ferry Port`,
      transfer_corridor: siteData.transfer_corridor || 'Express Ground Transit Link',
      base_transfer_minutes: Number(siteData.base_transfer_minutes) || 20,
      safety_buffer_minutes: Number(siteData.safety_buffer_minutes) || 5,
      high_traffic_multiplier: Number(siteData.high_traffic_multiplier) || 1.4,
      deplaning_window_minutes: Number(siteData.deplaning_window_minutes) || 15,
      prm_deplaning_buffer_minutes: Number(siteData.prm_deplaning_buffer_minutes) || 10,
      port_processing_minutes: Number(siteData.port_processing_minutes) || 10,
      ferry_cutoff_minutes: Number(siteData.ferry_cutoff_minutes) || 15,
      max_ferry_hold_minutes: Number(siteData.max_ferry_hold_minutes) || 15,
      dispatch_contact: siteData.dispatch_contact || `ops@${code.toLowerCase()}.internal`,
      status: siteData.status || 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.sites.set(code, newSite);

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'SITE',
      entity_id: code,
      action: 'SITE_ONBOARDED',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      new_value_json: JSON.stringify(newSite)
    });

    return newSite;
  }

  updateSite(siteCode: string, updates: Partial<SiteMasterConfig>): SiteMasterConfig {
    const existing = this.sites.get(siteCode);
    if (!existing) {
      throw new Error(`Site ${siteCode} not found`);
    }

    const updated: SiteMasterConfig = {
      ...existing,
      ...updates,
      site_code: existing.site_code, // protect primary key
      updated_at: new Date().toISOString()
    };

    this.sites.set(siteCode, updated);

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'SITE',
      entity_id: siteCode,
      action: 'SITE_UPDATED',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      old_value_json: JSON.stringify(existing),
      new_value_json: JSON.stringify(updated)
    });

    return updated;
  }

  deleteSite(siteCode: string): boolean {
    const existing = this.sites.get(siteCode);
    if (!existing) return false;
    this.sites.delete(siteCode);

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'SITE',
      entity_id: siteCode,
      action: 'SITE_DELETED',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      old_value_json: JSON.stringify(existing)
    });

    return true;
  }

  // ----------------------------------------------------
  // User Accounts & Roles Matrix (Section 64, User Request)
  // ----------------------------------------------------
  getUsers(): UserPersona[] {
    return this.personas;
  }

  updateUser(id: string, updates: Partial<UserPersona>): UserPersona {
    const index = this.personas.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`User ${id} not found`);
    }
    const existing = this.personas[index];
    const updated: UserPersona = {
      ...existing,
      ...updates,
      id: existing.id,
      permissions: updates.permissions ? { ...existing.permissions, ...updates.permissions } as any : existing.permissions
    };
    this.personas[index] = updated;
    if (this.currentUser.id === id) {
      this.currentUser = updated;
    }

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'USER',
      entity_id: id,
      action: 'USER_ROLE_UPDATED',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      old_value_json: JSON.stringify(existing),
      new_value_json: JSON.stringify(updated)
    });

    return updated;
  }

  createUser(userData: Partial<UserPersona>): UserPersona {
    const role = userData.role || 'CAR_VIEWER';
    const id = `usr_${role.toLowerCase().replace('car_', '')}_${Date.now().toString().slice(-4)}`;
    const initials = (userData.name || 'New User')
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const newUser: UserPersona = {
      id,
      name: userData.name || 'New User',
      role,
      team: userData.team || 'Cross-Modal Operations',
      email: userData.email || `${id}@car-ops.internal`,
      description: userData.description || 'Operational team member',
      avatar: initials || 'OP',
      assigned_sites: userData.assigned_sites || ['SITE01'],
      status: userData.status || 'ACTIVE',
      permissions: userData.permissions || {
        can_override_risk: false,
        can_rebook_sailings: false,
        can_request_ferry_hold: false,
        can_manage_sites: false,
        can_edit_rules: false,
        can_assign_cases: false,
        can_access_admin: false,
      }
    };

    this.personas.push(newUser);

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'USER',
      entity_id: id,
      action: 'USER_CREATED',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      new_value_json: JSON.stringify(newUser)
    });

    return newUser;
  }

  // ----------------------------------------------------
  // Global & Site-Specific Configuration Engine
  // ----------------------------------------------------
  createDefaultSiteFeeds(site: SiteMasterConfig): SiteFeedConfig[] {
    const code = site.site_code;
    const air = site.airport_code || 'AIR';
    const port = site.port_code || 'PRT';

    return [
      {
        feed_id: 'flight_aodb',
        feed_name: `${air} Airport AODB & ADS-B Radar Stream`,
        feed_type: 'FLIGHT_AODB',
        site_code: code,
        provider: `${air} AODB & FlightAware ADS-B Stream`,
        endpoint_url: `https://api.${air.toLowerCase()}.internal/aodb/v2/flights/live`,
        protocol: 'REST_JSON',
        polling_interval_seconds: 30,
        auth_type: 'API_KEY',
        auth_credential_masked: 'ak_live_•••••••92',
        status: 'ACTIVE',
        last_heartbeat_utc: new Date().toISOString(),
        events_ingested_count: 1420,
        error_count: 0
      },
      {
        feed_id: 'marine_ferry',
        feed_name: `${port} Harbor Master & AIS Berth Telemetry`,
        feed_type: 'MARINE_FERRY',
        site_code: code,
        provider: `${port} Harbor Master & Maritime AIS Dispatch`,
        endpoint_url: `https://berth-telemetry.${port.toLowerCase()}.internal/v1/sailings`,
        protocol: 'GTFS_RT',
        polling_interval_seconds: 45,
        auth_type: 'BEARER_TOKEN',
        auth_credential_masked: 'bearer_•••••••7a',
        status: 'ACTIVE',
        last_heartbeat_utc: new Date().toISOString(),
        events_ingested_count: 980,
        error_count: 0
      },
      {
        feed_id: 'ground_traffic',
        feed_name: `${site.transfer_corridor} Arterial Telematics`,
        feed_type: 'GROUND_TRAFFIC',
        site_code: code,
        provider: 'Regional DOT Arterial Sensors & Transit Link',
        endpoint_url: `https://traffic-telematics.transport.internal/sensors/${code.toLowerCase()}/arterials`,
        protocol: 'REST_JSON',
        polling_interval_seconds: 60,
        auth_type: 'API_KEY',
        auth_credential_masked: 'key_•••••••f4',
        status: 'ACTIVE',
        last_heartbeat_utc: new Date().toISOString(),
        events_ingested_count: 3105,
        error_count: 0
      },
      {
        feed_id: 'passenger_pss',
        feed_name: `${code} Passenger Host PSS & Manifest Feed`,
        feed_type: 'PASSENGER_PSS',
        site_code: code,
        provider: 'Airline Host PSS & Passenger Manifest Service',
        endpoint_url: `https://pss-manifest.global-airlines.internal/manifests/${code.toLowerCase()}`,
        protocol: 'REST_JSON',
        polling_interval_seconds: 120,
        auth_type: 'MUTUAL_TLS',
        auth_credential_masked: 'mtls_cert_sha256:••••d91',
        status: 'ACTIVE',
        last_heartbeat_utc: new Date().toISOString(),
        events_ingested_count: 540,
        error_count: 0
      },
      {
        feed_id: 'dispatch_webhook',
        feed_name: `${code} Duty Dispatch Notification Webhook`,
        feed_type: 'DISPATCH_WEBHOOK',
        site_code: code,
        provider: 'Duty Dispatch Escalation & Radio Notification Webhook',
        endpoint_url: `https://pagerduty.car-cloud.internal/dispatch/site/${code.toLowerCase()}`,
        protocol: 'WEBHOOK',
        polling_interval_seconds: 0,
        auth_type: 'BEARER_TOKEN',
        auth_credential_masked: 'sec_hook_•••••••3b',
        status: 'ACTIVE',
        last_heartbeat_utc: new Date().toISOString(),
        events_ingested_count: 42,
        error_count: 0
      },
      {
        feed_id: 'baggage_telematics',
        feed_name: `${air}-${port} Cross-Modal Baggage Telematics`,
        feed_type: 'BAGGAGE_TELEMATICS',
        site_code: code,
        provider: 'IATA 753 Cross-docking RFID BagJourney Feed',
        endpoint_url: `https://baggage-scan.${air.toLowerCase()}.internal/rfid/crossmodal`,
        protocol: 'REST_JSON',
        polling_interval_seconds: 60,
        auth_type: 'API_KEY',
        auth_credential_masked: 'rfid_•••••••c2',
        status: 'ACTIVE',
        last_heartbeat_utc: new Date().toISOString(),
        events_ingested_count: 2210,
        error_count: 0
      }
    ];
  }

  getGlobalConfig(): GlobalConfig {
    return this.globalConfig;
  }

  updateGlobalConfig(updates: Partial<GlobalConfig>): GlobalConfig {
    if (updates.calculation_defaults) {
      this.globalConfig.calculation_defaults = {
        ...this.globalConfig.calculation_defaults,
        ...updates.calculation_defaults
      };
    }
    const { calculation_defaults, ...rest } = updates;
    Object.assign(this.globalConfig, rest);

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CONFIG',
      entity_id: 'GLOBAL',
      action: 'GLOBAL_CONFIG_UPDATED',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      new_value_json: JSON.stringify(this.globalConfig)
    });

    return this.globalConfig;
  }

  getSiteCalculationConfig(siteCode: string): SiteCalculationConfig {
    const existing = this.siteCalculationConfigs.get(siteCode);
    if (existing) {
      return existing;
    }

    // Fallback: inherit from global defaults
    const inherited: SiteCalculationConfig = {
      ...this.globalConfig.calculation_defaults,
      site_code: siteCode,
      is_custom_override: false
    };
    this.siteCalculationConfigs.set(siteCode, inherited);
    return inherited;
  }

  updateSiteCalculationConfig(siteCode: string, updates: Partial<SiteCalculationConfig>): SiteCalculationConfig {
    const current = this.getSiteCalculationConfig(siteCode);
    const updated: SiteCalculationConfig = {
      ...current,
      ...updates,
      site_code: siteCode,
      is_custom_override: true
    };
    this.siteCalculationConfigs.set(siteCode, updated);

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CONFIG',
      entity_id: siteCode,
      action: 'SITE_CALCULATION_CONFIG_UPDATED',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      old_value_json: JSON.stringify(current),
      new_value_json: JSON.stringify(updated)
    });

    return updated;
  }

  resetSiteCalculationConfig(siteCode: string): SiteCalculationConfig {
    const resetConfig: SiteCalculationConfig = {
      ...this.globalConfig.calculation_defaults,
      site_code: siteCode,
      is_custom_override: false
    };
    this.siteCalculationConfigs.set(siteCode, resetConfig);

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CONFIG',
      entity_id: siteCode,
      action: 'SITE_CALCULATION_CONFIG_RESET_TO_GLOBAL',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      new_value_json: JSON.stringify(resetConfig)
    });

    return resetConfig;
  }

  getSiteFeeds(siteCode: string): SiteFeedConfig[] {
    let feeds = this.siteFeeds.get(siteCode);
    if (!feeds) {
      const site = this.sites.get(siteCode);
      if (site) {
        feeds = this.createDefaultSiteFeeds(site);
        this.siteFeeds.set(siteCode, feeds);
      } else {
        return [];
      }
    }
    return feeds;
  }

  updateSiteFeed(siteCode: string, feedId: string, updates: Partial<SiteFeedConfig>): SiteFeedConfig {
    const feeds = this.getSiteFeeds(siteCode);
    const index = feeds.findIndex(f => f.feed_id === feedId);
    if (index === -1) {
      throw new Error(`Feed ${feedId} not found for site ${siteCode}`);
    }

    const current = feeds[index];
    const updated: SiteFeedConfig = {
      ...current,
      ...updates,
      feed_id: current.feed_id,
      site_code: siteCode
    };

    feeds[index] = updated;
    this.siteFeeds.set(siteCode, feeds);

    this.recordAudit({
      correlation_id: crypto.randomUUID(),
      entity_type: 'CONFIG',
      entity_id: `${siteCode}_${feedId}`,
      action: 'SITE_FEED_UPDATED',
      actor_type: 'USER',
      actor_id: this.currentUser.id,
      old_value_json: JSON.stringify(current),
      new_value_json: JSON.stringify(updated)
    });

    return updated;
  }

  testSiteFeed(siteCode: string, feedId: string): { success: boolean; latency_ms: number; message: string; timestamp: string; status: 'ACTIVE' | 'ERROR' } {
    const feeds = this.getSiteFeeds(siteCode);
    const feed = feeds.find(f => f.feed_id === feedId);
    if (!feed) {
      throw new Error(`Feed ${feedId} not found for site ${siteCode}`);
    }

    // Simulate real probe latency & response
    const latency = Math.floor(Math.random() * 35) + 12;
    feed.last_heartbeat_utc = new Date().toISOString();
    feed.status = 'ACTIVE';

    return {
      success: true,
      latency_ms: latency,
      message: `HTTP 200 OK — Probe to ${feed.endpoint_url} responded in ${latency}ms via ${feed.protocol}. Telemetry verified.`,
      timestamp: feed.last_heartbeat_utc,
      status: 'ACTIVE'
    };
  }
}

export const ods = new OperationalStore();
