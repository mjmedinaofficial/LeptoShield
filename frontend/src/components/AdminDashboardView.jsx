import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  ExternalLink,
  Gauge,
  Loader2,
  Package,
  Pill,
  PlusCircle,
  RefreshCw,
  Search,
  Siren,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Waves,
} from 'lucide-react';

import { AppShell } from './AppShell';
import {
  DataRow,
  EmptyState,
  LiveIndicator,
  Modal,
  RiskMeter,
  SectionTitle,
  Sparkline,
  StatusPill,
  ThresholdBar,
  TierBadge,
  TierIcon,
} from './Primitives';
import { useLiveQueue } from '../hooks/useLiveQueue';
import {
  callNext,
  completeVisit,
  getEvents,
  getInventory,
  getSurveillance,
  overridePriority,
  restock,
  simulateSurge,
} from '../services/api';
import {
  classNames,
  compactNumber,
  formatTime,
  timeAgo,
  tierTheme,
  waitLabel,
} from '../lib/format';

const TIER_OPTIONS = ['high', 'moderate', 'low'];

const QUEUE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'low', label: 'Low' },
];

const REGION_STATUS_STYLES = {
  epidemic: 'border-clay/25 bg-clay-soft text-clay-deep',
  alert: 'border-ochre/30 bg-ochre-soft text-ochre-deep',
  normal: 'border-moss/25 bg-moss-soft text-moss-deep',
};

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const tone =
    toast.tone === 'error'
      ? 'border-clay/30 bg-clay-dark text-clay-soft'
      : toast.tone === 'warning'
        ? 'border-ochre/30 bg-ochre-deep text-ochre-soft'
        : 'border-moss/30 bg-moss-deep text-moss-soft';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div
        className={classNames(
          'pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-lift animate-rise',
          tone,
        )}
        role="status"
      >
        {toast.tone === 'error' ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
    </div>
  );
}

function CounterCard({ counter, highWaiting, busy, onCall, onComplete }) {
  const active = counter.active;
  const canPreempt =
    counter.mode === 'flexible' && active && active.tier !== 'high' && highWaiting > 0;

  return (
    <div
      className={classNames(
        'flex flex-col rounded-2xl border bg-surface p-4 shadow-soft',
        active ? 'border-teal/25' : 'border-ink-line/80',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.16em] text-ink-mute">
            Counter {counter.id}
          </p>
          <p className="mt-1 text-sm font-bold text-ink">
            {counter.mode === 'high' ? 'Fast-track' : 'Flexible'}
          </p>
          <p className="mt-0.5 text-2xs text-ink-mute">{counter.staff}</p>
        </div>
        <span
          className={classNames(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.1em]',
            active ? 'border-teal/25 bg-teal-soft text-teal-deep' : 'border-ink-line bg-paper-100 text-ink-mute',
          )}
        >
          <span className={classNames('h-1.5 w-1.5 rounded-full', active ? 'bg-teal' : 'bg-ink-faint')} />
          {active ? 'Serving' : 'Idle'}
        </span>
      </div>

      <div className="mt-4 min-h-[64px]">
        {active ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="numeric font-serif text-3xl font-semibold text-ink">
                {active.token}
              </span>
              <TierBadge tier={active.tier} size="sm" />
            </div>
            <p className="mt-1 truncate text-sm text-ink-soft">{active.display_name}</p>
            <p className="mt-0.5 text-2xs text-ink-mute">
              {active.serving_seconds
                ? `In consultation ${waitLabel(active.serving_seconds / 60)}`
                : 'Just called'}
              {active.preempted_count > 0 && ' · returned to queue once'}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-mute">
            {counter.mode === 'high' && highWaiting === 0
              ? 'No high-risk patient waiting.'
              : 'Ready for the next patient.'}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!active && (
          <button
            type="button"
            onClick={() => onCall(counter, false)}
            disabled={busy === `call-${counter.id}`}
            className="btn-primary h-10 px-4 text-xs"
          >
            {busy === `call-${counter.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <BellRing className="h-4 w-4" aria-hidden="true" />
            )}
            Call next
          </button>
        )}
        {canPreempt && (
          <button
            type="button"
            onClick={() => onCall(counter, true)}
            disabled={busy === `call-${counter.id}`}
            className="btn-ochre h-10 px-4 text-xs"
          >
            {busy === `call-${counter.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Waves className="h-4 w-4" aria-hidden="true" />
            )}
            Preempt for high-risk
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={() => onComplete(active)}
            className="btn-secondary h-10 px-4 text-xs"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Close visit
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardView() {
  const { snapshot, status, error, refresh } = useLiveQueue({ pollMs: 10000 });
  const [surveillance, setSurveillance] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [restockOpen, setRestockOpen] = useState(false);
  const [surgeOpen, setSurgeOpen] = useState(false);

  const loadSideData = useCallback(async () => {
    try {
      const [surveillanceData, inventoryData, eventsData] = await Promise.all([
        getSurveillance(),
        getInventory(),
        getEvents(14),
      ]);
      setSurveillance(surveillanceData);
      setInventory(inventoryData);
      setEvents(eventsData.events ?? []);
    } catch {
      /* side panels degrade gracefully */
    }
  }, []);

  useEffect(() => {
    loadSideData();
  }, [loadSideData]);

  useEffect(() => {
    if (!snapshot) return;
    if (Array.isArray(snapshot.recent_events)) setEvents(snapshot.recent_events);
  }, [snapshot]);

  const counters = snapshot?.counters ?? [];
  const waiting = snapshot?.waiting ?? [];
  const serving = snapshot?.serving ?? [];
  const stats = snapshot?.stats;
  const alerts = snapshot?.alerts ?? [];
  const regionRows = surveillance?.regions ?? [];
  const weather = surveillance?.weather ?? snapshot?.surveillance?.weather;
  const surge = surveillance?.surge ?? snapshot?.surge;
  const stock = inventory?.item ?? snapshot?.inventory;

  const highWaiting = stats?.high_waiting ?? waiting.filter((t) => t.tier === 'high').length;

  const rows = useMemo(() => {
    const combined = [...serving, ...waiting];
    return combined.filter((ticket) => {
      if (filter !== 'all' && ticket.tier !== filter) return false;
      if (!query.trim()) return true;
      const needle = query.trim().toLowerCase();
      return (
        ticket.token.toLowerCase().includes(needle) ||
        (ticket.display_name || '').toLowerCase().includes(needle) ||
        (ticket.barangay || '').toLowerCase().includes(needle)
      );
    });
  }, [serving, waiting, filter, query]);

  const notify = (message, tone = 'success') => setToast({ message, tone });

  const handleCall = async (counter, preempt) => {
    setBusy(`call-${counter.id}`);
    try {
      const result = await callNext({ counter_id: counter.id, preempt, actor: 'Duty desk' });
      notify(
        result.preempted_token
          ? `${result.token} called to Counter ${counter.id}; ${result.preempted_token} returned to the queue.`
          : `${result.token} called to Counter ${counter.id}.`,
        result.preempted_token ? 'warning' : 'success',
      );
      await Promise.all([refresh(), loadSideData()]);
    } catch (requestError) {
      notify(requestError.friendlyMessage || 'Could not call the next patient.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleNoShow = async (ticket) => {
    setBusy(`no-show-${ticket.id}`);
    try {
      await completeVisit({
        ticket_id: ticket.id,
        outcome: 'no_show',
        actor: 'Duty desk',
        notes: 'Marked no-show at the desk.',
      });
      notify(`${ticket.token} marked as a no-show.`, 'success');
      await Promise.all([refresh(), loadSideData()]);
    } catch (requestError) {
      notify(requestError.friendlyMessage || 'Could not update that pass.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleSurge = async (count) => {
    setBusy('surge');
    try {
      const result = await simulateSurge(count);
      notify(`${result.added.length} synthetic patients added to the queue.`, 'success');
      setSurgeOpen(false);
      await Promise.all([refresh(), loadSideData()]);
    } catch (requestError) {
      notify(requestError.friendlyMessage || 'Could not simulate a surge.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell status={status}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Duty desk</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Manila Health Center · NCR flood response · {stats ? `${stats.waiting} waiting` : 'connecting'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveIndicator status={status} />
          <button type="button" onClick={() => setSurgeOpen(true)} className="btn-secondary h-10 gap-2 px-3.5 text-xs">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Simulate surge
          </button>
          <button
            type="button"
            onClick={() => Promise.all([refresh(), loadSideData()])}
            className="btn-secondary h-10 gap-2 px-3.5 text-xs"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {error && !snapshot && (
        <div className="mt-6">
          <EmptyState
            icon={Siren}
            title="The clinic feed is not reachable"
            message={error}
            action={
              <button type="button" onClick={refresh} className="btn-primary">
                Try again
              </button>
            }
          />
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-6 space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={classNames(
                'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3',
                alert.level === 'critical'
                  ? 'border-clay/25 bg-clay-mist'
                  : 'border-ochre/30 bg-ochre-mist',
              )}
            >
              <Siren
                className={classNames('h-4 w-4 shrink-0', alert.level === 'critical' ? 'text-clay' : 'text-ochre')}
                aria-hidden="true"
              />
              <p
                className={classNames(
                  'text-sm font-semibold',
                  alert.level === 'critical' ? 'text-clay-deep' : 'text-ochre-deep',
                )}
              >
                {alert.title}
              </p>
              <p
                className={classNames(
                  'text-sm',
                  alert.level === 'critical' ? 'text-clay-deep/90' : 'text-ochre-deep/90',
                )}
              >
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-ink-line/80 bg-ink-line/70 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Waiting', value: stats?.waiting ?? '—', meta: `${stats?.serving ?? 0} in consultation` },
          {
            label: 'High risk waiting',
            value: stats?.high_waiting ?? '—',
            meta: `${stats?.moderate_waiting ?? 0} moderate · ${stats?.low_waiting ?? 0} low`,
            tone: 'text-clay-deep',
          },
          {
            label: 'Median wait today',
            value: stats ? waitLabel(stats.median_wait_minutes) : '—',
            meta: `${stats?.seen_today ?? 0} seen · ${stats?.throughput_last_hour ?? 0} in the last hour`,
          },
          {
            label: 'Doxycycline cover',
            value: stock?.days_remaining ? `${stock.days_remaining} d` : '—',
            meta: `${stock ? compactNumber(stock.stock) : '—'} capsules on hand`,
          },
        ].map((item) => (
          <div key={item.label} className="bg-surface px-5 py-4">
            <p className="label">{item.label}</p>
            <p className={classNames('numeric mt-2 font-serif text-3xl font-semibold', item.tone || 'text-ink')}>
              {item.value}
            </p>
            <p className="mt-1 text-2xs text-ink-mute">{item.meta}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <SectionTitle meta={stats ? `longest wait ${waitLabel(stats.longest_wait_minutes)}` : undefined}>
          Counters
        </SectionTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {counters.map((counter) => (
            <CounterCard
              key={counter.id}
              counter={counter}
              highWaiting={highWaiting}
              busy={busy}
              onCall={handleCall}
              onComplete={setCompleteTarget}
            />
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <SectionTitle
            meta={`${rows.length} shown`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-lg border border-ink-line bg-surface">
                  {QUEUE_FILTERS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      aria-pressed={filter === item.key}
                      className={classNames(
                        'px-3 py-1.5 text-xs font-semibold transition-colors',
                        filter === item.key ? 'bg-teal text-white' : 'text-ink-soft hover:bg-ink/[0.05]',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="relative inline-flex items-center">
                  <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Token or name"
                    className="field h-9 w-40 rounded-lg py-1.5 pl-8 text-xs"
                    aria-label="Search queue"
                  />
                </label>
              </div>
            }
          >
            Live queue
          </SectionTitle>

          <div className="mt-4 overflow-hidden rounded-2xl border border-ink-line/80 bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="bg-paper-50">
                    <th className="table-head px-4 py-3">Token</th>
                    <th className="table-head px-3 py-3">Patient</th>
                    <th className="table-head px-3 py-3">Risk</th>
                    <th className="table-head hidden px-3 py-3 lg:table-cell">Exposure</th>
                    <th className="table-head px-3 py-3">Waiting</th>
                    <th className="table-head px-3 py-3">Status</th>
                    <th className="table-head px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-teal-mist/40">
                      <td className="table-cell px-4 py-3">
                        <span className="numeric font-serif text-lg font-semibold text-ink">
                          {ticket.token}
                        </span>
                      </td>
                      <td className="table-cell px-3 py-3">
                        <p className="text-sm font-semibold text-ink">{ticket.display_name}</p>
                        <p className="text-2xs text-ink-mute">
                          {ticket.age ? `${ticket.age} y` : '—'}
                          {ticket.open_cuts ? ' · open wound' : ''}
                        </p>
                      </td>
                      <td className="table-cell px-3 py-3">
                        <div className="flex flex-col gap-1.5">
                          <TierBadge tier={ticket.tier} size="sm" />
                          <span className="numeric text-2xs text-ink-mute">
                            {ticket.risk_score.toFixed(2)} · pri {Math.round(ticket.priority_score)}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell hidden px-3 py-3 lg:table-cell">
                        <p className="text-xs text-ink-soft">{ticket.exposure_label}</p>
                        <p className="text-2xs text-ink-mute">
                          {ticket.exposure_hours ? `${ticket.exposure_hours} h` : 'no contact'}
                          {ticket.therapeutic?.hours_left > 0 ? ` · window ${ticket.therapeutic.hours_left} h` : ' · window passed'}
                        </p>
                      </td>
                      <td className="table-cell px-3 py-3">
                        <span className="numeric text-sm text-ink-soft">{waitLabel(ticket.wait_minutes)}</span>
                      </td>
                      <td className="table-cell px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusPill status={ticket.status} />
                          {ticket.counter_name && (
                            <span className="text-2xs text-ink-mute">{ticket.counter_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Link
                            to={`/token/${ticket.id}`}
                            className="btn-ghost h-8 gap-1 px-2 text-2xs"
                            title="Open patient pass"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            Pass
                          </Link>
                          {ticket.status === 'waiting' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setOverrideTarget(ticket)}
                                className="btn-secondary h-8 px-2.5 text-2xs"
                              >
                                Override
                              </button>
                              <button
                                type="button"
                                onClick={() => handleNoShow(ticket)}
                                disabled={busy === `no-show-${ticket.id}`}
                                className="btn-ghost h-8 px-2.5 text-2xs text-ink-mute"
                              >
                                No-show
                              </button>
                            </>
                          )}
                          {ticket.status === 'serving' && (
                            <button
                              type="button"
                              onClick={() => setCompleteTarget(ticket)}
                              className="btn-secondary h-8 px-2.5 text-2xs"
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-sm text-ink-mute">
                        No patients match this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-2xs text-ink-mute">
            Priority = tier base (H 1000 / M 500 / L 100) + 100 × risk + wait ageing + vulnerability.
            Counter 1 serves high-risk only; Counters 2 and 3 preempt for a high-risk patient after 30
            seconds.
          </p>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-4">
          <div className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle meta={stock ? `${stock.status}` : undefined}>Pharmacy</SectionTitle>
            </div>
            <div className="mt-2 flex items-end gap-3">
              <span className="numeric font-serif text-4xl font-semibold leading-none text-ink">
                {stock ? compactNumber(stock.stock) : '—'}
              </span>
              <span className="pb-1 text-sm text-ink-mute">{stock?.unit || 'capsules'}</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-ink-mute">
              <span>reorder {stock?.reorder_threshold ?? 500}</span>
              <span>par {stock?.par_level ?? 2000}</span>
            </div>
            <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]">
              <div
                className={classNames(
                  'h-full rounded-full',
                  stock?.status === 'critical' ? 'bg-clay' : stock?.status === 'watch' ? 'bg-ochre' : 'bg-moss',
                )}
                style={{ width: `${Math.min(100, stock?.pct_of_par ?? 0)}%` }}
              />
              <span
                className="absolute top-0 h-2 w-0.5 -translate-x-1/2 bg-ink/40"
                style={{ left: `${Math.min(100, ((stock?.reorder_threshold ?? 500) / (stock?.par_level || 2000)) * 100)}%` }}
                title="Reorder threshold"
              />
            </div>
            <div className="mt-3 space-y-1">
              <DataRow
                label="Projected cover"
                value={stock?.days_remaining ? `${stock.days_remaining} days` : '—'}
              />
              <DataRow
                label="Projected use"
                value={stock ? `${stock.projected_daily_use}/day` : '—'}
              />
              <DataRow
                label="Reached reorder in"
                value={stock?.days_to_reorder !== null && stock?.days_to_reorder !== undefined ? `${stock.days_to_reorder} days` : '—'}
              />
            </div>
            <button type="button" onClick={() => setRestockOpen(true)} className="btn-secondary mt-4 h-10 w-full gap-2 text-xs">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Record a delivery
            </button>
          </div>

          <div className="panel p-5">
            <p className="label">Recent actions</p>
            <ul className="mt-3 space-y-3">
              {events.slice(0, 7).map((event) => (
                <li key={event.id ?? `${event.message}-${event.created_at}`} className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal/60" />
                  <div className="min-w-0">
                    <p className="text-xs leading-relaxed text-ink-soft">{event.message}</p>
                    <p className="mt-0.5 text-2xs text-ink-faint">
                      {event.actor} · {timeAgo(event.created_at)}
                    </p>
                  </div>
                </li>
              ))}
              {!events.length && <li className="text-xs text-ink-mute">No actions recorded yet.</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle
          meta={surveillance ? `${surveillance.week} · DOH epidemiology bureau` : 'loading'}
        >
          DOH surveillance & surge outlook
        </SectionTitle>

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <div className="grid gap-4 md:grid-cols-3">
              {regionRows.map((region) => (
                <div key={region.code} className="panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-sans text-sm font-bold text-ink">{region.short_name}</p>
                      <p className="text-2xs text-ink-mute">{region.name}</p>
                    </div>
                    <span
                      className={classNames(
                        'rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.06em]',
                        REGION_STATUS_STYLES[region.status],
                      )}
                    >
                      {region.status === 'epidemic' ? 'Breach' : region.status === 'alert' ? 'Alert' : 'Stable'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="numeric font-serif text-3xl font-semibold text-ink">
                      {compactNumber(region.cases)}
                    </span>
                    <span className="text-2xs text-ink-mute">
                      {region.trend_pct !== null && region.trend_pct !== undefined
                        ? `${region.trend_pct > 0 ? '+' : ''}${region.trend_pct}% wk`
                        : ''}
                    </span>
                  </div>
                  <ThresholdBar
                    className="mt-2"
                    value={region.cases}
                    alert={region.alert_threshold}
                    epidemic={region.epidemic_threshold}
                  />
                  <div className="mt-1 flex items-center justify-between text-2xs text-ink-mute">
                    <span>alert {region.alert_threshold}</span>
                    <span>epidemic {region.epidemic_threshold}</span>
                  </div>
                  <Sparkline
                    values={(region.history || []).map((week) => week.cases)}
                    className="mt-3 h-10 w-full"
                    stroke={tierTheme(region.status === 'epidemic' ? 'high' : region.status === 'alert' ? 'moderate' : 'low').hex}
                    fill="rgba(14,107,98,.10)"
                    label={`${region.short_name} weekly cases`}
                  />
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {(region.flagged_cities || []).map((city) => (
                      <span key={city} className="rounded-md bg-paper-100 px-2 py-0.5 text-2xs text-ink-soft">
                        {city}
                      </span>
                    ))}
                  </p>
                  {region.margin_to_epidemic >= 0 && (
                    <p className="mt-2 text-2xs font-semibold text-clay-deep">
                      {region.margin_to_epidemic} above the epidemic threshold
                    </p>
                  )}
                </div>
              ))}
              {!regionRows.length && <p className="text-sm text-ink-mute">Surveillance feed is loading…</p>}
            </div>
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-4">
            <div className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="label">Weather & surge</p>
                {surge && (
                  <span
                    className={classNames(
                      'rounded-full border px-2.5 py-1 text-2xs font-semibold',
                      surge.label === 'Critical'
                        ? 'border-clay/25 bg-clay-soft text-clay-deep'
                        : surge.label === 'High'
                          ? 'border-ochre/30 bg-ochre-soft text-ochre-deep'
                          : 'border-moss/25 bg-moss-soft text-moss-deep',
                    )}
                  >
                    {surge.label} · {surge.score}
                  </span>
                )}
              </div>
              {weather && (
                <>
                  <div className="mt-3 flex items-end gap-3">
                    <CloudRain className="h-5 w-5 text-teal" aria-hidden="true" />
                    <span className="numeric font-serif text-3xl font-semibold leading-none text-ink">
                      {Math.round(weather.rainfall_24h_mm)}
                      <span className="ml-1 font-sans text-xs font-semibold text-ink-mute">mm / 24 h</span>
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">{weather.advisory}</p>
                  <div className="mt-3 flex items-center justify-between text-2xs text-ink-mute">
                    <span>Pasig {weather.river_level_m} m</span>
                    <span>critical {weather.river_critical_m} m</span>
                  </div>
                </>
              )}
              {surge && (
                <ul className="mt-4 space-y-2 border-t border-ink-line/70 pt-3">
                  {surge.drivers.map((driver) => (
                    <li key={driver.label} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-ink-soft">{driver.label}</span>
                      <span className="numeric font-semibold text-ink">{driver.value}</span>
                    </li>
                  ))}
                </ul>
              )}
              {surge && (
                <p className="mt-4 rounded-xl bg-paper-100 p-3 text-xs leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">Next step · </span>
                  {surge.recommendation}
                </p>
              )}
            </div>

            <div className="panel p-5">
              <p className="label">Prescription ledger</p>
              <ul className="mt-3 space-y-2.5">
                {(inventory?.transactions ?? []).slice(0, 6).map((txn) => (
                  <li key={txn.id} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="truncate text-ink-soft">{txn.reason}</p>
                      <p className="text-2xs text-ink-faint">
                        {txn.actor} · {timeAgo(txn.created_at)}
                      </p>
                    </div>
                    <span
                      className={classNames(
                        'numeric shrink-0 font-semibold',
                        txn.delta > 0 ? 'text-moss-deep' : 'text-clay-deep',
                      )}
                    >
                      {txn.delta > 0 ? '+' : ''}
                      {txn.delta}
                    </span>
                  </li>
                ))}
                {!(inventory?.transactions ?? []).length && (
                  <li className="text-xs text-ink-mute">No ledger entries yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <OverrideModal
        ticket={overrideTarget}
        onClose={() => setOverrideTarget(null)}
        onDone={async (message) => {
          notify(message, 'success');
          setOverrideTarget(null);
          await Promise.all([refresh(), loadSideData()]);
        }}
        onError={(message) => notify(message, 'error')}
      />

      <CompleteModal
        ticket={completeTarget}
        onClose={() => setCompleteTarget(null)}
        onDone={async (message) => {
          notify(message, 'success');
          setCompleteTarget(null);
          await Promise.all([refresh(), loadSideData()]);
        }}
        onError={(message) => notify(message, 'error')}
      />

      <RestockModal
        open={restockOpen}
        onClose={() => setRestockOpen(false)}
        onDone={async (message) => {
          notify(message, 'success');
          setRestockOpen(false);
          await Promise.all([refresh(), loadSideData()]);
        }}
        onError={(message) => notify(message, 'error')}
      />

      <SurgeModal
        open={surgeOpen}
        busy={busy === 'surge'}
        onClose={() => setSurgeOpen(false)}
        onConfirm={handleSurge}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}

function OverrideModal({ ticket, onClose, onDone, onError }) {
  const [tier, setTier] = useState(null);
  const [reason, setReason] = useState('');
  const [actor, setActor] = useState('Duty nurse');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setTier(ticket.tier === 'high' ? 'moderate' : 'high');
    setReason('');
    setSubmitting(false);
  }, [ticket]);

  const valid = tier && tier !== ticket?.tier && reason.trim().length >= 8;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await overridePriority({ ticket_id: ticket.id, tier, reason: reason.trim(), actor });
      await onDone(`${ticket.token} reprioritised to ${tier} risk.`);
    } catch (requestError) {
      onError(requestError.friendlyMessage || 'Override failed.');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(ticket)}
      onClose={onClose}
      title={`Override priority · ${ticket?.token ?? ''}`}
      description="The token stays the same; the queue priority changes immediately and the reason is audited."
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!valid || submitting} className="btn-primary">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Apply override
          </button>
        </>
      }
    >
      {ticket && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-ink-line/80 bg-paper-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">{ticket.display_name}</p>
                <p className="text-xs text-ink-mute">
                  {ticket.exposure_label} · score {ticket.risk_score.toFixed(2)}
                </p>
              </div>
              <TierBadge tier={ticket.tier} />
            </div>
            <RiskMeter score={ticket.risk_score} tier={ticket.tier} className="mt-3" />
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-ink">New priority</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {TIER_OPTIONS.map((option) => {
                const theme = tierTheme(option);
                const selected = tier === option;
                return (
                  <label
                    key={option}
                    className={classNames(
                      'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all',
                      selected ? theme.badge : 'border-ink-line bg-surface text-ink-soft hover:border-teal/30',
                    )}
                  >
                    <input
                      type="radio"
                      name="override-tier"
                      checked={selected}
                      onChange={() => setTier(option)}
                      className="sr-only"
                    />
                    <TierIcon tier={option} className="h-4 w-4" />
                    {theme.label}
                    {ticket.tier === option && <span className="ml-auto text-2xs">current</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="override-reason" className="text-sm font-bold text-ink">
              Reason (required, at least 8 characters)
            </label>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Clinician escalated after wound inspection and fever."
              className="field mt-2 resize-none"
            />
          </div>

          <div>
            <label htmlFor="override-actor" className="text-sm font-bold text-ink">
              Recorded by
            </label>
            <input
              id="override-actor"
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              maxLength={120}
              className="field mt-2"
            />
          </div>

          {tier === 'high' && ticket.status === 'waiting' && (
            <p className="rounded-xl border border-clay/25 bg-clay-mist p-3 text-xs text-clay-deep">
              This patient will move ahead of moderate and low-risk patients, and a flexible counter
              may preempt after 30 seconds.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function CompleteModal({ ticket, onClose, onDone, onError }) {
  const [outcome, setOutcome] = useState('completed');
  const [notes, setNotes] = useState('');
  const [dispense, setDispense] = useState(true);
  const [quantity, setQuantity] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setOutcome('completed');
    setNotes('');
    setDispense(ticket.tier === 'high');
    setQuantity(2);
    setSubmitting(false);
  }, [ticket]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await completeVisit({
        ticket_id: ticket.id,
        outcome,
        notes: notes.trim() || null,
        dispense: outcome === 'completed' ? dispense : false,
        quantity: dispense ? quantity : undefined,
        actor: 'Duty desk',
      });
      await onDone(
        `${ticket.token} closed${result.ticket?.dispensed_qty ? ` · ${result.ticket.dispensed_qty} capsules dispensed` : ''}.`,
      );
    } catch (requestError) {
      onError(requestError.friendlyMessage || 'Could not close the visit.');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(ticket)}
      onClose={onClose}
      title={`Close visit · ${ticket?.token ?? ''}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={submitting} className="btn-primary">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Close visit
          </button>
        </>
      }
    >
      {ticket && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-line/80 bg-paper-50 p-4">
            <div>
              <p className="text-sm font-bold text-ink">{ticket.display_name}</p>
              <p className="text-xs text-ink-mute">
                {ticket.token} · {ticket.exposure_label}
              </p>
            </div>
            <TierBadge tier={ticket.tier} />
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-ink">Outcome</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: 'completed', label: 'Completed' },
                { value: 'referred', label: 'Referred onward' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={classNames(
                    'chip cursor-pointer',
                    outcome === option.value ? 'chip-active' : 'chip-idle',
                  )}
                >
                  <input
                    type="radio"
                    name="outcome"
                    checked={outcome === option.value}
                    onChange={() => setOutcome(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label
            className={classNames(
              'flex items-start gap-3 rounded-xl border p-4 transition-colors',
              outcome === 'completed' ? 'border-ink-line bg-surface' : 'border-ink-line/60 bg-paper-100 opacity-60',
            )}
          >
            <input
              type="checkbox"
              checked={dispense}
              disabled={outcome !== 'completed'}
              onChange={(event) => setDispense(event.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-ink-line text-teal focus:ring-teal/30"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">
                Dispense doxycycline prophylaxis
              </span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Records the dose against {ticket.token} and draws down stock. Default for high risk is
                two capsules.
              </span>
            </span>
            <input
              type="number"
              min="1"
              max="30"
              value={quantity}
              disabled={!dispense || outcome !== 'completed'}
              onChange={(event) => setQuantity(Math.max(1, Math.min(30, Number(event.target.value) || 1)))}
              className="field numeric h-10 w-20 shrink-0 px-3 py-1 text-center"
              aria-label="Capsules to dispense"
            />
          </label>

          <div>
            <label htmlFor="complete-notes" className="text-sm font-bold text-ink">
              Notes (optional)
            </label>
            <textarea
              id="complete-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Assessment notes, advice given, or follow-up plan."
              className="field mt-2 resize-none"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

function RestockModal({ open, onClose, onDone, onError }) {
  const [quantity, setQuantity] = useState(240);
  const [reason, setReason] = useState('Emergency DOH delivery');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantity(240);
    setReason('Emergency DOH delivery');
    setSubmitting(false);
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await restock({ quantity, reason: reason.trim() || 'Restock delivery', actor: 'Clinic pharmacy' });
      await onDone(`Stock increased to ${result.item.stock} capsules.`);
    } catch (requestError) {
      onError(requestError.friendlyMessage || 'Could not record the delivery.');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a doxycycline delivery"
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={submitting} className="btn-primary">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Add stock
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="restock-qty" className="text-sm font-bold text-ink">
            Capsules received
          </label>
          <input
            id="restock-qty"
            type="number"
            min="1"
            max="10000"
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(10000, Number(event.target.value) || 1)))}
            className="field numeric mt-2"
          />
        </div>
        <div>
          <label htmlFor="restock-reason" className="text-sm font-bold text-ink">
            Source or reason
          </label>
          <input
            id="restock-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={240}
            className="field mt-2"
          />
        </div>
      </div>
    </Modal>
  );
}

function SurgeModal({ open, busy, onClose, onConfirm }) {
  const [count, setCount] = useState(6);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Simulate a flood surge"
      size="sm"
      description="Adds synthetic patients to the live queue so the fast-track and preemption rules can be demonstrated."
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(count)} disabled={busy} className="btn-primary">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Add {count} patients
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {[4, 6, 8].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCount(option)}
              className={classNames(
                'chip flex-1 justify-center',
                count === option ? 'chip-active' : 'chip-idle',
              )}
            >
              {option} patients
            </button>
          ))}
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-ochre/30 bg-ochre-mist p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ochre" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-ochre-deep">
            Surge patients are synthetic. A share of them arrive high risk and will trigger counter
            preemption, which is audited in the action log.
          </p>
        </div>
      </div>
    </Modal>
  );
}
