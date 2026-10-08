import React from 'react';
import { Journey, Transfer, RiskAssessment } from '../types/car';
import { Plane, Bus, Ship, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface JourneyTimelineProps {
  flight?: Journey;
  sailing?: Journey;
  transfer?: Transfer;
  assessment?: RiskAssessment;
}

export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({
  flight,
  sailing,
  transfer,
  assessment
}) => {
  if (!flight || !sailing || !assessment) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
        Timeline data incomplete.
      </div>
    );
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';
    } catch {
      return '--:--';
    }
  };

  const margin = assessment.connection_margin_minutes;
  const isCritical = margin <= 0;
  const isAtRisk = margin > 0 && margin <= 15;
  const isWatch = margin > 15 && margin <= 30;

  // Compute intermediate milestones
  const flightEtaMs = new Date(flight.estimated_arrival_utc).getTime();
  const airportExitMs = flightEtaMs + (assessment.deplaning_minutes + assessment.airport_exit_minutes) * 60000;
  const portArrivalMs = airportExitMs + assessment.transfer_minutes * 60000;
  const readyToBoardMs = new Date(assessment.ready_to_board_utc).getTime();
  const boardingCloseMs = new Date(assessment.boarding_close_utc).getTime();
  const ferryDepartMs = new Date(sailing.estimated_departure_utc).getTime();

  const steps = [
    {
      id: 'flight_sched',
      title: 'Flight Scheduled',
      sub: `${flight.service_number} (${flight.origin_code})`,
      time: formatTime(flight.scheduled_departure_utc),
      icon: Plane,
      status: 'DONE',
      note: 'Gate B14'
    },
    {
      id: 'flight_eta',
      title: 'Flight Touchdown (ETA)',
      sub: flight.status === 'DELAYED' ? 'Delayed Arrival' : 'On-Time Arrival',
      time: formatTime(flight.estimated_arrival_utc),
      icon: Plane,
      status: flight.status === 'DELAYED' ? 'WARNING' : 'DONE',
      note: flight.status === 'DELAYED' ? `ETA revised` : 'Original ETA'
    },
    {
      id: 'airport_exit',
      title: 'Airport Exit & Coach Boarding',
      sub: `Deplane (${assessment.deplaning_minutes}m) + Exit (${assessment.airport_exit_minutes}m)`,
      time: formatTime(new Date(airportExitMs).toISOString()),
      icon: Bus,
      status: 'PROGRESS',
      note: 'Ground Bay 4'
    },
    {
      id: 'transfer_port',
      title: 'Expressway Transfer',
      sub: `Transit duration (${assessment.transfer_minutes}m)`,
      time: formatTime(new Date(portArrivalMs).toISOString()),
      icon: Bus,
      status: transfer?.traffic_status !== 'NORMAL' ? 'WARNING' : 'PROGRESS',
      note: transfer?.traffic_status || 'Normal flow'
    },
    {
      id: 'ready_board',
      title: 'Predicted Ready to Board',
      sub: `Port security (${assessment.port_processing_minutes}m) + buffer (${assessment.safety_buffer_minutes}m)`,
      time: formatTime(new Date(readyToBoardMs).toISOString()),
      icon: Clock,
      status: isCritical ? 'DANGER' : isAtRisk ? 'WARNING' : 'DONE',
      note: isCritical ? 'EXCEEDS CUTOFF' : 'On schedule'
    },
    {
      id: 'boarding_close',
      title: 'Ferry Boarding Cutoff',
      sub: `${sailing.service_number} (${sailing.gate_or_berth || 'Berth 2'})`,
      time: formatTime(new Date(boardingCloseMs).toISOString()),
      icon: Ship,
      status: isCritical ? 'DANGER' : 'CUTOFF',
      note: 'Strict gate closure'
    },
    {
      id: 'sailing_depart',
      title: 'Sailing Departure',
      sub: `${sailing.service_number} → Batam/Bintan`,
      time: formatTime(new Date(ferryDepartMs).toISOString()),
      icon: Ship,
      status: sailing.status === 'DELAYED' ? 'WARNING' : 'PLANNED',
      note: sailing.status
    }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            Cross-Modal Connection Journey Timeline
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time correlation of inbound flight touch-down, ground transfer bottlenecks, and harbor boarding cutoffs.
          </p>
        </div>

        {/* Dynamic Margin Indicator */}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Connection Margin:</span>
          <div
            className={`px-3 py-1.5 rounded-lg font-mono font-bold text-sm flex items-center gap-2 border ${
              isCritical
                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                : isAtRisk
                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                : isWatch
                ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30'
                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
            }`}
          >
            {isCritical ? <XCircle className="w-4 h-4" /> : isAtRisk ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{margin > 0 ? `+${margin} min` : `${margin} min`}</span>
            <span className="text-xs font-sans font-semibold tracking-wide">
              ({assessment.final_severity})
            </span>
          </div>
        </div>
      </div>

      {/* Responsive Horizontal / Vertical Pipeline */}
      <div className="relative">
        <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 relative z-10">
          {steps.map((step) => {
            const Icon = step.icon;
            let badgeBg = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
            let cardBorder = 'border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90';

            if (step.status === 'DANGER') {
              badgeBg = 'bg-rose-500 text-white border-rose-400';
              cardBorder = 'border-rose-200 dark:border-rose-500/40 bg-rose-50/70 dark:bg-rose-950/20';
            } else if (step.status === 'WARNING') {
              badgeBg = 'bg-amber-500 text-white border-amber-400';
              cardBorder = 'border-amber-200 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20';
            } else if (step.status === 'CUTOFF') {
              badgeBg = 'bg-sky-500 text-white border-sky-400';
              cardBorder = 'border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-950/20';
            } else if (step.status === 'DONE') {
              badgeBg = 'bg-emerald-500 text-white border-emerald-400';
            }

            return (
              <div
                key={step.id}
                className={`p-3.5 rounded-xl border shadow-sm backdrop-blur transition-all flex flex-col justify-between ${cardBorder}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-sm ${badgeBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    {step.time}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 leading-tight">{step.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{step.sub}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 dark:text-slate-400">{step.note}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lost Buffer Callout */}
      {isCritical && (
        <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong>Negative Connection Buffer ({margin} min):</strong> Passengers will arrive at ferry boarding after the gate has closed. Urgent hold request or fast-track airport disembarkation is required.
          </div>
        </div>
      )}
    </div>
  );
};
