"use client";

import { useState, useEffect, useRef } from "react";
import useUser from "@/utils/useUser";
import { useInvestigationCredits } from "@/hooks/useInvestigationCredits";
import {
  Shield,
  ArrowRight,
  ArrowUpRight,
  Search,
  Bell,
  User,
  Menu,
  X,
  LayoutDashboard,
  FileBarChart,
  Map,
  CreditCard,
  Settings,
  Plus,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Sparkles,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import "@/components/Landing/shadowtrace.css";

export default function Dashboard() {
  const { data: user, loading } = useUser();
  const { data: credits, error: creditError } = useInvestigationCredits(user?.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [investigations, setInvestigations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
  });

  // NEW: lightweight polling so the dashboard feels "live"
  const pollRef = useRef({ invTimer: null, monitoringTimer: null });

  // NEW: keep admin gating consistent with /administration and backend admin checks
  const isAdminEmail =
    (user?.email || "").toLowerCase() === "glossontravis@gmail.com";
  const isAdmin = user?.role === "admin" || isAdminEmail;

  useEffect(() => {
    if (user) {
      fetchInvestigations();
    }
  }, [user]);

  // NEW: auto-refresh the investigations list while there is work in progress.
  useEffect(() => {
    if (!user) return;

    const clear = () => {
      if (pollRef.current.invTimer) {
        clearInterval(pollRef.current.invTimer);
        pollRef.current.invTimer = null;
      }
    };

    clear();

    pollRef.current.invTimer = setInterval(() => {
      // If the tab is hidden, don't spam requests.
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      fetchInvestigations();
    }, 5000);

    return () => clear();
  }, [user]);

  // NEW: drive "real-time social monitoring" while a user is on the dashboard.
  // (Without cron jobs, this is the safest way to keep monitoring running.)
  useEffect(() => {
    if (!user) return;

    const clear = () => {
      if (pollRef.current.monitoringTimer) {
        clearInterval(pollRef.current.monitoringTimer);
        pollRef.current.monitoringTimer = null;
      }
    };

    clear();

    const runMonitoringTick = async () => {
      try {
        // best-effort: do not block UI, ignore failures
        await fetch("/api/social-monitoring/tick", {
          method: "POST",
          headers: { Accept: "application/json" },
        });
      } catch (e) {
        // ignore
      }
    };

    // Run once on load, then periodically.
    runMonitoringTick();

    pollRef.current.monitoringTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      runMonitoringTick();
    }, 20000);

    return () => clear();
  }, [user]);

  // Redirect must be done in an effect to avoid SSR window access
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/account/signin";
    }
  }, [loading, user]);

  const fetchInvestigations = async () => {
    try {
      const response = await fetch("/api/investigations?limit=10", {
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        window.location.href = `/account/signin?callbackUrl=${encodeURIComponent(
          window.location.pathname,
        )}`;
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (!Array.isArray(data?.investigations)) throw new Error('Invalid investigation response');
        const items = data.investigations;
        setListError(false);
        setInvestigations(items);

        // Calculate stats
        const total = items.length;
        const completed = items.filter((i) => i.status === "completed").length;
        const processing = items.filter(
          (i) => i.status === "processing",
        ).length;
        const failed = items.filter((i) => i.status === "failed").length;

        setStats({ total, completed, processing, failed });
      } else {
        setListError(true);
      }
    } catch (error) {
      setListError(true);
    } finally {
      setListLoading(false);
    }
  };


  if (loading || !user) {
    return <div className="st-dashboard"><main className="st-empty-state" style={{ width: '100%' }}><Shield size={30} aria-hidden="true" /><p role="status">Opening your workspace…</p></main></div>;
  }

  return <DashboardView user={user} credits={credits} creditError={creditError}
    sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} isAdmin={isAdmin}
    investigations={investigations} stats={stats} listLoading={listLoading}
    listError={listError} retry={fetchInvestigations} />;
}

export function filterInvestigationRows(rows, query) {
  const value = String(query || '').trim().toLowerCase();
  return rows.filter(row => [row.target_value, row.target_type, row.status].some(field => String(field || '').toLowerCase().includes(value)));
}

export function DashboardView({ user, credits, creditError, sidebarOpen = false, setSidebarOpen = () => {}, isAdmin = false, investigations = [], stats = { total: 0, completed: 0, processing: 0, failed: 0 }, listLoading = false, listError = false, retry = () => {}, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const menuToggle = useRef(null);
  useEffect(() => {
    if (!sidebarOpen) return;
    const close = event => {
      if (event.key === 'Escape') { setSidebarOpen(false); menuToggle.current?.focus(); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [sidebarOpen, setSidebarOpen]);
  const rows = filterInvestigationRows(investigations, query);
  const navigation = [
    ['/dashboard', LayoutDashboard, 'Overview'],
    ['/investigations/new', Plus, 'New investigation'],
    ['/investigations', FileBarChart, 'Investigations'],
    ['/ai/chat', Sparkles, 'AI Chat'],
    ['/map', Map, 'Global map'],
    ['/billing', CreditCard, 'Billing'],
    ['/settings', Settings, 'Settings'],
  ];
  const creditLabel = creditError ? 'Unavailable' : !credits ? 'Loading…' : credits.credits_unlimited ? 'Unlimited' : credits.monthly_remaining;
  const creditNote = creditError ? 'Could not load your allowance' : credits?.credits_unlimited ? 'Your investigation allowance' : 'Current investigation allowance';
  const statusIcon = status => status === 'completed' ? CheckCircle : status === 'failed' ? XCircle : Clock;

  return (
    <div className="st-dashboard">
      <a className="st-skip" href="#workspace-main">Skip to workspace</a>
      <aside className="st-app-sidebar" id="workspace-navigation" data-open={sidebarOpen}>
        <div className="st-app-brand"><a href="/" aria-label="ShadowTrace home"><BrandLogo className="st-logo" /></a><button type="button" className="st-mobile-only" aria-label="Close navigation" onClick={() => { setSidebarOpen(false); menuToggle.current?.focus(); }}><X size={18} aria-hidden="true" /></button></div>
        <p className="st-sidebar-label">WORKSPACE</p>
        <nav className="st-app-nav" aria-label="Workspace navigation">{navigation.map(([href, Icon, label]) => <a key={href} href={href} aria-current={href === '/dashboard' ? 'page' : undefined}><Icon size={17} aria-hidden="true" /><span>{label}</span></a>)}</nav>
        {isAdmin && <div className="st-admin-nav"><p className="st-sidebar-label">ADMINISTRATION</p><nav className="st-app-nav" aria-label="Administration"><a href="/administration"><Activity size={17} aria-hidden="true" />Admin portal</a></nav></div>}
        <div className="st-sidebar-bottom"><Shield size={21} aria-hidden="true" /><p>SOURCE-LED INTELLIGENCE<br />HUMAN-REVIEWED CONCLUSIONS</p><a href="/account/logout">Sign out <ArrowRight size={13} aria-hidden="true" /></a></div>
      </aside>

      <div className="st-app-main">
        <header className="st-app-topbar"><div className="st-breadcrumb"><button ref={menuToggle} type="button" className="st-mobile-only" aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={19} aria-hidden="true" /></button><span>Workspace</span><span>/</span><strong>Overview</strong></div><a href="/settings" className="st-account-link" aria-label="Account settings"><span className="st-avatar"><User size={15} aria-hidden="true" /></span><span>{user?.name || user?.email || 'Your account'}</span></a></header>
        <main id="workspace-main" className="st-app-content">
          <div className="st-app-heading"><div><p className="st-eyebrow">YOUR INTELLIGENCE WORKSPACE</p><h1>A clearer view of your work.</h1><p>Pick up an investigation, examine the evidence, or follow a new lead.</p></div><div className="st-app-actions"><a href="/ai/chat" className="st-button st-button-outline"><Sparkles size={15} aria-hidden="true" />AI Chat</a><a href="/investigations/new" className="st-button"><Plus size={16} aria-hidden="true" />New investigation</a></div></div>

          <div className="st-stats-grid" aria-label="Investigation overview">
            <article className="st-stat"><div className="st-stat-top"><p>Credits remaining</p><CreditCard size={18} aria-hidden="true" /></div><strong>{creditLabel}</strong><small>{creditNote}</small></article>
            <article className="st-stat"><div className="st-stat-top"><p>Recent investigations</p><FileBarChart size={18} aria-hidden="true" /></div><strong>{listLoading ? '—' : listError ? 'Unavailable' : stats.total}</strong><small>Latest 10 investigations</small></article>
            <article className="st-stat"><div className="st-stat-top"><p>Completed</p><CheckCircle size={18} aria-hidden="true" /></div><strong>{listLoading ? '—' : listError ? 'Unavailable' : stats.completed}</strong><small>In your recent activity</small></article>
            <article className="st-stat"><div className="st-stat-top"><p>In progress</p><Clock size={18} aria-hidden="true" /></div><strong>{listLoading ? '—' : listError ? 'Unavailable' : stats.processing}</strong><small>In your recent activity</small></article>
          </div>

          {listError && <div role="alert" className="st-error-banner"><AlertTriangle size={18} aria-hidden="true" /><span>Could not refresh investigations.{investigations.length > 0 ? ' Previously loaded results are shown below.' : ''}</span><button type="button" onClick={retry}>Try again</button></div>}
          <section className="st-investigation-panel" aria-labelledby="recent-investigations-heading">
            <div className="st-panel-heading"><div><h2 id="recent-investigations-heading">Recent investigations</h2><p>Your latest work, with its current recorded status.</p></div><a href="/investigations">View all <ArrowUpRight size={15} aria-hidden="true" /></a></div>
            <div className="st-table-tools"><label className="st-search-field"><Search size={16} aria-hidden="true" /><span className="st-sr-only">Filter recent investigations</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by target, type or status…" /></label><span>{listLoading ? 'LOADING' : `${rows.length} SHOWN`}</span></div>
            {listLoading && !investigations.length ? <div className="st-empty-state"><p role="status">Loading your investigations…</p></div> : !investigations.length ? <div className="st-empty-state"><div className="st-empty-icon"><Search size={27} aria-hidden="true" /></div><h3>{listError ? 'Your investigations are unavailable' : 'Every investigation starts with a lead.'}</h3><p>{listError ? 'Retry the request to load your work. No investigation records have been changed.' : 'Start with a known identifier. Keep the evidence, context and unanswered questions together.'}</p>{!listError && <a href="/investigations/new" className="st-button st-button-small"><Plus size={15} aria-hidden="true" />Start an investigation</a>}</div> : !rows.length ? <div className="st-empty-state"><h3>No matching recent investigations</h3><p>Try another filter, or open all investigations to search beyond the latest ten.</p><button type="button" className="st-button st-button-outline" onClick={() => setQuery('')}>Clear filter</button></div> : <div className="st-table-scroll"><table className="st-data-table"><caption className="st-sr-only">Recent investigations with target, type, recorded status, risk score and creation date</caption><thead><tr>{['Target', 'Type', 'Status', 'Risk score', 'Created', 'Action'].map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{rows.map(investigation => {
              const Icon = statusIcon(investigation.status);
              const score = investigation.risk_score;
              const validScore = (typeof score === 'number' || (typeof score === 'string' && score.trim() !== '')) && Number.isFinite(Number(score)) && Number(score) >= 0 && Number(score) <= 100;
              const created = new Date(investigation.created_at);
              return <tr key={investigation.id}><td className="st-target-value" title={String(investigation.target_value || '')}>{investigation.target_value}</td><td className="st-type">{investigation.target_type}</td><td><span className={`st-status st-status-${['completed','processing','failed'].includes(investigation.status) ? investigation.status : 'pending'}`}><Icon size={12} aria-hidden="true" />{investigation.status}</span></td><td>{validScore ? `${score}/100` : '—'}</td><td>{Number.isFinite(created.getTime()) ? created.toLocaleDateString() : '—'}</td><td><a href={`/investigations/${encodeURIComponent(investigation.id)}`} className="st-view-link" aria-label={`View investigation ${investigation.id}`}>View <ArrowUpRight size={14} aria-hidden="true" /></a></td></tr>;
            })}</tbody></table></div>}
          </section>
          <p className="st-dashboard-note"><Shield size={14} aria-hidden="true" />Profile matches and automated scores require source review. They are not proof of identity.</p>
        </main>
      </div>
      {sidebarOpen && <button type="button" className="st-sidebar-overlay" aria-label="Close navigation overlay" onClick={() => { setSidebarOpen(false); menuToggle.current?.focus(); }} />}
    </div>
  );
}
