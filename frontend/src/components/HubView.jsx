import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  CloudRain,
  Droplets,
  Gauge,
  MonitorSmartphone,
  Pill,
  Siren,
  Stethoscope,
  Tv,
} from 'lucide-react';

import { AppShell } from './AppShell';
import {
  EmptyState,
  LiveIndicator,
  RiskMeter,
  SectionTitle,
  Sparkline,
  ThresholdBar,
  TierBadge,
} from './Primitives';
import { useLiveQueue } from '../hooks/useLiveQueue';
import { getSurveillance } from '../services/api';
import { classNames, compactNumber, tierTheme, waitLabel } from '../lib/format';

const STEPS = [
  {
    title: 'Answer four short screens',
    copy: 'Where the water touched you, how long, open cuts, and how you feel today. No blood test and no typing if you would rather not give a name.',
    meta: 'About 3 minutes · English or Filipino prompts',
  },
  {
    title: 'Receive a scored priority token',
    copy: 'Exposure, contact time, wounds, and warning symptoms are weighted into one score, and every point is shown back to you as a reason.',
    meta: 'High, moderate, or low risk · H / M / L token',
  },
  {
    title: 'Move to the right counter',
    copy: 'High-risk patients bypass the standard line to Counter 1 for physician review and the doxycycline window. Lower tiers keep their place fairly.',
    meta: 'Counter 1 fast-track · Counters 2 and 3 flexible',
  },
];

const SURFACES = [
  {
    to: '/kiosk',
    icon: MonitorSmartphone,
    name: 'Lobby kiosk',
    copy: 'Touchscreen check-in with a rotating QR code for personal phones.',
    statKey: 'kiosk',
  },
  {
    to: '/triage',
    icon: ClipboardList,
    name: 'Patient intake',
    copy: 'The three-minute mobile wizard a patient completes before the clinic sees them.',
    statKey: 'intake',
  },
  {
    to: '/overhead',
    icon: Tv,
    name: 'Waiting-room board',
    copy: 'Large-format counter, token, and advisory display for the TV screen.',
    statKey: 'board',
  },
  {
    to: '/admin',
    icon: Gauge,
    name: 'Duty desk',
    copy: 'Queue control, priority override, DOH surveillance, and doxycycline stock.',
    statKey: 'admin',
  },
];

export default function HubView() {
  const { snapshot, status, error } = useLiveQueue();
  const [surveillance, setSurveillance] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      getSurveillance()
        .then((data) => active && setSurveillance(data))
        .catch(() => {});
    load();
    const timer = window.setInterval(load, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const counters = snapshot?.counters ?? [];
  const waiting = snapshot?.waiting ?? [];
  const stats = snapshot?.stats;
  const alerts = snapshot?.alerts ?? [];
  const inventory = snapshot?.inventory;
  const regions = surveillance?.regions ?? [];
  const weather = surveillance?.weather ?? snapshot?.surveillance?.weather;
  const surge = surveillance?.surge ?? snapshot?.surge;
  const sampleTicket = waiting.find((ticket) => ticket.tier === 'high') ?? waiting[0];
  const criticalAlert = alerts.find((alert) => alert.level === 'critical');

  const surfaceStats = {
    kiosk: snapshot ? 'Ready for the lobby' : 'Loading',
    intake: stats ? `${stats.waiting} in line now` : 'Loading',
    board: counters.length ? `${counters.filter((c) => c.status === 'serving').length}/${counters.length} counters active` : 'Loading',
    admin: inventory ? `${inventory.stock} capsules on hand` : 'Loading',
  };

  return (
    <AppShell status={status}>
      <section className="relative overflow-hidden rounded-3xl border border-ink-line/80 bg-surface shadow-card">
        <div className="topo pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-12 lg:gap-12 lg:py-14">
          <div className="lg:col-span-7">
            <h1 className="font-serif text-[40px] font-semibold leading-[1.03] tracking-[-0.02em] text-ink sm:text-[54px] lg:text-[60px]">
              Triage first.
              <br />
              Treat in time.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft">
              In a flood week, leptospirosis risk climbs faster than a health center can sort it.
              LeptoShield scores flood exposure and warning symptoms in under three minutes, then
              moves high-risk patients straight to a physician and the prophylaxis window — while
              every other patient keeps a fair place in line.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/kiosk" className="btn-primary h-12 px-5 text-[15px]">
                Open the lobby kiosk
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/admin" className="btn-secondary h-12 px-5 text-[15px]">
                Staff duty desk
              </Link>
              {sampleTicket && (
                <Link
                  to={`/token/${sampleTicket.id}`}
                  className="inline-flex h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-teal-deep hover:bg-teal-mist"
                >
                  See a live patient pass
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>

            <dl className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink-line/70 pt-4 text-xs text-ink-mute">
              <div className="flex items-center gap-2">
                <dt className="sr-only">Facility</dt>
                <dd>Manila Health Center · NCR flood response</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">Data</dt>
                <dd className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-ochre" />
                  Synthetic demo data
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">Clinical status</dt>
                <dd>Decision support, not a diagnosis</dd>
              </div>
            </dl>
          </div>

          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl border border-night-line bg-night p-5 text-night-text shadow-night">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-2xs uppercase tracking-[0.18em] text-night-mute">
                  Lobby right now
                </p>
                <LiveIndicator status={status} className="text-night-mute" />
              </div>

              {stats ? (
                <>
                  <div className="mt-5 flex items-end gap-4">
                    <span className="numeric font-serif text-6xl font-semibold leading-none">
                      {stats.waiting}
                    </span>
                    <span className="pb-1 text-sm text-night-mute">
                      waiting
                      <br />
                      {stats.high_waiting} high risk
                    </span>
                  </div>

                  <div className="mt-5 h-px w-full bg-night-line" />
                  <ul className="mt-4 space-y-3">
                    {counters.map((counter) => (
                      <li key={counter.id} className="flex items-center gap-3">
                        <span className="font-mono text-2xs uppercase tracking-[0.16em] text-night-mute">
                          C{counter.id}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block truncate font-semibold">
                            {counter.active ? counter.active.token : 'Ready for next patient'}
                          </span>
                          <span className="block truncate text-2xs text-night-mute">
                            {counter.mode === 'high' ? 'Fast-track · high risk only' : 'Flexible'}
                            {counter.active ? ` · ${waitLabel(counter.active.wait_minutes)} wait` : ''}
                          </span>
                        </span>
                        {counter.active ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: tierTheme(counter.active.tier).hex }}
                            aria-label={tierTheme(counter.active.tier).label}
                          />
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-full bg-night-line" />
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-5 text-sm text-night-mute">Connecting to the live clinic feed…</p>
              )}

              <div className="mt-5 waterline h-1 w-full rounded-full" aria-hidden="true" />
              <p className="mt-3 text-2xs leading-relaxed text-night-mute">
                Every screen reads the same queue. A call at the duty desk changes the lobby board
                and the patient's phone in the same second.
              </p>
            </div>

            {criticalAlert && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-clay/25 bg-clay-mist p-4">
                <Siren className="mt-0.5 h-5 w-5 shrink-0 text-clay" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-clay-deep">{criticalAlert.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-clay-deep/90">{criticalAlert.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {error && !snapshot && (
        <div className="mt-8">
          <EmptyState
            icon={Activity}
            title="The clinic feed is not reachable"
            message={error}
            action={
              <Link to="/admin" className="btn-secondary">
                Open duty desk
              </Link>
            }
          />
        </div>
      )}

      <section className="mt-12">
        <SectionTitle meta="about three minutes end to end">How a patient moves through LeptoShield</SectionTitle>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-ink-line/80 bg-ink-line/70 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="bg-surface p-6">
              <span className="font-serif text-3xl font-semibold text-teal-deep/70">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 font-sans text-base font-bold tracking-tight text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.copy}</p>
              <p className="mt-4 font-mono text-2xs uppercase tracking-[0.12em] text-ink-mute">{step.meta}</p>
            </li>
          ))}
        </ol>
        <div className="mt-0 h-1 w-full rounded-b-full waterline" aria-hidden="true" />
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SectionTitle
            meta={surveillance ? `${surveillance.week} · DOH epidemiology bureau` : 'loading'}
            action={
              <Link to="/admin" className="text-xs font-semibold text-teal-deep hover:underline">
                Full surveillance
              </Link>
            }
          >
            Regional epidemic thresholds
          </SectionTitle>

          <ul className="mt-4 divide-y divide-ink-line/70 overflow-hidden rounded-2xl border border-ink-line/80 bg-surface">
            {regions.map((region) => {
              const statusStyles =
                region.status === 'epidemic'
                  ? 'border-clay/25 bg-clay-soft text-clay-deep'
                  : region.status === 'alert'
                    ? 'border-ochre/30 bg-ochre-soft text-ochre-deep'
                    : 'border-moss/25 bg-moss-soft text-moss-deep';
              return (
                <li key={region.code} className="grid grid-cols-12 items-center gap-3 px-5 py-4">
                  <div className="col-span-12 sm:col-span-4">
                    <p className="font-sans text-sm font-bold text-ink">{region.short_name}</p>
                    <p className="mt-0.5 text-2xs text-ink-mute">
                      {region.flagged_cities?.slice(0, 3).join(' · ') || region.name}
                    </p>
                  </div>
                  <div className="col-span-7 sm:col-span-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="numeric text-lg font-semibold text-ink">
                        {compactNumber(region.cases)}
                      </span>
                      <span className="text-2xs text-ink-mute">
                        alert {region.alert_threshold} · epidemic {region.epidemic_threshold}
                      </span>
                    </div>
                    <ThresholdBar
                      className="mt-1"
                      value={region.cases}
                      alert={region.alert_threshold}
                      epidemic={region.epidemic_threshold}
                    />
                  </div>
                  <div className="col-span-5 flex items-center justify-end gap-3 sm:col-span-3">
                    <Sparkline
                      values={(region.history || []).map((week) => week.cases)}
                      className="hidden h-8 w-16 sm:block"
                      stroke={tierTheme(region.status === 'epidemic' ? 'high' : region.status === 'alert' ? 'moderate' : 'low').hex}
                      fill="transparent"
                      label={`${region.short_name} case trend`}
                    />
                    <span
                      className={classNames(
                        'rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.06em]',
                        statusStyles,
                      )}
                    >
                      {region.status === 'epidemic' ? 'Breach' : region.status === 'alert' ? 'Alert' : 'Stable'}
                    </span>
                  </div>
                </li>
              );
            })}
            {!regions.length && (
              <li className="px-5 py-8 text-sm text-ink-mute">Surveillance feed is loading…</li>
            )}
          </ul>
        </div>

        <div className="grid gap-6 lg:col-span-5">
          <div className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="label">Rainfall & surge outlook</p>
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
            <div className="mt-4 flex items-end gap-4">
              <CloudRain className="h-6 w-6 text-teal" aria-hidden="true" />
              <span className="numeric font-serif text-4xl font-semibold leading-none text-ink">
                {weather ? `${Math.round(weather.rainfall_24h_mm)}` : '—'}
                <span className="ml-1 font-sans text-sm font-semibold text-ink-mute">mm / 24 h</span>
              </span>
            </div>
            {weather && (
              <>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{weather.advisory}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-ink-mute">
                  <span>Pasig river {weather.river_level_m} m</span>
                  <span>critical {weather.river_critical_m} m</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{ width: `${Math.min(100, (weather.river_level_m / weather.river_critical_m) * 100)}%` }}
                  />
                </div>
              </>
            )}
            {surge && (
              <p className="mt-4 border-t border-ink-line/70 pt-3 text-xs leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">Recommendation · </span>
                {surge.recommendation}
              </p>
            )}
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="label">Doxycycline reserve</p>
              <Pill className="h-4 w-4 text-teal" aria-hidden="true" />
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="numeric font-serif text-4xl font-semibold leading-none text-ink">
                {inventory ? compactNumber(inventory.stock) : '—'}
              </span>
              <span className="pb-1 text-sm text-ink-mute">capsules on hand</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-ink-mute">
              <span>reorder at {inventory?.reorder_threshold ?? 500}</span>
              <span>
                {inventory?.days_remaining ? `≈ ${inventory.days_remaining} days cover` : 'projection pending'}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]">
              <div
                className={classNames(
                  'h-full rounded-full',
                  inventory?.status === 'critical' ? 'bg-clay' : inventory?.status === 'watch' ? 'bg-ochre' : 'bg-moss',
                )}
                style={{ width: `${Math.min(100, inventory?.pct_of_par ?? 0)}%` }}
              />
            </div>
            <p className="mt-3 text-2xs leading-relaxed text-ink-mute">
              Stock is drawn down as prophylaxis is dispensed at the counter; the ledger and burn rate
              live on the duty desk.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle meta="one shared queue">Open a surface</SectionTitle>
        <div className="mt-4 divide-y divide-ink-line/70 overflow-hidden rounded-2xl border border-ink-line/80 bg-surface">
          {SURFACES.map((surface) => (
            <Link
              key={surface.to}
              to={surface.to}
              className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-teal-mist/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-line/80 bg-paper-50 text-teal-deep">
                <surface.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-sans text-sm font-bold text-ink">{surface.name}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-soft">{surface.copy}</span>
              </span>
              <span className="hidden text-2xs font-semibold text-ink-mute sm:block">
                {surfaceStats[surface.statKey]}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-teal-deep"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-12">
        <div className="panel p-6 lg:col-span-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-mist text-teal-deep">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-serif text-lg font-semibold text-ink">
                What the score is, and what it is not
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                The risk score is a transparent rule set, not a trained diagnostic model. Each factor
                carries a published weight — exposure type, contact time over two hours, open cuts,
                fever, calf tenderness, conjunctival suffusion, and vulnerability — so a clinician can
                audit exactly why a patient was fast-tracked. It never replaces examination.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <TierBadge tier="high" />
                <TierBadge tier="moderate" />
                <TierBadge tier="low" />
                <span className="text-2xs text-ink-mute">
                  H / M / L tokens · Counter 1 reserved for high risk
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="panel p-6 lg:col-span-4">
          <p className="label">Engine contract</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li className="flex items-start gap-2">
              <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
              Scores clamp to 0.0–1.0; high starts at 0.60.
            </li>
            <li className="flex items-start gap-2">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
              Wait ageing keeps long waits visible inside a tier.
            </li>
            <li className="flex items-start gap-2">
              <Siren className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
              A high-risk patient waiting 30 seconds can preempt a lower-tier consult, and that event
              is logged.
            </li>
          </ul>
          <div className="mt-4">
            <RiskMeter score={0.78} tier="high" showTicks={false} compact />
            <p className="mt-2 text-2xs text-ink-mute">
              Example: flood immersion with fever and muscle pain scores 0.78 — fast-track.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
