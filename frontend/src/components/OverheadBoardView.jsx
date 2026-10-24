import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  Maximize2,
  Minimize2,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';

import { BrandOnDark } from './Brand';
import { NavMenu } from './NavMenu';
import { LiveIndicator, ManilaClock, TierIcon } from './Primitives';
import { useLiveQueue } from '../hooks/useLiveQueue';
import { classNames, manilaLongDate, tierTheme, waitLabel } from '../lib/format';

function useChime() {
  const contextRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  const play = useCallback(() => {
    if (!enabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!contextRef.current) contextRef.current = new AudioCtx();
      const context = contextRef.current;
      const start = context.currentTime;
      [587.33, 880].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const at = start + index * 0.17;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.1, at + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.6);
      });
    } catch {
      /* audio is optional */
    }
  }, [enabled]);

  return { enabled, setEnabled, play };
}

export default function OverheadBoardView() {
  const { snapshot, status } = useLiveQueue({ pollMs: 10000 });
  const { enabled: soundOn, setEnabled: setSoundOn, play: playChime } = useChime();
  const [fullscreen, setFullscreen] = useState(false);
  const [flashCounter, setFlashCounter] = useState(null);
  const previousActive = useRef({});

  const counters = snapshot?.counters ?? [];
  const waiting = snapshot?.waiting ?? [];
  const stats = snapshot?.stats;
  const alerts = snapshot?.alerts ?? [];
  const inventory = snapshot?.inventory;
  const regions = snapshot?.surveillance?.regions ?? [];
  const weather = snapshot?.surveillance?.weather;

  useEffect(() => {
    if (!snapshot) return;
    const changes = [];
    counters.forEach((counter) => {
      const token = counter.active?.token ?? null;
      const before = previousActive.current[counter.id] ?? null;
      if (token && token !== before) changes.push(counter.id);
      previousActive.current[counter.id] = token;
    });
    if (changes.length) {
      setFlashCounter(changes[0]);
      playChime();
      const timer = window.setTimeout(() => setFlashCounter(null), 7000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [snapshot, counters, playChime]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* fullscreen may be blocked */
    }
  };

  const tickerItems = useMemo(() => {
    const items = [];
    alerts.forEach((alert) => items.push(`${alert.title} — ${alert.message}`));
    if (stats) {
      items.push(`Waiting now: ${stats.waiting} patients · ${stats.high_waiting} high risk`);
      items.push(`Counters active: ${stats.active_counters} of ${stats.counters_open}`);
    }
    regions.forEach((region) =>
      items.push(
        `${region.short_name}: ${region.cases} cases this week · ${region.status === 'epidemic' ? 'epidemic threshold breached' : region.status === 'alert' ? 'alert level' : 'below thresholds'}`,
      ),
    );
    if (inventory) {
      items.push(`Doxycycline on hand: ${inventory.stock} capsules`);
    }
    if (weather) {
      items.push(`Rainfall last 24 hours: ${Math.round(weather.rainfall_24h_mm)} mm`);
    }
    items.push('High-risk patients are seen first at Counter 1 · Counters 2 and 3 stay flexible');
    return items;
  }, [alerts, stats, regions, inventory, weather]);

  const nextUp = waiting.slice(0, 6);

  return (
    <div className="flex min-h-dvh flex-col bg-night text-night-text">
      <header className="flex flex-wrap items-center gap-4 border-b border-night-line px-6 py-4 lg:px-10">
        <BrandOnDark subtitle="Waiting-room board · Manila Health Center" />
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden text-sm text-night-mute sm:inline">{manilaLongDate()}</span>
          <ManilaClock className="text-2xl font-semibold lg:text-3xl" tone="text-night-text" withSeconds />
          <LiveIndicator status={status} className="text-night-mute" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundOn((value) => !value)}
              className="btn h-10 w-10 rounded-xl border border-night-line bg-night-soft p-0 text-night-text hover:bg-night-line"
              aria-pressed={soundOn}
              aria-label={soundOn ? 'Mute call chime' : 'Enable call chime'}
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn h-10 w-10 rounded-xl border border-night-line bg-night-soft p-0 text-night-text hover:bg-night-line"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <NavMenu tone="dark" />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-6 py-6 lg:px-10 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold tracking-tight lg:text-3xl">Now serving</h1>
          <p className="text-sm text-night-mute">
            {stats
              ? `${stats.waiting} waiting · ${stats.high_waiting} high risk · median wait ${waitLabel(stats.median_wait_minutes)}`
              : 'Connecting to the clinic feed…'}
          </p>
        </div>

        <div className="grid flex-1 gap-5 lg:grid-cols-3" aria-live="polite">
          {counters.map((counter) => {
            const active = counter.active;
            const theme = tierTheme(active?.tier);
            const isFlashing = flashCounter === counter.id;
            return (
              <section
                key={counter.id}
                className={classNames(
                  'relative flex flex-col overflow-hidden rounded-3xl border bg-night-soft p-6',
                  isFlashing ? 'border-teal' : 'border-night-line',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-2xs uppercase tracking-[0.2em] text-night-mute">
                      Counter {counter.id}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-night-text">
                      {counter.mode === 'high' ? 'Fast-track · high risk only' : 'Flexible · any tier'}
                    </p>
                  </div>
                  {counter.mode === 'high' && (
                    <span className="rounded-full border border-teal/40 bg-teal/15 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.12em] text-teal-mid">
                      Fast-track
                    </span>
                  )}
                </div>

                <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
                  {active ? (
                    <>
                      <span
                        className={classNames(
                          'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold',
                          active.tier === 'high'
                            ? 'border-clay/40 bg-clay/20 text-clay-soft'
                            : active.tier === 'moderate'
                              ? 'border-ochre/40 bg-ochre/20 text-ochre-soft'
                              : 'border-moss/40 bg-moss/20 text-moss-soft',
                        )}
                        style={{ color: theme.hex }}
                      >
                        <TierIcon tier={active.tier} className="h-4 w-4" />
                        {theme.label}
                      </span>
                      <p
                        className={classNames(
                          'numeric mt-4 font-serif text-[76px] font-semibold leading-none tracking-[-0.02em] lg:text-[96px]',
                          isFlashing && 'animate-pop',
                        )}
                      >
                        {active.token}
                      </p>
                      <p className="mt-3 text-lg font-semibold text-night-text">{active.display_name}</p>
                      <p className="mt-1 text-sm text-night-mute">
                        {active.serving_seconds
                          ? `In consultation · ${waitLabel(active.serving_seconds / 60)}`
                          : `Called ${waitLabel(active.wait_minutes)} after check-in`}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-night-line bg-night text-night-mute">
                        <BellRing className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <p className="mt-4 font-serif text-2xl font-semibold text-night-text">Ready</p>
                      <p className="mt-1 text-sm text-night-mute">Waiting for the next patient</p>
                    </>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-night-line pt-4 text-2xs text-night-mute">
                  <span>{counter.staff}</span>
                  <span className="truncate">{counter.location}</span>
                </div>
              </section>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          <section className="rounded-2xl border border-night-line bg-night-soft px-5 py-4 lg:col-span-8">
            <div className="flex items-center gap-3">
              <Radio className="h-4 w-4 text-teal-mid" aria-hidden="true" />
              <p className="font-mono text-2xs uppercase tracking-[0.18em] text-night-mute">
                Next in line
              </p>
            </div>
            <ul className="mt-3 flex flex-wrap gap-3">
              {nextUp.map((ticket, index) => (
                <li
                  key={ticket.id}
                  className={classNames(
                    'flex items-center gap-3 rounded-xl border px-4 py-2.5',
                    index === 0 ? 'border-teal/40 bg-teal/10' : 'border-night-line bg-night',
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: tierTheme(ticket.tier).hex }}
                    aria-hidden="true"
                  />
                  <span className="numeric font-serif text-2xl font-semibold leading-none">
                    {ticket.token}
                  </span>
                  <span className="text-2xs uppercase tracking-[0.1em] text-night-mute">
                    {tierTheme(ticket.tier).short}
                    <br />
                    {waitLabel(ticket.wait_minutes)} wait
                  </span>
                </li>
              ))}
              {!nextUp.length && (
                <li className="text-sm text-night-mute">
                  No one is waiting. The next check-in appears here instantly.
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-night-line bg-night-soft px-5 py-4 lg:col-span-4">
            <p className="font-mono text-2xs uppercase tracking-[0.18em] text-night-mute">
              How the line works
            </p>
            <p className="mt-3 text-sm leading-relaxed text-night-text">
              High-risk tokens are called at Counter 1 and skip the standard line. Moderate and low
              risk keep their place and their wait credit even if a high-risk patient arrives later.
            </p>
            <p className="mt-3 text-2xs leading-relaxed text-night-mute">
              If you cannot hear your token, tell any clinic staff member.
            </p>
            <Link
              to="/admin"
              className="mt-4 inline-flex text-2xs font-semibold uppercase tracking-[0.14em] text-teal-mid hover:underline"
            >
              Staff duty desk
            </Link>
          </section>
        </div>
      </main>

      <footer className="border-t border-night-line">
        <div className="ticker-mask overflow-hidden py-3">
          <div className="flex w-max animate-ticker gap-12 whitespace-nowrap px-6">
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <span key={`${item}-${index}`} className="text-sm text-night-mute">
                <span className="mr-3 text-teal-mid">◆</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
