import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  SiteMasterConfig,
  SiteCalculationConfig,
  GlobalConfig,
  RiskRuleConfig
} from '../../types/car';
import {
  Sliders,
  Clock,
  Car,
  Sparkles,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Globe,
  Building2,
  Info,
  Server,
  Bell
} from 'lucide-react';

interface SiteParametersTabProps {
  sites: SiteMasterConfig[];
  onFeedback: (message: string) => void;
  onError: (error: string) => void;
}

export const SiteParametersTab: React.FC<SiteParametersTabProps> = ({
  sites,
  onFeedback,
  onError
}) => {
  const [selectedScope, setSelectedScope] = useState<string>('GLOBAL');
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteCalculationConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load configuration based on selectedScope
  const loadConfig = async (scope: string) => {
    try {
      setLoading(true);
      if (scope === 'GLOBAL') {
        const cfg = await api.getGlobalConfig();
        setGlobalConfig(cfg);
        setSiteConfig(null);
      } else {
        const cfg = await api.getSiteConfig(scope);
        setSiteConfig(cfg);
      }
    } catch (err: any) {
      onError(`Failed to load configuration: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig(selectedScope);
  }, [selectedScope]);

  // Handle Global Config Save
  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalConfig) return;
    try {
      setSaving(true);
      const updated = await api.updateGlobalConfig(globalConfig);
      setGlobalConfig(updated);
      const recal = await api.recalculateRisk().catch(() => ({ count: 0 }));
      onFeedback(`Global parameters saved. Recalculated ${recal.count} active connections across all sites.`);
    } catch (err: any) {
      onError(`Failed to update global configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle Site Config Save
  const handleSaveSiteConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteConfig || selectedScope === 'GLOBAL') return;
    try {
      setSaving(true);
      const updated = await api.updateSiteConfig(selectedScope, siteConfig);
      setSiteConfig(updated);
      const recal = await api.recalculateRisk(selectedScope).catch(() => ({ count: 0 }));
      onFeedback(`Site ${selectedScope} calculation configuration updated. Recalculated ${recal.count} connections.`);
    } catch (err: any) {
      onError(`Failed to update site configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Reset site config to inherit global defaults
  const handleResetSiteConfig = async () => {
    if (selectedScope === 'GLOBAL') return;
    if (!confirm(`Reset ${selectedScope} calculation parameters to inherit Global Defaults? Any site-specific overrides will be removed.`)) return;
    try {
      setSaving(true);
      const reset = await api.resetSiteConfig(selectedScope);
      setSiteConfig(reset);
      const recal = await api.recalculateRisk(selectedScope).catch(() => ({ count: 0 }));
      onFeedback(`Site ${selectedScope} reset to inherit Global Defaults. Recalculated ${recal.count} connections.`);
    } catch (err: any) {
      onError(`Failed to reset site configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Trigger site or global recalculation
  const handleRecalculateCurrentScope = async () => {
    try {
      setSaving(true);
      const result = await api.recalculateRisk(selectedScope === 'GLOBAL' ? undefined : selectedScope);
      onFeedback(result.message || `Recalculation complete (${result.count} connections).`);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedSite = sites.find(s => s.site_code === selectedScope);

  return (
    <div className="space-y-6">
      {/* Scope Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              {selectedScope === 'GLOBAL' ? <Globe className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Parameter Configuration Scope</div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedScope === 'GLOBAL' ? 'Global Platform Defaults (All Sites)' : `${selectedSite?.site_name || selectedScope} (${selectedScope})`}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              id="scope-selector"
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
            >
              <option value="GLOBAL">🌐 Global Platform Defaults</option>
              <optgroup label="Site-Specific Overrides">
                {sites.map(site => (
                  <option key={site.site_code} value={site.site_code}>
                    📍 {site.site_code} - {site.site_name}
                  </option>
                ))}
              </optgroup>
            </select>

            <button
              onClick={handleRecalculateCurrentScope}
              disabled={saving}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
              title="Recalculate connections under this scope"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>Recalculate {selectedScope === 'GLOBAL' ? 'All' : selectedScope}</span>
            </button>
          </div>
        </div>

        {/* Site Override Status Banner */}
        {selectedScope !== 'GLOBAL' && siteConfig && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              {siteConfig.is_custom_override ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold font-mono text-[11px] border border-amber-300 dark:border-amber-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  CUSTOM SITE OVERRIDE ACTIVE
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-bold font-mono text-[11px] border border-sky-300 dark:border-sky-700 flex items-center gap-1.5">
                  <Globe className="w-3 h-3" />
                  INHERITING GLOBAL PLATFORM DEFAULTS
                </span>
              )}
              <span className="text-slate-500 dark:text-slate-400">
                Corridor: {selectedSite?.transfer_corridor || `${selectedSite?.airport_code} ↔ ${selectedSite?.port_code}`}
              </span>
            </div>

            {siteConfig.is_custom_override && (
              <button
                type="button"
                onClick={handleResetSiteConfig}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Inherit Global Defaults</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500 mb-2" />
          <p className="text-xs font-semibold">Loading scope configuration...</p>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. GLOBAL DEFAULTS CONFIGURATION FORM                     */}
      {/* ========================================================= */}
      {!loading && selectedScope === 'GLOBAL' && globalConfig && (
        <form onSubmit={handleSaveGlobal} className="space-y-6">
          {/* Global Platform Operational Settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Global Platform Governance & Telemetry Settings
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    System-wide operational parameters governing ingestion, DLQ policies, and monitoring heartbeats.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold">
                Rule Engine: {globalConfig.rule_version}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  System Availability & Mode
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">Maintenance Mode</div>
                      <div className="text-[11px] text-slate-500">Temporarily pause alert triggers</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={globalConfig.maintenance_mode}
                      onChange={(e) => setGlobalConfig({ ...globalConfig, maintenance_mode: e.target.checked })}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Rule Version Identifier</label>
                    <input
                      type="text"
                      value={globalConfig.rule_version}
                      onChange={(e) => setGlobalConfig({ ...globalConfig, rule_version: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-500" />
                  Telemetry & Feed Polling
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Telemetry Heartbeat (sec)</label>
                    <input
                      type="number"
                      value={globalConfig.telemetry_heartbeat_seconds}
                      onChange={(e) => setGlobalConfig({ ...globalConfig, telemetry_heartbeat_seconds: parseInt(e.target.value) || 30 })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Default Feed Timeout (ms)</label>
                    <input
                      type="number"
                      value={globalConfig.default_feed_timeout_ms}
                      onChange={(e) => setGlobalConfig({ ...globalConfig, default_feed_timeout_ms: parseInt(e.target.value) || 5000 })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  Reliability & Webhooks
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">DLQ Max Retry Attempts</label>
                    <input
                      type="number"
                      value={globalConfig.dlq_max_retry_attempts}
                      onChange={(e) => setGlobalConfig({ ...globalConfig, dlq_max_retry_attempts: parseInt(e.target.value) || 5 })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Global Escalation Webhook</label>
                    <input
                      type="text"
                      value={globalConfig.global_notification_webhook || ''}
                      onChange={(e) => setGlobalConfig({ ...globalConfig, global_notification_webhook: e.target.value })}
                      placeholder="https://webhook.site/..."
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Global Baseline Calculation Defaults */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Global Default Calculation Parameters
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sites that do not specify site-level parameter overrides inherit these values automatically.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Box 1: Margin Tiers */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  Connection Margin Thresholds (Min)
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">SAFE Minimum Margin (&ge; min)</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.safe_minimum_margin}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, safe_minimum_margin: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">WATCH Minimum Margin (&ge; min)</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.watch_minimum_margin}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, watch_minimum_margin: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-sky-600 dark:text-sky-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">AT_RISK Minimum Margin (&ge; min)</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.at_risk_minimum_margin}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, at_risk_minimum_margin: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">CRITICAL Threshold (&le; min)</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.critical_maximum_margin}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, critical_maximum_margin: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-rose-600 dark:text-rose-400"
                    />
                  </div>
                </div>
              </div>

              {/* Box 2: Transit Buffers */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Car className="w-4 h-4 text-sky-500" />
                  Corridor Buffers & Processing (Min)
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Default Deplaning Window</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.default_deplaning_minutes}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, default_deplaning_minutes: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Airport Exit & Baggage Clearance</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.default_airport_exit_minutes}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, default_airport_exit_minutes: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Base Transfer Duration</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.default_base_transfer_minutes}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, default_base_transfer_minutes: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Port Security & Check-in</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.default_port_processing_minutes}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, default_port_processing_minutes: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Baseline Safety Buffer</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.default_safety_buffer_minutes}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, default_safety_buffer_minutes: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Box 3: Modifiers */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Special Modifiers & Ferry Constraints
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">PRM Deplaning Buffer (min)</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.prm_deplaning_buffer_minutes}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, prm_deplaning_buffer_minutes: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">PRM Transfer Multiplier</label>
                    <input
                      type="number"
                      step="0.1"
                      value={globalConfig.calculation_defaults.prm_transfer_multiplier}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, prm_transfer_multiplier: parseFloat(e.target.value) || 1 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Large Group Threshold (pax)</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.large_group_threshold}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, large_group_threshold: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Large Group Delay Penalty (min)</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.large_group_delay_penalty_minutes}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, large_group_delay_penalty_minutes: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Maximum Ferry Hold Allowed (min)</label>
                    <input
                      type="number"
                      value={globalConfig.calculation_defaults.max_ferry_hold_minutes}
                      onChange={(e) => setGlobalConfig({
                        ...globalConfig,
                        calculation_defaults: { ...globalConfig.calculation_defaults, max_ferry_hold_minutes: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-sky-500 shrink-0" />
                Saving updates baseline defaults and recalculates all non-overridden site journeys.
              </span>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/30 flex items-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save Global Parameters & Recalculate</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* 2. SITE-SPECIFIC CALCULATION CONFIGURATION FORM           */}
      {/* ========================================================= */}
      {!loading && selectedScope !== 'GLOBAL' && siteConfig && (
        <form onSubmit={handleSaveSiteConfig} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedSite?.site_name} ({selectedScope}) Calculation Parameters
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fine-tune connection margins and transit buffers specifically for this terminal corridor.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteConfig.is_custom_override}
                    onChange={(e) => setSiteConfig({ ...siteConfig, is_custom_override: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Enable Custom Site Override</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Box 1: Margin Tiers */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  Site Margin Thresholds (Min)
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">SAFE Minimum Margin (&ge; min)</label>
                    <input
                      type="number"
                      value={siteConfig.safe_minimum_margin}
                      onChange={(e) => setSiteConfig({ ...siteConfig, safe_minimum_margin: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">WATCH Minimum Margin (&ge; min)</label>
                    <input
                      type="number"
                      value={siteConfig.watch_minimum_margin}
                      onChange={(e) => setSiteConfig({ ...siteConfig, watch_minimum_margin: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-sky-600 dark:text-sky-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">AT_RISK Minimum Margin (&ge; min)</label>
                    <input
                      type="number"
                      value={siteConfig.at_risk_minimum_margin}
                      onChange={(e) => setSiteConfig({ ...siteConfig, at_risk_minimum_margin: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">CRITICAL Threshold (&le; min)</label>
                    <input
                      type="number"
                      value={siteConfig.critical_maximum_margin}
                      onChange={(e) => setSiteConfig({ ...siteConfig, critical_maximum_margin: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-rose-600 dark:text-rose-400"
                    />
                  </div>
                </div>
              </div>

              {/* Box 2: Transit Buffers */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Car className="w-4 h-4 text-sky-500" />
                  Terminal & Corridor Buffers (Min)
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Deplaning Window (min)</label>
                    <input
                      type="number"
                      value={siteConfig.default_deplaning_minutes}
                      onChange={(e) => setSiteConfig({ ...siteConfig, default_deplaning_minutes: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Airport Exit & Baggage (min)</label>
                    <input
                      type="number"
                      value={siteConfig.default_airport_exit_minutes}
                      onChange={(e) => setSiteConfig({ ...siteConfig, default_airport_exit_minutes: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Base Transfer Duration (min)</label>
                    <input
                      type="number"
                      value={siteConfig.default_base_transfer_minutes}
                      onChange={(e) => setSiteConfig({ ...siteConfig, default_base_transfer_minutes: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Port Security & Check-in (min)</label>
                    <input
                      type="number"
                      value={siteConfig.default_port_processing_minutes}
                      onChange={(e) => setSiteConfig({ ...siteConfig, default_port_processing_minutes: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Safety Buffer (min)</label>
                    <input
                      type="number"
                      value={siteConfig.default_safety_buffer_minutes}
                      onChange={(e) => setSiteConfig({ ...siteConfig, default_safety_buffer_minutes: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Box 3: Modifiers */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Site-Specific Modifiers
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">PRM Deplaning Buffer (min)</label>
                    <input
                      type="number"
                      value={siteConfig.prm_deplaning_buffer_minutes}
                      onChange={(e) => setSiteConfig({ ...siteConfig, prm_deplaning_buffer_minutes: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">PRM Transfer Multiplier</label>
                    <input
                      type="number"
                      step="0.1"
                      value={siteConfig.prm_transfer_multiplier}
                      onChange={(e) => setSiteConfig({ ...siteConfig, prm_transfer_multiplier: parseFloat(e.target.value) || 1, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Large Group Threshold (pax)</label>
                    <input
                      type="number"
                      value={siteConfig.large_group_threshold}
                      onChange={(e) => setSiteConfig({ ...siteConfig, large_group_threshold: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Large Group Delay Penalty (min)</label>
                    <input
                      type="number"
                      value={siteConfig.large_group_delay_penalty_minutes}
                      onChange={(e) => setSiteConfig({ ...siteConfig, large_group_delay_penalty_minutes: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold block">Maximum Ferry Hold (min)</label>
                    <input
                      type="number"
                      value={siteConfig.max_ferry_hold_minutes}
                      onChange={(e) => setSiteConfig({ ...siteConfig, max_ferry_hold_minutes: parseInt(e.target.value) || 0, is_custom_override: true })}
                      className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-sky-500 shrink-0" />
                Saving will immediately trigger risk recalculation across all active journeys for {selectedScope}.
              </span>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/30 flex items-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save & Recalculate {selectedScope}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
