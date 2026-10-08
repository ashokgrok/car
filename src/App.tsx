import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { UserPersona } from './types/car';
import { ControlTower } from './components/ControlTower';
import { RiskInbox } from './components/RiskInbox';
import { CaseWorkspace } from './components/CaseWorkspace';
import { ConnectionExplorer } from './components/ConnectionExplorer';
import { SimulationConsole } from './components/SimulationConsole';
import { LakehouseAnalytics } from './components/LakehouseAnalytics';
import { AdminGovernance } from './components/AdminGovernance';
import { Login } from './components/Login';
import { useSSE } from './hooks/useSSE';
import { soundAlerts } from './utils/audioAlert';
import { useTheme } from './context/ThemeContext';
import {
  ShieldAlert,
  Activity,
  Inbox,
  Compass,
  Sliders,
  Database,
  Settings,
  User,
  CheckCircle2,
  ChevronDown,
  Plane,
  Ship,
  Sparkles,
  Volume2,
  VolumeX,
  Bell,
  BellRing,
  Radio,
  Sun,
  Moon,
  LogOut,
  Shield,
  Building2
} from 'lucide-react';

type NavView = 'control_tower' | 'inbox' | 'workspace' | 'explorer' | 'simulator' | 'lakehouse' | 'governance';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('car_authenticated_user');
      return !!stored;
    } catch {
      return false;
    }
  });

  const [currentView, setCurrentView] = useState<NavView>('control_tower');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [currentUser, setCurrentUser] = useState<UserPersona>(() => {
    try {
      const stored = localStorage.getItem('car_authenticated_user');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return {
      id: 'usr-duty-mgr-01',
      name: 'Sarah Chen',
      role: 'CAR_DUTY_MANAGER',
      email: 'sarah.chen@car-ops.internal'
    };
  });

  const [openCasesCount, setOpenCasesCount] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(soundAlerts.isAudioEnabled());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(soundAlerts.getNotificationPermission());
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Load Initial Personas and Dashboard Counts
  const loadInitialData = useCallback(async () => {
    try {
      const [personasRes, summaryRes] = await Promise.all([
        api.getPersonas(),
        api.getDashboardSummary()
      ]);
      setPersonas(personasRes.personas);
      
      // If we don't have a saved user in localStorage yet, pick current or first persona
      const savedUserStr = localStorage.getItem('car_authenticated_user');
      if (!savedUserStr && personasRes.currentUser) {
        setCurrentUser(personasRes.currentUser);
      } else if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          // Match with latest persona data from backend (e.g. updated permissions)
          const matched = personasRes.personas.find(p => p.id === parsed.id);
          if (matched) setCurrentUser(matched);
        } catch {
          // ignore
        }
      }
      setOpenCasesCount(summaryRes.openCases);
    } catch (err) {
      console.error('Failed to initialize application metadata:', err);
    }
  }, []);

  const { isConnected } = useSSE(() => {
    // Auto-update dashboard count upon SSE push
    api.getDashboardSummary().then(res => {
      setOpenCasesCount(res.openCases);
    }).catch(() => {});
  });

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    soundAlerts.setAudioEnabled(next);
    if (next) soundAlerts.playSuccessChime();
  };

  const handleRequestNotif = async () => {
    const perm = await soundAlerts.requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      soundAlerts.sendDesktopNotification('CaR Alerts Activated', 'You will receive immediate notifications for CRITICAL connections and SLA breaches.');
    }
  };

  const handleLogin = async (user: UserPersona) => {
    try {
      await api.setCurrentUser(user.id);
    } catch (e) {
      console.warn('Backend persona sync notice:', e);
    }
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('car_authenticated_user', JSON.stringify(user));
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserDropdownOpen(false);
    try {
      localStorage.removeItem('car_authenticated_user');
    } catch {
      // ignore
    }
  };

  const handlePersonaChange = async (p: UserPersona) => {
    try {
      await api.setCurrentUser(p.id);
      setCurrentUser(p);
      localStorage.setItem('car_authenticated_user', JSON.stringify(p));
      setUserDropdownOpen(false);
    } catch (err) {
      console.error('Failed to change persona:', err);
    }
  };

  const handlePersonaChangeById = (personaId: string) => {
    const matched = personas.find(p => p.id === personaId);
    if (matched) handlePersonaChange(matched);
  };

  const handleOpenCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView('workspace');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#user-profile-menu-container')) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // -------------------------------------------------------------
  // If not authenticated, render dedicated Login screen
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <Login
        personas={personas}
        onLogin={handleLogin}
      />
    );
  }

  const isAdmin = currentUser.role === 'CAR_ADMIN' || !!currentUser.permissions?.can_access_admin;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-sky-500 selection:text-white">
      {/* TOP NAVIGATION HEADER */}
      <header className="bg-white/95 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 backdrop-blur sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & System Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
              <div className="flex items-center -space-x-1">
                <Plane className="w-4 h-4 text-white -rotate-12" />
                <Ship className="w-4 h-4 text-sky-200" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
                  CaR <span className="text-sky-600 dark:text-sky-400 font-sans font-semibold text-sm">Connection-at-Risk</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30">
                  Production v2.4
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 antialiased hidden md:block">
                Airport-to-Port Cross-Modal Transfer Risk & Incident Management
              </p>
            </div>
          </div>

          {/* Persona Switcher & System Telemetry */}
          <div className="flex items-center gap-2">
            {/* Live SSE Stream Badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                isConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/50'
              }`}
              title={isConnected ? 'SSE Live Push Event Stream active' : 'Connecting to SSE Event Stream...'}
            >
              <Radio className={`w-3 h-3 ${isConnected ? 'animate-pulse text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <span>{isConnected ? 'SSE Live' : 'Connecting...'}</span>
            </div>

            {/* Global Theme Toggle Button */}
            <button
              id="app-theme-toggle"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-600" />}
            </button>

            {/* Audio Alert Toggle Button */}
            <button
              onClick={toggleAudio}
              className={`p-2 rounded-lg border transition-colors ${
                audioEnabled
                  ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600'
              }`}
              title={audioEnabled ? 'Audible Alerts Enabled (Click to Mute)' : 'Audible Alerts Muted (Click to Unmute)'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Desktop Notification Request Button */}
            <button
              onClick={handleRequestNotif}
              className={`p-2 rounded-lg border transition-colors ${
                notifPermission === 'granted'
                  ? 'bg-slate-50 dark:bg-slate-900 border-emerald-300 dark:border-emerald-700/60 text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
              title={
                notifPermission === 'granted'
                  ? 'Desktop Browser Notifications Active'
                  : 'Enable Desktop Push Notifications for Critical Alerts'
              }
            >
              {notifPermission === 'granted' ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>

            {/* Persona Switcher Dropdown */}
            <div id="user-profile-menu-container" className="relative">
              <button
                id="user-profile-menu-button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {currentUser.avatar || currentUser.name.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold text-slate-900 dark:text-white leading-tight flex items-center gap-1">
                    {currentUser.name}
                    {isAdmin && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1 py-0.2 rounded font-bold">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {currentUser.role.replace('CAR_', '')}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {/* Persona selection & Logout menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 z-50 animate-fade-in text-xs">
                  <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <div className="font-bold text-slate-900 dark:text-white">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{currentUser.email || `${currentUser.id}@car-ops.internal`}</div>
                    <div className="text-[11px] text-slate-500">{currentUser.team}</div>
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-slate-400 px-2 py-1 font-semibold">
                    Quick Persona Switch:
                  </div>

                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {personas.map((p) => {
                      const isCurrent = currentUser.id === p.id;
                      const isPAdmin = p.role === 'CAR_ADMIN';

                      return (
                        <button
                          key={p.id}
                          onClick={() => handlePersonaChange(p)}
                          className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between ${
                            isCurrent
                              ? 'bg-sky-50 text-sky-900 dark:bg-sky-500/20 dark:text-sky-300 font-semibold border border-sky-200 dark:border-sky-500/30'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                              {p.avatar || p.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                                {p.name}
                                {isPAdmin && (
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                    [ADMIN]
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.role.replace('CAR_', '')}</div>
                            </div>
                          </div>
                          {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Sign Out / Log Out Button */}
                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      id="navbar-logout-btn"
                      onClick={handleLogout}
                      className="w-full text-left p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-2 font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out of Console</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Standalone Logout Quick Action Icon */}
            <button
              id="header-direct-logout-btn"
              onClick={handleLogout}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SECONDARY NAVIGATION BAR */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-1 border-t border-slate-200 dark:border-slate-800/80">
          <button
            onClick={() => setCurrentView('control_tower')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap antialiased ${
              currentView === 'control_tower'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Control Tower
          </button>

          <button
            onClick={() => setCurrentView('inbox')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap antialiased ${
              currentView === 'inbox'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Risk Inbox
            {openCasesCount > 0 && (
              <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {openCasesCount}
              </span>
            )}
          </button>

          {selectedCaseId && (
            <button
              onClick={() => setCurrentView('workspace')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap antialiased ${
                currentView === 'workspace'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              Case Workspace
            </button>
          )}

          <button
            onClick={() => setCurrentView('explorer')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap antialiased ${
              currentView === 'explorer'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Connection Explorer
          </button>

          <button
            onClick={() => setCurrentView('simulator')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap antialiased ${
              currentView === 'simulator'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Simulation & S1–S12 Tests
          </button>

          <button
            onClick={() => setCurrentView('lakehouse')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap antialiased ${
              currentView === 'lakehouse'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Lakehouse Analytics
          </button>

          <button
            onClick={() => setCurrentView('governance')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap antialiased ${
              currentView === 'governance'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin & Site Master</span>
            {isAdmin && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
            )}
          </button>
        </div>
      </header>

      {/* MAIN BODY VIEW */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentView === 'control_tower' && (
          <ControlTower
            currentUser={currentUser}
            onSelectCase={handleOpenCase}
            onOpenSimulator={() => setCurrentView('simulator')}
          />
        )}

        {currentView === 'inbox' && (
          <RiskInbox onSelectCase={handleOpenCase} />
        )}

        {currentView === 'workspace' && selectedCaseId && (
          <CaseWorkspace
            caseId={selectedCaseId}
            currentUser={currentUser}
            onBack={() => setCurrentView('inbox')}
            onCaseUpdated={loadInitialData}
          />
        )}

        {currentView === 'explorer' && (
          <ConnectionExplorer onSelectCase={handleOpenCase} />
        )}

        {currentView === 'simulator' && (
          <SimulationConsole
            onScenarioRan={loadInitialData}
            onSelectCaseByConnectionId={(connId) => {
              setCurrentView('inbox');
            }}
          />
        )}

        {currentView === 'lakehouse' && (
          <LakehouseAnalytics />
        )}

        {currentView === 'governance' && (
          <AdminGovernance 
            currentUser={currentUser} 
            personas={personas}
            onSwitchPersona={handlePersonaChangeById}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/80 py-4 text-xs text-slate-500 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-400">CaR Control Tower</span>
            <span>•</span>
            <span>Deterministic Risk Engine</span>
            <span>•</span>
            <span>Site Master Hub</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Signed in as <strong className="text-slate-700 dark:text-slate-300">{currentUser.name}</strong> ({currentUser.role})</span>
            <span>•</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">Status: ALL SYSTEMS NOMINAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
