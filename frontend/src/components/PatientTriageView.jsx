import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Droplets,
  Eye,
  Footprints,
  Hand,
  HeartPulse,
  Loader2,
  Lock,
  PawPrint,
  ShieldCheck,
  Snowflake,
  SprayCan,
  Sun,
  Thermometer,
  TriangleAlert,
  UserRound,
  Waves,
  Wind,
  X,
} from 'lucide-react';

import { Brand } from './Brand';
import { LanguageToggle, useLanguage } from './LanguageToggle';
import { LiveIndicator } from './Primitives';
import { useLiveQueue } from '../hooks/useLiveQueue';
import { createTriage } from '../services/api';
import { classNames } from '../lib/format';

const DRAFT_KEY = 'leptoshield.intake.draft';

const COPY = {
  en: {
    leaveIntake: 'Leave intake',
    closeIntake: 'Close intake',
    close: 'Close',
    progress: 'Intake progress',
    stepOf: (n, total) => `Step ${n} of ${total}`,
    steps: [
      { key: 'exposure', label: 'Exposure', title: 'How were you exposed to floodwater?' },
      { key: 'symptoms', label: 'Symptoms', title: 'How you feel today' },
      { key: 'profile', label: 'Profile', title: 'A little about you' },
      { key: 'review', label: 'Review', title: 'Review and get your token' },
    ],
    exposureLabel: 'Exposure',
    exposure: {
      flood_swim: {
        label: 'Swam or was submerged',
        description: 'Head, face, or a large area of skin went under floodwater.',
      },
      flood_wade: {
        label: 'Waded through floodwater',
        description: 'Feet and legs were in the water while walking or working.',
      },
      rodent_urine: {
        label: 'Touched rodent urine or wet mud',
        description: 'Urine, silt, or soil where rats may have been.',
      },
      mud_contact: {
        label: 'Handled mud, silt, or soaked things',
        description: 'Carried or cleaned wet items without full immersion.',
      },
      cleanup: {
        label: 'Cleaned a flooded home',
        description: 'Swept or scrubbed after the water went down.',
      },
      none: {
        label: 'No flood contact',
        description: 'You came because of symptoms or another concern.',
      },
    },
    durations: {
      0.25: 'Under 30 minutes',
      1: '30 minutes – 2 hours',
      4: '2 – 6 hours',
      8: 'More than 6 hours',
    },
    recency: {
      8: 'Today',
      30: 'Yesterday',
      60: '2 – 3 days ago',
      96: 'More than 3 days ago',
    },
    symptoms: {
      fever: 'Fever or feeling very hot',
      muscle_pain: 'Muscle or calf pain',
      red_eyes: 'Red or irritated eyes',
      headache: 'Headache',
      chills: 'Chills or shivering',
      nausea: 'Nausea or vomiting',
      jaundice: 'Yellow eyes or skin',
      low_urine: 'Much less urine than usual',
    },
    comorbidities: {
      diabetes: 'Diabetes',
      kidney: 'Kidney disease',
      liver: 'Liver disease',
      immuno: 'Weakened immune system',
      heart: 'Heart disease',
    },
    qExposure: 'Which best describes your contact with floodwater?',
    qDuration: 'How long were you in contact?',
    qRecency: 'When did it happen?',
    recencyNote: 'This tells the clinician how much of the 72-hour prophylaxis window remains.',
    qCuts: 'Do you have any open cuts, scrapes, or wounds?',
    yesWound: 'Yes, open wound',
    noWound: 'No open wound',
    symptomsIntro:
      'Select everything you notice today. These answers carry the most weight in the score — this is not a diagnosis.',
    urgentNote:
      'Yellow eyes or very low urine needs to be seen today. Continue and tell the nurse at the desk — you will be moved forward in the queue.',
    noneOfThese: 'None of these',
    age: 'Age',
    agePlaceholder: 'e.g. 34',
    sex: 'Sex',
    sexOptions: {
      female: 'Female',
      male: 'Male',
      other: 'Other',
      undisclosed: 'Prefer not to say',
    },
    pregnant: 'Currently pregnant',
    pregnantNote: 'Pregnancy lowers the threshold for clinician review.',
    conditions: 'Existing conditions',
    conditionsNote: 'Select any that apply. These add a small priority weight.',
    optional: 'Optional details',
    optionalNote:
      'You can stay anonymous. A name helps staff call you, but it is not required.',
    name: 'Name (optional)',
    namePlaceholder: 'First and last name',
    barangay: 'Barangay (optional)',
    barangayPlaceholder: 'Where you live or were flooded',
    notAnswered: 'Not answered',
    contactTime: 'Contact time',
    when: 'When',
    symptomsRow: 'Symptoms',
    openWound: 'Open wound',
    ageAndSex: 'Age and sex',
    conditionsRow: 'Conditions',
    yes: 'Yes',
    no: 'No',
    pregnantSuffix: ' · pregnant',
    noneReported: 'None reported',
    edit: 'Edit',
    consent:
      'I agree to be triaged and for this clinic to record these answers for my visit. I understand this is decision support, not a diagnosis.',
    privacy:
      'Your answers stay with this clinic. Submitting creates a priority token you can show at the counter.',
    back: 'Back',
    continue: 'Continue',
    scoring: 'Scoring your answers…',
    getToken: 'Get my priority token',
    scoringShort: 'Scoring…',
    getTokenShort: 'Get token',
    errStep0:
      'Choose an exposure type, how long you were in contact, when it happened, and whether you have open cuts.',
    errStep1: 'Choose at least one answer. Select "No symptoms" if none apply.',
    errStep2: 'Enter an age between 0 and 120 and choose a sex option.',
    errConsent: 'Tick the consent box so we can create your triage pass.',
    errSubmit: 'We could not create your pass. Please try again.',
    asideTitle: 'What happens after you submit',
    asideSteps: [
      'You get a token with a colour and a score, plus the reasons behind it.',
      'High risk is called to Counter 1 and bypasses the standard line.',
      'Moderate and low risk wait in the flexible queue without losing their place.',
    ],
    warnTitle: 'Tell the nurse immediately if',
    warnItems: [
      'You feel confused or very weak.',
      'You are passing very little or no urine.',
      'Your eyes or skin turn yellow.',
      'You have severe pain in your calves or abdomen.',
    ],
  },
  fil: {
    leaveIntake: 'Umalis sa intake',
    closeIntake: 'Isara ang intake',
    close: 'Isara',
    progress: 'Progreso ng intake',
    stepOf: (n, total) => `Hakbang ${n} ng ${total}`,
    steps: [
      { key: 'exposure', label: 'Paglalahad', title: 'Paano ka nagkaroon ng kontak sa tubig-baha?' },
      { key: 'symptoms', label: 'Mga Sintomas', title: 'Kumusta ang pakiramdam mo ngayon' },
      { key: 'profile', label: 'Impormasyon', title: 'Kaunting impormasyon tungkol sa iyo' },
      { key: 'review', label: 'Pagtatasa', title: 'Suriin at kunin ang iyong token' },
    ],
    exposureLabel: 'Paglalahad',
    exposure: {
      flood_swim: {
        label: 'Lumangoy o nalubog',
        description: 'Nalubog sa baha ang ulo, mukha, o malaking bahagi ng balat.',
      },
      flood_wade: {
        label: 'Naglusong sa baha',
        description: 'Nabasa ng baha ang paa at binti habang naglalakad o nagtatrabaho.',
      },
      rodent_urine: {
        label: 'Humawak ng ihi ng daga o basang putik',
        description: 'Ihi, putik, o lupa kung saan maaaring dumaan ang daga.',
      },
      mud_contact: {
        label: 'Humawak ng putik, banlik, o basang gamit',
        description: 'Nagbuhat o naglinis ng basang gamit nang hindi lubusang nalubog.',
      },
      cleanup: {
        label: 'Naglilinis ng binahang bahay',
        description: 'Nagwalis o nagkuskos matapos humupa ang tubig.',
      },
      none: {
        label: 'Walang kontak sa baha',
        description: 'Pumunta ka dahil sa sintomas o ibang alalahanin.',
      },
    },
    durations: {
      0.25: 'Wala pang 30 minuto',
      1: '30 minuto – 2 oras',
      4: '2 – 6 na oras',
      8: 'Mahigit 6 na oras',
    },
    recency: {
      8: 'Ngayon',
      30: 'Kahapon',
      60: '2 – 3 araw ang nakalipas',
      96: 'Mahigit 3 araw ang nakalipas',
    },
    symptoms: {
      fever: 'Lagnat o sobrang init ng pakiramdam',
      muscle_pain: 'Pananakit ng kalamnan o binti',
      red_eyes: 'Namumula o naiiritang mata',
      headache: 'Sakit ng ulo',
      chills: 'Panginginig o ginaw',
      nausea: 'Pagduduwal o pagsusuka',
      jaundice: 'Naninilaw na mata o balat',
      low_urine: 'Kakaunti ang ihi kaysa dati',
    },
    comorbidities: {
      diabetes: 'Diabetes',
      kidney: 'Sakit sa bato',
      liver: 'Sakit sa atay',
      immuno: 'Mahinang immune system',
      heart: 'Sakit sa puso',
    },
    qExposure: 'Alin ang pinakaangkop na paglalarawan sa kontak mo sa baha?',
    qDuration: 'Gaano katagal ang kontak mo?',
    qRecency: 'Kailan nangyari?',
    recencyNote:
      'Sinasabi nito sa clinician kung gaano pa ang natitira sa 72-oras na prophylaxis window.',
    qCuts: 'May bukas na sugat, gasgas, o galos ka ba?',
    yesWound: 'Oo, may bukas na sugat',
    noWound: 'Walang bukas na sugat',
    symptomsIntro:
      'Piliin ang lahat ng napapansin mo ngayon. Ang mga sagot na ito ang may pinakamalaking bigat sa score — hindi ito diagnosis.',
    urgentNote:
      'Ang naninilaw na mata o napakakaunting ihi ay kailangang makita ng doktor ngayon. Magpatuloy at sabihin sa nars sa desk — ilalapit ka sa unahan ng pila.',
    noneOfThese: 'Wala sa mga ito',
    age: 'Edad',
    agePlaceholder: 'Halimbawa: 34',
    sex: 'Kasarian',
    sexOptions: {
      female: 'Babae',
      male: 'Lalaki',
      other: 'Iba pa',
      undisclosed: 'Ayaw sabihin',
    },
    pregnant: 'Kasalukuyang buntis',
    pregnantNote: 'Mas mababa ang threshold para sa pagsusuri ng clinician kapag buntis.',
    conditions: 'Mga kasalukuyang kondisyon',
    conditionsNote: 'Piliin ang naaangkop. Nagdadagdag ito ng maliit na priority weight.',
    optional: 'Opsyonal na detalye',
    optionalNote:
      'Maaari kang manatiling anonymous. Nakakatulong ang pangalan para matawag ka ng staff, pero hindi ito kinakailangan.',
    name: 'Pangalan (opsyonal)',
    namePlaceholder: 'Pangalan at apelyido',
    barangay: 'Barangay (opsyonal)',
    barangayPlaceholder: 'Saan ka nakatira o kung saan ka binaha',
    notAnswered: 'Hindi sinagot',
    contactTime: 'Tagal ng kontak',
    when: 'Kailan',
    symptomsRow: 'Mga Sintomas',
    openWound: 'Bukas na sugat',
    ageAndSex: 'Edad at kasarian',
    conditionsRow: 'Mga kondisyon',
    yes: 'Oo',
    no: 'Hindi',
    pregnantSuffix: ' · buntis',
    noneReported: 'Walang inulat',
    edit: 'I-edit',
    consent:
      'Pumapayag akong ma-triage at maitala ng klinikang ito ang mga sagot na ito para sa aking pagbisita. Nauunawaan kong decision support ito, hindi diagnosis.',
    privacy:
      'Mananatili sa klinikang ito ang mga sagot mo. Ang pagsusumite ay gumagawa ng priority token na maipapakita mo sa counter.',
    back: 'Bumalik',
    continue: 'Magpatuloy',
    scoring: 'Sinusuri ang mga sagot mo…',
    getToken: 'Kunin ang aking priority token',
    scoringShort: 'Sinusuri…',
    getTokenShort: 'Kunin ang token',
    errStep0:
      'Pumili ng uri ng exposure, gaano katagal ang kontak, kailan nangyari, at kung may bukas na sugat.',
    errStep1: 'Pumili ng kahit isang sagot. Piliin ang "Wala sa mga ito" kung wala kang sintomas.',
    errStep2: 'Maglagay ng edad mula 0 hanggang 120 at pumili ng kasarian.',
    errConsent: 'Lagyan ng tsek ang consent box para makagawa kami ng iyong triage pass.',
    errSubmit: 'Hindi namin magawa ang iyong pass. Subukan muli.',
    asideTitle: 'Ano ang mangyayari pagkatapos mong magsumite',
    asideSteps: [
      'Makakakuha ka ng token na may kulay at score, kasama ang mga dahilan nito.',
      'Ang mga pasyente na may mataas na panganib ay tinatawag sa Counter 1 at may prayoridad sa pila.',
      'Ang mga pasyente na may katamtaman o mababang panganib ay naghihintay sa flexible queue nang hindi nawawala ang kanilang puwesto.',
    ],
    warnTitle: 'Sabihin agad sa nars kung:',
    warnItems: [
      'Nalilito ka o sobrang nanghihina.',
      'Napakakaunti o wala kang ihi.',
      'Naninilaw ang iyong mata o balat.',
      'Matindi ang pananakit ng binti o tiyan.',
    ],
  },
};

const EXPOSURE_OPTIONS = [
  { key: 'flood_swim', icon: Waves },
  { key: 'flood_wade', icon: Footprints },
  { key: 'rodent_urine', icon: PawPrint },
  { key: 'mud_contact', icon: Hand },
  { key: 'cleanup', icon: SprayCan },
  { key: 'none', icon: ShieldCheck },
];

const DURATION_OPTIONS = [{ value: 0.25 }, { value: 1 }, { value: 4 }, { value: 8 }];

const RECENCY_OPTIONS = [{ value: 8 }, { value: 30 }, { value: 60 }, { value: 96 }];

const SYMPTOM_OPTIONS = [
  { key: 'fever', icon: Thermometer },
  { key: 'muscle_pain', icon: Activity },
  { key: 'red_eyes', icon: Eye },
  { key: 'headache', icon: Brain },
  { key: 'chills', icon: Snowflake },
  { key: 'nausea', icon: Wind },
  { key: 'jaundice', icon: Sun, urgent: true },
  { key: 'low_urine', icon: Droplets, urgent: true },
];

const COMORBIDITY_KEYS = ['diabetes', 'kidney', 'liver', 'immuno', 'heart'];

const EMPTY_FORM = {
  exposureType: '',
  exposureHours: null,
  exposureRecency: null,
  openCuts: null,
  symptoms: [],
  age: '',
  sex: '',
  pregnant: false,
  comorbidities: [],
  name: '',
  barangay: '',
};

function OptionCard({ name, value, checked, onChange, icon: Icon, label, description, urgent = false }) {
  return (
    <label
      className={classNames(
        'flex cursor-pointer gap-3 rounded-2xl border p-4 transition-all duration-150 focus-within:ring-2 focus-within:ring-teal/25',
        checked
          ? 'border-teal bg-teal-mist shadow-[0_0_0_3px_rgba(14,107,98,.08)]'
          : 'border-ink-line bg-surface hover:border-teal/35',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={classNames(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
          checked ? 'border-teal/30 bg-teal text-white' : 'border-ink-line bg-paper-50 text-teal-deep',
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-sans text-sm font-bold text-ink">
          {label}
          {urgent && <TriangleAlert className="h-4 w-4 text-clay" aria-hidden="true" />}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-soft">{description}</span>
      </span>
      <span className={classNames('ml-auto mt-0.5 shrink-0', checked ? 'text-teal' : 'text-ink-faint')} aria-hidden="true">
        {checked ? <Check className="h-5 w-5" /> : <span className="block h-5 w-5 rounded-full border border-ink-line" />}
      </span>
    </label>
  );
}

function ChoicePill({ name, value, checked, onChange, children, multiple = false }) {
  return (
    <label
      className={classNames(
        'chip cursor-pointer focus-within:ring-2 focus-within:ring-teal/25',
        checked ? 'chip-active' : 'chip-idle',
      )}
    >
      <input
        type={multiple ? 'checkbox' : 'radio'}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={classNames(
          'flex h-4 w-4 items-center justify-center rounded-full border',
          checked ? 'border-teal bg-teal text-white' : 'border-ink-line',
        )}
        aria-hidden="true"
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      {children}
    </label>
  );
}

function SymptomChip({ symptom, checked, onChange }) {
  const Icon = symptom.icon;
  return (
    <label
      className={classNames(
        'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all focus-within:ring-2 focus-within:ring-teal/25',
        checked
          ? symptom.urgent
            ? 'border-clay bg-clay-mist text-clay-deep shadow-[0_0_0_3px_rgba(178,58,50,.08)]'
            : 'border-teal bg-teal-mist text-teal-deep shadow-[0_0_0_3px_rgba(14,107,98,.08)]'
          : 'border-ink-line bg-surface text-ink-soft hover:border-teal/35',
      )}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{symptom.label}</span>
      <span
        className={classNames(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
          checked ? (symptom.urgent ? 'border-clay bg-clay text-white' : 'border-teal bg-teal text-white') : 'border-ink-line',
        )}
        aria-hidden="true"
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
    </label>
  );
}

export default function PatientTriageView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { status } = useLiveQueue({ pollMs: 20000 });
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) return { ...EMPTY_FORM, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return EMPTY_FORM;
  });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const fromKiosk = params.get('src') === 'kiosk';

  const toggleSymptom = (key) => {
    setForm((current) => {
      const has = current.symptoms.includes(key);
      if (key === 'none') return { ...current, symptoms: has ? [] : ['none'] };
      const without = current.symptoms.filter((item) => item !== key && item !== 'none');
      return { ...current, symptoms: has ? without : [...without, key] };
    });
  };

  const toggleComorbidity = (key) => {
    setForm((current) => ({
      ...current,
      comorbidities: current.comorbidities.includes(key)
        ? current.comorbidities.filter((item) => item !== key)
        : [...current.comorbidities, key],
    }));
  };

  const stepValid = useMemo(() => {
    if (step === 0) {
      return Boolean(form.exposureType) && form.exposureHours !== null && form.openCuts !== null && form.exposureRecency !== null;
    }
    if (step === 1) return form.symptoms.length > 0;
    if (step === 2) {
      const age = Number(form.age);
      return form.age !== '' && Number.isFinite(age) && age >= 0 && age <= 120 && Boolean(form.sex);
    }
    return consent;
  }, [step, form, consent]);

  const next = () => {
    if (!stepValid) {
      setError({
        key: step === 0 ? 'errStep0' : step === 1 ? 'errStep1' : step === 2 ? 'errStep2' : 'errConsent',
      });
      return;
    }
    setError(null);
    setStep((value) => Math.min(copy.steps.length - 1, value + 1));
  };

  const back = () => {
    setError(null);
    setStep((value) => Math.max(0, value - 1));
  };

  const submit = async () => {
    if (!stepValid) {
      setError({ key: 'errConsent' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await createTriage({
        exposure_type: form.exposureType,
        exposure_hours: form.exposureHours ?? 0,
        exposure_recency_hours: form.exposureRecency ?? 24,
        open_cuts: Boolean(form.openCuts),
        symptoms: form.symptoms.filter((item) => item !== 'none'),
        age: form.age === '' ? null : Number(form.age),
        sex: form.sex || null,
        pregnant: Boolean(form.pregnant),
        comorbidities: form.comorbidities,
        name: form.name.trim() || null,
        barangay: form.barangay.trim() || null,
        consent: true,
      });
      window.sessionStorage.removeItem(DRAFT_KEY);
      navigate(`/token/${ticket.id}`, { state: { justSubmitted: true } });
    } catch (requestError) {
      setError(
        requestError.friendlyMessage
          ? { text: requestError.friendlyMessage }
          : { key: 'errSubmit' },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const urgentSelected = form.symptoms.some((key) => key === 'jaundice' || key === 'low_urine');
  const showAside = step === copy.steps.length - 1;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-ink-line/70 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <Link to={fromKiosk ? '/kiosk' : '/'} className="shrink-0" aria-label={copy.leaveIntake}>
            <Brand compact markClass="h-8 w-8" />
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LiveIndicator status={status} labelClassName="sr-only sm:not-sr-only" />
            <LanguageToggle size="sm" />
            <Link
              to={fromKiosk ? '/kiosk' : '/'}
              className="btn-ghost h-9 gap-1.5 px-2.5 text-xs"
              aria-label={copy.closeIntake}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{copy.close}</span>
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1120px] px-4 pb-3 sm:px-6">
          <div className="flex items-center gap-2" role="list" aria-label={copy.progress}>
            {copy.steps.map((item, index) => (
              <div key={item.key} className="flex flex-1 items-center gap-2" role="listitem">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={classNames(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-2xs font-semibold',
                        index < step
                          ? 'border-moss bg-moss text-white'
                          : index === step
                            ? 'border-teal bg-teal text-white'
                            : 'border-ink-line bg-surface text-ink-faint',
                      )}
                    >
                      {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span
                      className={classNames(
                        'hidden truncate text-xs font-semibold sm:block',
                        index === step ? 'text-ink' : 'text-ink-mute',
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
                    <div
                      className={classNames('h-full rounded-full transition-all duration-500', index <= step ? 'waterline' : 'bg-transparent')}
                      style={{ width: index < step ? '100%' : index === step ? '55%' : '0%' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:py-10">
        <main className={classNames(showAside ? 'lg:col-span-7 xl:col-span-8' : 'mx-auto w-full max-w-3xl lg:col-span-12')}>
          <div key={step} className="animate-rise">
            <p className="label">{copy.stepOf(step + 1, copy.steps.length)}</p>
            <h1 className="mt-2 font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
              {copy.steps[step].title}
            </h1>

            {step === 0 && (
              <div className="mt-6 space-y-6">
                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">{copy.qExposure}</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {EXPOSURE_OPTIONS.map((option) => (
                      <OptionCard
                        key={option.key}
                        name="exposureType"
                        value={option.key}
                        checked={form.exposureType === option.key}
                        onChange={() => update({ exposureType: option.key })}
                        icon={option.icon}
                        label={copy.exposure[option.key].label}
                        description={copy.exposure[option.key].description}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">{copy.qDuration}</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((option) => (
                      <ChoicePill
                        key={option.value}
                        name="exposureHours"
                        value={option.value}
                        checked={form.exposureHours === option.value}
                        onChange={() => update({ exposureHours: option.value })}
                      >
                        {copy.durations[option.value]}
                      </ChoicePill>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">{copy.qRecency}</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {RECENCY_OPTIONS.map((option) => (
                      <ChoicePill
                        key={option.value}
                        name="exposureRecency"
                        value={option.value}
                        checked={form.exposureRecency === option.value}
                        onChange={() => update({ exposureRecency: option.value })}
                      >
                        {copy.recency[option.value]}
                      </ChoicePill>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-mute">{copy.recencyNote}</p>
                </fieldset>

                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">{copy.qCuts}</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { value: true, label: copy.yesWound },
                      { value: false, label: copy.noWound },
                    ].map((option) => (
                      <ChoicePill
                        key={String(option.value)}
                        name="openCuts"
                        value={option.value}
                        checked={form.openCuts === option.value}
                        onChange={() => update({ openCuts: option.value })}
                      >
                        {option.label}
                      </ChoicePill>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 1 && (
              <div className="mt-6 space-y-5">
                <p className="text-sm leading-relaxed text-ink-soft">{copy.symptomsIntro}</p>
                {urgentSelected && (
                  <div className="flex items-start gap-3 rounded-2xl border border-clay/25 bg-clay-mist p-4">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-clay" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-clay-deep">{copy.urgentNote}</p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {SYMPTOM_OPTIONS.map((symptom) => (
                    <SymptomChip
                      key={symptom.key}
                      symptom={{ ...symptom, label: copy.symptoms[symptom.key] }}
                      checked={form.symptoms.includes(symptom.key)}
                      onChange={() => toggleSymptom(symptom.key)}
                    />
                  ))}
                </div>
                <label
                  className={classNames(
                    'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all focus-within:ring-2 focus-within:ring-teal/25',
                    form.symptoms.includes('none')
                      ? 'border-teal bg-teal-mist text-teal-deep'
                      : 'border-ink-line bg-surface text-ink-soft hover:border-teal/35',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.symptoms.includes('none')}
                    onChange={() => toggleSymptom('none')}
                    className="sr-only"
                  />
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {copy.noneOfThese}
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="mt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="age" className="font-sans text-sm font-bold text-ink">
                      {copy.age}
                    </label>
                    <input
                      id="age"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="120"
                      value={form.age}
                      onChange={(event) => update({ age: event.target.value })}
                      placeholder={copy.agePlaceholder}
                      className="field numeric mt-2 h-12"
                    />
                  </div>
                  <div>
                    <span className="font-sans text-sm font-bold text-ink">{copy.sex}</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { value: 'female', label: copy.sexOptions.female },
                        { value: 'male', label: copy.sexOptions.male },
                        { value: 'other', label: copy.sexOptions.other },
                        { value: 'undisclosed', label: copy.sexOptions.undisclosed },
                      ].map((option) => (
                        <ChoicePill
                          key={option.value}
                          name="sex"
                          value={option.value}
                          checked={form.sex === option.value}
                          onChange={() => update({ sex: option.value })}
                        >
                          {option.label}
                        </ChoicePill>
                      ))}
                    </div>
                  </div>
                </div>

                {(form.sex === 'female' || form.sex === 'undisclosed') && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-surface p-4">
                    <input
                      type="checkbox"
                      checked={form.pregnant}
                      onChange={(event) => update({ pregnant: event.target.checked })}
                      className="mt-0.5 h-5 w-5 rounded border-ink-line text-teal focus:ring-teal/30"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{copy.pregnant}</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {copy.pregnantNote}
                      </span>
                    </span>
                  </label>
                )}

                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">{copy.conditions}</legend>
                  <p className="mt-1 text-xs text-ink-mute">{copy.conditionsNote}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {COMORBIDITY_KEYS.map((key) => (
                      <ChoicePill
                        key={key}
                        name={`comorbidity-${key}`}
                        value={key}
                        multiple
                        checked={form.comorbidities.includes(key)}
                        onChange={() => toggleComorbidity(key)}
                      >
                        {copy.comorbidities[key]}
                      </ChoicePill>
                    ))}
                  </div>
                </fieldset>

                <div className="rounded-2xl border border-ink-line/80 bg-surface p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                    <UserRound className="h-4 w-4 text-teal" aria-hidden="true" />
                    {copy.optional}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">{copy.optionalNote}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="text-xs font-semibold text-ink-soft">
                        {copy.name}
                      </label>
                      <input
                        id="name"
                        value={form.name}
                        onChange={(event) => update({ name: event.target.value })}
                        placeholder={copy.namePlaceholder}
                        maxLength={80}
                        className="field mt-1.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="barangay" className="text-xs font-semibold text-ink-soft">
                        {copy.barangay}
                      </label>
                      <input
                        id="barangay"
                        value={form.barangay}
                        onChange={(event) => update({ barangay: event.target.value })}
                        placeholder={copy.barangayPlaceholder}
                        maxLength={80}
                        className="field mt-1.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-6 space-y-5">
                <div className="divide-y divide-ink-line/70 overflow-hidden rounded-2xl border border-ink-line/80 bg-surface">
                  {[
                    {
                      label: copy.exposureLabel,
                      value:
                        (form.exposureType ? copy.exposure[form.exposureType]?.label : null) ||
                        copy.notAnswered,
                      stepIndex: 0,
                    },
                    {
                      label: copy.contactTime,
                      value:
                        (form.exposureHours !== null ? copy.durations[form.exposureHours] : null) ||
                        copy.notAnswered,
                      stepIndex: 0,
                    },
                    {
                      label: copy.when,
                      value:
                        (form.exposureRecency !== null ? copy.recency[form.exposureRecency] : null) ||
                        copy.notAnswered,
                      stepIndex: 0,
                    },
                    {
                      label: copy.openWound,
                      value:
                        form.openCuts === null ? copy.notAnswered : form.openCuts ? copy.yes : copy.no,
                      stepIndex: 0,
                    },
                    {
                      label: copy.symptomsRow,
                      value:
                        form.symptoms.length === 0
                          ? copy.notAnswered
                          : form.symptoms
                              .map((key) =>
                                key === 'none' ? copy.noneOfThese : copy.symptoms[key] || key,
                              )
                              .join(', '),
                      stepIndex: 1,
                    },
                    {
                      label: copy.ageAndSex,
                      value: `${form.age || '—'} · ${form.sex ? copy.sexOptions[form.sex] || form.sex : '—'}${
                        form.pregnant ? copy.pregnantSuffix : ''
                      }`,
                      stepIndex: 2,
                    },
                    {
                      label: copy.conditionsRow,
                      value:
                        form.comorbidities.length === 0
                          ? copy.noneReported
                          : form.comorbidities.map((key) => copy.comorbidities[key]).join(', '),
                      stepIndex: 2,
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-mute">
                          {row.label}
                        </p>
                        <p className="mt-1 text-sm text-ink">{row.value}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(row.stepIndex)}
                        className="text-xs font-semibold text-teal-deep hover:underline"
                      >
                        {copy.edit}
                      </button>
                    </div>
                  ))}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink-line bg-surface p-4">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-ink-line text-teal focus:ring-teal/30"
                  />
                  <span className="text-sm leading-relaxed text-ink-soft">{copy.consent}</span>
                </label>

                <div className="flex items-start gap-3 rounded-2xl border border-teal/20 bg-teal-mist p-4">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-teal-deep">{copy.privacy}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-clay/25 bg-clay-mist p-3.5" role="alert">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
                <p className="text-sm text-clay-deep">
                  {error.text || copy[error.key] || copy.errSubmit}
                </p>
              </div>
            )}

            <div className="mt-8 hidden items-center justify-between gap-3 sm:flex">
              <button
                type="button"
                onClick={back}
                disabled={step === 0}
                className="btn-secondary h-12 px-5 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {copy.back}
              </button>
              {step < copy.steps.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  aria-disabled={!stepValid}
                  className={classNames(
                    'h-12 min-w-[160px] px-6',
                    stepValid ? 'btn-primary' : 'btn-muted',
                  )}
                >
                  {copy.continue}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  aria-disabled={!stepValid}
                  className={classNames(
                    'h-12 min-w-[200px] px-6',
                    stepValid ? 'btn-primary' : 'btn-muted',
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {copy.scoring}
                    </>
                  ) : (
                    <>
                      {copy.getToken}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </main>

        {showAside && (
          <aside className="space-y-5 lg:col-span-5 xl:col-span-4">
            <div className="panel p-5">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                <HeartPulse className="h-4 w-4 text-teal" aria-hidden="true" />
                {copy.asideTitle}
              </p>
              <ol className="mt-3 space-y-3">
                {copy.asideSteps.map((item, index) => (
                  <li key={item} className="flex gap-3 text-sm text-ink-soft">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-teal/25 bg-teal-mist font-mono text-2xs font-semibold text-teal-deep">
                      {index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-clay/25 bg-clay-mist p-5">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-clay-deep">
                <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                {copy.warnTitle}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-clay-deep/90">
                {copy.warnItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      <div className="sticky bottom-0 z-30 border-t border-ink-line/70 bg-paper/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={back}
            disabled={step === 0}
            className="btn-secondary h-12 flex-1"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {copy.back}
          </button>
          {step < copy.steps.length - 1 ? (
            <button
              type="button"
              onClick={next}
              aria-disabled={!stepValid}
              className={classNames('h-12 flex-[1.4]', stepValid ? 'btn-primary' : 'btn-muted')}
            >
              {copy.continue}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              aria-disabled={!stepValid}
              className={classNames('h-12 flex-[1.4]', stepValid ? 'btn-primary' : 'btn-muted')}
            >
              {submitting ? copy.scoringShort : copy.getTokenShort}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
