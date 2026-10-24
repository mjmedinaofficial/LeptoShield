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
  X,
} from 'lucide-react';

import { Brand } from './Brand';
import { LanguageToggle, useLanguage } from './LanguageToggle';
import { EmptyState, LiveIndicator, RiskMeter, StatusPill, TierBadge, TierIcon } from './Primitives';
import { useLiveQueue } from '../hooks/useLiveQueue';
import { getTicket } from '../services/api';
import { classNames, formatTime, scorePercent, tierTheme, waitLabel } from '../lib/format';

const COPY = {
  en: {
    backToKiosk: 'Back to kiosk',
    kiosk: 'Kiosk',
    loading: 'Loading your pass…',
    errorTitle: 'We could not find that pass',
    errorMessage: 'The link may be incomplete, or the pass was removed.',
    startNew: 'Start a new check',
    passReadyTitle: 'Your pass is ready',
    passReadyBody:
      'Keep this screen open — the queue updates by itself. Show it at the counter when your token is called.',
    dismiss: 'Dismiss',
    priorityToken: 'Priority token',
    issuedAt: (time, name) => `Issued ${time} · ${name}`,
    position: 'Position',
    inLine: (tierShort) => `in ${tierShort} line`,
    aheadOfYou: 'Ahead of you',
    estimatedWait: 'Estimated wait',
    proceedTitle: (counterName) => `Proceed to ${counterName || 'the counter'} now`,
    proceedSubtitle: (location) => location || 'Ask the triage desk if you cannot find it.',
    passClosed: 'This pass was closed.',
    referredTitle: 'You have been referred for further care.',
    visitComplete: 'This visit is complete.',
    priorityReviewed: 'Priority reviewed by clinic staff',
    refresh: 'Refresh',
    savePass: 'Save pass',
    staffScanCode: 'Staff scan code',
    staffVerification: 'staff verification',
    prophylaxisWindow: 'Prophylaxis window',
    hoursLeftOf: (left, total) => `${left} h left of ${total} h`,
    whyThisScore: 'Why this score',
    confidence: (pct) => `confidence ${pct}%`,
    riskScore: 'risk score',
    noFactors: 'No factors were recorded for this pass.',
    warningIndicatorsTitle: 'Warning indicators',
    warningIndicatorsSubtext:
      'Warning indicators highlight critical clinical signs and vulnerability factors identified during triage that prompt priority clinician review.',
    whatThisMeans: 'What this means',
    doxycyclineDispensed: 'Doxycycline dispensed',
    doxycyclineDetail: (qty) =>
      `${qty} capsule${qty === 1 ? '' : 's'} recorded against your token. Take doxycycline exactly as the clinician directed, finish what was prescribed, do not share it, and protect your skin from strong sun while taking it.`,
    doxycyclineWarning: 'Return immediately if fever, calf pain, red eyes, or reduced urine develops.',
    counterStatus: 'Counter status',
    ready: 'Ready',
    statsSummary: (waiting, high, wait) =>
      `${waiting} waiting · ${high} high risk · median wait today ${wait}`,
    footerNotice:
      'Manila Health Center · NCR flood response. If you leave the waiting area, keep this pass open so you can still see when your token is called. Prototype data is synthetic.',
  },
  fil: {
    backToKiosk: 'Bumalik sa kiosk',
    kiosk: 'Kiosk',
    loading: 'Ikinakarga ang iyong pass…',
    errorTitle: 'Hindi namin mahanap ang pass na iyan',
    errorMessage: 'Maaaring hindi kumpleto ang link, o tinanggal na ang pass.',
    startNew: 'Magsimula ng bagong pagsusuri',
    passReadyTitle: 'Handa na ang iyong pass',
    passReadyBody:
      'Panatilihing bukas ang screen na ito — kusang nag-a-update ang pila. Ipakita ito sa counter kapag tinawag ang iyong token.',
    dismiss: 'Isara',
    priorityToken: 'Priority token',
    issuedAt: (time, name) => `Inisyu noong ${time} · ${name}`,
    position: 'Posisyon',
    inLine: (tierShort) => `sa linyang ${tierShort}`,
    aheadOfYou: 'Nauna sa iyo',
    estimatedWait: 'Tinatayang paghihintay',
    proceedTitle: (counterName) => `Pumunta na sa ${counterName || 'counter'} ngayon`,
    proceedSubtitle: (location) => location || 'Magtanong sa triage desk kung hindi mo ito mahanap.',
    passClosed: 'Sarado na ang pass na ito.',
    referredTitle: 'Na-refer ka para sa karagdagang lunas.',
    visitComplete: 'Tapos na ang pagbisitang ito.',
    priorityReviewed: 'Nasuri na ng staff ng klinika ang prayoridad',
    refresh: 'I-refresh',
    savePass: 'I-save ang pass',
    staffScanCode: 'Scan code para sa staff',
    staffVerification: 'pagpapatunay ng staff',
    prophylaxisWindow: 'Window ng prophylaxis',
    hoursLeftOf: (left, total) => `${left} h natitira sa ${total} h`,
    whyThisScore: 'Bakit ito ang marka',
    confidence: (pct) => `tiwala ${pct}%`,
    riskScore: 'marka ng panganib',
    noFactors: 'Walang naitalang salik para sa pass na ito.',
    warningIndicatorsTitle: 'Mga warning indicator',
    warningIndicatorsSubtext:
      'Ipinapakita ng mga warning indicator ang mga kritikal na sintomas at salik ng kahinaan na natukoy sa triage na nangangailangan ng agarang pagsusuri ng clinician.',
    whatThisMeans: 'Ano ang ibig sabihin nito',
    doxycyclineDispensed: 'Naibigay na Doxycycline',
    doxycyclineDetail: (qty) =>
      `${qty} kapsula ang naitala para sa iyong token. Inumin ang doxycycline nang eksakto ayon sa tagubilin ng clinician, ubusin ang inireseta, huwag ipamahagi sa iba, at protektahan ang balat sa matinding sikat ng araw habang umiinom nito.`,
    doxycyclineWarning: 'Bumalik kaagad kung magkaroon ng lagnat, pananakit ng binti, pamumula ng mata, o pagkaunti ng ihi.',
    counterStatus: 'Katayuan ng mga Counter',
    ready: 'Handa',
    statsSummary: (waiting, high, wait) =>
      `${waiting} naghihintay · ${high} mataas ang panganib · karaniwang oras ng paghihintay ngayon ${wait}`,
    footerNotice:
      'Manila Health Center · Tugon sa baha ng NCR. Kung aalis sa waiting area, panatilihing bukas ang pass na ito upang makita kapag tinawag ang iyong token. Ang datos ay para lamang sa prototype.',
  },
};

const FLAG_LABELS = {
  en: {
    classic_triad: 'Fever with muscle pain and red eyes',
    severe_symptom: 'Urgent clinical sign reported',
    open_wound: 'Open wound exposed',
    vulnerable: 'Vulnerable patient',
    older_adult: 'Age 60 or over',
    child: 'Child 12 or under',
    pregnant: 'Pregnancy',
  },
  fil: {
    classic_triad: 'Lagnat na may pananakit ng kalamnan at pamumula ng mata',
    severe_symptom: 'May iniulat na agarang senyales ng panganib',
    open_wound: 'Nalantad na may bukas na sugat',
    vulnerable: 'Pasyenteng may mataas na kahinaan',
    older_adult: 'Edad 60 pataas',
    child: 'Bata 12 taong gulang pababa',
    pregnant: 'Pagbubuntis',
  },
};

const FLAG_DESCRIPTIONS = {
  en: {
    classic_triad: 'Classic symptom cluster indicating acute risk',
    severe_symptom: 'Urgent sign requiring immediate clinician evaluation',
    open_wound: 'Direct entry route for bacteria from floodwater',
    vulnerable: 'Patient belongs to a high-vulnerability demographic',
    older_adult: 'Higher risk of severe complications and rapid dehydration',
    child: 'Pediatric protocols and adjusted dosing required',
    pregnant: 'Requires tailored maternal protocol; standard prophylaxis contraindicated',
  },
  fil: {
    classic_triad: 'Klasikong grupo ng sintomas na nagpapahiwatig ng agarang panganib ng leptospirosis',
    severe_symptom: 'Agarang senyales na nangangailangan ng mabilisang pagsusuri ng doktor',
    open_wound: 'Direktang daanan ng bakterya mula sa maruming tubig-baha',
    vulnerable: 'Kabilang sa grupong may mataas na kahinaan na nangangailangan ng priyoridad',
    older_adult: 'Mas mataas na panganib ng malubhang komplikasyon at mabilis na dehydration',
    child: 'Nangangailangan ng espesyal na gabay at tamang dosis para sa bata',
    pregnant: 'Nangangailangan ng espesyal na gabay; bawal ang karaniwang doxycycline',
  },
};

const CATEGORY_LABELS = {
  en: {
    exposure: 'Exposure',
    symptom: 'Symptoms',
    pattern: 'Symptom pattern',
    vulnerability: 'Vulnerability',
  },
  fil: {
    exposure: 'Pagkababad',
    symptom: 'Mga Sintomas',
    pattern: 'Padrón ng sintomas',
    vulnerability: 'Kahinaan',
  },
};

const FACTOR_TRANSLATIONS = {
  exposure: {
    label: 'Kontak sa tubig-baha',
    details: {
      'Swam or was submerged in floodwater': 'Lumangoy o nalubog sa tubig-baha.',
      'Waded through floodwater': 'Naglusong sa tubig-baha.',
      'Touched rodent urine or contaminated mud': 'Humawak ng ihi ng daga o kontaminadong putik.',
      'Cleaned a flooded home or yard': 'Naglinis ng binahang bahay o bakuran.',
      'Handled mud, silt, or wet belongings': 'Humawak ng putik, banlik, o basang gamit.',
      'No direct flood exposure reported': 'Walang direktang kontak sa baha na iniulat.',
    },
  },
  duration: {
    label: 'Tagal ng kontak sa baha',
    match: (detail) =>
      detail
        ?.replace(/hours in contact — prolonged exposure raises risk\./i, 'oras na kontak — ang matagal na pagkababad ay nagpapataas ng panganib.')
        ?.replace(/hours in contact with floodwater or contaminated material\./i, 'oras na kontak sa tubig-baha o kontaminadong gamit.')
        ?.replace(/hours in contact\./i, 'oras na kontak sa baha.'),
  },
  open_cuts: {
    label: 'Bukas na sugat o gasgas',
    detail: 'Ang sugat o sira sa balat ay nagiging direktang daanan ng leptospira papunta sa daluyan ng dugo.',
  },
  symptom_fever: {
    label: 'Lagnat o sobrang init ng pakiramdam',
    detail: 'Temperatura na 38°C pataas, o panginginig na may matinding init ng katawan.',
  },
  symptom_muscle_pain: {
    label: 'Pananakit ng kalamnan o binti',
    detail: 'Pananakit o pamamanhid sa mga binti, hita, o ibabang bahagi ng likod.',
  },
  symptom_red_eyes: {
    label: 'Namumula o naiiritang mata',
    detail: 'Conjunctival suffusion: pamumula ng mata nang walang gaanong muta.',
  },
  symptom_headache: {
    label: 'Sakit ng ulo',
    detail: 'Bago o hindi pangkaraniwang pananakit ng ulo.',
  },
  symptom_chills: {
    label: 'Panginginig o ginaw',
    detail: 'Panginginig kahit walang nasukat na mataas na temperatura.',
  },
  symptom_nausea: {
    label: 'Pagduduwal o pagsusuka',
    detail: 'Pakiramdam na nasusuka o hindi maayos ang tiyan.',
  },
  symptom_jaundice: {
    label: 'Naninilaw na mata o balat',
    detail: 'Maaaring senyales ng pagkaapektado ng atay o apdo; nangangailangan ng agarang atensyon.',
  },
  symptom_low_urine: {
    label: 'Kakaunti o madilim na ihi',
    detail: 'Maaaring senyales ng pagkaapektado ng bato; nangangailangan ng agarang atensyon.',
  },
  cluster_triad: {
    label: 'Klasikong grupo ng sintomas',
    detail: 'Ang lagnat, pananakit ng kalamnan, at pamumula ng mata nang magkasabay ay kilalang padrón ng leptospirosis.',
  },
  cluster_pair: {
    label: 'Lagnat na may pangunahing senyales',
    detail: 'Ang lagnat kasabay ng pananakit ng kalamnan o pamumula ng mata ay nagpapahiwatig ng alalahanin sa kalusugan.',
  },
  age_older: {
    label: 'Edad 60 pataas',
    detail: 'Ang mga nakatatanda ay may mas mataas na panganib ng malubhang komplikasyon ng leptospirosis.',
  },
  age_child: {
    label: 'Bata 12 taong gulang pababa',
    detail: 'Binibigyang prayoridad ang mga bata para sa mabilisang pagsusuri ng clinician.',
  },
  pregnancy: {
    label: 'Pagbubuntis',
    detail: 'Nangangailangan ng mas mabilis na pagsusuri; bawal ang karaniwang doxycycline.',
  },
};

const COMORBIDITY_LABELS = {
  fil: {
    comorbidity_diabetes: { label: 'Diabetes', detail: 'Kasalukuyang kondisyon na maaaring magpalala sa impeksyon.' },
    comorbidity_kidney: { label: 'Sakit sa bato', detail: 'Kasalukuyang kondisyon na maaaring magpalala sa impeksyon.' },
    comorbidity_liver: { label: 'Sakit sa atay', detail: 'Kasalukuyang kondisyon na maaaring magpalala sa impeksyon.' },
    comorbidity_immuno: { label: 'Mahinang immune system', detail: 'Kasalukuyang kondisyon na maaaring magpalala sa impeksyon.' },
    comorbidity_heart: { label: 'Sakit sa puso', detail: 'Kasalukuyang kondisyon na maaaring magpalala sa impeksyon.' },
  },
};

function getFactorText(factor, language) {
  if (language !== 'fil') {
    return { label: factor.label, detail: factor.detail };
  }
  const entry = FACTOR_TRANSLATIONS[factor.key];
  if (entry) {
    let detail = entry.detail;
    if (entry.details && entry.details[factor.detail]) {
      detail = entry.details[factor.detail];
    } else if (entry.match) {
      detail = entry.match(factor.detail);
    }
    return {
      label: entry.label || factor.label,
      detail: detail || factor.detail,
    };
  }
  const comorb = COMORBIDITY_LABELS.fil[factor.key];
  if (comorb) {
    return comorb;
  }
  return { label: factor.label, detail: factor.detail };
}

function formatNextStep(step, ticket, language) {
  if (language !== 'fil' || !step) return step;
  if (ticket.status === 'waiting') {
    return ticket.tier === 'high'
      ? 'Manatili malapit sa waiting area. Tatawagin ka sa Counter 1.'
      : 'Tingnan ang overhead board para sa iyong token.';
  }
  if (ticket.status === 'serving') {
    const counter = ticket.counter?.name ? formatCounterName(ticket.counter.name, language) : null;
    return counter ? `Pumunta na sa ${counter} ngayon.` : 'Pumunta na sa counter ngayon.';
  }
  if (ticket.status === 'completed') {
    return 'Tapos na ang pagbisita. Sundin ang payo para sa pangangalaga sa ibaba.';
  }
  if (ticket.status === 'referred') {
    return 'Na-refer ka para sa karagdagang lunas. Sundin ang mga tagubilin ng klinika.';
  }
  if (ticket.status === 'no_show') {
    return 'Sarado na ang pass na ito. Magtanong sa triage desk kung kailangan mo pa rin ng lunas.';
  }
  return step;
}

function formatTherapeuticNote(window_, language) {
  if (language !== 'fil') return window_?.note || '';
  if (window_?.status === 'within') {
    return 'Pinaka-epektibo ang doxycycline prophylaxis sa loob ng 72 oras pagkatapos ng pagkababad sa baha. Kukumpirmahin ng clinician kung angkop ito para sa iyo.';
  }
  if (window_?.status === 'outside') {
    return 'Lumagpas ka na sa 72-oras na prophylaxis window. Dapat pa ring suriin ng clinician ang iyong mga sintomas at pangangailangan sa paggamot.';
  }
  return window_?.note || '';
}

function formatRecommendation(recommendation, tier, language) {
  if (language !== 'fil') return recommendation;
  if (tier === 'high') {
    return 'Pumunta agad sa Counter 1. Naabisuhan na ang staff at lalampasan mo ang karaniwang pila. Huwag nang hintaying lumala ang mga sintomas.';
  }
  if (tier === 'moderate') {
    return 'Pumunta sa Counter 2 o 3 para sa pagsusuri ng clinician. Sabihin agad sa staff kung magkaroon ng lagnat, matinding pananakit ng binti, pamumula ng mata, o kaunting ihi.';
  }
  if (tier === 'low') {
    return 'Maaari kang maghintay sa karaniwang pila. Panatilihing may takip ang mga sugat, maghugas gamit ang malinis na tubig at sabon, at magpatingin kapag may lumitaw na sintomas.';
  }
  return recommendation;
}

function formatDisclaimer(disclaimer, language) {
  if (language !== 'fil') return disclaimer;
  return 'Ang LeptoShield ay pansuporta sa desisyong klinikal, hindi pormal na diagnosis. Hindi nito pinapalitan ang doktor o clinician. Kung masama ang iyong pakiramdam, sabihin agad sa staff ng klinika.';
}

function formatCounterMode(label, language) {
  if (language !== 'fil' || !label) return label;
  if (label === 'High-risk only') return 'Para sa mataas na panganib lamang';
  if (label === 'Flexible') return 'Lahat ng antas (Flexible)';
  return label;
}

function formatCounterName(name, language) {
  if (language !== 'fil' || !name) return name;
  return name.replace('Assessment', 'Pagsusuri');
}

function PassHeader({ status }) {
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  return (
    <header className="border-b border-ink-line/70 bg-paper/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-2 sm:gap-3">
        <Link to="/kiosk" className="btn-ghost h-9 gap-1.5 px-2.5 text-xs" aria-label={copy.backToKiosk}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{copy.kiosk}</span>
        </Link>
        <div className="mx-auto">
          <Brand compact markClass="h-7 w-7" />
        </div>
        <div className="flex items-center gap-2">
          <LiveIndicator status={status} className="hidden sm:inline-flex" />
          <LanguageToggle size="sm" />
        </div>
      </div>
    </header>
  );
}

export default function TokenPassView() {
  const { id } = useParams();
  const location = useLocation();
  const justSubmitted = Boolean(location.state?.justSubmitted);
  const { snapshot, status } = useLiveQueue({ pollMs: 6000 });
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const flagLabels = FLAG_LABELS[language] ?? FLAG_LABELS.en;
  const flagDescriptions = FLAG_DESCRIPTIONS[language] ?? FLAG_DESCRIPTIONS.en;
  const categoryLabels = CATEGORY_LABELS[language] ?? CATEGORY_LABELS.en;

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStaffCode, setShowStaffCode] = useState(false);
  const [flash, setFlash] = useState(false);
  const [readyNotice, setReadyNotice] = useState(justSubmitted);
  const previousStatus = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getTicket(id);
      setTicket(data);
      setError(null);
    } catch (requestError) {
      setError(requestError.friendlyMessage || (language === 'fil' ? 'Hindi namin maikarga ang pass na ito.' : 'We could not load this pass.'));
    } finally {
      setLoading(false);
    }
  }, [id, language]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!snapshot) return;
    load();
  }, [snapshot?.generated_at, load]);

  useEffect(() => {
    if (!justSubmitted || !readyNotice) return undefined;
    const timer = window.setTimeout(() => setReadyNotice(false), 15000);
    return () => window.clearTimeout(timer);
  }, [justSubmitted, readyNotice]);

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

  const theme = tierTheme(ticket?.tier, language);
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
      <div className="min-h-dvh bg-paper">
        <PassHeader status={status} />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <span className="inline-flex items-center gap-3 text-sm text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin text-teal" aria-hidden="true" />
            {copy.loading}
          </span>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-dvh bg-paper">
        <PassHeader status={status} />
        <div className="mx-auto max-w-lg px-4 py-16">
          <EmptyState
            icon={Info}
            title={copy.errorTitle}
            message={error || copy.errorMessage}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/triage" className="btn-primary">
                  {copy.startNew}
                </Link>
                <Link to="/kiosk" className="btn-secondary">
                  {copy.backToKiosk}
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
      <PassHeader status={status} />

      <main className="mx-auto max-w-[720px] px-4 py-6 sm:px-6">
        {readyNotice && (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 top-4 z-50 mx-auto w-[min(92vw,520px)] animate-rise"
          >
            <div className="rounded-2xl border border-moss/25 bg-moss-mist p-4 shadow-lift">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-moss-deep" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-moss-deep">{copy.passReadyTitle}</p>
                  <p className="mt-1 text-sm text-moss-deep/90">
                    {copy.passReadyBody}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReadyNotice(false)}
                  className="btn-ghost -mr-1 -mt-1 h-8 w-8 rounded-lg p-0"
                  aria-label={copy.dismiss}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink/10">
                <div className="h-full w-full origin-left animate-shrink bg-moss" />
              </div>
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
                <p className="label">{copy.priorityToken}</p>
                <p className="numeric mt-1 font-serif text-[68px] font-semibold leading-none tracking-[-0.02em] text-ink sm:text-[84px]">
                  {ticket.token}
                </p>
              </div>
              <div className="text-right">
                <StatusPill status={ticket.status} />
                <p className="mt-2 text-xs text-ink-mute">
                  {copy.issuedAt(formatTime(ticket.created_at), ticket.display_name)}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-dashed border-ink-line pt-5">
              {ticket.status === 'waiting' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="label">{copy.position}</p>
                    <p className="numeric mt-1 font-serif text-3xl font-semibold text-ink">
                      #{ticket.position}
                      <span className="ml-1 font-sans text-xs font-semibold text-ink-mute">
                        {copy.inLine(theme.short.toLowerCase())}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="label">{copy.aheadOfYou}</p>
                    <p className="numeric mt-1 font-serif text-3xl font-semibold text-ink">
                      {ticket.people_ahead}
                    </p>
                  </div>
                  <div>
                    <p className="label">{copy.estimatedWait}</p>
                    <p className="numeric mt-1 font-serif text-3xl font-semibold text-ink">
                      {waitLabel(ticket.estimated_wait_minutes, language)}
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
                      {copy.proceedTitle(formatCounterName(ticket.counter?.name, language))}
                    </p>
                    <p className="mt-1 text-sm text-teal-deep/90">
                      {copy.proceedSubtitle(ticket.counter?.location)}
                    </p>
                  </div>
                </div>
              )}

              {isDone && (
                <div className="rounded-2xl border border-ink-line/80 bg-paper-50 p-4">
                  <p className="text-sm font-semibold text-ink">
                    {ticket.status === 'no_show'
                      ? copy.passClosed
                      : ticket.status === 'referred'
                        ? copy.referredTitle
                        : copy.visitComplete}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {formatNextStep(ticket.next_step, ticket, language)}
                  </p>
                </div>
              )}

              {!isDone && (
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                  {formatNextStep(ticket.next_step, ticket, language)}
                </p>
              )}

              {ticket.priority_reviewed && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-ochre/30 bg-ochre-soft px-3 py-1.5 text-xs font-semibold text-ochre-deep">
                  <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy.priorityReviewed}
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
                {copy.refresh}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary h-10 gap-2 px-3.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.savePass}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowStaffCode((value) => !value)}
              className="btn-ghost h-10 gap-2 px-3 text-xs"
              aria-expanded={showStaffCode}
            >
              <QrCode className="h-4 w-4" aria-hidden="true" />
              {copy.staffScanCode}
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
                {ticket.token} · {copy.staffVerification}
              </p>
            </div>
          )}
        </article>

        <section className="panel mt-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
              <CalendarClock className="h-4 w-4 text-teal" aria-hidden="true" />
              {copy.prophylaxisWindow}
            </p>
            <span className="numeric text-sm font-semibold text-ink">
              {copy.hoursLeftOf(window_.hours_left ?? '—', window_.window_hours ?? 72)}
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
            <div
              className={classNames('h-full rounded-full', windowPct > 33 ? 'bg-teal' : windowPct > 0 ? 'bg-ochre' : 'bg-clay')}
              style={{ width: `${Math.max(2, windowPct)}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            {formatTherapeuticNote(window_, language)}
          </p>
        </section>

        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line/70 px-5 py-4">
            <div>
              <h2 className="font-serif text-lg font-semibold text-ink">{copy.whyThisScore}</h2>
              <p className="mt-0.5 text-xs text-ink-mute">
                {ticket.xai?.model_version} · {copy.confidence(Math.round((ticket.xai?.confidence ?? 0) * 100))}
              </p>
            </div>
            <div className="text-right">
              <p className="numeric font-serif text-3xl font-semibold leading-none text-ink">
                {(ticket.risk_score ?? 0).toFixed(2)}
              </p>
              <p className="text-2xs uppercase tracking-[0.12em] text-ink-mute">{copy.riskScore}</p>
            </div>
          </div>

          <div className="px-5 pt-4">
            <RiskMeter score={ticket.risk_score} tier={ticket.tier} />
          </div>

          <ul className="mt-5 divide-y divide-ink-line/70">
            {factors.map((factor) => {
              const factorText = getFactorText(factor, language);
              return (
                <li key={factor.key} className="grid grid-cols-12 items-center gap-3 px-5 py-3">
                  <div className="col-span-12 sm:col-span-7">
                    <p className="text-sm font-semibold text-ink">{factorText.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{factorText.detail}</p>
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
                      {categoryLabels[factor.category] || ''}
                    </span>
                  </div>
                </li>
              );
            })}
            {!factors.length && (
              <li className="px-5 py-6 text-sm text-ink-mute">{copy.noFactors}</li>
            )}
          </ul>

          {ticket.xai?.flags?.length > 0 && (
            <div className="border-t border-ink-line/70 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {ticket.xai.flags.map((flag) => (
                  <span
                    key={flag}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-line bg-paper-50 px-2.5 py-1 text-2xs font-semibold text-ink-soft"
                    title={flagDescriptions[flag] || flagLabels[flag] || ''}
                  >
                    <TriangleAlert className="h-3 w-3 text-ochre" aria-hidden="true" />
                    {flagLabels[flag] || flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                {copy.warningIndicatorsSubtext}
              </p>
            </div>
          )}

          <div className="border-t border-ink-line/70 bg-paper-50 px-5 py-4">
            <p className="font-sans text-sm font-bold text-ink">{copy.whatThisMeans}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {formatRecommendation(ticket.xai?.recommendation, ticket.tier, language)}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-mute">
              {formatDisclaimer(ticket.xai?.disclaimer, language)}
            </p>
          </div>
        </section>

        {ticket.dispensed && (
          <section className="panel mt-6 p-5">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
              <Pill className="h-4 w-4 text-moss-deep" aria-hidden="true" />
              {copy.doxycyclineDispensed}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {copy.doxycyclineDetail(ticket.dispensed_qty)}
            </p>
            <p className="mt-3 text-xs font-semibold text-clay-deep">
              {copy.doxycyclineWarning}
            </p>
          </section>
        )}

        <section className="panel mt-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
              <Clock3 className="h-4 w-4 text-teal" aria-hidden="true" />
              {copy.counterStatus}
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
                  <span className="block truncate font-semibold text-ink">
                    {formatCounterName(counter.name, language)}
                  </span>
                  <span className="block truncate text-2xs text-ink-mute">
                    {formatCounterMode(counter.mode_label, language)}
                    {counter.staff ? ` · ${counter.staff}` : ''}
                  </span>
                </span>
                {counter.active ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: tierTheme(counter.active.tier, language).hex }}
                      aria-hidden="true"
                    />
                    <span className="numeric font-semibold text-ink">{counter.active.token}</span>
                  </span>
                ) : (
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-moss-deep">
                    {copy.ready}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {stats && (
            <p className="mt-4 border-t border-ink-line/70 pt-3 text-xs text-ink-mute">
              {copy.statsSummary(
                stats.waiting,
                stats.high_waiting,
                waitLabel(stats.median_wait_minutes, language),
              )}
            </p>
          )}
        </section>

        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-ink-line/80 bg-surface p-4">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-ink-mute">
            {copy.footerNotice}
          </p>
        </section>
      </main>
    </div>
  );
}
