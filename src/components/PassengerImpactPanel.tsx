import React from 'react';
import { PassengerGroup, Connection, Journey } from '../types/car';
import { Users, Accessibility, Baby, ShieldCheck, Tag, Ticket } from 'lucide-react';

interface PassengerImpactPanelProps {
  group?: PassengerGroup;
  connection?: Connection;
  flight?: Journey;
  sailing?: Journey;
}

export const PassengerImpactPanel: React.FC<PassengerImpactPanelProps> = ({
  group,
  flight,
  sailing
}) => {
  if (!group) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-center text-slate-500 dark:text-slate-400">
        No passenger group details attached.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Synthetic Passenger Group Profile</h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded">
            Tokenized Identity (PII Safe)
          </span>
        </div>

        {/* Tokens Row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] mb-1">
              <Tag className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span>Group Reference Token</span>
            </div>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {group.group_reference_token}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] mb-1">
              <Ticket className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              <span>Airline PNR Token</span>
            </div>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {group.pnr_token}
            </span>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-center">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Total Pax</div>
            <div className="font-bold text-xl text-slate-900 dark:text-white font-mono mt-0.5">{group.passenger_count}</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-center">
            <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1">
              <Accessibility className="w-3 h-3" />
              PRM
            </div>
            <div className="font-bold text-xl text-amber-700 dark:text-amber-400 font-mono mt-0.5">{group.prm_count}</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-center">
            <div className="text-[11px] text-sky-700 dark:text-sky-300 flex items-center justify-center gap-1">
              <Baby className="w-3 h-3" />
              Children
            </div>
            <div className="font-bold text-xl text-sky-700 dark:text-sky-400 font-mono mt-0.5">{group.children_count}</div>
          </div>
        </div>

        {/* Priority and Special Assistance Requirements */}
        <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Handling Tier:</span>
            {group.priority ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Priority Transfer Protocol
              </span>
            ) : (
              <span className="text-slate-700 dark:text-slate-300">Standard Transit</span>
            )}
          </div>

          {group.prm_count > 0 && (
            <div className="text-[11px] text-amber-800 dark:text-amber-200/90 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
              Special Assistance: 1 passenger requires wheelchair assistance at gate and dedicated lift coach.
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
            Itinerary: {flight?.service_number || 'AI123'} ({flight?.origin_code}) → Coach Transfer → {sailing?.service_number || 'F205'} ({sailing?.destination_code})
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
        Source System: {group.source_system}
      </div>
    </div>
  );
};
