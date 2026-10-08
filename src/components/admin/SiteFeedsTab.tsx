import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { SiteMasterConfig, SiteFeedConfig } from '../../types/car';
import {
  Radio,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  ExternalLink,
  Key,
  Clock,
  Zap,
  Edit2,
  Check,
  X,
  Plane,
  Users,
  Ship,
  Car,
  ShieldCheck,
  Globe,
  Wifi,
  WifiOff
} from 'lucide-react';

interface SiteFeedsTabProps {
  sites: SiteMasterConfig[];
  onFeedback: (message: string) => void;
  onError: (error: string) => void;
}

export const SiteFeedsTab: React.FC<SiteFeedsTabProps> = ({
  sites,
  onFeedback,
  onError
}) => {
  const [selectedSiteCode, setSelectedSiteCode] = useState<string>(sites[0]?.site_code || 'SITE01');
  const [feeds, setFeeds] = useState<SiteFeedConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingFeedId, setTestingFeedId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency_ms: number; message: string; timestamp: string }>>({});

  // Feed Edit Modal State
  const [editingFeed, setEditingFeed] = useState<SiteFeedConfig | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Load feeds for the selected site
  const loadSiteFeeds = async (siteCode: string) => {
    try {
      setLoading(true);
      const data = await api.getSiteFeeds(siteCode);
      setFeeds(data);
    } catch (err: any) {
      onError(`Failed to load feeds for ${siteCode}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSiteCode) {
      loadSiteFeeds(selectedSiteCode);
    }
  }, [selectedSiteCode]);

  // Test feed connectivity probe
  const handleTestFeed = async (feedId: string) => {
    try {
      setTestingFeedId(feedId);
      const result = await api.testSiteFeed(selectedSiteCode, feedId);
      setTestResults(prev => ({ ...prev, [feedId]: result }));
      if (result.success) {
        onFeedback(`Probe succeeded for ${feedId} (${result.latency_ms}ms)`);
      } else {
        onError(`Probe error on ${feedId}: ${result.message}`);
      }
      // Reload feeds to update status and last_sync
      await loadSiteFeeds(selectedSiteCode);
    } catch (err: any) {
      onError(`Connectivity test failed: ${err.message}`);
    } finally {
      setTestingFeedId(null);
    }
  };

  // Toggle Feed Enabled
  const handleToggleFeedEnabled = async (feed: SiteFeedConfig) => {
    try {
      const isCurrentlyActive = feed.status === 'ACTIVE';
      const newStatus = isCurrentlyActive ? 'PAUSED' : 'ACTIVE';
      const updated = await api.updateSiteFeed(selectedSiteCode, feed.feed_id, {
        status: newStatus
      });
      setFeeds(prev => prev.map(f => f.feed_id === feed.feed_id ? updated : f));
      onFeedback(`Feed ${feed.feed_name} ${newStatus === 'ACTIVE' ? 'activated' : 'paused'}.`);
    } catch (err: any) {
      onError(err.message);
    }
  };

  // Open Edit Modal
  const openEditModal = (feed: SiteFeedConfig) => {
    setEditingFeed({ ...feed });
  };

  // Save Modal
  const handleSaveFeedModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeed) return;
    try {
      setModalSaving(true);
      const updated = await api.updateSiteFeed(selectedSiteCode, editingFeed.feed_id, editingFeed);
      setFeeds(prev => prev.map(f => f.feed_id === updated.feed_id ? updated : f));
      setEditingFeed(null);
      onFeedback(`Feed ${updated.feed_name} configuration updated successfully.`);
    } catch (err: any) {
      onError(`Failed to save feed configuration: ${err.message}`);
    } finally {
      setModalSaving(false);
    }
  };

  const getSystemIcon = (category: string) => {
    switch (category) {
      case 'AODB': return <Plane className="w-4 h-4 text-sky-500" />;
      case 'PASSENGER_MANIFEST': return <Users className="w-4 h-4 text-emerald-500" />;
      case 'HARBOR_FERRY': return <Ship className="w-4 h-4 text-indigo-500" />;
      case 'FLEET_AVL': return <Car className="w-4 h-4 text-amber-500" />;
      case 'PORT_GATE': return <ShieldCheck className="w-4 h-4 text-rose-500" />;
      default: return <Server className="w-4 h-4 text-slate-500" />;
    }
  };

  const selectedSite = sites.find(s => s.site_code === selectedSiteCode);

  return (
    <div className="space-y-6">
      {/* Site Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Site-Specific Ingestion & Endpoints</div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Integration Systems & Feeds for {selectedSite?.site_name || selectedSiteCode} ({selectedSiteCode})
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              id="feed-site-selector"
              value={selectedSiteCode}
              onChange={(e) => setSelectedSiteCode(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              {sites.map(site => (
                <option key={site.site_code} value={site.site_code}>
                  📍 {site.site_code} - {site.site_name}
                </option>
              ))}
            </select>

            <button
              onClick={() => loadSiteFeeds(selectedSiteCode)}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Feeds</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-mono">Configured Systems</div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{feeds.length} Systems</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-mono">Active Ingestion</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {feeds.filter(f => f.enabled && f.status === 'ACTIVE').length} / {feeds.length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-mono">Corridor Context</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
              {selectedSite?.airport_code} ↔ {selectedSite?.port_code}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-mono">Total Cumulative Errors</div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {feeds.reduce((acc, f) => acc + (f.error_count || 0), 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-xs font-semibold">Polling feed configurations for {selectedSiteCode}...</p>
        </div>
      )}

      {/* Feeds List */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4">
          {feeds.map((feed) => {
            const probeResult = testResults[feed.feed_id];
            return (
              <div
                key={feed.feed_id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                {/* Header line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      {getSystemIcon(feed.feed_category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-white">{feed.feed_name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                          {feed.feed_category}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold">
                          {feed.protocol}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {feed.description}
                      </p>
                    </div>
                  </div>

                  {/* Status and Action buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
                    {/* Status Badge */}
                    {feed.status === 'ACTIVE' && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold font-mono text-[11px] border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        ACTIVE
                      </span>
                    )}
                    {feed.status === 'DEGRADED' && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold font-mono text-[11px] border border-amber-300 dark:border-amber-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        DEGRADED
                      </span>
                    )}
                    {feed.status === 'PAUSED' && (
                      <span className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold font-mono text-[11px] flex items-center gap-1.5">
                        <WifiOff className="w-3 h-3" />
                        PAUSED
                      </span>
                    )}
                    {feed.status === 'ERROR' && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-bold font-mono text-[11px] border border-rose-300 dark:border-rose-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" />
                        ERROR
                      </span>
                    )}

                    {/* Enable toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleFeedEnabled(feed)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        feed.status === 'ACTIVE'
                          ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      }`}
                    >
                      {feed.status === 'ACTIVE' ? 'Pause Feed' : 'Resume Feed'}
                    </button>

                    {/* Test Probe button */}
                    <button
                      type="button"
                      onClick={() => handleTestFeed(feed.feed_id)}
                      disabled={testingFeedId === feed.feed_id}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {testingFeedId === feed.feed_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>Test Probe</span>
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(feed)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit feed configuration"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Connection Parameters Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
                  <div className="md:col-span-2 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase block">Endpoint URL</span>
                    <div className="text-slate-900 dark:text-slate-100 font-bold truncate flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="truncate">{feed.endpoint_url}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase block">Auth Scheme</span>
                    <div className="text-slate-900 dark:text-slate-100 font-bold flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      <span>{feed.auth_type}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase block">Polling & Timeout</span>
                    <div className="text-slate-900 dark:text-slate-100 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{feed.polling_interval_seconds}s poll / {feed.timeout_ms}ms</span>
                    </div>
                  </div>
                </div>

                {/* Live Diagnostic Probe Output */}
                {probeResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                    probeResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {probeResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                      <span className="font-semibold">{probeResult.message}</span>
                    </div>
                    <div className="font-mono text-[11px] shrink-0 font-bold">
                      Roundtrip Latency: {probeResult.latency_ms}ms
                    </div>
                  </div>
                )}

                {/* Footer Sync Telemetry */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Last sync: {feed.last_sync_utc || 'Never'}</span>
                  <span>Max Retries: {feed.retry_attempts} attempts</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Feed Modal */}
      {editingFeed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {getSystemIcon(editingFeed.feed_category)}
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Configure Feed: {editingFeed.feed_name}
                </h3>
              </div>
              <button
                onClick={() => setEditingFeed(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFeedModal} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Endpoint URL</label>
                <input
                  type="text"
                  required
                  value={editingFeed.endpoint_url}
                  onChange={(e) => setEditingFeed({ ...editingFeed, endpoint_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 font-semibold block mb-1">Protocol</label>
                  <select
                    value={editingFeed.protocol}
                    onChange={(e) => setEditingFeed({ ...editingFeed, protocol: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  >
                    <option value="REST_POLL">REST_POLL (HTTP GET/POST)</option>
                    <option value="SSE">SSE (Server-Sent Events)</option>
                    <option value="WEBHOOK">WEBHOOK (HTTP Push)</option>
                    <option value="AMQP">AMQP (Azure Service Bus)</option>
                    <option value="KAFKA">KAFKA (Event Stream)</option>
                    <option value="SFTP">SFTP (Batch XML/CSV)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold block mb-1">Auth Type</label>
                  <select
                    value={editingFeed.auth_type}
                    onChange={(e) => setEditingFeed({ ...editingFeed, auth_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  >
                    <option value="BEARER_TOKEN">BEARER_TOKEN</option>
                    <option value="API_KEY">API_KEY</option>
                    <option value="OAUTH2">OAUTH2</option>
                    <option value="BASIC">BASIC</option>
                    <option value="MTLS">MTLS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-500 font-semibold block mb-1">Secret / Token / API Key</label>
                <input
                  type="text"
                  value={editingFeed.auth_secret || ''}
                  onChange={(e) => setEditingFeed({ ...editingFeed, auth_secret: e.target.value })}
                  placeholder="Bearer token or secret string..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-500 font-semibold block mb-1">Polling Interval (sec)</label>
                  <input
                    type="number"
                    value={editingFeed.polling_interval_seconds}
                    onChange={(e) => setEditingFeed({ ...editingFeed, polling_interval_seconds: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-500 font-semibold block mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    value={editingFeed.timeout_ms}
                    onChange={(e) => setEditingFeed({ ...editingFeed, timeout_ms: parseInt(e.target.value) || 5000 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-500 font-semibold block mb-1">Max Retries</label>
                  <input
                    type="number"
                    value={editingFeed.retry_attempts}
                    onChange={(e) => setEditingFeed({ ...editingFeed, retry_attempts: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFeed(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
                >
                  {modalSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Feed Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
