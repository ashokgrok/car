/**
 * Front-end API Client for CaR Backend Services
 */

import {
  UserPersona,
  RiskAssessment,
  Case,
  Connection,
  Journey,
  PassengerGroup,
  Transfer,
  CaseTask,
  Intervention,
  CaseComment,
  AuditEntry,
  DatabricksGoldKPIs,
  DatabricksBronzeEvent,
  DatabricksSilverEntity,
  DatabricksAIReadyFeature,
  ScenarioTestResult,
  RiskRuleConfig,
  AlternateSailingOption,
  SiteMasterConfig,
  SiteCalculationConfig,
  GlobalConfig,
  SiteFeedConfig,
  SiteDeadLetterMessage
} from '../types/car';

export interface ConnectionDetailResponse {
  connection: Connection;
  flight?: Journey;
  sailing?: Journey;
  group?: PassengerGroup;
  transfer?: Transfer;
  latestRisk?: RiskAssessment;
  riskHistory: RiskAssessment[];
  activeCase?: Case;
}

export interface AlternateSailingsResponse {
  connection_id: string;
  current_sailing: Journey;
  flight_eta: string;
  ready_to_board_utc: string;
  passengers_to_protect: number;
  alternates: AlternateSailingOption[];
}

export interface CaseDetailResponse {
  caseItem: Case;
  connection?: Connection;
  flight?: Journey;
  sailing?: Journey;
  group?: PassengerGroup;
  transfer?: Transfer;
  latestRisk?: RiskAssessment;
  riskHistory: RiskAssessment[];
  tasks: CaseTask[];
  interventions: Intervention[];
  comments: CaseComment[];
  auditTimeline: AuditEntry[];
}

export interface DeadLetterMessage {
  id: string;
  topic: string;
  reason: string;
  dead_lettered_at: string;
  payload_sample: string;
}

export interface LakehouseOverviewResponse {
  layers: {
    bronze: { recordCount: number; description: string };
    silver: { recordCount: number; description: string };
    gold: { recordCount: number; description: string };
  };
  gold: {
    kpis: DatabricksGoldKPIs;
    rootCauses: Array<{ cause: string; percentage: number; count: number }>;
  };
}

/**
 * Robust fetch wrapper with automatic retry and exponential backoff for transient failures
 */
async function safeFetch(url: string, options?: RequestInit, retries = 3, backoff = 400): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok && res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoff * Math.pow(1.8, attempt)));
        continue;
      }
      return res;
    } catch (err: any) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoff * Math.pow(1.8, attempt)));
        continue;
      }
      throw err;
    }
  }
  return fetch(url, options);
}

export const api = {
  // Auth & Personas
  async getPersonas(): Promise<{ currentUser: UserPersona; personas: UserPersona[] }> {
    const res = await safeFetch('/api/v1/auth/personas');
    if (!res.ok) throw new Error('Failed to fetch personas');
    return res.json();
  },

  async switchPersona(persona_id: string): Promise<{ currentUser: UserPersona }> {
    const res = await safeFetch('/api/v1/auth/personas/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id })
    });
    if (!res.ok) throw new Error('Failed to switch persona');
    return res.json();
  },

  // Dashboard
  async getDashboardSummary(siteCode?: string): Promise<{ kpis: DatabricksGoldKPIs; openCases: number; slaBreaches: number }> {
    const q = siteCode && siteCode !== 'ALL' ? `?site_code=${encodeURIComponent(siteCode)}` : '';
    const res = await safeFetch(`/api/v1/dashboard/summary${q}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard summary');
    return res.json();
  },

  async getRiskDistribution(siteCode?: string): Promise<Record<string, number>> {
    const q = siteCode && siteCode !== 'ALL' ? `?site_code=${encodeURIComponent(siteCode)}` : '';
    const res = await safeFetch(`/api/v1/dashboard/risk-distribution${q}`);
    if (!res.ok) throw new Error('Failed to fetch risk distribution');
    return res.json();
  },

  async getActivity(limit = 30): Promise<AuditEntry[]> {
    const res = await safeFetch(`/api/v1/dashboard/activity?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch operational activity');
    return res.json();
  },

  // Connections
  async getConnections(params?: { severity?: string; status?: string; search?: string; site_code?: string }): Promise<{ items: ConnectionDetailResponse[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.severity) q.append('severity', params.severity);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    if (params?.site_code && params.site_code !== 'ALL') q.append('site_code', params.site_code);
    const res = await safeFetch(`/api/v1/connections?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch connections');
    return res.json();
  },

  async getConnection(id: string): Promise<ConnectionDetailResponse> {
    const res = await safeFetch(`/api/v1/connections/${id}`);
    if (!res.ok) throw new Error('Failed to fetch connection detail');
    return res.json();
  },

  async getAlternateSailings(id: string): Promise<AlternateSailingsResponse> {
    const res = await safeFetch(`/api/v1/connections/${id}/alternate-sailings`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to fetch alternate sailings');
    }
    return res.json();
  },

  async rebookAlternateSailing(id: string, payload: { new_sailing_journey_id: string; reason?: string; note?: string }): Promise<any> {
    const res = await safeFetch(`/api/v1/connections/${id}/rebook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to rebook alternate sailing');
    }
    return res.json();
  },

  async recalculateConnection(id: string): Promise<{ assessment: RiskAssessment }> {
    const res = await safeFetch(`/api/v1/connections/${id}/recalculate`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to recalculate connection');
    return res.json();
  },

  // Risks & Overrides
  async applyOverride(connectionId: string, payload: { new_severity: string; reason_code: string; comment: string }): Promise<{ assessment: RiskAssessment }> {
    const res = await safeFetch(`/api/v1/risks/${connectionId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Override failed');
    }
    return res.json();
  },

  // Cases
  async getCases(params?: { status?: string; priority?: string; severity?: string; site_code?: string }): Promise<{ items: Array<{ caseItem: Case; connection?: Connection; flight?: Journey; sailing?: Journey; group?: PassengerGroup; latestRisk?: RiskAssessment }>; total: number }> {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.priority) q.append('priority', params.priority);
    if (params?.severity) q.append('severity', params.severity);
    if (params?.site_code && params.site_code !== 'ALL') q.append('site_code', params.site_code);
    const res = await safeFetch(`/api/v1/cases?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch cases');
    return res.json();
  },

  async getCase(id: string): Promise<CaseDetailResponse> {
    const res = await safeFetch(`/api/v1/cases/${id}`);
    if (!res.ok) throw new Error('Case not found');
    return res.json();
  },

  async claimCase(id: string): Promise<Case> {
    const res = await safeFetch(`/api/v1/cases/${id}/claim`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to claim case');
    return res.json();
  },

  async updateCaseStatus(id: string, status: string): Promise<Case> {
    const res = await safeFetch(`/api/v1/cases/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Invalid transition');
    }
    return res.json();
  },

  // Tasks & Interventions
  async completeTask(taskId: string): Promise<CaseTask> {
    const res = await safeFetch(`/api/v1/tasks/${taskId}/complete`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to complete task');
    }
    return res.json();
  },

  async selectIntervention(caseId: string, interventionId: string): Promise<Intervention> {
    const res = await safeFetch(`/api/v1/cases/${caseId}/interventions/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervention_id: interventionId })
    });
    if (!res.ok) throw new Error('Failed to select intervention');
    return res.json();
  },

  async completeIntervention(interventionId: string): Promise<Intervention> {
    const res = await safeFetch(`/api/v1/interventions/${interventionId}/complete`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to complete intervention');
    return res.json();
  },

  async addComment(caseId: string, text: string): Promise<CaseComment> {
    const res = await safeFetch(`/api/v1/cases/${caseId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Failed to add comment');
    return res.json();
  },

  // Simulation & Disruptions
  async delayFlight(flightId: string, delayMinutes: number): Promise<void> {
    await safeFetch(`/api/v1/mock/aodb/flights/${flightId}/delay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delay_minutes: delayMinutes })
    });
  },

  async cancelFlight(flightId: string): Promise<void> {
    await safeFetch(`/api/v1/mock/aodb/flights/${flightId}/cancel`, { method: 'POST' });
  },

  async restoreFlight(flightId: string): Promise<void> {
    await safeFetch(`/api/v1/mock/aodb/flights/${flightId}/restore`, { method: 'POST' });
  },

  async delayFerry(sailingId: string, delayMinutes: number): Promise<void> {
    await safeFetch(`/api/v1/mock/ferry/sailings/${sailingId}/delay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delay_minutes: delayMinutes })
    });
  },

  async cancelFerry(sailingId: string): Promise<void> {
    await safeFetch(`/api/v1/mock/ferry/sailings/${sailingId}/cancel`, { method: 'POST' });
  },

  async restoreFerry(sailingId: string): Promise<void> {
    await safeFetch(`/api/v1/mock/ferry/sailings/${sailingId}/restore`, { method: 'POST' });
  },

  async updateTraffic(transferId: string, trafficStatus: string, durationMinutes: number): Promise<void> {
    await safeFetch(`/api/v1/mock/transfer/${transferId}/traffic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traffic_status: trafficStatus, duration_minutes: durationMinutes })
    });
  },

  async runScenario(scenarioId: string): Promise<{ message: string; connectionId: string }> {
    const res = await safeFetch(`/api/v1/simulation/scenarios/${scenarioId}/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run scenario');
    return res.json();
  },

  async getVerificationMatrix(): Promise<ScenarioTestResult[]> {
    const res = await safeFetch('/api/v1/simulation/verification-matrix');
    if (!res.ok) throw new Error('Failed to fetch verification matrix');
    return res.json();
  },

  async resetDemo(): Promise<void> {
    await safeFetch('/api/v1/simulation/reset', { method: 'POST' });
  },

  // Medallion & Lakehouse
  async getMedallion(): Promise<{ bronze: DatabricksBronzeEvent[]; silver: DatabricksSilverEntity[]; aiFeatures: DatabricksAIReadyFeature[]; goldKpis: DatabricksGoldKPIs }> {
    const res = await safeFetch('/api/v1/analytics/medallion');
    if (!res.ok) throw new Error('Failed to fetch medallion data');
    return res.json();
  },

  async getLakehouseOverview(): Promise<LakehouseOverviewResponse> {
    const res = await safeFetch('/api/v1/analytics/lakehouse-overview');
    if (!res.ok) throw new Error('Failed to fetch lakehouse overview');
    return res.json();
  },

  // Health & Config & DLQ
  async getSystemHealth(): Promise<any> {
    const res = await safeFetch('/api/v1/system/health');
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  },

  async getDLQ(siteCode?: string): Promise<SiteDeadLetterMessage[]> {
    const url = siteCode && siteCode !== 'ALL'
      ? `/api/v1/system/dlq?site_code=${encodeURIComponent(siteCode)}`
      : '/api/v1/system/dlq';
    const res = await safeFetch(url);
    if (!res.ok) throw new Error('Failed to fetch DLQ');
    return res.json();
  },

  async retryDLQ(id: string, siteCode?: string): Promise<void> {
    const url = siteCode && siteCode !== 'ALL'
      ? `/api/v1/sites/${encodeURIComponent(siteCode)}/dlq/${encodeURIComponent(id)}/retry`
      : `/api/v1/system/dlq/${encodeURIComponent(id)}/retry`;
    await safeFetch(url, { method: 'POST' });
  },

  async purgeDLQ(id?: string, siteCode?: string): Promise<void> {
    if (id) {
      const url = siteCode && siteCode !== 'ALL'
        ? `/api/v1/sites/${encodeURIComponent(siteCode)}/dlq/${encodeURIComponent(id)}/purge`
        : `/api/v1/system/dlq/${encodeURIComponent(id)}/purge`;
      await safeFetch(url, { method: 'POST' });
    } else {
      const url = siteCode && siteCode !== 'ALL'
        ? `/api/v1/sites/${encodeURIComponent(siteCode)}/dlq`
        : '/api/v1/system/dlq';
      await safeFetch(url, { method: 'DELETE' });
    }
  },

  async simulatePoisonPill(siteCode: string, reason?: string): Promise<any> {
    const res = await safeFetch(`/api/v1/sites/${encodeURIComponent(siteCode)}/dlq/simulate-poison`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Corrupt Ingestion Byte Stream: Non-conforming UTF8' })
    });
    if (!res.ok) throw new Error('Failed to simulate poison pill');
    return res.json();
  },

  async getCurrentUser(): Promise<UserPersona> {
    const res = await safeFetch('/api/v1/auth/personas');
    if (!res.ok) throw new Error('Failed to fetch current user');
    const data = await res.json();
    return data.currentUser;
  },

  async setCurrentUser(persona_id: string): Promise<{ currentUser: UserPersona }> {
    return this.switchPersona(persona_id);
  },

  // Global Configuration
  async getGlobalConfig(): Promise<GlobalConfig> {
    const res = await safeFetch('/api/v1/config/global');
    if (!res.ok) throw new Error('Failed to fetch global configuration');
    return res.json();
  },

  async updateGlobalConfig(config: Partial<GlobalConfig>): Promise<GlobalConfig> {
    const res = await safeFetch('/api/v1/config/global', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to update global configuration');
    return res.json();
  },

  // Site-Specific Calculation Configuration
  async getSiteConfig(siteCode: string): Promise<SiteCalculationConfig> {
    const res = await safeFetch(`/api/v1/sites/${encodeURIComponent(siteCode)}/config`);
    if (!res.ok) throw new Error(`Failed to fetch config for site ${siteCode}`);
    return res.json();
  },

  async updateSiteConfig(siteCode: string, config: Partial<SiteCalculationConfig>): Promise<SiteCalculationConfig> {
    const res = await safeFetch(`/api/v1/sites/${encodeURIComponent(siteCode)}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(`Failed to update config for site ${siteCode}`);
    return res.json();
  },

  async resetSiteConfig(siteCode: string): Promise<SiteCalculationConfig> {
    const res = await safeFetch(`/api/v1/sites/${encodeURIComponent(siteCode)}/config/reset`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to reset config for site ${siteCode}`);
    return res.json();
  },

  // Site Integration Feeds & Systems
  async getSiteFeeds(siteCode: string): Promise<SiteFeedConfig[]> {
    const res = await safeFetch(`/api/v1/sites/${encodeURIComponent(siteCode)}/feeds`);
    if (!res.ok) throw new Error(`Failed to fetch feeds for site ${siteCode}`);
    return res.json();
  },

  async updateSiteFeed(siteCode: string, feedId: string, updates: Partial<SiteFeedConfig>): Promise<SiteFeedConfig> {
    const res = await safeFetch(`/api/v1/sites/${encodeURIComponent(siteCode)}/feeds/${encodeURIComponent(feedId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(`Failed to update feed ${feedId} for site ${siteCode}`);
    return res.json();
  },

  async testSiteFeed(siteCode: string, feedId: string): Promise<{ success: boolean; latency_ms: number; message: string; timestamp: string; status: 'ACTIVE' | 'ERROR' }> {
    const res = await safeFetch(`/api/v1/sites/${encodeURIComponent(siteCode)}/feeds/${encodeURIComponent(feedId)}/test`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to test feed ${feedId}`);
    return res.json();
  },

  async getConfig(): Promise<RiskRuleConfig> {
    const res = await safeFetch('/api/v1/config');
    if (!res.ok) throw new Error('Failed to fetch configuration');
    return res.json();
  },

  async updateConfig(config: Partial<RiskRuleConfig>): Promise<RiskRuleConfig> {
    const res = await safeFetch('/api/v1/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to update configuration');
    return res.json();
  },

  // Batch Case Operations (Section 22)
  async batchUpdateCases(params: {
    case_ids: string[];
    action: 'ACKNOWLEDGE' | 'ASSIGN' | 'STATUS_CHANGE' | 'RESOLVE';
    assigned_to?: string;
    assigned_team?: string;
    status?: string;
    note?: string;
  }): Promise<{ success: boolean; updated_count: number; cases: Case[] }> {
    const res = await safeFetch('/api/v1/cases/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to perform batch update');
    }
    return res.json();
  },

  // Site Master & Operations Config APIs
  async getSites(): Promise<SiteMasterConfig[]> {
    const res = await safeFetch('/api/v1/admin/sites');
    if (!res.ok) throw new Error('Failed to fetch sites from Site Master');
    return res.json();
  },

  async createSite(siteData: Partial<SiteMasterConfig>): Promise<SiteMasterConfig> {
    const res = await safeFetch('/api/v1/admin/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to onboard new site');
    }
    return res.json();
  },

  async updateSite(siteCode: string, updates: Partial<SiteMasterConfig>): Promise<SiteMasterConfig> {
    const res = await safeFetch(`/api/v1/admin/sites/${encodeURIComponent(siteCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to update site configuration');
    }
    return res.json();
  },

  async deleteSite(siteCode: string): Promise<{ message: string }> {
    const res = await safeFetch(`/api/v1/admin/sites/${encodeURIComponent(siteCode)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to delete site');
    }
    return res.json();
  },

  // User Accounts & RBAC Matrix APIs
  async getUsers(): Promise<UserPersona[]> {
    const res = await safeFetch('/api/v1/admin/users');
    if (!res.ok) throw new Error('Failed to fetch user directory');
    return res.json();
  },

  async createUser(userData: Partial<UserPersona>): Promise<UserPersona> {
    const res = await safeFetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to create user account');
    }
    return res.json();
  },

  async updateUser(userId: string, updates: Partial<UserPersona>): Promise<UserPersona> {
    const res = await safeFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to update user role and permissions');
    }
    return res.json();
  },

  async recalculateRisk(siteCode?: string): Promise<{ message: string; count: number }> {
    const url = siteCode && siteCode !== 'ALL'
      ? `/api/v1/sites/${encodeURIComponent(siteCode)}/recalculate`
      : '/api/v1/admin/recalculate';
    const res = await safeFetch(url, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to recalculate connection risk');
    }
    return res.json();
  },

  getExportConnectionsUrl(siteCode?: string): string {
    return siteCode && siteCode !== 'ALL'
      ? `/api/v1/export/connections.csv?site_code=${encodeURIComponent(siteCode)}`
      : '/api/v1/export/connections.csv';
  },

  getExportCasesUrl(siteCode?: string): string {
    return siteCode && siteCode !== 'ALL'
      ? `/api/v1/export/cases.csv?site_code=${encodeURIComponent(siteCode)}`
      : '/api/v1/export/cases.csv';
  },

  getExportAuditUrl(): string {
    return '/api/v1/export/audit.csv';
  }
};
