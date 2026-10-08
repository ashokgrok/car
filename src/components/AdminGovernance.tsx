import React, { useState, useEffect } from 'react';
import { api, DeadLetterMessage } from '../services/api';
import { ThresholdConfig, UserPersona, SiteMasterConfig, UserPermissions } from '../types/car';
import { SiteParametersTab } from './admin/SiteParametersTab';
import { SiteFeedsTab } from './admin/SiteFeedsTab';
import { DlqPartitionedTab } from './admin/DlqPartitionedTab';
import {
  Settings,
  Shield,
  AlertOctagon,
  Users,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Play,
  Download,
  FileSpreadsheet,
  Building2,
  Plus,
  Edit2,
  MapPin,
  Clock,
  Car,
  Plane,
  Ship,
  Lock,
  ArrowRight,
  Sparkles,
  Sliders,
  Check,
  X,
  AlertTriangle,
  Info,
  Radio
} from 'lucide-react';

interface AdminGovernanceProps {
  currentUser: UserPersona;
  personas?: UserPersona[];
  onSwitchPersona?: (personaId: string) => void;
}

export const AdminGovernance: React.FC<AdminGovernanceProps> = ({ 
  currentUser, 
  personas = [], 
  onSwitchPersona 
}) => {
  const isAdmin = currentUser.role === 'CAR_ADMIN' || !!currentUser.permissions?.can_access_admin;

  const [activeTab, setActiveTab] = useState<'sites' | 'parameters' | 'feeds' | 'users' | 'dlq' | 'exports'>('sites');
  const [config, setConfig] = useState<ThresholdConfig | null>(null);
  const [sites, setSites] = useState<SiteMasterConfig[]>([]);
  const [userList, setUserList] = useState<UserPersona[]>([]);
  const [dlqMessages, setDlqMessages] = useState<DeadLetterMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Site Onboarding / Edit Modal State
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [editingSiteCode, setEditingSiteCode] = useState<string | null>(null);
  const [siteFormData, setSiteFormData] = useState<Partial<SiteMasterConfig>>({
    site_code: '',
    site_name: '',
    region: '',
    airport_code: '',
    airport_name: '',
    port_code: '',
    port_name: '',
    transfer_corridor: '',
    base_transfer_minutes: 20,
    safety_buffer_minutes: 5,
    high_traffic_multiplier: 1.4,
    deplaning_window_minutes: 15,
    prm_deplaning_buffer_minutes: 10,
    port_processing_minutes: 10,
    ferry_cutoff_minutes: 15,
    max_ferry_hold_minutes: 15,
    dispatch_contact: '',
    status: 'ACTIVE'
  });

  // User Create / Edit Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [userFormData, setUserFormData] = useState<{
    name: string;
    email: string;
    role: any;
    team: string;
    description: string;
    assigned_sites: string[];
    permissions: UserPermissions;
  }>({
    name: '',
    email: '',
    role: 'CAR_DUTY_MANAGER',
    team: 'Airport-Port Integrated Ops',
    description: 'Operational team member',
    assigned_sites: ['SITE01'],
    permissions: {
      can_override_risk: false,
      can_rebook_sailings: false,
      can_request_ferry_hold: false,
      can_manage_sites: false,
      can_edit_rules: false,
      can_assign_cases: false,
      can_access_admin: false
    }
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [cfg, sitesData, usersData, dlq] = await Promise.all([
        api.getConfig(),
        api.getSites().catch(() => []),
        api.getUsers().catch(() => personas),
        api.getDLQ().catch(() => [])
      ]);
      setConfig(cfg);
      setSites(sitesData);
      setUserList(usersData.length > 0 ? usersData : personas);
      setDlqMessages(dlq);
    } catch (err: any) {
      console.error('Failed to load admin governance data:', err);
      setErrorMessage(err.message || 'Failed to connect to admin backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerFeedback = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  // --- PARAMETERS SAVE & RECALCULATION ---
  const handleConfigSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      await api.updateConfig(config);
      // Automatically recalculate active connections
      const result = await api.recalculateRisk().catch(() => ({ count: 0 }));
      triggerFeedback(`Operational parameters updated. Recalculated ${result.count} active connections.`);
    } catch (err: any) {
      setErrorMessage(`Failed to save configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleManualRecalculate = async () => {
    try {
      setSaving(true);
      const result = await api.recalculateRisk();
      triggerFeedback(result.message || 'Active connections recalculated successfully.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- SITE MASTER CRUD ---
  const openNewSiteModal = () => {
    setEditingSiteCode(null);
    setSiteFormData({
      site_code: '',
      site_name: '',
      region: '',
      airport_code: '',
      airport_name: '',
      port_code: '',
      port_name: '',
      transfer_corridor: '',
      base_transfer_minutes: 20,
      safety_buffer_minutes: 5,
      high_traffic_multiplier: 1.4,
      deplaning_window_minutes: 15,
      prm_deplaning_buffer_minutes: 10,
      port_processing_minutes: 10,
      ferry_cutoff_minutes: 15,
      max_ferry_hold_minutes: 15,
      dispatch_contact: '',
      status: 'ACTIVE'
    });
    setShowSiteModal(true);
  };

  const openEditSiteModal = (site: SiteMasterConfig) => {
    setEditingSiteCode(site.site_code);
    setSiteFormData({ ...site });
    setShowSiteModal(true);
  };

  const handleSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMessage(null);

      if (editingSiteCode) {
        await api.updateSite(editingSiteCode, siteFormData);
        triggerFeedback(`Site ${editingSiteCode} updated successfully.`);
      } else {
        await api.createSite(siteFormData);
        triggerFeedback(`New site ${siteFormData.site_code} onboarded successfully!`);
      }

      setShowSiteModal(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save site');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSite = async (siteCode: string) => {
    if (!confirm(`Are you sure you want to decommission and delete site ${siteCode}?`)) return;
    try {
      setSaving(true);
      await api.deleteSite(siteCode);
      triggerFeedback(`Site ${siteCode} deleted.`);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- USER PERMISSION TOGGLES ---
  const handleTogglePermission = async (user: UserPersona, permissionKey: keyof UserPermissions) => {
    const currentVal = !!user.permissions?.[permissionKey];
    const updatedPermissions = {
      ...(user.permissions || {
        can_override_risk: false,
        can_rebook_sailings: false,
        can_request_ferry_hold: false,
        can_manage_sites: false,
        can_edit_rules: false,
        can_assign_cases: false,
        can_access_admin: false
      }),
      [permissionKey]: !currentVal
    };

    try {
      const updated = await api.updateUser(user.id, { permissions: updatedPermissions });
      setUserList(prev => prev.map(u => (u.id === user.id ? updated : u)));
      triggerFeedback(`Permissions updated for ${user.name}`);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleUserCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMessage(null);
      const created = await api.createUser(userFormData);
      setUserList(prev => [...prev, created]);
      setShowUserModal(false);
      triggerFeedback(`User ${created.name} (${created.role}) created successfully.`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- DLQ ACTIONS ---
  const handleRetryDLQ = async (id: string) => {
    await api.retryDLQ(id);
    await loadData();
    triggerFeedback(`Message ${id} dispatched for reprocessing.`);
  };

  const handlePurgeDLQ = async (id: string) => {
    await api.purgeDLQ(id);
    await loadData();
    triggerFeedback(`Message ${id} purged.`);
  };

  // ==========================================
  // ACCESS RESTRICTION GATE FOR NON-ADMIN USERS
  // ==========================================
  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              Administrator Privilege Required
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              You are currently signed in as <strong className="text-slate-900 dark:text-slate-200">{currentUser.name}</strong> ({currentUser.role}). 
              Configuration of calculation parameters, site master onboarding, and user roles is restricted to authorized platform administrators.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left max-w-md mx-auto space-y-2 text-xs">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Required Role: CAR_ADMIN
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Only users with administrative privileges can alter connection risk thresholds, transit corridors, and RBAC matrix policies.
            </p>
          </div>

          {onSwitchPersona && (
            <div className="pt-2">
              <button
                id="elevate-admin-btn"
                onClick={() => {
                  const adminPersona = personas.find(p => p.role === 'CAR_ADMIN');
                  if (adminPersona) onSwitchPersona(adminPersona.id);
                }}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/30 inline-flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                <span>Switch to Administrator (Priya Patel)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading && !config) {
    return (
      <div className="p-16 text-center text-slate-400">
        <RefreshCw className="w-7 h-7 animate-spin mx-auto text-sky-500 mb-3" />
        <p className="text-sm font-semibold">Loading Admin & Site Master Console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccess}</span>
          </div>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Admin Governance & Site Master
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
                PRIVILEGED
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configure cross-modal site corridors, risk calculation drivers, user role permissions, and compliance pipelines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRecalculate}
            disabled={saving}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-2 border border-slate-300 dark:border-slate-700"
            title="Recalculate risk on all active journeys using current parameters"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span>Recalculate Margins</span>
          </button>

          <button
            onClick={openNewSiteModal}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Site</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          id="admin-tab-sites"
          onClick={() => setActiveTab('sites')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'sites'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Site Master ({sites.length})</span>
        </button>

        <button
          id="admin-tab-parameters"
          onClick={() => setActiveTab('parameters')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'parameters'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Calculation Parameters</span>
        </button>

        <button
          id="admin-tab-feeds"
          onClick={() => setActiveTab('feeds')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'feeds'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Site Feeds & Systems</span>
        </button>

        <button
          id="admin-tab-users"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'users'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Roles & Permissions ({userList.length})</span>
        </button>

        <button
          id="admin-tab-dlq"
          onClick={() => setActiveTab('dlq')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'dlq'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>DLQ Message Bus ({dlqMessages.length})</span>
        </button>

        <button
          id="admin-tab-exports"
          onClick={() => setActiveTab('exports')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'exports'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Compliance Exports</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SITE MASTER & ONBOARDING HUB                     */}
      {/* ======================================================== */}
      {activeTab === 'sites' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase">Onboarded Sites</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{sites.length}</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> All active & reachable
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase">Total Active Corridors</div>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
                {sites.filter(s => s.status === 'ACTIVE').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Highway & marine transit links</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase">Average Transfer Window</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {sites.length ? Math.round(sites.reduce((acc, s) => acc + s.base_transfer_minutes, 0) / sites.length) : 0} min
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Base highway shuttle duration</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase">Max Ferry Hold Allowed</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {sites.length ? Math.max(...sites.map(s => s.max_ferry_hold_minutes)) : 15} min
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Maximum berth hold limit</div>
            </div>
          </div>

          {/* Sites Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sites.map((site) => (
              <div 
                key={site.site_code} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-sky-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                          {site.site_code}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase">
                          {site.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 leading-snug">
                        {site.site_name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {site.region}
                      </p>
                    </div>

                    <button
                      onClick={() => openEditSiteModal(site)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Edit site configuration"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Terminal details */}
                  <div className="space-y-2.5 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Plane className="w-4 h-4 text-sky-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{site.airport_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">Code: {site.airport_code}</div>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Ship className="w-4 h-4 text-teal-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{site.port_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">Berth: {site.port_code}</div>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Car className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{site.transfer_corridor}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Base: {site.base_transfer_minutes}m • Buffer: +{site.safety_buffer_minutes}m • Peak: {site.high_traffic_multiplier}x
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Site Parameters */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-950/60">
                      <span className="text-slate-500">Deplaning Window:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 ml-1">{site.deplaning_window_minutes} min</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-950/60">
                      <span className="text-slate-500">PRM Extra Buffer:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 ml-1">+{site.prm_deplaning_buffer_minutes} min</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-950/60">
                      <span className="text-slate-500">Port Check-in:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 ml-1">{site.port_processing_minutes} min</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-950/60">
                      <span className="text-slate-500">Max Ferry Hold:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 ml-1">{site.max_ferry_hold_minutes} min</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 truncate">
                    Contact: {site.dispatch_contact || 'N/A'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditSiteModal(site)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60 transition-colors"
                    >
                      Configure
                    </button>
                    <button
                      onClick={() => handleDeleteSite(site.site_code)}
                      className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition-colors"
                      title="Delete site"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: OPERATIONAL CALCULATION PARAMETERS               */}
      {/* ======================================================== */}
      {activeTab === 'parameters' && (
        <SiteParametersTab
          sites={sites}
          onFeedback={triggerFeedback}
          onError={(err) => setErrorMessage(err)}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 2.5: SITE-SPECIFIC FEEDS & SYSTEMS                  */}
      {/* ======================================================== */}
      {activeTab === 'feeds' && (
        <SiteFeedsTab
          sites={sites}
          onFeedback={triggerFeedback}
          onError={(err) => setErrorMessage(err)}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 3: ROLES & PERMISSIONS MATRIX                       */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Operator User Directory & Role-Based Access Control (RBAC)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage operator roles, assigned site scopes, and fine-grained operational execution permissions.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowUserModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                    <th className="pb-3 pr-4">User</th>
                    <th className="pb-3 px-3">Role & Team</th>
                    <th className="pb-3 px-3">Sites</th>
                    <th className="pb-3 px-2 text-center" title="Can Override Connection Risk Assessment">Override</th>
                    <th className="pb-3 px-2 text-center" title="Can Rebook Alternative Sailings">Rebook</th>
                    <th className="pb-3 px-2 text-center" title="Can Authorize Ferry Berth Holds">Hold Ferry</th>
                    <th className="pb-3 px-2 text-center" title="Can Manage Sites in Site Master">Site Master</th>
                    <th className="pb-3 px-2 text-center" title="Can Edit Calculation Rules">Edit Rules</th>
                    <th className="pb-3 px-2 text-center" title="Can Assign & Escalate Cases">Assign Cases</th>
                    <th className="pb-3 px-2 text-center" title="Has Full Admin Console Access">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {userList.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-sky-300 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                            {user.avatar}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {user.name}
                              {user.id === currentUser.id && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-mono font-normal">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">{user.email || `${user.id}@car-ops.internal`}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {user.role}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[160px]">{user.team}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(user.assigned_sites || ['SITE01']).map(site => (
                            <span key={site} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {site}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Toggles */}
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleTogglePermission(user, 'can_override_risk')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            user.permissions?.can_override_risk
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {user.permissions?.can_override_risk ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                        </button>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleTogglePermission(user, 'can_rebook_sailings')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            user.permissions?.can_rebook_sailings
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {user.permissions?.can_rebook_sailings ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                        </button>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleTogglePermission(user, 'can_request_ferry_hold')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            user.permissions?.can_request_ferry_hold
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {user.permissions?.can_request_ferry_hold ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                        </button>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleTogglePermission(user, 'can_manage_sites')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            user.permissions?.can_manage_sites
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {user.permissions?.can_manage_sites ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                        </button>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleTogglePermission(user, 'can_edit_rules')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            user.permissions?.can_edit_rules
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {user.permissions?.can_edit_rules ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                        </button>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleTogglePermission(user, 'can_assign_cases')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            user.permissions?.can_assign_cases
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {user.permissions?.can_assign_cases ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                        </button>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleTogglePermission(user, 'can_access_admin')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            user.permissions?.can_access_admin
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {user.permissions?.can_access_admin ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: SERVICE BUS DLQ & TELEMETRY                      */}
      {/* ======================================================== */}
      {activeTab === 'dlq' && (
        <DlqPartitionedTab
          sites={sites}
          onFeedback={triggerFeedback}
          onError={(err) => setErrorMessage(err)}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 5: COMPLIANCE EXPORTS                               */}
      {/* ======================================================== */}
      {activeTab === 'exports' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Operational CSV & Compliance Export Engine
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Stream-to-CSV</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Download production-ready snapshots directly from the Operational Data Store (ODS) and Azure Event Hubs audit stream for port authority audit and SLA reporting.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <a
              href={api.getExportConnectionsUrl()}
              download
              className="p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-sky-500 rounded-xl transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-500 transition-colors flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-sky-500" />
                  Active Connections CSV
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Margins, flight ETAs, ferry cutoffs, pax counts
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
            </a>

            <a
              href={api.getExportCasesUrl()}
              download
              className="p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-amber-500 rounded-xl transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                  Cases & Interventions CSV
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Priorities, SLA statuses, assigned teams, outcomes
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
            </a>

            <a
              href={api.getExportAuditUrl()}
              download
              className="p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 rounded-xl transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  Full Audit Trail CSV
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Immutable action logs, overrides, actor IDs
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
            </a>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SITE ONBOARDING / CONFIGURATION MODAL                    */}
      {/* ======================================================== */}
      {showSiteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingSiteCode ? `Edit Site Configuration: ${editingSiteCode}` : 'Onboard New Intermodal Site'}
                </h3>
              </div>
              <button
                onClick={() => setShowSiteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSiteSubmit} className="space-y-4 text-xs">
              {/* Row 1: Site Code, Name, Region */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Site Code (ID) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingSiteCode}
                    placeholder="e.g. SITE04, ATH, OSL"
                    value={siteFormData.site_code || ''}
                    onChange={(e) => setSiteFormData({ ...siteFormData, site_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Site Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Athens Intermodal Gateway"
                    value={siteFormData.site_name || ''}
                    onChange={(e) => setSiteFormData({ ...siteFormData, site_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Region / Corridor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aegean Maritime Hub"
                    value={siteFormData.region || ''}
                    onChange={(e) => setSiteFormData({ ...siteFormData, region: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Row 2: Airport & Port Entities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                <div className="space-y-2">
                  <div className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5" /> Airside Origin Entity
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Airport Code (IATA)</label>
                    <input
                      type="text"
                      placeholder="e.g. ATH"
                      value={siteFormData.airport_code || ''}
                      onChange={(e) => setSiteFormData({ ...siteFormData, airport_code: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Airport Terminal Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Athens International Eleftherios"
                      value={siteFormData.airport_name || ''}
                      onChange={(e) => setSiteFormData({ ...siteFormData, airport_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5" /> Maritime Port Entity
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Ferry Port / Berth Code</label>
                    <input
                      type="text"
                      placeholder="e.g. PIR_GATE_E7"
                      value={siteFormData.port_code || ''}
                      onChange={(e) => setSiteFormData({ ...siteFormData, port_code: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Ferry Terminal Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Port of Piraeus Terminal"
                      value={siteFormData.port_name || ''}
                      onChange={(e) => setSiteFormData({ ...siteFormData, port_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Transfer Corridor & Traffic Parameters */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" /> Ground Transit Corridor
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Corridor Route Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Attiki Odos / Express Bus Link"
                    value={siteFormData.transfer_corridor || ''}
                    onChange={(e) => setSiteFormData({ ...siteFormData, transfer_corridor: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Base Transfer (min)</label>
                    <input
                      type="number"
                      value={siteFormData.base_transfer_minutes || 20}
                      onChange={(e) => setSiteFormData({ ...siteFormData, base_transfer_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Safety Buffer (min)</label>
                    <input
                      type="number"
                      value={siteFormData.safety_buffer_minutes || 5}
                      onChange={(e) => setSiteFormData({ ...siteFormData, safety_buffer_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Peak Multiplier (x)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={siteFormData.high_traffic_multiplier || 1.4}
                      onChange={(e) => setSiteFormData({ ...siteFormData, high_traffic_multiplier: parseFloat(e.target.value) || 1.0 })}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Site-Specific Operational Timings */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Deplaning (min)</label>
                  <input
                    type="number"
                    value={siteFormData.deplaning_window_minutes || 15}
                    onChange={(e) => setSiteFormData({ ...siteFormData, deplaning_window_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">PRM Buffer (min)</label>
                  <input
                    type="number"
                    value={siteFormData.prm_deplaning_buffer_minutes || 10}
                    onChange={(e) => setSiteFormData({ ...siteFormData, prm_deplaning_buffer_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Port Check-in (min)</label>
                  <input
                    type="number"
                    value={siteFormData.port_processing_minutes || 10}
                    onChange={(e) => setSiteFormData({ ...siteFormData, port_processing_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Max Hold (min)</label>
                  <input
                    type="number"
                    value={siteFormData.max_ferry_hold_minutes || 15}
                    onChange={(e) => setSiteFormData({ ...siteFormData, max_ferry_hold_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold text-amber-500"
                  />
                </div>
              </div>

              {/* Row 5: Contact & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Dispatch Operations Contact
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ath-dispatch@car-transit.internal"
                    value={siteFormData.dispatch_contact || ''}
                    onChange={(e) => setSiteFormData({ ...siteFormData, dispatch_contact: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Site Operational Status
                  </label>
                  <select
                    value={siteFormData.status || 'ACTIVE'}
                    onChange={(e) => setSiteFormData({ ...siteFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value="ACTIVE">ACTIVE (In Service)</option>
                    <option value="ONBOARDING">ONBOARDING (Testing Phase)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Temporarily Offline)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSiteModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow flex items-center gap-1.5"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingSiteCode ? 'Save Site Changes' : 'Confirm Site Onboarding'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD USER MODAL                                           */}
      {/* ======================================================== */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Operator Account
                </h3>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUserCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Email / ID</label>
                  <input
                    type="email"
                    placeholder="alex@car-ops.internal"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Operational Role</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                  >
                    <option value="CAR_DUTY_MANAGER">Duty Manager</option>
                    <option value="CAR_AIRPORT_OPS">Airport Ops Lead</option>
                    <option value="CAR_FERRY_OPS">Ferry Ops Dispatcher</option>
                    <option value="CAR_SUPERVISOR">Logistics Supervisor</option>
                    <option value="CAR_ADMIN">Platform Administrator</option>
                    <option value="CAR_VIEWER">Read-Only Observer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Team / Department</label>
                <input
                  type="text"
                  placeholder="e.g. Terminal 2 Airside Ground Crew"
                  value={userFormData.team}
                  onChange={(e) => setUserFormData({ ...userFormData, team: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Initial Permissions</label>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.can_override_risk}
                      onChange={(e) => setUserFormData({
                        ...userFormData,
                        permissions: { ...userFormData.permissions, can_override_risk: e.target.checked }
                      })}
                      className="rounded text-sky-600"
                    />
                    <span>Override Risk</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.can_rebook_sailings}
                      onChange={(e) => setUserFormData({
                        ...userFormData,
                        permissions: { ...userFormData.permissions, can_rebook_sailings: e.target.checked }
                      })}
                      className="rounded text-sky-600"
                    />
                    <span>Rebook Sailings</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.can_request_ferry_hold}
                      onChange={(e) => setUserFormData({
                        ...userFormData,
                        permissions: { ...userFormData.permissions, can_request_ferry_hold: e.target.checked }
                      })}
                      className="rounded text-sky-600"
                    />
                    <span>Hold Ferry</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.can_manage_sites}
                      onChange={(e) => setUserFormData({
                        ...userFormData,
                        permissions: { ...userFormData.permissions, can_manage_sites: e.target.checked }
                      })}
                      className="rounded text-sky-600"
                    />
                    <span>Manage Sites</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
