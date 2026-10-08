import React, { useState } from 'react';
import { AuditEntry, CaseComment, UserPersona } from '../types/car';
import { History, MessageSquare, Send, ShieldAlert, CheckCircle2, User, Activity } from 'lucide-react';

interface ActivityAndAuditTimelineProps {
  caseId: string;
  auditTimeline: AuditEntry[];
  comments: CaseComment[];
  currentUser: UserPersona;
  onAddComment: (text: string) => Promise<void>;
}

export const ActivityAndAuditTimeline: React.FC<ActivityAndAuditTimelineProps> = ({
  auditTimeline,
  comments,
  currentUser,
  onAddComment
}) => {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'audit' | 'comments'>('all');

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(commentText.trim());
      setCommentText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';
    } catch {
      return '--:--';
    }
  };

  // Merge audit items and comments chronologically
  const unifiedItems = [
    ...auditTimeline.map(a => ({
      id: a.audit_id,
      type: 'AUDIT' as const,
      timestamp: a.event_time,
      title: a.action.replace(/_/g, ' '),
      actor: `${a.actor_id} (${a.actor_type})`,
      description: a.new_value_json ? a.new_value_json : undefined,
      correlationId: a.correlation_id,
      entityType: a.entity_type
    })),
    ...comments.map(c => ({
      id: c.comment_id,
      type: 'COMMENT' as const,
      timestamp: c.timestamp_utc,
      title: 'Operator Note',
      actor: `${c.author_name} (${c.author_role.replace('CAR_', '')})`,
      description: c.text,
      correlationId: undefined,
      entityType: 'COMMENT'
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredItems = unifiedItems.filter(item => {
    if (viewMode === 'audit') return item.type === 'AUDIT';
    if (viewMode === 'comments') return item.type === 'COMMENT';
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-500 dark:text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Immutable Activity & Audit Timeline</h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                viewMode === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Unified Stream
            </button>
            <button
              onClick={() => setViewMode('audit')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                viewMode === 'audit' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              System Audits ({auditTimeline.length})
            </button>
            <button
              onClick={() => setViewMode('comments')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                viewMode === 'comments' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Comments ({comments.length})
            </button>
          </div>
        </div>
      </div>

      {/* Add Comment Input */}
      <form onSubmit={handleSubmitComment} className="mb-4 flex gap-2">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={`Add operational comment as ${currentUser.name}...`}
          className="flex-1 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={isSubmitting || !commentText.trim()}
          className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Send className="w-3 h-3" />
          Post Note
        </button>
      </form>

      {/* Timeline List */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">No activity logged yet.</p>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl flex items-start gap-3 text-xs"
            >
              <div className="mt-0.5 shrink-0">
                {item.type === 'COMMENT' ? (
                  <div className="w-6 h-6 rounded-full bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center">
                    <MessageSquare className="w-3 h-3" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center">
                    <Activity className="w-3 h-3" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-semibold text-slate-900 dark:text-slate-200">{item.title}</span>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">
                    {formatTime(item.timestamp)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
                  <span>Actor: <strong className="text-slate-800 dark:text-slate-300 font-normal">{item.actor}</strong></span>
                  {item.correlationId && (
                    <span className="font-mono text-[10px] text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1 rounded">
                      corr: {item.correlationId.slice(0, 8)}
                    </span>
                  )}
                </div>

                {item.description && (
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900/90 text-slate-800 dark:text-slate-300 font-mono text-[11px] break-words border border-slate-200 dark:border-slate-800/60">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
