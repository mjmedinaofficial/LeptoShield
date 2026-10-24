import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowRight,
  MonitorSmartphone,
  QrCode,
  ShieldCheck,
  Siren,
  Tv,
  UserRound,
} from 'lucide-react';

import { Brand } from './Brand';
import { LanguageToggle, useLanguage } from './LanguageToggle';
import { NavMenu } from './NavMenu';
import { LiveIndicator, ManilaClock } from './Primitives';
import { useLiveQueue } from '../hooks/useLiveQueue';

const COPY = {
  en: {
    headline: 'Know your risk. Get the right care, faster.',
    sub: 'A three-minute check for leptospirosis risk after flood exposure. No blood test. No guessing which line to stand in.',
    cta: 'Start the 3-minute check',
    steps: [
      'Answer four short screens about the water and how you feel.',
      'Receive a colour-coded priority token with the reasons behind it.',
      'High-risk patients go straight to the fast-track counter.',
    ],
    qrTitle: 'Use your own phone',
    qrHint: 'Scan to start on your phone. Your answers stay at this clinic.',
    sessionLabel: 'Station code',
    lobbyTitle: 'Waiting-room board',
    lobbyBody: 'See which counter is being called and how many patients are waiting.',
    lobbyCta: 'Open the waiting-room board',
    privacy: 'You can stay anonymous. No name is required to be assessed.',
    languages: 'English',
    languagesAlt: 'Need help? Ask any clinic staff member. Filipino assistance is available.',
  },
  fil: {
    headline: 'Alamin ang panganib. Makatanggap ng mabilisang lunas.',
    sub: 'Tatlong minutong pagsusuri para sa leptospirosis pagkatapos ng baha. Walang blood test. Hindi na kailangang hulaan kung saan pipila.',
    cta: 'Simulan ang 3-minutong pagsusuri',
    steps: [
      'Sagutin ang apat na maikling tanong tungkol sa tubig at pakiramdam mo.',
      'Tumanggap ng priority token na may paliwanag sa bawat puntos.',
      'Ang mataas ang panganib ay dumidiretso sa fast-track counter.',
    ],
    qrTitle: 'Gamitin ang iyong telepono',
    qrHint: 'I-scan upang magsimula sa telepono. Mananatili sa klinika ang mga sagot.',
    sessionLabel: 'Station code',
    lobbyTitle: 'Waiting-room board',
    lobbyBody: 'Tingnan kung anong counter ang tinawag at ilan ang naghihintay.',
    lobbyCta: 'Buksan ang waiting-room board',
    privacy: 'Maaari kang manatiling anonymous. Hindi kailangan ang pangalan.',
    languages: 'Filipino',
    languagesAlt: 'Kailangan ng tulong? Tanungin ang staff ng klinika.',
  },
};

function useRotatingCode(seconds = 45) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);
  return useMemo(() => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let index = 0; index < 4; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }, [tick]);
}

export default function KioskView() {
  const { snapshot, status } = useLiveQueue({ pollMs: 12000 });
  const { language } = useLanguage();
  const copy = COPY[language];
  const sessionCode = useRotatingCode(45);

  const alerts = snapshot?.alerts ?? [];
  const breach = alerts.find((alert) => alert.id === 'ncr-epidemic');

  const intakeUrl = useMemo(() => {
    const origin = typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin;
    return `${origin}/triage?src=kiosk&station=LOBBY01&s=${sessionCode}`;
  }, [sessionCode]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      <div className="topo pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

      <header className="relative z-30 mx-auto flex w-full max-w-[1560px] flex-wrap items-center gap-4 px-5 py-4 sm:px-8">
        <Brand subtitle="Lobby kiosk 01 · Manila Health Center" />
        <div className="ml-auto flex items-center gap-3">
          <LiveIndicator status={status} />
          <ManilaClock className="hidden text-sm sm:inline-flex" />
          <LanguageToggle />
          <NavMenu />
        </div>
      </header>

      {breach && (
        <div className="relative z-10 border-y border-clay/25 bg-clay-mist">
          <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
            <Siren className="h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
            <p className="text-sm font-semibold text-clay-deep">{breach.title}</p>
            <p className="text-sm text-clay-deep/90">{breach.message}</p>
            <p className="ml-auto text-xs font-semibold uppercase tracking-[0.12em] text-clay-deep/80">
              High-risk fast-track is open
            </p>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto grid w-full max-w-[1560px] flex-1 gap-10 px-5 py-8 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:py-10">
        <div className="lg:col-span-7">
          <h1 className="max-w-[16ch] font-serif text-[40px] font-semibold leading-[1.04] tracking-[-0.02em] text-ink sm:text-[56px] lg:text-[64px]">
            {copy.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-soft sm:text-lg">
            {copy.sub}
          </p>

          <div className="mt-8">
            <Link
              to={`/triage?src=kiosk&station=LOBBY01&s=${sessionCode}`}
              className="btn-primary h-16 w-full justify-between px-6 text-base sm:w-auto sm:justify-center sm:gap-4 sm:px-8"
            >
              <span className="inline-flex items-center gap-3">
                <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
                {copy.cta}
              </span>
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {copy.steps.map((step, index) => (
              <li key={step} className="rounded-2xl border border-ink-line/80 bg-surface/90 p-4">
                <span className="font-mono text-2xs uppercase tracking-[0.16em] text-teal-deep">
                  Step {index + 1}
                </span>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="lg:col-span-5">
          <div className="panel relative overflow-hidden p-6 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label inline-flex items-center gap-2">
                  <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.qrTitle}
                </p>
                <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-ink-soft">{copy.qrHint}</p>
              </div>
              <span className="rounded-full border border-teal/25 bg-teal-mist px-2.5 py-1 font-mono text-2xs font-semibold uppercase tracking-[0.12em] text-teal-deep">
                {copy.sessionLabel} {sessionCode}
              </span>
            </div>

            <div className="mt-5 flex flex-col items-center">
              <div className="relative">
                <div
                  className="rounded-2xl border border-ink-line/80 bg-surface p-4"
                  role="img"
                  aria-label={`QR code linking to the LeptoShield intake form, station code ${sessionCode}`}
                >
                  <QRCodeSVG
                    value={intakeUrl}
                    size={232}
                    level="M"
                    marginSize={0}
                    bgColor="#FFFDF9"
                    fgColor="#12211E"
                    className="block h-[200px] w-[200px] sm:h-[232px] sm:w-[232px]"
                  />
                </div>
                {[
                  { pos: '-left-1.5 -top-1.5', d: 'M23 1H9a8 8 0 0 0-8 8v14' },
                  { pos: '-right-1.5 -top-1.5', d: 'M1 1h14a8 8 0 0 1 8 8v14' },
                  { pos: '-bottom-1.5 -left-1.5', d: 'M23 23H9a8 8 0 0 1-8-8V1' },
                  { pos: '-bottom-1.5 -right-1.5', d: 'M1 23h14a8 8 0 0 0 8-8V1' },
                ].map((corner) => (
                  <svg
                    key={corner.pos}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0E6B62"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                    className={`pointer-events-none absolute h-6 w-6 ${corner.pos}`}
                  >
                    <path d={corner.d} />
                  </svg>
                ))}
              </div>
              <p className="mt-5 max-w-full truncate font-mono text-2xs text-ink-faint">
                {intakeUrl.replace(/^https?:\/\//, '')}
              </p>
              <div className="mt-2 h-1 w-full max-w-[240px] overflow-hidden rounded-full bg-ink/10">
                <div key={sessionCode} className="h-full w-full origin-left animate-fill bg-teal" />
              </div>
            </div>

            <div className="mt-6 border-t border-ink-line/70 pt-4">
              <div className="flex items-start gap-3 rounded-2xl border border-teal/20 bg-teal-mist p-4">
                <Tv className="mt-0.5 h-5 w-5 shrink-0 text-teal-deep" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{copy.lobbyTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{copy.lobbyBody}</p>
                  <Link to="/overhead" className="btn-secondary mt-3 h-10 px-4 text-xs">
                    {copy.lobbyCta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-xs text-ink-mute">
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              {copy.privacy}
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Decision support, not a diagnosis
            </span>
          </div>
        </div>
      </main>

      <footer className="relative z-10 mt-auto">
        <div className="waterline h-1 w-full" aria-hidden="true" />
        <div className="mx-auto flex w-full max-w-[1560px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-2xs text-ink-mute sm:px-8">
          <span>LeptoShield prototype · synthetic demo data · not a medical device</span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.languagesAlt}
          </span>
        </div>
      </footer>
    </div>
  );
}
