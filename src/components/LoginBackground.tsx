import React from 'react';

/**
 * LoginBackground - Isometric Cross-Modal Operations Center Concept Visual
 * Recreates the airport-to-ferry intermodal corridor with animated telemetry rings,
 * elevated transit arterial, docked vessel, and connection-at-risk warning nodes.
 */
export const LoginBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none bg-[#070b14]">
      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-[650px] h-[650px] bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 -right-40 w-[700px] h-[700px] bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 left-1/4 w-[800px] h-[800px] bg-rose-500/10 rounded-full blur-3xl" />

      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(circle at 60% 45%, black 40%, transparent 85%)'
        }}
      />

      {/* Isometric Vector Visual Stage */}
      <svg 
        className="absolute w-full h-full min-w-[1200px] opacity-90 transition-all duration-700" 
        viewBox="0 0 1600 1000" 
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="runwayGrad" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#05192d" />
            <stop offset="100%" stopColor="#030712" />
          </linearGradient>

          <linearGradient id="trackGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#f97316" stopOpacity="1" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="intenseGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* --- ISOMETRIC HARBOR BASIN & WATERWAY --- */}
        <polygon 
          points="800,560 1600,820 1600,1000 700,1000" 
          fill="url(#waterGrad)" 
          stroke="#0e7490" 
          strokeWidth="1.5" 
          strokeOpacity="0.4" 
        />
        {/* Subtle Water Ripples */}
        <path d="M 900 680 L 1250 780" stroke="#0891b2" strokeWidth="1" strokeDasharray="6,12" strokeOpacity="0.3" />
        <path d="M 960 720 L 1380 840" stroke="#0891b2" strokeWidth="1" strokeDasharray="8,16" strokeOpacity="0.25" />
        <path d="M 1040 770 L 1490 910" stroke="#0891b2" strokeWidth="1" strokeDasharray="10,20" strokeOpacity="0.2" />

        {/* --- DOCKED PASSENGER FERRY VESSEL (BERTH 2) --- */}
        <g transform="translate(1080, 660) scale(0.95)">
          {/* Vessel Hull Shadow */}
          <polygon points="120,40 280,95 240,125 70,70" fill="#020617" opacity="0.8" />
          {/* Main Hull Body */}
          <polygon points="100,10 260,65 230,105 70,50" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Vessel Superstructure */}
          <polygon points="120,0 230,38 210,68 100,30" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
          {/* Ferry Bridge Windows */}
          <polygon points="140,-5 200,16 190,32 130,11" fill="#38bdf8" opacity="0.75" />
          {/* Deck Marker Lights */}
          <circle cx="250" cy="70" r="3" fill="#22c55e" filter="url(#neonGlow)" />
          <circle cx="80" cy="45" r="3" fill="#ef4444" filter="url(#neonGlow)" />
          {/* Ferry Service Label */}
          <text x="145" y="45" fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold" transform="rotate(20 145 45)">
            SLG-205 [BATAM]
          </text>
        </g>

        {/* --- HARBOR PIER & MARITIME TERMINAL --- */}
        <polygon 
          points="780,520 1150,650 980,740 610,610" 
          fill="#0f172a" 
          stroke="#334155" 
          strokeWidth="1.5" 
        />
        {/* Pier Edge Highlight */}
        <path d="M 780 520 L 1150 650" stroke="#0ea5e9" strokeWidth="2" strokeOpacity="0.8" />
        {/* Ferry Terminal Building */}
        <polygon points="820,530 960,580 920,630 780,580" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
        <polygon points="820,500 960,550 960,580 820,530" fill="#334155" />
        <polygon points="960,550 920,600 920,630 960,580" fill="#1e293b" />
        {/* Terminal Gate Lights */}
        <circle cx="890" cy="570" r="2.5" fill="#38bdf8" />
        <circle cx="910" cy="578" r="2.5" fill="#38bdf8" />
        <text x="830" y="555" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">FERRY GATE B2</text>

        {/* --- AIRPORT TERMINAL & RUNWAY COMPLEX (TOP-LEFT) --- */}
        <g transform="translate(180, 180)">
          {/* Runway Base Slab */}
          <polygon 
            points="100,60 550,220 400,330 -50,170" 
            fill="url(#runwayGrad)" 
            stroke="#334155" 
            strokeWidth="1.5" 
          />
          {/* Runway Centerline */}
          <path 
            d="M 120 110 L 440 220" 
            stroke="#f8fafc" 
            strokeWidth="3" 
            strokeDasharray="14,14" 
            strokeOpacity="0.6" 
          />
          {/* Threshold Markings */}
          <path d="M 90 90 L 110 130" stroke="#e2e8f0" strokeWidth="2" strokeOpacity="0.7" />
          <path d="M 110 97 L 130 137" stroke="#e2e8f0" strokeWidth="2" strokeOpacity="0.7" />

          {/* Airport Terminal Building */}
          <polygon points="260,110 420,165 380,210 220,155" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1" />
          <polygon points="260,70 420,125 420,165 260,110" fill="#0f172a" />
          <polygon points="420,125 380,170 380,210 420,165" fill="#1e293b" />
          <text x="275" y="105" fill="#38bdf8" fontSize="9" fontFamily="monospace" fontWeight="bold">AIRSIDE T1 [SIN_T1]</text>

          {/* Inbound Aircraft on Apron (FLT-AI123) */}
          <g transform="translate(230, 160) scale(0.85)">
            {/* Plane Body */}
            <path d="M 50 10 L 85 45 L 75 55 L 45 35 L 20 60 L 10 55 L 25 35 L -10 20 L -5 10 L 30 15 Z" fill="#f8fafc" stroke="#64748b" strokeWidth="1" />
            <circle cx="85" cy="45" r="3" fill="#38bdf8" filter="url(#neonGlow)" />
            {/* Plane Alert Ring (Delay Warning) */}
            <circle cx="50" cy="30" r="34" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,3" className="animate-spin" style={{ animationDuration: '14s' }} />
            <circle cx="50" cy="30" r="48" fill="url(#radarGrad)" opacity="0.3" />
            {/* Warning Beacon */}
            <g transform="translate(70, -5)">
              <polygon points="0,0 16,0 8,-14" fill="#ef4444" filter="url(#neonGlow)" />
              <text x="5.5" y="-3" fill="#ffffff" fontSize="9" fontWeight="bold">!</text>
            </g>
          </g>
        </g>

        {/* --- ELEVATED INTERMODAL TRANSIT ARTERIAL / EXPRESS LINK --- */}
        {/* Connecting Airport Terminal (450, 360) -> Ferry Port (780, 540) */}
        <g filter="url(#neonGlow)">
          {/* Track Shadow */}
          <path 
            d="M 460 380 C 580 430, 680 470, 800 535" 
            stroke="#020617" 
            strokeWidth="8" 
            fill="none" 
            opacity="0.6" 
          />
          {/* Main Transit Rail Beam */}
          <path 
            d="M 460 370 C 580 420, 680 460, 800 525" 
            stroke="url(#trackGlow)" 
            strokeWidth="4" 
            fill="none" 
          />
          {/* Pylons / Piers */}
          <line x1="530" y1="400" x2="530" y2="445" stroke="#475569" strokeWidth="3" />
          <line x1="620" y1="435" x2="620" y2="480" stroke="#475569" strokeWidth="3" />
          <line x1="710" y1="475" x2="710" y2="520" stroke="#475569" strokeWidth="3" />
        </g>

        {/* Animated Transit Shuttle Vehicle along Corridor */}
        <g transform="translate(630, 440)">
          <rect x="-16" y="-6" width="32" height="12" rx="4" fill="#f8fafc" stroke="#f97316" strokeWidth="2" filter="url(#intenseGlow)" />
          <circle cx="10" cy="0" r="2.5" fill="#38bdf8" />
          <circle cx="-10" cy="0" r="2.5" fill="#ef4444" />
        </g>

        {/* Corridor Speed / ETA Telemetry */}
        <g transform="translate(560, 395)">
          <rect x="0" y="0" width="130" height="24" rx="4" fill="#0f172a" stroke="#f97316" strokeWidth="1" opacity="0.9" />
          <text x="8" y="16" fill="#fb923c" fontSize="9" fontFamily="monospace" fontWeight="bold">
            HWY-99: 28m (+8m DELAY)
          </text>
        </g>

        {/* --- FOREGROUND TELEMETRY HUD & BROKEN CONNECTION CALLOUT --- */}
        <g transform="translate(860, 240)">
          {/* Concentric Telemetry Radar Disk */}
          <circle cx="180" cy="180" r="160" fill="none" stroke="#1e293b" strokeWidth="1.5" />
          <circle cx="180" cy="180" r="120" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="4,8" strokeOpacity="0.4" />
          <circle cx="180" cy="180" r="80" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.6" />
          <circle cx="180" cy="180" r="40" fill="rgba(239, 68, 68, 0.08)" />

          {/* Crosshairs */}
          <line x1="180" y1="10" x2="180" y2="350" stroke="#334155" strokeWidth="1" strokeDasharray="3,6" />
          <line x1="10" y1="180" x2="350" y2="180" stroke="#334155" strokeWidth="1" strokeDasharray="3,6" />

          {/* Node 1: Inbound Flight AI123 */}
          <g transform="translate(100, 120)">
            <circle cx="0" cy="0" r="20" fill="#0f172a" stroke="#ef4444" strokeWidth="2" filter="url(#neonGlow)" />
            <text x="-12" y="4" fill="#ffffff" fontSize="11" fontWeight="bold">✈</text>
            <text x="-35" y="34" fill="#f87171" fontSize="10" fontFamily="monospace" fontWeight="bold">AI123 (ETA +30)</text>
          </g>

          {/* Broken Connection Lightning Spark Between Nodes */}
          <g filter="url(#intenseGlow)">
            <path 
              d="M 120 120 L 170 145 L 160 160 L 210 185 L 200 200 L 250 220" 
              stroke="#ef4444" 
              strokeWidth="2.5" 
              fill="none" 
              strokeDasharray="6,4"
            />
            {/* Warning Exclamation Symbol */}
            <circle cx="180" cy="175" r="14" fill="#ef4444" />
            <text x="176" y="180" fill="#ffffff" fontSize="13" fontWeight="bold">⚡</text>
          </g>

          {/* Node 2: Outbound Ferry F205 */}
          <g transform="translate(260, 230)">
            <circle cx="0" cy="0" r="20" fill="#0f172a" stroke="#0ea5e9" strokeWidth="2" filter="url(#neonGlow)" />
            <text x="-9" y="4" fill="#ffffff" fontSize="11" fontWeight="bold">🚢</text>
            <text x="-25" y="34" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">F205 (15:30 CLOSE)</text>
          </g>

          {/* Connection Risk Tag */}
          <g transform="translate(90, 280)">
            <rect x="0" y="0" width="180" height="36" rx="6" fill="#1c1917" stroke="#ef4444" strokeWidth="1.5" />
            <circle cx="16" cy="18" r="4" fill="#ef4444" className="animate-ping" />
            <circle cx="16" cy="18" r="4" fill="#ef4444" />
            <text x="30" y="16" fill="#f87171" fontSize="10" fontWeight="bold" fontFamily="monospace">
              MARGIN: -15 MIN
            </text>
            <text x="30" y="28" fill="#fca5a5" fontSize="9" fontFamily="sans-serif">
              CRITICAL: MISSED CONNECTION RISK
            </text>
          </g>
        </g>
      </svg>

      {/* High-tech Vignette / Radial Overlay to balance readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70" />
    </div>
  );
};
