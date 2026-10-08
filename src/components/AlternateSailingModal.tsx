import React, { useState, useEffect } from 'react';
import { api, AlternateSailingsResponse } from '../services/api';
import { AlternateSailingOption } from '../types/car';
import { soundAlerts } from '../utils/audioAlert';
import {
  Ship,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  X,
  Loader2,
  Sparkles,
  Compass,
  Anchor
} from 'lucide-react';

interface AlternateSailingModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  caseId?: string;
  onRebooked?: (result: any) => void;
}

export const AlternateSailingModal: React.FC<AlternateSailingModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  caseId,
  onRebooked
}) => {
  const [data, setData] = useState<AlternateSailingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSailingId, setSelectedSailingId] = useState<string | null>(null);
  const [rebookingNote, setRebookingNote] = useState<string>('Disruption recovery: Rebooking group onto scheduled alternate departure.');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !connectionId) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    api.getAlternateSailings(connectionId)
      .then(res => {
        if (!mounted) return;
        setData(res);
        // Auto-select recommended sailing if available
        const recommended = res.alternates.find(a => a.recommended);
        if (recommended) {
          setSelectedSailingId(recommended.sailing_id);
        } else if (res.alternates.length > 0) {
          setSelectedSailingId(res.alternates[0].sailing_id);
        }
      })
      .catch(err => {
        if (!mounted) return;
        setError(err.message || 'Failed to load alternate sailings');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, connectionId]);

  if (!isOpen) return null;

  const handleConfirmRebooking = async () => {
    if (!selectedSailingId) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await api.rebookAlternateSailing(connectionId, {
        new_sailing_journey_id: selectedSailingId,
        reason: 'OPERATOR_DISRUPTION_RECOVERY',
        note: rebookingNote
      });

      soundAlerts.playSuccessChime();
      setSuccessMessage('Group rebooking confirmed! Passes issued and connection margin recovered.');

      setTimeout(() => {
        if (onRebooked) onRebooked(result);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Rebooking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOption = data?.alternates.find(a => a.sailing_id === selectedSailingId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center">
              <Anchor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Alternate Sailing Rebooking Engine
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-mono uppercase">
                  Phase 2 Automation
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deterministic seat validation & connection window recovery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-500 dark:text-sky-400" />
              <p className="text-xs">Analyzing harbor departures and calculating connection margins...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 flex items-start gap-3 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Unable to Load Alternates</div>
                <div className="text-rose-600 dark:text-rose-400/80">{error}</div>
              </div>
            </div>
          ) : data ? (
            <>
              {/* Context Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                    Current Sailing
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                    <span>{data.current_sailing.service_number}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      data.current_sailing.status === 'CANCELLED'
                        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                    }`}>
                      {data.current_sailing.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Destination: {data.current_sailing.destination_code}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                    Passenger Group
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                    <span>{data.passengers_to_protect} Passengers</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Requires Guaranteed Seating
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                    Ready-To-Board ETA
                  </span>
                  <div className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                    <span>{new Date(data.ready_to_board_utc).toISOString().slice(11, 16)} UTC</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Flight ETA + Transit Buffer
                  </div>
                </div>
              </div>

              {/* Candidate Alternate Sailings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Candidate Sailings ({data.alternates.length} Available)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Select departure to issue new boarding passes
                  </span>
                </div>

                {data.alternates.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    No viable alternate sailings available for destination {data.current_sailing.destination_code}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.alternates.map((alt) => {
                      const isSelected = selectedSailingId === alt.sailing_id;
                      const hasCapacity = alt.available_seats >= data.passengers_to_protect;

                      return (
                        <div
                          key={alt.sailing_id}
                          onClick={() => hasCapacity && setSelectedSailingId(alt.sailing_id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-1 ring-sky-500/50 shadow-md'
                              : hasCapacity
                              ? 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                              : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800/40 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Selection Indicator */}
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-sky-500 border-sky-500 text-white'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                                    {alt.service_number}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                                    {alt.gate_or_berth}
                                  </span>
                                  {alt.recommended && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" /> Recommended
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
                                  <span>Departure: <strong className="text-slate-800 dark:text-slate-200 font-mono">{new Date(alt.scheduled_departure_utc).toISOString().slice(11, 16)} UTC</strong></span>
                                  <span>Boarding Cutoff: <strong className="text-slate-800 dark:text-slate-200 font-mono">{new Date(alt.boarding_close_utc).toISOString().slice(11, 16)} UTC</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Capacity & Margin Metrics */}
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-md ${
                                  alt.projected_severity === 'SAFE'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50'
                                    : alt.projected_severity === 'WATCH'
                                    ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-700/50'
                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50'
                                }`}>
                                  Margin: {alt.projected_margin_minutes > 0 ? `+${alt.projected_margin_minutes}m` : `${alt.projected_margin_minutes}m`} ({alt.projected_severity})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-end gap-1 font-mono">
                                <Users className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                <span className={hasCapacity ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400'}>
                                  {alt.available_seats} seats available
                                </span>
                                <span className="text-slate-400 dark:text-slate-600">/ {alt.total_capacity}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rationale & Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Rebooking Action Rationale (Appended to Audit Trail & Case Timeline)
                </label>
                <input
                  type="text"
                  value={rebookingNote}
                  onChange={(e) => setRebookingNote(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  placeholder="Operational justification for rebooking..."
                />
              </div>

              {/* Projection Card */}
              {selectedOption && (
                <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">Projected Recovery: </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        Connection moves to <strong>{selectedOption.service_number}</strong> with{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">+{selectedOption.projected_margin_minutes} min</strong> buffer ({selectedOption.projected_severity}).
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-mono tracking-wider font-bold">
                    PROTECTED
                  </span>
                </div>
              )}

              {/* Success Notification */}
              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmRebooking}
            disabled={!selectedSailingId || submitting || !!successMessage}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Issuing Alternate Boarding Passes...</span>
              </>
            ) : (
              <>
                <span>Confirm Rebooking & Issue Passes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
