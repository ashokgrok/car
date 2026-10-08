import React, { useState, useEffect } from 'react';
import { api, ConnectionDetailResponse } from '../services/api';
import { Search, Compass, Plane, Ship, Users, RefreshCw, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ConnectionExplorerProps {
  onSelectCase: (caseId: string) => void;
}

export const ConnectionExplorer: React.FC<ConnectionExplorerProps> = ({ onSelectCase }) => {
  const [connections, setConnections] = useState<ConnectionDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<string>('ALL');
  const [siteFilter, setSiteFilter] = useState<string>('ALL');

  const loadConnections = async () => {
    try {
      setLoading(true);
      const res = await api.getConnections({
        severity: severity !== 'ALL' ? severity : undefined,
        site_code: siteFilter !== 'ALL' ? siteFilter : undefined,
        search: search || undefined
      });
      setConnections(res.items);
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, [severity, siteFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadConnections();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cross-Modal Connection Explorer</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse and inspect all 30 monitored airport-to-port connections, including safe baseline journeys.
          </p>
        </div>

        {/* Filter & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, Flight, Sailing, PNR..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 w-64"
            />
          </form>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            {['ALL', 'CRITICAL', 'AT_RISK', 'WATCH', 'SAFE'].map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-colors ${
                  severity === s
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Sites</option>
            <option value="SITE01">SITE01 - Vancouver</option>
            <option value="SITE02">SITE02 - Puget Sound</option>
            <option value="SITE03">SITE03 - Strait Passage</option>
          </select>

          <button
            onClick={loadConnections}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Connections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500 mb-2" />
            Loading connection inventory...
          </div>
        ) : connections.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500">
            No connections found matching your search.
          </div>
        ) : (
          connections.map((item) => {
            const sev = item.latestRisk?.final_severity || 'SAFE';
            const margin = item.latestRisk?.connection_margin_minutes ?? 0;
            const isCrit = sev === 'CRITICAL';
            const isAtRisk = sev === 'AT_RISK';
            const isWatch = sev === 'WATCH';

            return (
              <div
                key={item.connection.connection_id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {item.connection.connection_id}
                      </span>
                      <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {item.connection.site_code || 'SITE01'}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        isCrit
                          ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40'
                          : isAtRisk
                          ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40'
                          : isWatch
                          ? 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-500/40'
                          : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                      }`}
                    >
                      {sev}
                    </span>
                  </div>

                  {/* Flight & Ferry Details */}
                  <div className="space-y-2.5 bg-slate-50 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs mb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300">
                        <Plane className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                        <span className="font-bold">{item.flight?.service_number}</span>
                        <span className="text-slate-500 text-[11px]">({item.flight?.origin_code})</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        ETA {new Date(item.flight?.estimated_arrival_utc || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} UTC
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300">
                        <Ship className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span className="font-bold">{item.sailing?.service_number}</span>
                        <span className="text-slate-500 text-[11px]">({item.sailing?.destination_code})</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        Cutoff {new Date(item.connection.boarding_close_utc || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} UTC
                      </span>
                    </div>
                  </div>

                  {/* Passenger & Margin Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Passenger Group</span>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono">{item.group?.group_reference_token}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">({item.group?.passenger_count} pax)</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Connection Margin</span>
                      <span
                        className={`font-bold font-mono text-sm ${
                          isCrit ? 'text-rose-600 dark:text-rose-400' : isAtRisk ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {margin > 0 ? `+${margin} min` : `${margin} min`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Status: <strong className="text-slate-700 dark:text-slate-400 font-normal">{item.connection.connection_status}</strong>
                  </span>
                  {item.activeCase ? (
                    <button
                      onClick={() => onSelectCase(item.activeCase!.case_id)}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1 transition-colors"
                    >
                      Case Workspace
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Safe Buffer
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
