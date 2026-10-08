import React, { useState } from 'react';
import { RiskSeverity, ReasonCode, UserPersona } from '../types/car';
import { ShieldAlert, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface HumanOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  currentSeverity: RiskSeverity;
  currentUser: UserPersona;
  onApplyOverride: (newSeverity: RiskSeverity, reasonCode: ReasonCode, comment: string) => Promise<void>;
}

export const HumanOverrideModal: React.FC<HumanOverrideModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  currentSeverity,
  currentUser,
  onApplyOverride
}) => {
  const [targetSeverity, setTargetSeverity] = useState<RiskSeverity>('WATCH');
  const [reasonCode, setReasonCode] = useState<ReasonCode>('MANUAL_OVERRIDE');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorMsg('A detailed operational justification comment is mandatory for human override compliance.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onApplyOverride(targetSeverity, reasonCode, comment.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit override');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasons: ReasonCode[] = [
    'MANUAL_OVERRIDE',
    'FERRY_DELAY',
    'SHORT_CONNECTION_WINDOW',
    'LARGE_GROUP',
    'PRM_PRESENT',
    'RISK_RECOVERED'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <ShieldAlert className="w-6 h-6 text-amber-500 dark:text-amber-400" />
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Apply Operational Human Override</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Connection ID: <span className="font-mono text-slate-800 dark:text-slate-200">{connectionId}</span></p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 inline mr-1.5 -mt-0.5" />
          <strong>Section 27 Compliance:</strong> All human adjustments are logged to the immutable audit trail. The deterministic automated severity (<span className="font-bold">{currentSeverity}</span>) will be permanently preserved for Databricks AI analytics.
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Adjusted Severity Target:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['SAFE', 'WATCH', 'AT_RISK', 'CRITICAL'] as RiskSeverity[]).map((sev) => (
                <button
                  type="button"
                  key={sev}
                  onClick={() => setTargetSeverity(sev)}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    targetSeverity === sev
                      ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:text-white'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason Code:
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Operational Justification (Mandatory):
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Harbor master confirmed 15-minute boarding extension for this flight arrival group."
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Actor Signature: <strong className="text-slate-800 dark:text-slate-200">{currentUser.name}</strong> ({currentUser.role})
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Signing Override...' : 'Apply & Audit Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
