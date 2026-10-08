import React, { useState, useMemo } from 'react';
import {
  Plane,
  Ship,
  Truck,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Layers,
  Compass,
  Flame,
  ArrowRight,
  Users,
  Clock,
  Filter,
  Eye,
  Activity,
  Maximize2
} from 'lucide-react';
import { ConnectionDetailResponse } from '../services/api';

interface RegionalHubsMapProps {
  selectedSite: string;
  onSelectSite: (siteCode: string) => void;
  connections: ConnectionDetailResponse[];
  onSelectCase?: (caseId: string) => void;
}

interface HubGeoData {
  code: string;
  name: string;
  region: string;
  corridorName: string;
  airport: {
    code: string;
    name: string;
    x: number;
    y: number;
  };
  port: {
    code: string;
    name: string;
    x: number;
    y: number;
  };
  center: {
    x: number;
    y: number;
  };
  corridorPath: string;
  marinePath?: string;
  baseTransferMinutes: number;
}

interface HubMetricItem {
  total: number;
  critical: number;
  atRisk: number;
  watch: number;
  safe: number;
  passengersAtRisk: number;
  prmAtRisk: number;
  worstMargin: number;
  openCases: number;
  riskConcentrationPct: number;
  dominantSeverity: 'CRITICAL' | 'AT_RISK' | 'WATCH' | 'SAFE';
  items: ConnectionDetailResponse[];
}

const REGIONAL_HUBS: HubGeoData[] = [
  {
    code: 'SITE01',
    name: 'Vancouver Metro Hub',
    region: 'Pacific Northwest (BC Corridor)',
    corridorName: 'Hwy 99 Express Shuttle',
    airport: {
      code: 'YVR',
      name: 'Vancouver Int’l Airport',
      x: 440,
      y: 110
    },
    port: {
      code: 'TSA_FERRY',
      name: 'Tsawwassen Ferry Terminal',
      x: 520,
      y: 200
    },
    center: {
      x: 480,
      y: 155
    },
    corridorPath: 'M 440 110 Q 480 150 520 200',
    marinePath: 'M 520 200 Q 400 240 280 230',
    baseTransferMinutes: 20
  },
  {
    code: 'SITE03',
    name: 'Strait Passage Intermodal',
    region: 'Vancouver Island Sound',
    corridorName: 'Patricia Bay Hwy Transfer',
    airport: {
      code: 'YYJ',
      name: 'Victoria Int’l Airport',
      x: 230,
      y: 290
    },
    port: {
      code: 'SWARTZ_BAY',
      name: 'Swartz Bay Terminal',
      x: 280,
      y: 230
    },
    center: {
      x: 255,
      y: 260
    },
    corridorPath: 'M 230 290 Q 255 260 280 230',
    marinePath: 'M 280 230 Q 380 220 520 200',
    baseTransferMinutes: 15
  },
  {
    code: 'SITE02',
    name: 'Puget Sound Gateway',
    region: 'Washington Maritime Corridor',
    corridorName: 'I-5 / Alaskan Way Intermodal',
    airport: {
      code: 'SEA',
      name: 'Seattle-Tacoma Int’l Airport',
      x: 680,
      y: 430
    },
    port: {
      code: 'COLMAN_DOCK',
      name: 'Seattle Colman Dock Terminal',
      x: 620,
      y: 340
    },
    center: {
      x: 650,
      y: 385
    },
    corridorPath: 'M 680 430 Q 650 380 620 340',
    marinePath: 'M 620 340 Q 550 330 500 320',
    baseTransferMinutes: 25
  }
];

export const RegionalHubsMap: React.FC<RegionalHubsMapProps> = ({
  selectedSite,
  onSelectSite,
  connections,
  onSelectCase
}) => {
  const [hoveredHub, setHoveredHub] = useState<string | null>(null);
  const [showTrafficCorridors, setShowTrafficCorridors] = useState(true);
  const [showMaritimeLanes, setShowMaritimeLanes] = useState(true);
  const [filterHighRiskOnly, setFilterHighRiskOnly] = useState(false);

  // Compute live risk concentration metrics for each regional hub
  const hubMetrics = useMemo(() => {
    const metrics: Record<string, HubMetricItem> = {};

    REGIONAL_HUBS.forEach((hub) => {
      const siteConns = connections.filter((c) => (c.connection.site_code || 'SITE01') === hub.code);
      let crit = 0;
      let atRisk = 0;
      let watch = 0;
      let safe = 0;
      let paxAtRisk = 0;
      let prmAtRisk = 0;
      let minMargin = 999;
      let cases = 0;

      siteConns.forEach((item) => {
        const sev = item.latestRisk?.final_severity || 'SAFE';
        const margin = item.latestRisk?.connection_margin_minutes ?? 30;
        if (margin < minMargin) minMargin = margin;

        if (sev === 'CRITICAL') {
          crit++;
          paxAtRisk += item.group?.passenger_count || 0;
          prmAtRisk += item.group?.prm_count || 0;
        } else if (sev === 'AT_RISK') {
          atRisk++;
          paxAtRisk += item.group?.passenger_count || 0;
          prmAtRisk += item.group?.prm_count || 0;
        } else if (sev === 'WATCH') {
          watch++;
        } else {
          safe++;
        }

        if (item.activeCase && item.activeCase.status !== 'CLOSED') {
          cases++;
        }
      });

      const total = siteConns.length || 1;
      const concentration = Math.round(((crit + atRisk) / total) * 100);

      let domSev: 'CRITICAL' | 'AT_RISK' | 'WATCH' | 'SAFE' = 'SAFE';
      if (crit > 0) domSev = 'CRITICAL';
      else if (atRisk > 0) domSev = 'AT_RISK';
      else if (watch > 0) domSev = 'WATCH';

      metrics[hub.code] = {
        total: siteConns.length,
        critical: crit,
        atRisk,
        watch,
        safe,
        passengersAtRisk: paxAtRisk,
        prmAtRisk,
        worstMargin: minMargin === 999 ? 0 : minMargin,
        openCases: cases,
        riskConcentrationPct: concentration,
        dominantSeverity: domSev,
        items: siteConns
      };
    });

    return metrics;
  }, [connections]);

  // Overall network risk summary
  const networkSummary = useMemo(() => {
    let totalCrit = 0;
    let totalAtRisk = 0;
    let totalConns = connections.length || 1;
    let totalPax = 0;

    Object.values(hubMetrics).forEach((m: HubMetricItem) => {
      totalCrit += m.critical;
      totalAtRisk += m.atRisk;
      totalPax += m.passengersAtRisk;
    });

    const netConcentration = Math.round(((totalCrit + totalAtRisk) / totalConns) * 100);
    return { totalCrit, totalAtRisk, netConcentration, totalPax, totalConns };
  }, [hubMetrics, connections]);

  const activeFocusHub = hoveredHub || (selectedSite !== 'ALL' ? selectedSite : null);
  const activeHubData = activeFocusHub ? REGIONAL_HUBS.find((h) => h.code === activeFocusHub) : null;
  const activeMetrics = activeFocusHub ? hubMetrics[activeFocusHub] : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* MAP HEADER / TOOLBAR */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Regional Transfer Hubs & Risk Concentration Topology
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                Live GIS Ingest
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Spatial cross-modal transfer monitoring across Pacific Northwest intermodal corridors
            </p>
          </div>
        </div>

        {/* Global Network Health Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-xs shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Network Risk Concentration:</span>
            <span
              className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                networkSummary.netConcentration >= 40
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : networkSummary.netConcentration > 15
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {networkSummary.netConcentration}% ({networkSummary.totalCrit + networkSummary.totalAtRisk} / {networkSummary.totalConns} conns)
            </span>
          </div>

          {/* Layer Controls */}
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setShowTrafficCorridors(!showTrafficCorridors)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                showTrafficCorridors
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Toggle Ground Transfer Corridors"
            >
              <Truck className="w-3 h-3" />
              <span>Corridors</span>
            </button>

            <button
              onClick={() => setShowMaritimeLanes(!showMaritimeLanes)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                showMaritimeLanes
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Toggle Maritime Ferry Lanes"
            >
              <Ship className="w-3 h-3" />
              <span>Marine Lanes</span>
            </button>

            <button
              onClick={() => setFilterHighRiskOnly(!filterHighRiskOnly)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                filterHighRiskOnly
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Filter to High Risk Concentration Hubs"
            >
              <Filter className="w-3 h-3" />
              <span>At-Risk Only</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAP VIEWPORT & SIDE INSPECTOR DUAL LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-4 relative min-h-[460px] bg-slate-950">
        {/* INTERACTIVE SVG MAP CANVAS (3 COLS) */}
        <div className="xl:col-span-3 relative h-[440px] md:h-[500px] overflow-hidden select-none bg-radial from-slate-900 to-slate-950 flex items-center justify-center">
          {/* Tactical Grid Background Overlay */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />

          {/* Compass Rose & Geographic Coordinates in Corners */}
          <div className="absolute top-3 left-4 pointer-events-none z-10 flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-sky-400/70 uppercase">
              SALISH SEA / PACIFIC NORTHWEST CORRIDOR
            </span>
          </div>
          <div className="absolute bottom-3 left-4 pointer-events-none z-10 text-[10px] font-mono text-slate-500">
            48°30′N / 123°15′W • Scale: 1:250,000
          </div>

          <svg
            className="w-full h-full object-contain"
            viewBox="0 0 880 520"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Radial Gradients for Risk Concentration Heat Rings */}
              <radialGradient id="grad-critical-heat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.5" />
                <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="grad-atrisk-heat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="grad-safe-heat" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="60%" stopColor="#10b981" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>

              {/* Linear Gradients for Highway Corridors */}
              <linearGradient id="corridor-gradient-crit" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>

              <linearGradient id="corridor-gradient-safe" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              {/* Water Pattern & Topography */}
              <pattern id="water-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.75" fill="#38bdf8" fillOpacity="0.15" />
              </pattern>
            </defs>

            {/* WATERWAY BASE: Strait of Georgia, Puget Sound, Haro Strait */}
            <rect x="0" y="0" width="880" height="520" fill="#090d16" />
            <rect x="0" y="0" width="880" height="520" fill="url(#water-grid)" />

            {/* STYLIZED LANDMASS CONTOURS (Vancouver Island West, Mainland BC/WA East) */}
            {/* Vancouver Island (West) */}
            <path
              d="M 50 30 C 130 50, 160 140, 190 220 C 210 270, 240 330, 220 380 C 200 420, 140 450, 100 470 C 60 490, 40 500, 20 520 L 0 520 L 0 0 L 70 0 Z"
              fill="#131b2e"
              stroke="#1e293b"
              strokeWidth="2"
            />
            {/* Gulf Islands & San Juan Archipelago in the central strait */}
            <path
              d="M 320 200 C 350 210, 360 250, 330 270 C 310 280, 290 240, 320 200 Z"
              fill="#162035"
              stroke="#1e293b"
              strokeWidth="1.5"
            />
            <path
              d="M 370 280 C 400 290, 420 340, 380 350 C 350 355, 340 310, 370 280 Z"
              fill="#162035"
              stroke="#1e293b"
              strokeWidth="1.5"
            />
            {/* Mainland British Columbia & Washington (East) */}
            <path
              d="M 430 0 C 480 30, 520 70, 560 100 C 600 130, 680 160, 720 200 C 760 240, 780 300, 760 360 C 740 420, 780 470, 840 500 L 880 520 L 880 0 Z"
              fill="#131b2e"
              stroke="#1e293b"
              strokeWidth="2"
            />

            {/* Sound & Strait Waterway Name Labels */}
            <text x="360" y="160" fill="#334155" fontSize="11" fontFamily="monospace" letterSpacing="3">
              STRAIT OF GEORGIA
            </text>
            <text x="320" y="380" fill="#334155" fontSize="11" fontFamily="monospace" letterSpacing="3">
              HARO STRAIT / SALISH SEA
            </text>
            <text x="560" y="470" fill="#334155" fontSize="11" fontFamily="monospace" letterSpacing="3">
              PUGET SOUND
            </text>

            {/* MARITIME SHIPPING & FERRY LANES */}
            {showMaritimeLanes && (
              <g id="maritime-lanes" opacity="0.6">
                {REGIONAL_HUBS.map((hub) => {
                  if (!hub.marinePath) return null;
                  return (
                    <g key={`marine-${hub.code}`}>
                      <path
                        d={hub.marinePath}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="4 6"
                        strokeOpacity="0.5"
                      />
                      {/* Sailing path direction arrow or buoy */}
                      <circle cx={(hub.port.x + 400) / 2} cy={(hub.port.y + 220) / 2} r="2" fill="#38bdf8" />
                    </g>
                  );
                })}
              </g>
            )}

            {/* GROUND TRANSFER HIGHWAY CORRIDORS */}
            {showTrafficCorridors && (
              <g id="transfer-corridors">
                {REGIONAL_HUBS.map((hub) => {
                  const metrics = hubMetrics[hub.code];
                  const isCrit = metrics?.critical > 0;
                  const isAtRisk = metrics?.atRisk > 0;
                  const isSelected = selectedSite === hub.code || hoveredHub === hub.code;

                  return (
                    <g key={`corridor-${hub.code}`}>
                      {/* Glow path backdrop */}
                      <path
                        d={hub.corridorPath}
                        fill="none"
                        stroke={isCrit ? '#f43f5e' : isAtRisk ? '#f59e0b' : '#38bdf8'}
                        strokeWidth={isSelected ? '6' : '3'}
                        strokeOpacity={isSelected ? '0.5' : '0.25'}
                        strokeLinecap="round"
                      />
                      {/* Animated dashed line for vehicle transfer flow */}
                      <path
                        d={hub.corridorPath}
                        fill="none"
                        stroke={isCrit ? '#fb7185' : isAtRisk ? '#fbbf24' : '#38bdf8'}
                        strokeWidth="2.5"
                        strokeDasharray="6 6"
                        strokeLinecap="round"
                        className="animate-pulse"
                      />
                      {/* Corridor Name Label */}
                      <text
                        x={hub.center.x}
                        y={hub.center.y - 12}
                        fill={isSelected ? '#f8fafc' : '#94a3b8'}
                        fontSize="9"
                        fontWeight="600"
                        fontFamily="sans-serif"
                        textAnchor="middle"
                      >
                        {hub.corridorName} ({hub.baseTransferMinutes}m)
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* REGIONAL HUBS NODES & RISK CONCENTRATION HEAT RINGS */}
            {REGIONAL_HUBS.map((hub) => {
              const metrics = hubMetrics[hub.code];
              if (!metrics) return null;

              if (filterHighRiskOnly && metrics.critical === 0 && metrics.atRisk === 0) {
                return null;
              }

              const isSelected = selectedSite === hub.code;
              const isHovered = hoveredHub === hub.code;
              const isCrit = metrics.critical > 0;
              const isAtRisk = metrics.atRisk > 0 && !isCrit;
              const isSafe = !isCrit && !isAtRisk;

              // Heat ring color & radius based on concentration
              const ringColor = isCrit ? '#f43f5e' : isAtRisk ? '#f59e0b' : '#10b981';
              const gradientId = isCrit ? 'url(#grad-critical-heat)' : isAtRisk ? 'url(#grad-atrisk-heat)' : 'url(#grad-safe-heat)';
              const heatRadius = Math.max(35, Math.min(85, 30 + metrics.riskConcentrationPct * 0.65));

              return (
                <g
                  key={hub.code}
                  className="cursor-pointer transition-transform duration-200"
                  onClick={() => onSelectSite(isSelected ? 'ALL' : hub.code)}
                  onMouseEnter={() => setHoveredHub(hub.code)}
                  onMouseLeave={() => setHoveredHub(null)}
                >
                  {/* CONCENTRATION HEAT CIRCLE */}
                  <circle
                    cx={hub.center.x}
                    cy={hub.center.y}
                    r={heatRadius}
                    fill={gradientId}
                    className="pointer-events-none"
                  />

                  {/* PULSING CRITICAL RADAR RING */}
                  {(isCrit || isAtRisk) && (
                    <circle
                      cx={hub.center.x}
                      cy={hub.center.y}
                      r={heatRadius * 0.9}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      className="animate-spin"
                      style={{ transformOrigin: `${hub.center.x}px ${hub.center.y}px`, animationDuration: '8s' }}
                    />
                  )}

                  {/* ACTIVE FOCUS SELECTION RING */}
                  {(isSelected || isHovered) && (
                    <circle
                      cx={hub.center.x}
                      cy={hub.center.y}
                      r={heatRadius + 10}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* AIRPORT NODE (Square glyph with plane) */}
                  <g transform={`translate(${hub.airport.x}, ${hub.airport.y})`}>
                    <rect
                      x="-14"
                      y="-14"
                      width="28"
                      height="28"
                      rx="6"
                      fill="#0f172a"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      className="drop-shadow-md"
                    />
                    <text
                      x="0"
                      y="4"
                      fill="#38bdf8"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      ✈
                    </text>
                    <text
                      x="0"
                      y="-18"
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {hub.airport.code}
                    </text>
                  </g>

                  {/* FERRY PORT NODE (Circle glyph with anchor/ship) */}
                  <g transform={`translate(${hub.port.x}, ${hub.port.y})`}>
                    <circle
                      cx="0"
                      cy="0"
                      r="14"
                      fill="#0f172a"
                      stroke="#818cf8"
                      strokeWidth="1.5"
                      className="drop-shadow-md"
                    />
                    <text
                      x="0"
                      y="4"
                      fill="#818cf8"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      ⚓
                    </text>
                    <text
                      x="0"
                      y="26"
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {hub.port.code.replace('_FERRY', '').replace('_DOCK', '')}
                    </text>
                  </g>

                  {/* HUB CENTER TACTICAL BADGE */}
                  <g transform={`translate(${hub.center.x}, ${hub.center.y})`}>
                    {/* Outer Pill Container */}
                    <rect
                      x="-55"
                      y="-16"
                      width="110"
                      height="32"
                      rx="16"
                      fill="#020617"
                      stroke={ringColor}
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                      className="drop-shadow-lg"
                    />

                    {/* Site Code Label */}
                    <text
                      x="-22"
                      y="-2"
                      fill="#f8fafc"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {hub.code}
                    </text>

                    {/* Risk Concentration Pill Tag */}
                    <rect
                      x="4"
                      y="-11"
                      width="45"
                      height="22"
                      rx="11"
                      fill={isCrit ? '#f43f5e' : isAtRisk ? '#f59e0b' : '#10b981'}
                    />
                    <text
                      x="26"
                      y="4"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      textAnchor="middle"
                    >
                      {metrics.riskConcentrationPct}%
                    </text>

                    {/* Sub-label for status */}
                    <text
                      x="-22"
                      y="9"
                      fill={isCrit ? '#fb7185' : isAtRisk ? '#fde68a' : '#6ee7b7'}
                      fontSize="7"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {isCrit ? 'CRITICAL' : isAtRisk ? 'AT RISK' : 'SAFE'}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Quick Hub Jump Pills Overlay (Bottom Left of Canvas) */}
          <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-xs p-1.5 rounded-xl border border-slate-700/80 shadow-lg text-xs">
            <button
              onClick={() => onSelectSite('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors ${
                selectedSite === 'ALL'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              ALL SITES
            </button>
            {REGIONAL_HUBS.map((h) => {
              const m = hubMetrics[h.code];
              const isCrit = m?.critical > 0;
              const isSelected = selectedSite === h.code;
              return (
                <button
                  key={h.code}
                  onClick={() => onSelectSite(h.code)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1 transition-colors ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCrit ? 'bg-rose-500 animate-ping' : m?.atRisk > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span>{h.code}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* REGIONAL HUB INSPECTOR PANEL (1 COL) */}
        <div className="xl:col-span-1 border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-slate-800 p-4.5 bg-white dark:bg-slate-900 flex flex-col justify-between">
          {activeHubData && activeMetrics ? (
            <div className="space-y-4">
              {/* Hub Title & Status */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                    {activeHubData.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      activeMetrics.dominantSeverity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : activeMetrics.dominantSeverity === 'AT_RISK'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {activeMetrics.dominantSeverity} CONCENTRATION
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                  {activeHubData.name}
                </h4>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {activeHubData.region}
                </div>
              </div>

              {/* Concentration Gauge Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Risk Concentration:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {activeMetrics.riskConcentrationPct}%
                  </span>
                </div>
                {/* Segmented meter */}
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${(activeMetrics.critical / activeMetrics.total) * 100}%` }}
                    className="bg-rose-500"
                    title="Critical"
                  />
                  <div
                    style={{ width: `${(activeMetrics.atRisk / activeMetrics.total) * 100}%` }}
                    className="bg-amber-500"
                    title="At Risk"
                  />
                  <div
                    style={{ width: `${(activeMetrics.watch / activeMetrics.total) * 100}%` }}
                    className="bg-yellow-400"
                    title="Watch"
                  />
                  <div
                    style={{ width: `${(activeMetrics.safe / activeMetrics.total) * 100}%` }}
                    className="bg-emerald-500"
                    title="Safe"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center mt-2">
                  <div className="text-rose-600 dark:text-rose-400">
                    <strong>{activeMetrics.critical}</strong> Crit
                  </div>
                  <div className="text-amber-600 dark:text-amber-400">
                    <strong>{activeMetrics.atRisk}</strong> Risk
                  </div>
                  <div className="text-yellow-600 dark:text-yellow-400">
                    <strong>{activeMetrics.watch}</strong> Watch
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400">
                    <strong>{activeMetrics.safe}</strong> Safe
                  </div>
                </div>
              </div>

              {/* Corridor Topology Summary */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Plane className="w-3.5 h-3.5 text-sky-500" />
                    <span>Airport Node:</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {activeHubData.airport.code}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Ship className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Port Terminal:</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {activeHubData.port.code}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Truck className="w-3.5 h-3.5 text-amber-500" />
                    <span>Corridor Link:</span>
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]" title={activeHubData.corridorName}>
                    {activeHubData.corridorName}
                  </span>
                </div>
              </div>

              {/* Impact Telemetry Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="text-[10px] text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1">
                    <Users className="w-3 h-3" /> Pax At-Risk
                  </div>
                  <div className="text-base font-bold font-mono text-purple-900 dark:text-purple-200 mt-0.5">
                    {activeMetrics.passengersAtRisk}
                  </div>
                  {activeMetrics.prmAtRisk > 0 && (
                    <div className="text-[9px] text-purple-600 dark:text-purple-400 mt-0.5">
                      Includes {activeMetrics.prmAtRisk} PRM
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <div className="text-[10px] text-rose-700 dark:text-rose-300 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Worst Margin
                  </div>
                  <div className="text-base font-bold font-mono text-rose-900 dark:text-rose-200 mt-0.5">
                    {activeMetrics.worstMargin > 0 ? `+${activeMetrics.worstMargin}m` : `${activeMetrics.worstMargin}m`}
                  </div>
                  <div className="text-[9px] text-rose-600 dark:text-rose-400 mt-0.5">
                    {activeMetrics.openCases} Open Case(s)
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-8 text-center flex flex-col items-center justify-center h-full">
              <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Network Overview Selected
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto mt-1">
                  Hover or click any regional hub on the map to inspect transfer corridor risk concentration.
                </p>
              </div>

              <div className="w-full space-y-1.5 text-xs text-left pt-2">
                {REGIONAL_HUBS.map((h) => {
                  const m = hubMetrics[h.code];
                  return (
                    <button
                      key={h.code}
                      onClick={() => onSelectSite(h.code)}
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{h.name}</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          m?.critical > 0
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            : m?.atRisk > 0
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {m?.riskConcentrationPct || 0}% Risk
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-4 flex items-center justify-between gap-2">
            <button
              onClick={() => onSelectSite(selectedSite === activeFocusHub ? 'ALL' : activeFocusHub || 'ALL')}
              className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>{selectedSite === activeFocusHub ? 'Clear Filter (Show All)' : `Filter Dashboard to ${activeFocusHub || 'All'}`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* MAP LEGEND FOOTER */}
      <div className="p-3 bg-slate-100/70 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 font-medium">
            <div className="w-3 h-3 rounded bg-slate-800 border border-sky-400 flex items-center justify-center text-[7px] text-sky-400 font-bold">
              ✈
            </div>
            <span>Airport Origin</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <div className="w-3 h-3 rounded-full bg-slate-800 border border-indigo-400 flex items-center justify-center text-[7px] text-indigo-400 font-bold">
              ⚓
            </div>
            <span>Marine Ferry Port</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <div className="w-4 h-0.5 bg-sky-400 border-dashed" />
            <span>Transfer Highway Link</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <div className="w-4 h-0.5 border-t border-dotted border-sky-400/60" />
            <span>Maritime Sailing Lane</span>
          </div>
        </div>

        {/* Risk scale */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500">Risk Concentration:</span>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px]">Safe (&lt;15%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="text-[11px]">Watch</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[11px]">At Risk</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-[11px]">Critical</span>
          </div>
        </div>
      </div>
    </div>
  );
};
