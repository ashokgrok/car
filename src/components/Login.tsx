import React, { useState } from 'react';
import { 
  Shield, 
  Plane, 
  Ship, 
  Anchor, 
  Users, 
  Key, 
  ArrowRight, 
  Sun, 
  Moon, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Sparkles,
  Building2,
  Sliders
} from 'lucide-react';
import { UserPersona } from '../types/car';
import { LoginBackground } from './LoginBackground';
import { useTheme } from '../context/ThemeContext';

interface LoginProps {
  personas: UserPersona[];
  onLogin: (user: UserPersona) => void;
  isLoading?: boolean;
}

export const Login: React.FC<LoginProps> = ({ personas, onLogin, isLoading = false }) => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'quick' | 'credentials'>('quick');
  const [emailOrUsername, setEmailOrUsername] = useState('priya.patel@car-ops.internal');
  const [password, setPassword] = useState('••••••••••••');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleQuickLogin = (persona: UserPersona) => {
    setSubmittingId(persona.id);
    setErrorMessage(null);
    setTimeout(() => {
      onLogin(persona);
    }, 250);
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = emailOrUsername.trim().toLowerCase();
    // Match against known personas
    const matched = personas.find(p => 
      p.email?.toLowerCase() === cleanInput || 
      p.name.toLowerCase().includes(cleanInput) ||
      p.role.toLowerCase() === cleanInput ||
      (cleanInput.includes('admin') && p.role === 'CAR_ADMIN') ||
      (cleanInput.includes('duty') && p.role === 'CAR_DUTY_MANAGER') ||
      (cleanInput.includes('ferry') && p.role === 'CAR_FERRY_OPS') ||
      (cleanInput.includes('airport') && p.role === 'CAR_AIRPORT_OPS') ||
      (cleanInput.includes('super') && p.role === 'CAR_SUPERVISOR')
    );

    if (matched) {
      setSubmittingId(matched.id);
      setTimeout(() => {
        onLogin(matched);
      }, 300);
    } else {
      // If entered demo admin
      if (cleanInput === 'admin' || cleanInput === 'admin@car-ops.internal') {
        const adminPersona = personas.find(p => p.role === 'CAR_ADMIN') || personas[0];
        onLogin(adminPersona);
      } else {
        setErrorMessage('Invalid credentials. Select a quick persona or enter one of the authorized email accounts.');
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'CAR_ADMIN':
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'CAR_DUTY_MANAGER':
        return <Building2 className="w-4 h-4 text-sky-400" />;
      case 'CAR_FERRY_OPS':
        return <Ship className="w-4 h-4 text-teal-400" />;
      case 'CAR_AIRPORT_OPS':
        return <Plane className="w-4 h-4 text-amber-400" />;
      case 'CAR_SUPERVISOR':
        return <Sliders className="w-4 h-4 text-indigo-400" />;
      default:
        return <Users className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'CAR_ADMIN':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80 dark:bg-emerald-950/90 dark:text-emerald-300';
      case 'CAR_DUTY_MANAGER':
        return 'bg-sky-950/80 text-sky-300 border-sky-800/80 dark:bg-sky-950/90 dark:text-sky-300';
      case 'CAR_FERRY_OPS':
        return 'bg-teal-950/80 text-teal-300 border-teal-800/80 dark:bg-teal-950/90 dark:text-teal-300';
      case 'CAR_AIRPORT_OPS':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/80 dark:bg-amber-950/90 dark:text-amber-300';
      case 'CAR_SUPERVISOR':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80 dark:bg-indigo-950/90 dark:text-indigo-300';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between text-slate-100 overflow-x-hidden font-sans">
      {/* Visual Concept Background */}
      <LoginBackground />

      {/* Top Bar Header */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 border border-sky-400/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-wider text-white">CaR PLATFORM</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800">
                v2.4 Production
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Cross-Modal Connection-at-Risk Operations Center</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Azure ODS Stream: Active</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            id="login-theme-toggle"
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-2 text-xs font-semibold"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-sky-400" />
                <span className="hidden md:inline">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Hero Overview */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Real-Time Passenger Protection</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Secure Operator <br />
                <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
                  Access Portal
                </span>
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed max-w-md">
                Monitor live flight-to-ferry connections, track corridor travel times, manage berth holding decisions, and administer site-level calculation parameters.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm">
                <div className="text-[11px] font-mono text-sky-400 mb-0.5">SITE MASTER</div>
                <div className="text-sm font-bold text-white">Multi-Corridor</div>
                <div className="text-[11px] text-slate-400">YVR, SEA, YYJ & Custom</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm">
                <div className="text-[11px] font-mono text-emerald-400 mb-0.5">RBAC MATRIX</div>
                <div className="text-sm font-bold text-white">5 Personas</div>
                <div className="text-[11px] text-slate-400">Granular role delegation</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-400 flex items-center gap-3">
              <Lock className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Role-governed operational console. Only CAR_ADMIN can modify calculation parameters & Site Master.</span>
            </div>
          </div>

          {/* Right Login Card */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-2xl shadow-black/80 backdrop-blur-xl p-6 md:p-8">
              {/* Tab Selector */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
                <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                  <button
                    id="tab-quick-login"
                    onClick={() => { setActiveTab('quick'); setErrorMessage(null); }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                      activeTab === 'quick'
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Quick Persona Login
                  </button>
                  <button
                    id="tab-credentials-login"
                    onClick={() => { setActiveTab('credentials'); setErrorMessage(null); }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                      activeTab === 'credentials'
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    Operator Credentials
                  </button>
                </div>

                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  Select Role to Begin
                </span>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* TAB 1: QUICK PERSONA LOGIN */}
              {activeTab === 'quick' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-400 mb-3">
                    Click any persona below for instant one-click login with pre-configured operational privileges:
                  </p>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {personas.map((persona) => {
                      const isSubmitting = submittingId === persona.id;
                      const isAdmin = persona.role === 'CAR_ADMIN';

                      return (
                        <button
                          key={persona.id}
                          id={`persona-login-${persona.id}`}
                          onClick={() => handleQuickLogin(persona)}
                          disabled={isLoading || !!submittingId}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                            isAdmin 
                              ? 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-800/40 hover:border-emerald-500/80' 
                              : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800/80 hover:border-sky-500/60'
                          } ${isSubmitting ? 'ring-2 ring-sky-400 opacity-90' : ''}`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Avatar */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow ${
                              isAdmin
                                ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-emerald-500/20'
                                : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-sky-300'
                            }`}>
                              {persona.avatar}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-white group-hover:text-sky-300 transition-colors truncate">
                                  {persona.name}
                                </span>
                                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${getRoleBadgeStyle(persona.role)}`}>
                                  {getRoleIcon(persona.role)}
                                  {persona.role.replace('CAR_', '')}
                                </span>
                                {isAdmin && (
                                  <span className="text-[10px] bg-emerald-500 text-slate-950 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Full Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 truncate mt-0.5">
                                {persona.team}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {persona.description}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-xs font-semibold text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                              Sign In
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-sky-600 flex items-center justify-center text-slate-400 group-hover:text-white transition-all shadow">
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: CREDENTIALS LOGIN */}
              {activeTab === 'credentials' && (
                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Operator Username or Email</label>
                    <div className="relative">
                      <input
                        id="login-username"
                        type="text"
                        value={emailOrUsername}
                        onChange={(e) => setEmailOrUsername(e.target.value)}
                        placeholder="e.g. priya.patel@car-ops.internal or admin"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">Access Token / Password</label>
                      <span className="text-[11px] text-slate-500">SSO / Azure AD Enabled</span>
                    </div>
                    <div className="relative">
                      <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Preset Shortcuts */}
                  <div className="pt-2">
                    <span className="text-[11px] text-slate-400 font-semibold block mb-2">
                      Quick Auto-Fill Account:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEmailOrUsername('priya.patel@car-ops.internal');
                          setPassword('admin2026');
                        }}
                        className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono border border-slate-700"
                      >
                        Admin (Priya Patel)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmailOrUsername('sarah.chen@car-ops.internal');
                          setPassword('manager2026');
                        }}
                        className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-mono border border-slate-700"
                      >
                        Duty Manager (Sarah)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmailOrUsername('elena.rostova@car-ops.internal');
                          setPassword('ferry2026');
                        }}
                        className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 font-mono border border-slate-700"
                      >
                        Ferry Ops (Elena)
                      </button>
                    </div>
                  </div>

                  <button
                    id="submit-login-btn"
                    type="submit"
                    disabled={isLoading || !!submittingId}
                    className="w-full mt-4 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition-all shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>Authenticate & Access Console</span>
                  </button>
                </form>
              )}

              {/* Card Footer */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>Authorized Transit Authority Personnel Only</span>
                <span className="font-mono">Security Level 4</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full px-6 py-3 border-t border-slate-900 bg-slate-950/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-sky-500" />
          <span>CaR Multi-Modal Transit Operations Control • Compliant with FAA & Port Maritime Security Standards</span>
        </div>
        <div className="font-mono">
          ODS Sync: 2026-09-08 UTC • Active Site Master Enabled
        </div>
      </footer>
    </div>
  );
};
