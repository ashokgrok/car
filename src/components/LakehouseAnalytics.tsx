import React, { useState, useEffect } from 'react';
import { api, LakehouseOverviewResponse } from '../services/api';
import {
  Database,
  Layers,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Clock,
  Users,
  RefreshCw,
  Cpu,
  BarChart3,
  Server
} from 'lucide-react';

export const LakehouseAnalytics: React.FC = () => {
  const [data, setData] = useState<LakehouseOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLakehouse = async () => {
    try {
      setLoading(true);
      const res = await api.getLakehouseOverview();
      setData(res);
    } catch (err) {
      console.error('Failed to load Lakehouse metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLakehouse();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
        Querying Databricks Medallion Lakehouse tables...
      </div>
    );
  }

  const kpis = data?.gold.kpis;
  const rootCauses = data?.gold.rootCauses || [];
  const layers = data?.layers;

  return (
    <div className="space-y-6">
      {/* Synthetic Disclaimer Banner (Section 45) */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Databricks Medallion Architecture Emulation & Analytics
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Powered by Delta Lake Bronze / Silver / Gold streaming pipelines with simulated ML feature store tables.
            </p>
          </div>
        </div>

        <button
          onClick={loadLakehouse}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Delta Tables
        </button>
      </div>

      {/* OPERATIONAL GOLD KPIS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Connections</div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">{kpis?.total_connections || 30}</div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Delta Gold Snapshot</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">At-Risk Identified</div>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-300 mt-1">{kpis?.at_risk_identified || 8}</div>
          <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1">Early Warnings</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Protected Pax %</div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-300 mt-1">{kpis?.protected_percent || 94.2}%</div>
          <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">Target ≥ 90%</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <div className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">Interventions Executed</div>
          <div className="text-xl font-bold font-mono text-sky-600 dark:text-sky-300 mt-1">{kpis?.interventions_executed || 5}</div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">SLA Standard</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Connections Saved</div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-300 mt-1">{kpis?.connections_saved || 4}</div>
          <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">Zero Missed Sailings</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Avg Mitigation Time</div>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-300 mt-1">{kpis?.avg_mitigation_time_minutes || 6.5}m</div>
          <div className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-1">Prompt Turnaround</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Human Override Rate</div>
          <div className="text-xl font-bold font-mono text-slate-800 dark:text-slate-300 mt-1">{kpis?.human_override_rate_percent || 4.2}%</div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Governance Monitored</div>
        </div>
      </div>

      {/* MEDALLION PIPELINE VISUALIZATION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Medallion Delta Lake Architecture</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Lakehouse Emulation / Unity Catalog</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bronze Layer */}
          <div className="bg-amber-50/50 dark:bg-slate-950/70 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Bronze (Raw Ingest)
                </span>
                <span className="font-mono text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-200 dark:border-slate-800">
                  {layers?.bronze.recordCount ?? 120} rows
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">{layers?.bronze.description}</p>

              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-amber-100 dark:border-slate-800/80">
                  raw_aodb_flights (Append-only)
                </div>
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-amber-100 dark:border-slate-800/80">
                  raw_ferry_schedules (Append-only)
                </div>
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-amber-100 dark:border-slate-800/80">
                  raw_passenger_manifests (Tokenized)
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Retention: 365 days</span>
              <span>Format: Parquet/Delta</span>
            </div>
          </div>

          {/* Silver Layer */}
          <div className="bg-sky-50/50 dark:bg-slate-950/70 border border-sky-200 dark:border-sky-900/40 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-sky-700 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Silver (Cleansed & Conformed)
                </span>
                <span className="font-mono text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-sky-200 dark:border-slate-800">
                  {layers?.silver.recordCount ?? 95} rows
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">{layers?.silver.description}</p>

              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-sky-100 dark:border-slate-800/80">
                  dim_flight & dim_sailing
                </div>
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-sky-100 dark:border-slate-800/80">
                  fact_connection_risk_snapshots
                </div>
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-sky-100 dark:border-slate-800/80">
                  dim_case_lifecycle & interventions
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-sky-200/60 dark:border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Data Quality: Enforced</span>
              <span>SCD Type 2: Active</span>
            </div>
          </div>

          {/* Gold Layer */}
          <div className="bg-emerald-50/50 dark:bg-slate-950/70 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Gold (Business Aggregates)
                </span>
                <span className="font-mono text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-slate-800">
                  {layers?.gold.recordCount ?? 30} rows
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">{layers?.gold.description}</p>

              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-emerald-100 dark:border-slate-800/80">
                  gold_daily_connection_sla_kpis
                </div>
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-emerald-100 dark:border-slate-800/80">
                  gold_root_cause_attribution
                </div>
                <div className="p-2 bg-white dark:bg-slate-900/90 rounded border border-emerald-100 dark:border-slate-800/80">
                  gold_ml_passenger_transfer_features
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Audience: Exec & ML Engineers</span>
              <span>Sync: Streaming</span>
            </div>
          </div>
        </div>
      </div>

      {/* DUAL SECTION: ROOT CAUSE BREAKDOWN & ML FEATURE STORE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Root Cause Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              Root Cause Disruption Attribution
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Past 30 Days Aggregate</span>
          </div>

          <div className="space-y-3">
            {rootCauses.map((rc) => (
              <div key={rc.cause} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{rc.cause}</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">{rc.percentage}% ({rc.count} cases)</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${rc.percentage}%` }}
                    className="h-full bg-sky-500 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI / ML Feature Store Showcase */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delta ML Feature Store</h3>
              </div>
              <span className="text-[11px] font-mono text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 px-2 py-0.5 rounded">
                Read-Only Features
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Curated features prepared for future machine learning delay prediction and transfer risk modeling:
            </p>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-sky-700 dark:text-sky-300 font-bold">feat_inbound_historical_delay_mean</span>
                  <div className="text-[11px] text-slate-500 font-sans">Rolling 30-day mean arrival delay for flight route</div>
                </div>
                <span className="text-slate-700 dark:text-slate-300">Float (12.4m)</span>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-sky-700 dark:text-sky-300 font-bold">feat_corridor_congestion_index</span>
                  <div className="text-[11px] text-slate-500 font-sans">Real-time highway traffic velocity ratio</div>
                </div>
                <span className="text-slate-700 dark:text-slate-300">Float (1.18x)</span>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-sky-700 dark:text-sky-300 font-bold">feat_prm_transfer_latency_delta</span>
                  <div className="text-[11px] text-slate-500 font-sans">Added dwell time required for special assistance</div>
                </div>
                <span className="text-slate-700 dark:text-slate-300">Int (+15m)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Unity Catalog Namespace: default.car_lakehouse</span>
            <span>Delta ACID Compliance: Validated</span>
          </div>
        </div>
      </div>
    </div>
  );
};
