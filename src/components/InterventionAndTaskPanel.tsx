import React, { useState } from 'react';
import { Intervention, CaseTask, UserPersona } from '../types/car';
import {
  CheckSquare,
  Zap,
  Clock,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Anchor,
  Lock,
  ArrowDown
} from 'lucide-react';

interface InterventionAndTaskPanelProps {
  caseId: string;
  connectionId?: string;
  interventions: Intervention[];
  tasks: CaseTask[];
  currentUser: UserPersona;
  onSelectIntervention: (interventionId: string) => Promise<void>;
  onCompleteIntervention: (interventionId: string) => Promise<void>;
  onCompleteTask: (taskId: string) => Promise<void>;
  onOpenAlternateSailings?: () => void;
}

export const InterventionAndTaskPanel: React.FC<InterventionAndTaskPanelProps> = ({
  caseId,
  connectionId,
  interventions,
  tasks,
  currentUser,
  onSelectIntervention,
  onCompleteIntervention,
  onCompleteTask,
  onOpenAlternateSailings
}) => {
  const [activeTab, setActiveTab] = useState<'interventions' | 'tasks'>('interventions');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const handleSelect = async (id: string) => {
    setLoadingAction(id);
    try {
      await onSelectIntervention(id);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleComplete = async (id: string) => {
    setLoadingAction(id);
    try {
      await onCompleteIntervention(id);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTaskCheck = async (task: CaseTask) => {
    // Check client-side dependency
    if (task.dependency_task_id) {
      const prerequisite = tasks.find(t => t.task_id === task.dependency_task_id);
      if (prerequisite && prerequisite.status !== 'COMPLETED') {
        setTaskError(`Prerequisite Blocked: Please complete "${prerequisite.title}" (Step ${prerequisite.sequence || 1}) first.`);
        setTimeout(() => setTaskError(null), 4000);
        return;
      }
    }

    setLoadingAction(task.task_id);
    setTaskError(null);
    try {
      await onCompleteTask(task.task_id);
    } catch (err: any) {
      setTaskError(err.message || 'Failed to complete task');
      setTimeout(() => setTaskError(null), 5000);
    } finally {
      setLoadingAction(null);
    }
  };

  const pendingTasksCount = tasks.filter(t => t.status !== 'COMPLETED').length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        {/* Tab Toggle */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('interventions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'interventions'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Interventions ({interventions.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'tasks'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Actionable Tasks
              {pendingTasksCount > 0 && (
                <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                  {pendingTasksCount}
                </span>
              )}
            </button>
          </div>

          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Operating as: <strong className="text-slate-800 dark:text-slate-200">{currentUser.name}</strong>
          </span>
        </div>

        {taskError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <span>{taskError}</span>
          </div>
        )}

        {/* TAB 1: INTERVENTIONS */}
        {activeTab === 'interventions' && (
          <div className="space-y-3">
            {interventions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No interventions generated yet.</p>
            ) : (
              interventions.map((item) => {
                const isExecuted = item.status === 'EXECUTED' || item.status === 'COMPLETED';
                const isInProgress = item.status === 'IN_PROGRESS';
                const isAlternateSailing = item.intervention_type === 'MOVE_TO_ALTERNATE_SAILING';

                return (
                  <div
                    key={item.intervention_id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isExecuted
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/40'
                        : isAlternateSailing
                        ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-600/50 ring-1 ring-sky-300/50 dark:ring-sky-500/30'
                        : isInProgress
                        ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-500/40'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isAlternateSailing && (
                            <Anchor className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
                          )}
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</h4>
                          {item.recommended && (
                            <span className="text-[10px] font-semibold uppercase bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                          {isAlternateSailing && (
                            <span className="text-[10px] font-bold uppercase bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/40 px-1.5 py-0.5 rounded">
                              Phase 2 Rebooking
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              isExecuted
                                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                                : isInProgress
                                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{item.reason}</p>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isAlternateSailing && onOpenAlternateSailings && (
                          <button
                            onClick={onOpenAlternateSailings}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-sky-500/20 transition-all flex items-center gap-1.5"
                          >
                            <Anchor className="w-3.5 h-3.5" />
                            {isExecuted ? 'Review Alternate' : 'Find Alternate Sailings'}
                          </button>
                        )}

                        {!isExecuted && !isInProgress && !isAlternateSailing && (
                          <button
                            onClick={() => handleSelect(item.intervention_id)}
                            disabled={loadingAction === item.intervention_id}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            Select
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {isInProgress && !isAlternateSailing && (
                          <button
                            onClick={() => handleComplete(item.intervention_id)}
                            disabled={loadingAction === item.intervention_id}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Mark Done
                          </button>
                        )}

                        {isExecuted && !isAlternateSailing && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-4 h-4" />
                            Executed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: TASKS */}
        {activeTab === 'tasks' && (
          <div className="space-y-2.5">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No tasks created.</p>
            ) : (
              tasks.map((task, idx) => {
                const isCompleted = task.status === 'COMPLETED';
                const prerequisite = task.dependency_task_id
                  ? tasks.find(t => t.task_id === task.dependency_task_id)
                  : null;
                const isBlocked = prerequisite ? prerequisite.status !== 'COMPLETED' : false;

                return (
                  <div
                    key={task.task_id}
                    className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      isCompleted
                        ? 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 opacity-70'
                        : isBlocked
                        ? 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 border-dashed'
                        : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1">
                      <button
                        onClick={() => handleTaskCheck(task)}
                        disabled={isCompleted || loadingAction === task.task_id}
                        title={isBlocked ? `Requires "${prerequisite?.title}" first` : 'Click to complete'}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-400 text-white'
                            : isBlocked
                            ? 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                            : 'border-slate-300 dark:border-slate-600 hover:border-sky-500 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : isBlocked ? (
                          <Lock className="w-2.5 h-2.5" />
                        ) : null}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Step {task.sequence || idx + 1}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-200'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{task.description}</p>

                        {/* Prerequisite status pill */}
                        {prerequisite && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                            <span className="text-slate-500">Prerequisite:</span>
                            <span className={`px-1.5 py-0.2 rounded font-mono ${
                              prerequisite.status === 'COMPLETED'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 flex items-center gap-1'
                            }`}>
                              {prerequisite.status !== 'COMPLETED' && <Lock className="w-2.5 h-2.5" />}
                              Step {prerequisite.sequence || 1}: {prerequisite.title} ({prerequisite.status})
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                            <User className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                            {task.assigned_role.replace('CAR_', '')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            Due: {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                          {task.assigned_user && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">By: {task.assigned_user}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          isCompleted
                            ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                            : isBlocked
                            ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 border border-slate-200 dark:border-slate-700/60'
                            : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                        }`}
                      >
                        {task.status}
                      </span>
                      {isBlocked && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400/80 font-mono">
                          BLOCKED
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Workflow Engine / Service Bus: case-command</span>
        <span>Phase 2 Sequenced SLA Automation: Active</span>
      </div>
    </div>
  );
};
