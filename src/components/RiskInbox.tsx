import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { Case, Connection, Journey, PassengerGroup, RiskAssessment } from '../types/car';
import { exportToCsv } from '../utils/exportCsv';
import { useSSE } from '../hooks/useSSE';
import { soundAlerts } from '../utils/audioAlert';
import {
  Inbox,
  Filter,
  Search,
  Plane,
  Ship,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Download,
  CheckSquare,
  Square,
  Users,
  CheckCircle2,
  X,
  Radio
} from 'lucide-react';

interface CaseListItem {
  caseItem: Case;
  connection?: Connection;
  flight?: Journey;
  sailing?: Journey;
  group?: PassengerGroup;
  latestRisk?: RiskAssessment;
}

interface RiskInboxProps {
  onSelectCase: (caseId: string) => void;
}

export const RiskInbox: React.FC<RiskInboxProps> = ({ onSelectCase }) => {
  const [items, setItems] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [siteFilter, setSiteFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getCases({
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        site_code: siteFilter !== 'ALL' ? siteFilter : undefined
      });
      setItems(res.items);
    } catch (err) {
      console.error('Failed to load cases in inbox:', err);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter, siteFilter]);

  // Hook up SSE live auto-refresh
  useSSE(() => {
    loadCases();
  });

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.caseItem.case_number.toLowerCase().includes(q) ||
        item.flight?.service_number.toLowerCase().includes(q) ||
        item.sailing?.service_number.toLowerCase().includes(q) ||
        item.group?.group_reference_token.toLowerCase().includes(q) ||
        item.group?.pnr_token.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  // Selection handlers
  const allFilteredIds = useMemo(() => filtered.map(i => i.caseItem.case_id), [filtered]);
  const isAllSelected = filtered.length > 0 && allFilteredIds.every(id => selectedCaseIds.includes(id));
  const isPartiallySelected = selectedCaseIds.length > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCaseIds([]);
    } else {
      setSelectedCaseIds(allFilteredIds);
    }
  };

  const toggleSelectCase = (caseId: string) => {
    setSelectedCaseIds(prev =>
      prev.includes(caseId) ? prev.filter(id => id !== caseId) : [...prev, caseId]
    );
  };

  // Bulk Actions
  const handleBulkAcknowledge = async () => {
    if (selectedCaseIds.length === 0) return;
    try {
      setActionLoading(true);
      await api.batchUpdateCases({
        case_ids: selectedCaseIds,
        action: 'ACKNOWLEDGE',
        note: 'Acknowledged via Bulk Triage action bar'
      });
      soundAlerts.playSuccessChime();
      await loadCases();
      setSelectedCaseIds([]);
    } catch (err) {
      alert('Bulk acknowledge error: ' + err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAssignMe = async () => {
    if (selectedCaseIds.length === 0) return;
    try {
      setActionLoading(true);
      const user = await api.getCurrentUser();
      await api.batchUpdateCases({
        case_ids: selectedCaseIds,
        action: 'ASSIGN',
        assigned_to: user.name,
        assigned_team: user.team,
        note: `Claimed by ${user.name}`
      });
      soundAlerts.playSuccessChime();
      await loadCases();
      setSelectedCaseIds([]);
    } catch (err) {
      alert('Bulk assign error: ' + err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAssignTeam = async (team: string) => {
    if (selectedCaseIds.length === 0) return;
    try {
      setActionLoading(true);
      setTeamDropdownOpen(false);
      await api.batchUpdateCases({
        case_ids: selectedCaseIds,
        action: 'ASSIGN',
        assigned_team: team,
        note: `Assigned to team: ${team}`
      });
      soundAlerts.playSuccessChime();
      await loadCases();
      setSelectedCaseIds([]);
    } catch (err) {
      alert('Bulk assign team error: ' + err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkResolve = async () => {
    if (selectedCaseIds.length === 0) return;
    if (!confirm(`Are you sure you want to mark ${selectedCaseIds.length} case(s) as RESOLVED?`)) return;
    try {
      setActionLoading(true);
      await api.batchUpdateCases({
        case_ids: selectedCaseIds,
        action: 'RESOLVE',
        note: 'Bulk resolution confirmed by operator'
      });
      soundAlerts.playSuccessChime();
      await loadCases();
      setSelectedCaseIds([]);
    } catch (err) {
      alert('Bulk resolve error: ' + err);
    } finally {
      setActionLoading(false);
    }
  };

  // CSV Export functions
  const handleExportSelected = () => {
    const selectedItems = items.filter(i => selectedCaseIds.includes(i.caseItem.case_id));
    exportCasesToCsv(selectedItems, 'CaR_Selected_Cases');
  };

  const handleExportFiltered = () => {
    exportCasesToCsv(filtered, 'CaR_Filtered_Inbox_Cases');
  };

  const exportCasesToCsv = (caseList: CaseListItem[], filename: string) => {
    exportToCsv(caseList, filename, [
      { key: 'caseItem.case_number', label: 'Case Number' },
      { key: 'connection.site_code', label: 'Site Code' },
      { key: 'latestRisk.final_severity', label: 'Risk Severity' },
      { key: 'caseItem.priority', label: 'Priority' },
      { key: 'flight.service_number', label: 'Inbound Flight' },
      { key: 'sailing.service_number', label: 'Onward Ferry' },
      { key: 'latestRisk.connection_margin_minutes', label: 'Margin (min)' },
      { key: 'group.passenger_count', label: 'Pax Count' },
      { key: 'group.prm_count', label: 'PRM Count' },
      { key: 'caseItem.assigned_user', label: 'Assigned User' },
      { key: 'caseItem.assigned_team', label: 'Assigned Team' },
      { key: 'caseItem.status', label: 'Case Status' },
      { key: 'caseItem.created_at_utc', label: 'Created UTC' },
      { key: 'caseItem.sla_due_at', label: 'SLA Due UTC' }
    ]);
  };

  return (
    <div className="space-y-5 relative pb-16">
      {/* Header & Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Connection Risk Inbox</h2>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
              Live SSE Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Active cross-modal cases prioritized by severity, connection margin deficit, and SLA countdown.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Case, Flight, Ferry, PNR..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 w-52"
            />
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Risk:
            </span>
            {['ALL', 'CRITICAL', 'AT_RISK', 'WATCH'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-colors ${
                  severityFilter === sev
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">NEW</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          {/* Site Filter (Phase 2 Multi-Site Distribution) */}
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

          {/* Export Filtered CSV */}
          <button
            onClick={handleExportFiltered}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
            title="Export filtered inbox to CSV"
          >
            <Download className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            Export CSV
          </button>

          <button
            onClick={loadCases}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh inbox"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    title={isAllSelected ? 'Deselect all' : 'Select all'}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                    ) : isPartiallySelected ? (
                      <div className="w-4 h-4 bg-sky-500/20 border border-sky-500 rounded flex items-center justify-center">
                        <div className="w-2 h-0.5 bg-sky-500" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Risk Severity</th>
                <th className="py-3 px-4">Case #</th>
                <th className="py-3 px-4">Inbound Flight</th>
                <th className="py-3 px-4">Onward Ferry</th>
                <th className="py-3 px-4">Margin</th>
                <th className="py-3 px-4">Pax Impact</th>
                <th className="py-3 px-4">Primary Reason</th>
                <th className="py-3 px-4">SLA Countdown</th>
                <th className="py-3 px-4">Owner / Team</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500 dark:text-sky-400 mb-2" />
                    Loading cases from ODS...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No active cases match the filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const sev = item.latestRisk?.final_severity || 'SAFE';
                  const margin = item.latestRisk?.connection_margin_minutes ?? 0;
                  const isCrit = sev === 'CRITICAL';
                  const isAtRisk = sev === 'AT_RISK';
                  const isSelected = selectedCaseIds.includes(item.caseItem.case_id);

                  // SLA calculation
                  const slaDueMs = new Date(item.caseItem.sla_due_at).getTime();
                  const diffMinutes = Math.round((slaDueMs - Date.now()) / 60000);
                  const isSlaBreached = diffMinutes <= 0 && item.caseItem.status !== 'RESOLVED' && item.caseItem.status !== 'CLOSED';

                  return (
                    <tr
                      key={item.caseItem.case_id}
                      className={`transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100/60 dark:hover:bg-sky-900/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                      onClick={() => onSelectCase(item.caseItem.case_id)}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 px-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectCase(item.caseItem.case_id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sky-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded font-bold text-[11px] uppercase font-mono ${
                            isCrit
                              ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                              : isAtRisk
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                              : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/40'
                          }`}
                        >
                          {sev}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        <div>{item.caseItem.case_number}</div>
                        <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {item.connection?.site_code || 'SITE01'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                          <Plane className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                          {item.flight?.service_number}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          ETA: {new Date(item.flight?.estimated_arrival_utc || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} UTC
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                          <Ship className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                          {item.sailing?.service_number}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Cutoff: {new Date(item.connection?.boarding_close_utc || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} UTC
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold">
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

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white font-mono">
                          {item.group?.passenger_count} pax
                        </div>
                        {item.group?.prm_count ? (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                            {item.group.prm_count} PRM
                          </div>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/60">
                          {item.latestRisk?.reason_codes[0] || 'SHORT_BUFFER'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {item.caseItem.status === 'RESOLVED' || item.caseItem.status === 'CLOSED' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">RESOLVED</span>
                        ) : isSlaBreached ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                            BREACHED ({Math.abs(diffMinutes)}m)
                          </span>
                        ) : (
                          <span
                            className={
                              diffMinutes < 10 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-600 dark:text-slate-300'
                            }
                          >
                            {diffMinutes} min rem
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 dark:text-slate-200">
                          {item.caseItem.assigned_user || (
                            <span className="text-slate-400 dark:text-slate-500 italic">Unclaimed</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {item.caseItem.assigned_team}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {item.caseItem.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCase(item.caseItem.case_id);
                          }}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 ml-auto"
                        >
                          Workspace
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Sorting Order: CRITICAL first → lowest margin → nearest SLA breach</span>
          <span>Showing {filtered.length} of {items.length} cases</span>
        </div>
      </div>

      {/* FLOATING BULK ACTIONS TOOLBAR (Section 22: Rapid Operator Triage) */}
      {selectedCaseIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-500/50 shadow-2xl shadow-slate-900/10 dark:shadow-sky-950/80 rounded-2xl px-5 py-3 flex items-center gap-4 text-xs animate-in fade-in slide-in-from-bottom-4 backdrop-blur">
          <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-700 pr-4">
            <div className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-xs">
              {selectedCaseIds.length}
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">Cases Selected</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Acknowledge */}
            <button
              disabled={actionLoading}
              onClick={handleBulkAcknowledge}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold shadow-sm transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Acknowledge
            </button>

            {/* Claim (Assign to Me) */}
            <button
              disabled={actionLoading}
              onClick={handleBulkAssignMe}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold shadow-sm transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Claim (Assign Me)
            </button>

            {/* Assign to Team Dropdown */}
            <div className="relative">
              <button
                disabled={actionLoading}
                onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                Assign Team...
              </button>

              {teamDropdownOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden py-1 z-50">
                  {['Airport Hub Operations', 'Harbor Pier Operations', 'Ground Transport Dispatch'].map(team => (
                    <button
                      key={team}
                      onClick={() => handleBulkAssignTeam(team)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {team}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Resolve */}
            <button
              disabled={actionLoading}
              onClick={handleBulkResolve}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Resolve
            </button>

            {/* Export Selected CSV */}
            <button
              onClick={handleExportSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
              title="Download CSV for selected cases"
            >
              <Download className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              Export
            </button>

            {/* Deselect */}
            <button
              onClick={() => setSelectedCaseIds([])}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
