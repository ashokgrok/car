import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { SiteMasterConfig, SiteDeadLetterMessage } from '../../types/car';
import {
  AlertOctagon,
  Play,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Building2,
  AlertTriangle,
  Bug,
  Filter,
  Eye,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

interface DlqPartitionedTabProps {
  sites: SiteMasterConfig[];
  onFeedback: (message: string) => void;
  onError: (error: string) => void;
}

export const DlqPartitionedTab: React.FC<DlqPartitionedTabProps> = ({
  sites,
  onFeedback,
  onError
}) => {
  const [selectedSiteCode, setSelectedSiteCode] = useState<string>('ALL');
  const [dlqMessages, setDlqMessages] = useState<SiteDeadLetterMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  // Poison Pill Simulator Modal
  const [showPoisonModal, setShowPoisonModal] = useState(false);
  const [poisonTargetSite, setPoisonTargetSite] = useState<string>(sites[0]?.site_code || 'SITE01');
  const [poisonReason, setPoisonReason] = useState<string>('Schema Violation: Non-conforming UTF-8 ingestion payload in AODB stream');
  const [injecting, setInjecting] = useState(false);

  const loadDLQ = async (siteCode: string) => {
    try {
      setLoading(true);
      const data = await api.getDLQ(siteCode === 'ALL' ? undefined : siteCode);
      setDlqMessages(data);
    } catch (err: any) {
      onError(`Failed to load DLQ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDLQ(selectedSiteCode);
  }, [selectedSiteCode]);

  const handleRetry = async (msg: SiteDeadLetterMessage) => {
    try {
      setActionInProgress(msg.id);
      await api.retryDLQ(msg.id, msg.site_code);
      onFeedback(`Message ${msg.id} dispatched for reprocessing on ${msg.site_code}.`);
      await loadDLQ(selectedSiteCode);
    } catch (err: any) {
      onError(`Retry failed: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePurge = async (msg: SiteDeadLetterMessage) => {
    try {
      setActionInProgress(msg.id);
      await api.purgeDLQ(msg.id, msg.site_code);
      onFeedback(`Message ${msg.id} purged from ${msg.site_code} DLQ partition.`);
      await loadDLQ(selectedSiteCode);
    } catch (err: any) {
      onError(`Purge failed: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePurgeAll = async () => {
    const scopeName = selectedSiteCode === 'ALL' ? 'ALL sites' : `site ${selectedSiteCode}`;
    if (!confirm(`Are you sure you want to purge all dead-lettered messages for ${scopeName}? This action cannot be undone.`)) return;
    try {
      setLoading(true);
      await api.purgeDLQ(undefined, selectedSiteCode === 'ALL' ? undefined : selectedSiteCode);
      onFeedback(`All DLQ messages purged for ${scopeName}.`);
      await loadDLQ(selectedSiteCode);
    } catch (err: any) {
      onError(`Failed to purge DLQ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInjectPoison = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInjecting(true);
      const result = await api.simulatePoisonPill(poisonTargetSite, poisonReason);
      setShowPoisonModal(false);
      onFeedback(`Injected simulated poison pill into ${poisonTargetSite} partition (Event ${result.event_id}).`);
      await loadDLQ(selectedSiteCode);
    } catch (err: any) {
      onError(`Simulation failed: ${err.message}`);
    } finally {
      setInjecting(false);
    }
  };

  const togglePayload = (id: string) => {
    setExpandedPayloads(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Partition & Actions Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Site-Partitioned Dead Letter Queue</div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Azure Service Bus & Event Hubs Dead Letter Partition
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Site Partition Selector */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                id="dlq-site-partition-filter"
                value={selectedSiteCode}
                onChange={(e) => setSelectedSiteCode(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
              >
                <option value="ALL">🌐 All Sites (Global DLQ)</option>
                {sites.map(site => (
                  <option key={site.site_code} value={site.site_code}>
                    📍 {site.site_code} ({site.site_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Simulate Poison Pill Button */}
            <button
              onClick={() => setShowPoisonModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
              title="Inject a malformed payload to test site partition isolation"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Simulate Poison Pill</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => loadDLQ(selectedSiteCode)}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs transition-colors border border-slate-300 dark:border-slate-700"
              title="Refresh DLQ"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Purge All */}
            {dlqMessages.length > 0 && (
              <button
                onClick={handlePurgeAll}
                disabled={loading}
                className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge {selectedSiteCode === 'ALL' ? 'All' : selectedSiteCode}</span>
              </button>
            )}
          </div>
        </div>

        {/* Informational Subtext */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
          Events that fail deserialization, schema integrity checks, or feed connectivity are isolated into site-specific partitions. Corrupted messages in one corridor (e.g., MIA/SITE01) cannot starve or stall processing in another (e.g., FLL/SITE02).
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-2" />
          <p className="text-xs font-semibold">Querying partition queues...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && dlqMessages.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Partition Queue Clean
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Zero poison pills or deserialization failures detected in {selectedSiteCode === 'ALL' ? 'any site partition' : `${selectedSiteCode} partition`}.
          </p>
        </div>
      )}

      {/* Messages List */}
      {!loading && dlqMessages.length > 0 && (
        <div className="space-y-3">
          {dlqMessages.map((msg) => {
            const isExpanded = expandedPayloads[msg.id];
            const isProcessing = actionInProgress === msg.id;

            return (
              <div
                key={msg.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 hover:border-rose-300 dark:hover:border-rose-800 transition-all text-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{msg.id}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-700">
                        📍 {msg.site_code || 'GLOBAL'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                        {msg.topic}
                      </span>
                      <span className="text-[10px] text-slate-400">{msg.dead_lettered_at}</span>
                      {(msg.retry_count || 0) > 0 && (
                        <span className="text-[10px] text-indigo-500 font-semibold font-mono">
                          ({msg.retry_count} retries)
                        </span>
                      )}
                    </div>

                    <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5 pt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>{msg.reason}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                    <button
                      type="button"
                      onClick={() => togglePayload(msg.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1 font-semibold transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'Hide Payload' : 'View Payload'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRetry(msg)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      <span>Retry</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePurge(msg)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 font-semibold rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purge</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Payload Inspector */}
                {isExpanded && (
                  <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-800">
                    <pre className="whitespace-pre-wrap">{msg.payload_sample}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Poison Pill Simulator Modal */}
      {showPoisonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Simulate Poison Pill Ingestion
                </h3>
              </div>
              <button
                onClick={() => setShowPoisonModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Inject a simulated corrupted payload directly into a site partition. Use this to verify that corrupt payloads are immediately isolated to the target site DLQ and do not propagate cross-site faults.
            </p>

            <form onSubmit={handleInjectPoison} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Target Site Partition</label>
                <select
                  value={poisonTargetSite}
                  onChange={(e) => setPoisonTargetSite(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-xs text-slate-900 dark:text-white"
                >
                  {sites.map(site => (
                    <option key={site.site_code} value={site.site_code}>
                      📍 {site.site_code} - {site.site_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-500 font-semibold block mb-1">Failure Reason / Description</label>
                <input
                  type="text"
                  required
                  value={poisonReason}
                  onChange={(e) => setPoisonReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Realistic Test Presets</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPoisonReason('Schema Violation: Non-conforming UTF-8 ingestion payload in AODB stream')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Non-UTF8 Stream
                  </button>
                  <button
                    type="button"
                    onClick={() => setPoisonReason('Missing Required Attribute: passenger_group_id absent from DCS manifest')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Missing Manifest Key
                  </button>
                  <button
                    type="button"
                    onClick={() => setPoisonReason('Temporal Paradox: Touchdown estimated_arrival_utc timestamp in past century')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Corrupt Time Range
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPoisonModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={injecting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
                >
                  {injecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />}
                  <span>Inject Poison Pill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
