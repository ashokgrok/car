import React from 'react';
import { RiskAssessment } from '../types/car';
import { Calculator, ShieldAlert, Cpu, AlertCircle, UserCheck } from 'lucide-react';

interface RiskExplanationPanelProps {
  assessment: RiskAssessment;
}

export const RiskExplanationPanel: React.FC<RiskExplanationPanelProps> = ({ assessment }) => {
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';
    } catch {
      return '--:--';
    }
  };

  const margin = assessment.connection_margin_minutes;
  const isCritical = assessment.final_severity === 'CRITICAL';
  const isAtRisk = assessment.final_severity === 'AT_RISK';
  const isWatch = assessment.final_severity === 'WATCH';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Deterministic Risk Calculation</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            {assessment.rule_version}
          </span>
        </div>

        {/* Human Override Banner if active */}
        {assessment.human_override?.overridden && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <UserCheck className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800 dark:text-amber-300">
                Human Override Applied: {assessment.human_override.override_severity}
              </div>
              <div className="text-[11px] text-amber-700/80 dark:text-amber-200/80 mt-0.5">
                Automated Engine Result: <span className="font-mono">{assessment.base_severity}</span> | Actor: {assessment.human_override.actor_id}
              </div>
              <div className="text-[11px] italic mt-1 text-slate-600 dark:text-slate-300">
                "{assessment.human_override.comment}"
              </div>
            </div>
          </div>
        )}

        {/* Arithmetic Breakdown Formula Table */}
        <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800/80 font-mono text-xs space-y-1.5">
          <div className="flex justify-between text-slate-700 dark:text-slate-300">
            <span>Inbound Flight Touchdown (ETA)</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatTime(assessment.flight_eta_utc)}</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-3">
            <span>+ Deplaning & Disembarkation</span>
            <span>+{assessment.deplaning_minutes} min</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-3">
            <span>+ Terminal Exit & Baggage Claim</span>
            <span>+{assessment.airport_exit_minutes} min</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-3">
            <span>+ Airport-to-Port Coach Transit</span>
            <span>+{assessment.transfer_minutes} min</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-3">
            <span>+ Port Security & Check-in</span>
            <span>+{assessment.port_processing_minutes} min</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-3 pb-2 border-b border-slate-200 dark:border-slate-800">
            <span>+ Safety Operational Buffer</span>
            <span>+{assessment.safety_buffer_minutes} min</span>
          </div>

          <div className="flex justify-between text-sky-600 dark:text-sky-400 pt-1 font-semibold">
            <span>Predicted Ready to Board</span>
            <span>{formatTime(assessment.ready_to_board_utc)}</span>
          </div>
          <div className="flex justify-between text-slate-700 dark:text-slate-300">
            <span>Ferry Boarding Gate Cutoff</span>
            <span>{formatTime(assessment.boarding_close_utc)}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-sm font-bold">
            <span className="text-slate-900 dark:text-slate-200">Connection Margin</span>
            <span
              className={
                isCritical
                  ? 'text-rose-600 dark:text-rose-400'
                  : isAtRisk
                  ? 'text-amber-600 dark:text-amber-400'
                  : isWatch
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }
            >
              {margin > 0 ? `+${margin} min` : `${margin} min`}
            </span>
          </div>
        </div>

        {/* Severity & Score Badges */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Risk Severity</span>
            <span
              className={`inline-block mt-1 font-bold text-sm px-2 py-0.5 rounded ${
                isCritical
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                  : isAtRisk
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                  : isWatch
                  ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/40'
                  : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {assessment.final_severity}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Risk Score</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-bold text-lg text-slate-900 dark:text-white font-mono">{assessment.risk_score}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">/ 100</span>
            </div>
          </div>
        </div>

        {/* Reason Codes */}
        <div className="mt-4">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
            Active Reason Codes & Modifiers:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {assessment.reason_codes.length === 0 ? (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">None (Parameters within baseline limits)</span>
            ) : (
              assessment.reason_codes.map((code) => (
                <span
                  key={code}
                  className="px-2 py-0.5 text-[11px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                >
                  <AlertCircle className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                  {code}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          Deterministic Engine (No LLM)
        </span>
        <span>Audited: {formatTime(assessment.calculated_at_utc)}</span>
      </div>
    </div>
  );
};
