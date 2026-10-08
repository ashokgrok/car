/**
 * Connection-at-Risk (CaR) Domain Types and Canonical Contracts
 */

export type JourneyType = 'FLIGHT' | 'SAILING' | 'TRAIN' | 'COACH';

export type JourneyStatus = 
  | 'SCHEDULED' 
  | 'DELAYED' 
  | 'BOARDING' 
  | 'DEPARTED' 
  | 'ARRIVED' 
  | 'CANCELLED';

export interface Journey {
  journey_id: string;
  journey_type: JourneyType;
  service_number: string;
  origin_code: string;
  destination_code: string;
  scheduled_departure_utc: string;
  scheduled_arrival_utc: string;
  estimated_departure_utc: string;
  estimated_arrival_utc: string;
  status: JourneyStatus;
  gate_or_berth?: string;
  boarding_close_utc?: string;
  source_system: string;
  source_entity_id: string;
  last_updated_utc: string;
}

export interface PassengerGroup {
  passenger_group_id: string;
  group_reference_token: string;
  pnr_token: string;
  passenger_count: number;
  prm_count: number;
  children_count: number;
  priority: boolean;
  source_system: string;
}

export type TrafficStatus = 'NORMAL' | 'MODERATE' | 'HEAVY' | 'DISRUPTED';

export interface Transfer {
  transfer_id: string;
  origin_location: string;
  destination_location: string;
  base_duration_minutes: number;
  current_duration_minutes: number;
  buffer_minutes: number;
  traffic_status: TrafficStatus;
  last_updated_utc: string;
}

export type ConnectionStatus = 'ACTIVE' | 'AT_RISK' | 'MISSED' | 'COMPLETED' | 'CANCELLED';

export interface Connection {
  connection_id: string;
  inbound_journey_id: string;
  outbound_journey_id: string;
  passenger_group_id: string;
  transfer_id: string;
  boarding_close_utc: string;
  connection_status: ConnectionStatus;
  site_code: string;
  last_evaluated_utc: string;
}

export type RiskSeverity = 'SAFE' | 'WATCH' | 'AT_RISK' | 'CRITICAL';

export type ReasonCode =
  | 'FLIGHT_DELAY'
  | 'FLIGHT_CANCELLED'
  | 'FERRY_DELAY'
  | 'FERRY_CANCELLED'
  | 'TRANSFER_DELAY'
  | 'SHORT_CONNECTION_WINDOW'
  | 'NEGATIVE_CONNECTION_MARGIN'
  | 'LARGE_GROUP'
  | 'PRM_PRESENT'
  | 'LAST_SAILING'
  | 'NO_ALTERNATIVE'
  | 'MISSING_PASSENGER_MAPPING'
  | 'MISSING_MANIFEST_MAPPING'
  | 'MANUAL_OVERRIDE'
  | 'RISK_RECOVERED';

export interface HumanOverride {
  overridden: boolean;
  original_severity?: RiskSeverity;
  override_severity?: RiskSeverity;
  reason_code?: ReasonCode;
  comment?: string;
  actor_id?: string;
  timestamp_utc?: string;
}

export interface RiskAssessment {
  risk_assessment_id: string;
  connection_id: string;
  calculated_at_utc: string;
  flight_eta_utc: string;
  deplaning_minutes: number;
  airport_exit_minutes: number;
  transfer_minutes: number;
  port_processing_minutes: number;
  safety_buffer_minutes: number;
  ready_to_board_utc: string;
  boarding_close_utc: string;
  connection_margin_minutes: number;
  base_severity: RiskSeverity;
  final_severity: RiskSeverity;
  risk_score: number;
  reason_codes: ReasonCode[];
  rule_version: string;
  human_override?: HumanOverride;
}

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'ESCALATED' | 'CLEARED' | 'CLOSED';

export interface Alert {
  alert_id: string;
  connection_id: string;
  risk_assessment_id: string;
  severity: RiskSeverity;
  status: AlertStatus;
  detected_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  deduplication_key: string;
  escalation_level: number;
}

export type CaseStatus = 'NEW' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface Case {
  case_id: string;
  case_number: string;
  connection_id: string;
  alert_id: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: CaseStatus;
  assigned_team: string;
  assigned_user?: string;
  created_at: string;
  sla_due_at: string;
  resolved_at?: string;
  closed_at?: string;
  resolution_code?: string;
  outcome_code?: 'MADE_CONNECTION' | 'MISSED_CONNECTION' | 'PROTECTED_ON_ALTERNATE' | 'CANCELLED';
  row_version: number;
}

export type TaskStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

export interface CaseTask {
  task_id: string;
  case_id: string;
  task_type: string;
  title: string;
  description: string;
  assigned_role: UserRole;
  assigned_user?: string;
  status: TaskStatus;
  due_at: string;
  completed_at?: string;
  dependency_task_id?: string;
  sequence: number;
}

export type InterventionType = 
  | 'EXPEDITE_AIRPORT_EXIT'
  | 'EXPEDITE_TRANSFER'
  | 'REQUEST_FERRY_HOLD'
  | 'MOVE_TO_ALTERNATE_SAILING'
  | 'OPERATIONAL_ESCALATION';

export interface Intervention {
  intervention_id: string;
  case_id: string;
  intervention_type: InterventionType;
  title: string;
  recommended: boolean;
  selected: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
  reason: string;
  created_at: string;
  completed_at?: string;
  outcome?: string;
  task_ids: string[];
}

export interface CaseComment {
  comment_id: string;
  case_id: string;
  author_name: string;
  author_role: UserRole;
  text: string;
  timestamp_utc: string;
}

export interface AuditEntry {
  audit_id: string;
  correlation_id: string;
  entity_type: 'CONNECTION' | 'RISK' | 'ALERT' | 'CASE' | 'TASK' | 'INTERVENTION' | 'CONFIG' | 'MOCK' | 'USER' | 'SITE';
  entity_id: string;
  action: string;
  actor_type: 'SYSTEM' | 'USER' | 'SIMULATION';
  actor_id: string;
  previous_value_json?: string;
  old_value_json?: string;
  new_value_json?: string;
  event_time: string;
  source_ip?: string;
}

export interface CanonicalEventEnvelope<T = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  event_version: string;
  event_time_utc: string;
  received_time_utc: string;
  source_system: string;
  source_entity_id: string;
  site_code: string;
  correlation_id: string;
  causation_id?: string;
  payload: T;
}

export type UserRole = 
  | 'CAR_DUTY_MANAGER'
  | 'CAR_AIRPORT_OPS'
  | 'CAR_FERRY_OPS'
  | 'CAR_SUPERVISOR'
  | 'CAR_ADMIN'
  | 'CAR_VIEWER';

export interface UserPermissions {
  can_override_risk: boolean;
  can_rebook_sailings: boolean;
  can_request_ferry_hold: boolean;
  can_manage_sites: boolean;
  can_edit_rules: boolean;
  can_assign_cases: boolean;
  can_access_admin: boolean;
}

export interface UserPersona {
  id: string;
  name: string;
  role: UserRole;
  team: string;
  email?: string;
  description: string;
  avatar: string;
  permissions?: UserPermissions;
  assigned_sites?: string[];
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface SiteMasterConfig {
  site_code: string;
  site_name: string;
  region: string;
  airport_code: string;
  airport_name: string;
  port_code: string;
  port_name: string;
  transfer_corridor: string;
  base_transfer_minutes: number;
  safety_buffer_minutes: number;
  high_traffic_multiplier: number;
  deplaning_window_minutes: number;
  prm_deplaning_buffer_minutes: number;
  port_processing_minutes: number;
  ferry_cutoff_minutes: number;
  max_ferry_hold_minutes: number;
  dispatch_contact: string;
  status: 'ACTIVE' | 'ONBOARDING' | 'MAINTENANCE';
  active_connections_count?: number;
  created_at: string;
  updated_at: string;
}

export interface RiskRuleConfig {
  safe_minimum_margin: number;
  watch_minimum_margin: number;
  at_risk_minimum_margin: number;
  critical_maximum_margin: number;
  default_deplaning_minutes: number;
  default_airport_exit_minutes: number;
  default_port_processing_minutes: number;
  default_safety_buffer_minutes: number;
  sla_critical_minutes: number;
  sla_at_risk_minutes: number;
  sla_watch_minutes: number;
  prm_transfer_multiplier?: number;
  large_group_threshold?: number;
  large_group_deplane_penalty?: number;
  max_ferry_hold_minutes?: number;
  auto_trigger_rebook_threshold?: number;
  traffic_surge_alert_threshold?: number;
}

export interface SiteCalculationConfig extends RiskRuleConfig {
  site_code?: string;
  is_custom_override?: boolean;
}

export interface GlobalConfig {
  rule_version: string;
  maintenance_mode: boolean;
  telemetry_heartbeat_seconds: number;
  dlq_max_retry_attempts: number;
  default_feed_timeout_ms: number;
  global_notification_webhook?: string;
  calculation_defaults: RiskRuleConfig;
}

export type FeedType =
  | 'FLIGHT_AODB'
  | 'MARINE_FERRY'
  | 'GROUND_TRAFFIC'
  | 'PASSENGER_PSS'
  | 'DISPATCH_WEBHOOK'
  | 'BAGGAGE_TELEMATICS';

export interface SiteFeedConfig {
  feed_id: string;
  feed_name: string;
  feed_type: FeedType;
  site_code: string;
  provider: string;
  endpoint_url: string;
  protocol: 'REST_JSON' | 'GTFS_RT' | 'ADS_B' | 'KAFKA' | 'WEBHOOK';
  polling_interval_seconds: number;
  auth_type: 'NONE' | 'API_KEY' | 'BEARER_TOKEN' | 'BASIC' | 'MUTUAL_TLS';
  auth_credential_masked?: string;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR' | 'DEGRADED';
  last_heartbeat_utc?: string;
  events_ingested_count: number;
  error_count: number;
  last_error_message?: string;
}

export interface SiteDeadLetterMessage {
  id: string;
  site_code: string;
  topic: string;
  reason: string;
  dead_lettered_at: string;
  payload_sample: string;
  retry_count: number;
  source_feed_id?: string;
}

export interface ThresholdConfig extends RiskRuleConfig {
  rule_version?: string;
  at_risk_threshold_minutes?: number;
  default_transfer_minutes?: number;
}

export interface DatabricksBronzeEvent {
  event_id: string;
  event_type: string;
  event_version: string;
  event_time: string;
  received_time: string;
  source_system: string;
  site_code: string;
  correlation_id: string;
  raw_payload: string;
  ingestion_time: string;
  is_valid: boolean;
}

export interface DatabricksSilverEntity {
  entity_id: string;
  entity_type: string;
  status: string;
  service_or_ref: string;
  effective_time: string;
  margin_or_duration?: number;
  pax_count?: number;
  severity?: string;
  updated_at: string;
}

export interface DatabricksGoldKPIs {
  total_connections: number;
  at_risk_connections: number;
  critical_connections: number;
  connections_saved: number;
  connections_missed: number;
  avg_detection_lead_time_minutes: number;
  avg_intervention_time_minutes: number;
  sla_compliance_percentage: number;
  passengers_protected: number;
}

export interface DatabricksAIReadyFeature {
  feature_id: string;
  flight_delay_minutes: number;
  connection_margin_minutes: number;
  passenger_count: number;
  prm_count: number;
  transfer_duration_minutes: number;
  time_of_day_utc: string;
  day_of_week: number;
  last_sailing_flag: boolean;
  alternative_sailing_count: number;
  risk_score: number;
  intervention_type?: string;
  connection_outcome: string;
}

export interface ScenarioTestResult {
  scenario_id: string;
  scenario_name: string;
  input_events: string;
  expected_risk: RiskSeverity;
  actual_risk: RiskSeverity;
  case_expected: boolean;
  case_created: boolean;
  expected_intervention: string;
  observed_intervention: string;
  final_outcome: string;
  passed: boolean;
}

export interface AlternateSailingOption {
  sailing_id: string;
  service_number: string;
  origin_code: string;
  destination_code: string;
  scheduled_departure_utc: string;
  boarding_close_utc: string;
  status: string;
  gate_or_berth: string;
  available_seats: number;
  total_capacity: number;
  projected_margin_minutes: number;
  projected_severity: RiskSeverity;
  recommended: boolean;
}
