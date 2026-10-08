import React, { useState, useEffect } from 'react';
import { api, CaseDetailResponse } from '../services/api';
import { UserPersona, RiskSeverity, ReasonCode, CaseStatus } from '../types/car';
import { JourneyTimeline } from './JourneyTimeline';
import { RiskExplanationPanel } from './RiskExplanationPanel';
import { PassengerImpactPanel } from './PassengerImpactPanel';
import { InterventionAndTaskPanel } from './InterventionAndTaskPanel';
import { ActivityAndAuditTimeline } from './ActivityAndAuditTimeline';
import { HumanOverrideModal } from './HumanOverrideModal';
import { AlternateSailingModal } from './AlternateSailingModal';
import {
  ShieldAlert,
  ArrowLeft,
  Clock,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Zap,
  Anchor
} from 'lucide-react';

interface CaseWorkspaceProps {
  caseId: string;
  currentUser: UserPersona;
  onBack: () => void;
  onCaseUpdated?: () => void;
}

export const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({
  caseId,
  currentUser,
  onBack,
  onCaseUpdated
}) => {
  const [data, setData] = useState<CaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [alternateModalOpen, setAlternateModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCase = async () => {
    try {
      setLoading(true);
      const res = await api.getCase(caseId);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load case');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCase();
  }, [caseId]);

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
        <span>Loading operational case workspace...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-rose-400 bg-rose-950/20 border border-rose-800 rounded-xl">
        <p className="font-semibold">{error || 'Case not found'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs"
        >
          Return to Inbox
        </button>
      </div>
    );
  }

  const { caseItem, flight, sailing, group, transfer, latestRisk, tasks, interventions, comments, auditTimeline } = data;

  const severity = latestRisk?.final_severity || 'SAFE';
  const margin = latestRisk?.connection_margin_minutes ?? 0;

  // SLA countdown
  const slaDueMs = new Date(caseItem.sla_due_at).getTime();
  const diffMinutes = Math.round((slaDueMs - Date.now()) / 60000);
  const isSlaBreached = diffMinutes <= 0 && caseItem.status !== 'RESOLVED' && caseItem.status !== 'CLOSED';

  // Case Status Handlers
  const handleTransition = async (status: CaseStatus) => {
    setActionLoading(true);
    try {
      await api.updateCaseStatus(caseId, status);
      await fetchCase();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err: any) {
      alert(`Transition error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaim = async () => {
    setActionLoading(true);
    try {
      await api.claimCase(caseId);
      await fetchCase();
      if (onCaseUpdated) onCaseUpdated();
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyOverride = async (newSeverity: RiskSeverity, reasonCode: ReasonCode, comment: string) => {
    await api.applyOverride(caseItem.connection_id, {
      new_severity: newSeverity,
      reason_code: reasonCode,
      comment
    });
    await fetchCase();
    if (onCaseUpdated) onCaseUpdated();
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar / Case Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Back to inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold font-mono text-slate-900 dark:text-white">{caseItem.case_number}</h2>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold font-sans uppercase tracking-wider ${
                  severity === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                    : severity === 'AT_RISK'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                    : severity === 'WATCH'
                    ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/40'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {severity}
              </span>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                {caseItem.status}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
              <span>Connection: <strong className="font-mono text-slate-800 dark:text-slate-300">{caseItem.connection_id}</strong></span>
              <span>•</span>
              <span>Flight: <strong className="text-slate-800 dark:text-slate-300">{flight?.service_number}</strong></span>
              <span>•</span>
              <span>Ferry: <strong className="text-slate-800 dark:text-slate-300">{sailing?.service_number}</strong></span>
              <span>•</span>
              <span>Passengers: <strong className="text-slate-800 dark:text-slate-300">{group?.passenger_count}</strong></span>
            </div>
          </div>
        </div>

        {/* SLA & Status Transitions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* SLA Counter */}
          <div
            className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 font-mono ${
              isSlaBreached
                ? 'bg-rose-50 dark:bg-rose-500/20 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
                : diffMinutes < 10
                ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>
              {caseItem.status === 'RESOLVED' || caseItem.status === 'CLOSED'
                ? 'SLA MET'
                : isSlaBreached
                ? `SLA BREACHED (${Math.abs(diffMinutes)}m ago)`
                : `SLA Due: ${diffMinutes} min`}
            </span>
          </div>

          {/* Assigned User */}
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>Owner: <strong className="text-slate-900 dark:text-white">{caseItem.assigned_user || 'Unassigned'}</strong></span>
          </div>

          {/* Claim Action */}
          {!caseItem.assigned_user && (
            <button
              onClick={handleClaim}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              Claim Case
            </button>
          )}

          {/* Status Transitions */}
          {caseItem.status === 'NEW' && (
            <button
              onClick={() => handleTransition('ACKNOWLEDGED')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Acknowledge
            </button>
          )}

          {(caseItem.status === 'NEW' || caseItem.status === 'ACKNOWLEDGED') && (
            <button
              onClick={() => handleTransition('IN_PROGRESS')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Start Handling
            </button>
          )}

          {caseItem.status === 'IN_PROGRESS' && (
            <button
              onClick={() => handleTransition('RESOLVED')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Resolve Case
            </button>
          )}

          {caseItem.status === 'RESOLVED' && (
            <button
              onClick={() => handleTransition('CLOSED')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Close Case
            </button>
          )}

          {/* Alternate Sailings Quick Action Button */}
          <button
            onClick={() => setAlternateModalOpen(true)}
            className="px-3 py-1.5 bg-sky-50 dark:bg-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/40 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Anchor className="w-3.5 h-3.5" />
            Alternate Sailings
          </button>

          {/* Override Button */}
          <button
            onClick={() => setOverrideModalOpen(true)}
            className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            Human Override
          </button>
        </div>
      </div>

      {/* 1. Journey Timeline Component */}
      <JourneyTimeline
        flight={flight}
        sailing={sailing}
        transfer={transfer}
        assessment={latestRisk}
      />

      {/* 2. Middle Row: Risk Explanation & Passenger Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {latestRisk && <RiskExplanationPanel assessment={latestRisk} />}
        <PassengerImpactPanel group={group} connection={data.connection} flight={flight} sailing={sailing} />
      </div>

      {/* 3. Interventions & Actionable Tasks Panel */}
      <InterventionAndTaskPanel
        caseId={caseId}
        connectionId={caseItem.connection_id}
        interventions={interventions}
        tasks={tasks}
        currentUser={currentUser}
        onOpenAlternateSailings={() => setAlternateModalOpen(true)}
        onSelectIntervention={async (id) => {
          await api.selectIntervention(caseId, id);
          await fetchCase();
        }}
        onCompleteIntervention={async (id) => {
          await api.completeIntervention(id);
          await fetchCase();
        }}
        onCompleteTask={async (id) => {
          await api.completeTask(id);
          await fetchCase();
        }}
      />

      {/* 4. Activity & Audit Timeline */}
      <ActivityAndAuditTimeline
        caseId={caseId}
        auditTimeline={auditTimeline}
        comments={comments}
        currentUser={currentUser}
        onAddComment={async (text) => {
          await api.addComment(caseId, text);
          await fetchCase();
        }}
      />

      {/* Human Override Modal */}
      <HumanOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        connectionId={caseItem.connection_id}
        currentSeverity={severity}
        currentUser={currentUser}
        onApplyOverride={handleApplyOverride}
      />

      {/* Alternate Sailing Rebooking Modal */}
      <AlternateSailingModal
        isOpen={alternateModalOpen}
        onClose={() => setAlternateModalOpen(false)}
        connectionId={caseItem.connection_id}
        caseId={caseId}
        onRebooked={async () => {
          await fetchCase();
          if (onCaseUpdated) onCaseUpdated();
        }}
      />
    </div>
  );
};
