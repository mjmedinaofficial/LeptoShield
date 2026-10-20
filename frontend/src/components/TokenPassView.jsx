import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  Clock3,
  Info,
  Loader2,
  MapPin,
  Pill,
  Printer,
  QrCode,
  RefreshCw,
  Sparkles,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react';

import { Brand } from './Brand';
import { EmptyState, LiveIndicator, RiskMeter, StatusPill, TierBadge, TierIcon } from './Primitives';
import { useLiveQueue } from '../hooks/useLiveQueue';
import { getTicket } from '../services/api';
import { classNames, formatTime, scorePercent, tierTheme, waitLabel } from '../lib/format';

const FLAG_LABELS = {
  classic_triad: 'Fever with muscle pain and red eyes',
  severe_symptom: 'Urgent clinical sign reported',
  open_wound: 'Open wound exposed',
  vulnerable: 'Vulnerable patient',
  older_adult: 'Age 60 or over',
  child: 'Child 12 or under',
  pregnant: 'Pregnancy',
};

const CATEGORY_LABELS = {
  exposure: 'Exposure',
  symptom: 'Symptoms',
  pattern: 'Symptom pattern',
  vulnerability: 'Vulnerability',
};

export default function TokenPassView() {
  const { id } = useParams();
  const location = useLocation();
  const justSubmitted = Boolean(location.state?.justSubmitted);
  const { snapshot, status } = useLiveQueue({ pollMs: 6000 });
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStaffCode, setShowStaffCode] = useState(false);
  const [flash, setFlash] = useState(false);
  const previousStatus = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getTicket(id);
      setTicket(data);
      setError(null);
    } catch (requestError) {
      setError(requestError.friendlyMessage || 'We could not load this pass.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!snapshot) return;
    load();
  }, [snapshot?.generated_at, load]);

  useEffect(() => {
    if (!ticket) return;
    if (previousStatus.current && previousStatus.current !== ticket.status && ticket.status === 'serving') {
      setFlash(true);
      const timer = window.setTimeout(() => setFlash(false), 4000);
      return () => window.clearTimeout(timer);
    }
    previousStatus.current = ticket.status;
    return undefined;
  }, [ticket]);

  const theme = tierTheme(ticket?.tier);
  const factors = useMemo(() => {
    const list = ticket?.xai?.factors ?? [];
    return [...list].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  }, [ticket]);
  const maxFactor = useMemo(
    () => Math.max(0.25, ...factors.map((factor) => factor.max_points || factor.points || 0.25)),
    [factors],
  );
  const counters = snapshot?.counters ?? [];
  const stats = snapshot?.stats;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <span className="inline-flex items-center gap-3 text-sm text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin text-teal" aria-hidden="true" />
          Loading your pass…
        </span>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-dvh bg-paper px-4 py-16">
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={Info}
            title="We could not find that pass"
            message={error || 'The link may be incomplete, or the pass was removed.'}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/triage" className="btn-primary">
                  Start a new check
                </Link>
                <Link to="/kiosk" className="btn-secondary">
                  Back to kiosk
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const window_ = ticket.therapeutic || {};
  const windowPct = Math.max(0, Math.min(100, ((window_.hours_left ?? 0) / (window_.window_hours || 72)) * 100));
  const isServing = ticket.status === 'serving';
  const isDone = ['completed', 'referred', 'no_show'].includes(ticket.status);

  return (
    <div className="min-h-dvh bg-paper pb-16">
      <header className="border-b border-ink-line/70 bg-paper/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[720px] items-center gap-3">
          <Link to="/kiosk" className="btn-ghost h-9 gap-1.5 px-2.5 text-xs">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kiosk
          </Link>
          <div className="mx-auto">
            <Brand compact markClass="h-7 w-7" />
          </div>
          <LiveIndicator status={status} />
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-4 py-6 sm:px-6">
        {justSubmitted && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-moss/25 bg-moss-mist p-4 animate-rise">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-moss-deep" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-moss-deep">Your pass is ready</p>
              <p className="mt-1 text-sm text-moss-deep/90">
                Keep this screen open — the queue updates by itself. Show it at the counter when your
                token is called.
              </p>
            </div>
          </div>
        )}

        <article
          className={classNames(
            'ticket-notch overflow-hidden rounded-3xl border bg-surface shadow-card',
            isServing ? 'border-teal/40' : 'border-ink-line/80',
            flash && 'animate-pop',
          )}
        >
          <div className={classNames('flex items-center justify-between gap-3 px-6 py-4', theme.solid)}>
            <span className="inline-flex items-center gap-2 text-sm font-bold">
              <TierIcon tier={ticket.tier} className="h-5 w-5" />
              {theme.label}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.14em]">
              {theme.priority}
            </span>
          </div>

          <div className="px-6 py-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label">Priority token</p>
                <p className="numeric mt-1 font-serif text-[68px] font-semibold leading-none tracking-[-0.02em] text-ink sm:text-[84px]">
                  {ticket.token}
                </p>
              </div>
              <div className="text-right">
                <StatusPill status={ticket.status} />
                <p className="mt-2 text-xs text-ink-mute">
                  Issued {formatTime(ticket.created_at)} · {ticket.display_name}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-dashed border-ink-line pt-5">
              {ticket.status === 'waiting' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="label">Position</p>
                    <p className="numeric mt-1 font-serif text-3xl font-semibold text-ink">
                      #{ticket.position}
                      <span className="ml-1 font-sans text-xs font-semibold text-ink-mute">
                        in {ticket.tier} line
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="label">Ahead of you</p>
                    <p className="numeric mt-1 font-serif text-3xl font-semibold text-ink">
                      {ticket.people_ahead}
                    </p>
                  </div>
                  <div>
                    <p className="label">Estimated wait</p>
                    <p className="numeric mt-1 font-serif text-3xl font-semibold text-ink">
                      {waitLabel(ticket.estimated_wait_minutes)}
                    </p>
                  </div>
                </div>
              )}

              {isServing && (
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-teal/25 bg-teal-mist p-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white">
                    <BellRing className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-2xl font-semibold text-teal-deep">
                      Proceed to {ticket.counter?.name || 'the counter'} now
                    </p>
                    <p className="mt-1 text-sm text-teal-deep/90">
                      {ticket.counter?.location || 'Ask the triage desk if you cannot find it.'}
                    </p>
                  </div>
                </div>
              )}

              {isDone && (
                <div className="rounded-2xl border border-ink-line/80 bg-paper-50 p-4">
                  <p className="text-sm font-semibold text-ink">
                    {ticket.status === 'no_show'
                      ? 'This pass was closed.'
                      : ticket.status === 'referred'
                        ? 'You have been referred for further care.'
                        : 'This visit is complete.'}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{ticket.next_step}</p>
                </div>
              )}

              {!isDone && (
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">{ticket.next_step}</p>
              )}

              {ticket.priority_reviewed && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-ochre/30 bg-ochre-soft px-3 py-1.5 text-xs font-semibold text-ochre-deep">
                  <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
                  Priority reviewed by clinic staff
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-line/70 bg-paper-50 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="btn-secondary h-10 gap-2 px-3.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary h-10 gap-2 px-3.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Save pass
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowStaffCode((value) => !value)}
              className="btn-ghost h-10 gap-2 px-3 text-xs"
              aria-expanded={showStaffCode}
            >
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Staff scan code
            </button>
          </div>

          {showStaffCode && (
            <div className="flex flex-col items-center gap-3 border-t border-ink-line/70 bg-surface px-6 py-5">
              <QRCodeSVG
                value={`LEPTOSHIELD:${ticket.id}`}
                size={140}
                level="M"
                marginSize={2}
                bgColor="#FFFDF9"
                fgColor="#12211E"
              />
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-ink-mute">
                {ticket.token} · staff verification
              </p>
            </div>
          )}
        </article>

        <section className="panel mt-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
              <CalendarClock className="h-4 w-4 text-teal" aria-hidden="true" />
              Prophylaxis window
            </p>
            <span className="numeric text-sm font-semibold text-ink">
              {window_.hours_left ?? '—'} h left of {window_.window_hours ?? 72} h
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
            <div
              className={classNames('h-full rounded-full', windowPct > 33 ? 'bg-teal' : windowPct > 0 ? 'bg-ochre' : 'bg-clay')}
              style={{ width: `${Math.max(2, windowPct)}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{window_.note}</p>
        </section>

        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line/70 px-5 py-4">
            <div>
              <h2 className="font-serif text-lg font-semibold text-ink">Why this score</h2>
              <p className="mt-0.5 text-xs text-ink-mute">
                {ticket.xai?.model_version} · confidence {Math.round((ticket.xai?.confidence ?? 0) * 100)}%
              </p>
            </div>
            <div className="text-right">
              <p className="numeric font-serif text-3xl font-semibold leading-none text-ink">
                {(ticket.risk_score ?? 0).toFixed(2)}
              </p>
              <p className="text-2xs uppercase tracking-[0.12em] text-ink-mute">risk score</p>
            </div>
          </div>

          <div className="px-5 pt-4">
            <RiskMeter score={ticket.risk_score} tier={ticket.tier} />
          </div>

          <ul className="mt-5 divide-y divide-ink-line/70">
            {factors.map((factor) => (
              <li key={factor.key} className="grid grid-cols-12 items-center gap-3 px-5 py-3">
                <div className="col-span-12 sm:col-span-7">
                  <p className="text-sm font-semibold text-ink">{factor.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{factor.detail}</p>
                </div>
                <div className="col-span-8 sm:col-span-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
                    <div
                      className={classNames('h-full rounded-full', factor.category === 'vulnerability' ? 'bg-teal/70' : 'bg-ink-soft')}
                      style={{ width: `${Math.max(3, (Math.abs(factor.points) / maxFactor) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="col-span-4 text-right sm:col-span-2">
                  <span className="numeric text-sm font-semibold text-ink">
                    +{factor.points.toFixed(2)}
                  </span>
                  <span className="ml-1 hidden text-2xs text-ink-faint sm:inline">
                    {CATEGORY_LABELS[factor.category] || ''}
                  </span>
                </div>
              </li>
            ))}
            {!factors.length && (
              <li className="px-5 py-6 text-sm text-ink-mute">No factors were recorded for this pass.</li>
            )}
          </ul>

          {ticket.xai?.flags?.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-ink-line/70 px-5 py-4">
              {ticket.xai.flags.map((flag) => (
                <span
                  key={flag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-line bg-paper-50 px-2.5 py-1 text-2xs font-semibold text-ink-soft"
                >
                  <TriangleAlert className="h-3 w-3 text-ochre" aria-hidden="true" />
                  {FLAG_LABELS[flag] || flag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          <div className="border-t border-ink-line/70 bg-paper-50 px-5 py-4">
            <p className="font-sans text-sm font-bold text-ink">What this means</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{ticket.xai?.recommendation}</p>
            <p className="mt-3 text-xs leading-relaxed text-ink-mute">{ticket.xai?.disclaimer}</p>
          </div>
        </section>

        {ticket.dispensed && (
          <section className="panel mt-6 p-5">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
              <Pill className="h-4 w-4 text-moss-deep" aria-hidden="true" />
              Doxycycline dispensed
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {ticket.dispensed_qty} capsule{ticket.dispensed_qty === 1 ? '' : 's'} recorded against your
              token. Take doxycycline exactly as the clinician directed, finish what was prescribed,
              do not share it, and protect your skin from strong sun while taking it.
            </p>
            <p className="mt-3 text-xs font-semibold text-clay-deep">
              Return immediately if fever, calf pain, red eyes, or reduced urine develops.
            </p>
          </section>
        )}

        <section className="panel mt-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
              <Clock3 className="h-4 w-4 text-teal" aria-hidden="true" />
              Counter status
            </p>
            <LiveIndicator status={status} />
          </div>
          <ul className="mt-3 space-y-2.5">
            {counters.map((counter) => (
              <li key={counter.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-2xs uppercase tracking-[0.14em] text-ink-mute">
                  C{counter.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{counter.name}</span>
                  <span className="block truncate text-2xs text-ink-mute">
                    {counter.mode_label}
                    {counter.staff ? ` · ${counter.staff}` : ''}
                  </span>
                </span>
                {counter.active ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: tierTheme(counter.active.tier).hex }}
                      aria-hidden="true"
                    />
                    <span className="numeric font-semibold text-ink">{counter.active.token}</span>
                  </span>
                ) : (
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-moss-deep">
                    Ready
                  </span>
                )}
              </li>
            ))}
          </ul>
          {stats && (
            <p className="mt-4 border-t border-ink-line/70 pt-3 text-xs text-ink-mute">
              {stats.waiting} waiting · {stats.high_waiting} high risk · median wait today{' '}
              {waitLabel(stats.median_wait_minutes)}
            </p>
          )}
        </section>

        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-ink-line/80 bg-surface p-4">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-ink-mute">
            Manila Health Center · NCR flood response. If you leave the waiting area, keep this pass
            open so you can still see when your token is called. Prototype data is synthetic.
          </p>
        </section>
      </main>
    </div>
  );
}
