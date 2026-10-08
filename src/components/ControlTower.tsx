import React, { useState, useEffect, useCallback } from 'react';
import { api, ConnectionDetailResponse } from '../services/api';
import { DatabricksGoldKPIs, AuditEntry, UserPersona } from '../types/car';
import { useSSE } from '../hooks/useSSE';
import { RegionalHubsMap } from './RegionalHubsMap';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Plane,
  Ship,
  TrendingUp,
  Users,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  MapPin,
  Building2,
  Radio
} from 'lucide-react';

interface ControlTowerProps {
  currentUser: UserPersona;
  onSelectCase: (caseId: string) => void;
  onOpenSimulator: () => void;
}

const SITES = [
  { code: 'ALL', label: 'All Sites (Global)', subtitle: 'Consolidated Network' },
  { code: 'SITE01', label: 'SITE01 - Vancouver Metro', subtitle: 'YVR Air / Tsawwassen Marine' },
  { code: 'SITE02', label: 'SITE02 - Puget Sound', subtitle: 'Seattle Air / Anacortes Port' },
  { code: 'SITE03', label: 'SITE03 - Strait Passage', subtitle: 'Bellingham / Sidney Marine' }
];

export const ControlTower: React.FC<ControlTowerProps> = ({
  currentUser,
  onSelectCase,
  onOpenSimulator
}) => {
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [kpis, setKpis] = useState<DatabricksGoldKPIs | null>(null);
  const [openCases, setOpenCases] = useState(0);
  const [slaBreaches, setSlaBreaches] = useState(0);
  const [riskDistribution, setRiskDistribution] = useState<Record<string, number>>({ SAFE: 0, WATCH: 0, AT_RISK: 0, CRITICAL: 0 });
  const [priorityConnections, setPriorityConnections] = useState<ConnectionDetailResponse[]>([]);
  const [allConnections, setAllConnections] = useState<ConnectionDetailResponse[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRetry = false) => {
    try {
      if (!isRetry) setLoading(true);
      const [summaryRes, distRes, connRes, actRes, allConnRes] = await Promise.all([
        api.getDashboardSummary(selectedSite),
        api.getRiskDistribution(selectedSite),
        api.getConnections({ site_code: selectedSite }),
        api.getActivity(15),
        api.getConnections({ site_code: 'ALL' })
      ]);

      setKpis(summaryRes.kpis);
      setOpenCases(summaryRes.openCases);
      setSlaBreaches(summaryRes.slaBreaches);
      setRiskDistribution(distRes);
      setActivity(actRes);
      setAllConnections(allConnRes.items || []);
      setError(null);

      // Filter priority connections: CRITICAL & AT_RISK first, then lowest margin
      const sorted = [...connRes.items].sort((a, b) => {
        const sevOrder: Record<string, number> = { CRITICAL: 0, AT_RISK: 1, WATCH: 2, SAFE: 3 };
        const sA = sevOrder[a.latestRisk?.final_severity || 'SAFE'];
        const sB = sevOrder[b.latestRisk?.final_severity || 'SAFE'];
        if (sA !== sB) return sA - sB;
        return (a.latestRisk?.connection_margin_minutes ?? 0) - (b.latestRisk?.connection_margin_minutes ?? 0);
      });

      setPriorityConnections(sorted.slice(0, 8));
    } catch (err: any) {
      console.warn('Control Tower data load error, scheduled auto-retry:', err);
      setError(err?.message || 'Connection to operational telemetry interrupted.');
      // Auto-retry in 3 seconds
      setTimeout(() => {
        loadData(true);
      }, 3000);
    } finally {
      setLoading(false);
    }
  }, [selectedSite]);

  // Real-time event push updates
  useSSE(() => {
    loadData(true);
  });

  useEffect(() => {
    loadData();
    // Gentle 30s background sync fallback
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const total = (riskDistribution.SAFE || 0) + (riskDistribution.WATCH || 0) + (riskDistribution.AT_RISK || 0) + (riskDistribution.CRITICAL || 0) || 1;
  const criticalPct = Math.round(((riskDistribution.CRITICAL || 0) / total) * 100);
  const atRiskPct = Math.round(((riskDistribution.AT_RISK || 0) / total) * 100);
  const watchPct = Math.round(((riskDistribution.WATCH || 0) / total) * 100);
  const safePct = 100 - criticalPct - atRiskPct - watchPct;

  return (
    <div className="space-y-6">
      {/* SITE SELECTOR BAR (Phase 2 Multi-Site Operations) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Operational Site:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          {SITES.map((site) => {
            const isSelected = selectedSite === site.code;
            return (
              <button
                key={site.code}
                onClick={() => setSelectedSite(site.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 antialiased ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/70'
                }`}
              >
                <MapPin className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className="antialiased tracking-normal">{site.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden md:block">
          Distribution: <strong className="text-slate-800 dark:text-slate-200">{selectedSite}</strong>
        </div>
      </div>

      {/* Connection Notice Banner if stream sync stalls */}
      {error && (
        <div className="bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 p-3.5 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>Operational Feed Notice: {error}</span>
          </div>
          <button
            onClick={() => loadData(false)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-md transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* KPI METRICS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Active Conns</div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">{kpis?.total_connections || 30}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Live Ingest
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] text-amber-600 dark:text-yellow-400 font-medium uppercase tracking-wider">Watch</div>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-yellow-300 mt-1">{riskDistribution.WATCH || 0}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Margin 16-30m</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 p-4 rounded-xl shadow-sm bg-amber-50/50 dark:bg-amber-950/10">
          <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wider">At Risk</div>
          <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">{riskDistribution.AT_RISK || 0}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400/80 mt-1">Margin 1-15m</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl shadow-sm bg-rose-50/50 dark:bg-rose-950/10">
          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium uppercase tracking-wider">Critical</div>
          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-300 mt-1">{riskDistribution.CRITICAL || 0}</div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400/80 mt-1">Margin ≤ 0m</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] text-sky-600 dark:text-sky-400 font-medium uppercase tracking-wider">Open Cases</div>
          <div className="text-xl font-bold font-mono text-sky-600 dark:text-sky-300 mt-1">{openCases}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Workflow Engine</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium uppercase tracking-wider">SLA Breaches</div>
          <div className={`text-xl font-bold font-mono mt-1 ${slaBreaches > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {slaBreaches}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{slaBreaches > 0 ? 'Action Req' : 'None'}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium uppercase tracking-wider">Pax Impacted</div>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-300 mt-1">{kpis?.passengers_protected || 142}</div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400/80 mt-1">Protected</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-xl shadow-sm bg-emerald-50/50 dark:bg-emerald-950/10">
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider">Saved Conns</div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-300 mt-1">{kpis?.connections_saved || 4}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-1">Target 95%</div>
        </div>
      </div>

      {/* RISK DISTRIBUTION BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Live Cross-Modal Risk Distribution</h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Total Monitored: <strong className="text-slate-900 dark:text-white font-mono">{total}</strong>
          </span>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div style={{ width: `${criticalPct}%` }} className="bg-rose-500 transition-all duration-500" title={`Critical: ${criticalPct}%`} />
          <div style={{ width: `${atRiskPct}%` }} className="bg-amber-500 transition-all duration-500" title={`At Risk: ${atRiskPct}%`} />
          <div style={{ width: `${watchPct}%` }} className="bg-yellow-400 transition-all duration-500" title={`Watch: ${watchPct}%`} />
          <div style={{ width: `${safePct}%` }} className="bg-emerald-500 transition-all duration-500" title={`Safe: ${safePct}%`} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-700 dark:text-slate-300">Critical ({riskDistribution.CRITICAL || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-700 dark:text-slate-300">At Risk ({riskDistribution.AT_RISK || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="text-slate-700 dark:text-slate-300">Watch ({riskDistribution.WATCH || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-700 dark:text-slate-300">Safe ({riskDistribution.SAFE || 0})</span>
          </div>
        </div>
      </div>

      {/* REGIONAL TRANSFER HUBS & RISK CONCENTRATION MAP */}
      <RegionalHubsMap
        selectedSite={selectedSite}
        onSelectSite={setSelectedSite}
        connections={allConnections.length > 0 ? allConnections : priorityConnections}
        onSelectCase={onSelectCase}
      />

      {/* MAIN DUAL GRID: PRIORITY CONNECTIONS + LIVE ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Connections Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Priority Connections Requiring Action</h3>
              </div>
              <button
                onClick={onOpenSimulator}
                className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 font-semibold flex items-center gap-1"
              >
                Inject Disruption
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Risk</th>
                    <th className="py-2.5 px-3">Site</th>
                    <th className="py-2.5 px-3">Flight / ETA</th>
                    <th className="py-2.5 px-3">Ferry / Cutoff</th>
                    <th className="py-2.5 px-3">Margin</th>
                    <th className="py-2.5 px-3">Pax</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {priorityConnections.map((item) => {
                    const sev = item.latestRisk?.final_severity || 'SAFE';
                    const margin = item.latestRisk?.connection_margin_minutes ?? 0;
                    const isCrit = sev === 'CRITICAL';
                    const isAtRisk = sev === 'AT_RISK';

                    return (
                      <tr key={item.connection.connection_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase font-mono ${
                              isCrit
                                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                                : isAtRisk
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                                : sev === 'WATCH'
                                ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/40'
                                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            {sev}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.connection.site_code || 'SITE01'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            <Plane className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                            {item.flight?.service_number}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {new Date(item.flight?.estimated_arrival_utc || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} UTC
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            <Ship className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                            {item.sailing?.service_number}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {new Date(item.connection.boarding_close_utc || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} UTC
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono font-bold">
                          <span
                            className={
                              isCrit
                                ? 'text-rose-600 dark:text-rose-400'
                                : isAtRisk
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {margin > 0 ? `+${margin}m` : `${margin}m`}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono text-slate-900 dark:text-white font-semibold">{item.group?.passenger_count}</span>
                          {item.group?.prm_count ? (
                            <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-1 py-0.2 rounded font-semibold">
                              PRM
                            </span>
                          ) : null}
                        </td>

                        <td className="py-3 px-3">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.activeCase ? item.activeCase.case_number : 'Monitoring'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          {item.activeCase ? (
                            <button
                              onClick={() => onSelectCase(item.activeCase!.case_id)}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded transition-colors"
                            >
                              Open Case
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">Safe Buffer</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Partition Key: connection_id</span>
            <span>Real-time Stream: Active</span>
          </div>
        </div>

        {/* Live Operational Activity (1 Col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live Event Backbone Stream</h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" title="Live stream active" />
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {activity.map((item) => (
                <div
                  key={item.audit_id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">{item.action}</span>
                    <span className="font-mono text-slate-400 dark:text-slate-500">
                      {new Date(item.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC
                    </span>
                  </div>

                  <div className="text-slate-700 dark:text-slate-300 text-[11px]">
                    Actor: <strong className="text-slate-900 dark:text-white font-medium">{item.actor_id}</strong>
                  </div>

                  {item.new_value_json && (
                    <div className="mt-1 text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded truncate border border-slate-200 dark:border-slate-800/60">
                      {item.new_value_json}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
            Consumer Group: <span className="font-mono text-slate-600 dark:text-slate-400">operational-state</span>
          </div>
        </div>
      </div>
    </div>
  );
};
