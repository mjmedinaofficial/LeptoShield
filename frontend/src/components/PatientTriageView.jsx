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
  Info,
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
import { LiveIndicator } from './Primitives';
import { useLiveQueue } from '../hooks/useLiveQueue';
import { createTriage } from '../services/api';
import { classNames, COMORBIDITY_LABELS } from '../lib/format';

const DRAFT_KEY = 'leptoshield.intake.draft';

const EXPOSURE_OPTIONS = [
  {
    key: 'flood_swim',
    label: 'Swam or was submerged',
    description: 'Head, face, or a large area of skin went under floodwater.',
    icon: Waves,
  },
  {
    key: 'flood_wade',
    label: 'Waded through floodwater',
    description: 'Feet and legs were in the water while walking or working.',
    icon: Footprints,
  },
  {
    key: 'rodent_urine',
    label: 'Touched rodent urine or wet mud',
    description: 'Urine, silt, or soil where rats may have been.',
    icon: PawPrint,
  },
  {
    key: 'mud_contact',
    label: 'Handled mud, silt, or soaked things',
    description: 'Carried or cleaned wet items without full immersion.',
    icon: Hand,
  },
  {
    key: 'cleanup',
    label: 'Cleaned a flooded home',
    description: 'Swept or scrubbed after the water went down.',
    icon: SprayCan,
  },
  {
    key: 'none',
    label: 'No flood contact',
    description: 'You came because of symptoms or another concern.',
    icon: ShieldCheck,
  },
];

const DURATION_OPTIONS = [
  { value: 0.25, label: 'Under 30 minutes' },
  { value: 1, label: '30 minutes – 2 hours' },
  { value: 4, label: '2 – 6 hours' },
  { value: 8, label: 'More than 6 hours' },
];

const RECENCY_OPTIONS = [
  { value: 8, label: 'Today' },
  { value: 30, label: 'Yesterday' },
  { value: 60, label: '2 – 3 days ago' },
  { value: 96, label: 'More than 3 days ago' },
];

const SYMPTOM_OPTIONS = [
  { key: 'fever', label: 'Fever or feeling very hot', icon: Thermometer },
  { key: 'muscle_pain', label: 'Muscle or calf pain', icon: Activity },
  { key: 'red_eyes', label: 'Red or irritated eyes', icon: Eye },
  { key: 'headache', label: 'Headache', icon: Brain },
  { key: 'chills', label: 'Chills or shivering', icon: Snowflake },
  { key: 'nausea', label: 'Nausea or vomiting', icon: Wind },
  { key: 'jaundice', label: 'Yellow eyes or skin', icon: Sun, urgent: true },
  { key: 'low_urine', label: 'Much less urine than usual', icon: Droplets, urgent: true },
];

const COMORBIDITY_KEYS = ['diabetes', 'kidney', 'liver', 'immuno', 'heart'];

const STEPS = [
  { key: 'exposure', label: 'Exposure', title: 'Where the water touched you' },
  { key: 'symptoms', label: 'Symptoms', title: 'How you feel today' },
  { key: 'profile', label: 'Profile', title: 'A little about you' },
  { key: 'review', label: 'Review', title: 'Review and get your token' },
];

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
  const { snapshot, status } = useLiveQueue({ pollMs: 20000 });
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
      setError(
        step === 0
          ? 'Choose an exposure type, how long you were in contact, when it happened, and whether you have open cuts.'
          : step === 1
            ? 'Choose at least one answer. Select “No symptoms” if none apply.'
            : step === 2
              ? 'Enter an age between 0 and 120 and choose a sex option.'
              : 'Tick the consent box so we can create your triage pass.',
      );
      return;
    }
    setError(null);
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const back = () => {
    setError(null);
    setStep((value) => Math.max(0, value - 1));
  };

  const submit = async () => {
    if (!stepValid) {
      setError('Tick the consent box so we can create your triage pass.');
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
      setError(requestError.friendlyMessage || 'We could not create your pass. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const urgentSelected = form.symptoms.some((key) => key === 'jaundice' || key === 'low_urine');
  const waitingCount = snapshot?.stats?.waiting ?? 0;
  const highCount = snapshot?.stats?.high_waiting ?? 0;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-ink-line/70 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link to={fromKiosk ? '/kiosk' : '/'} className="shrink-0" aria-label="Leave intake">
            <Brand compact markClass="h-8 w-8" />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <LiveIndicator status={status} />
            <Link
              to={fromKiosk ? '/kiosk' : '/'}
              className="btn-ghost h-9 gap-1.5 px-2.5 text-xs"
              aria-label="Close intake"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Close
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1120px] px-4 pb-3 sm:px-6">
          <div className="flex items-center gap-2" role="list" aria-label="Intake progress">
            {STEPS.map((item, index) => (
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
        <main className="lg:col-span-7 xl:col-span-8">
          <div key={step} className="animate-rise">
            <p className="label">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mt-2 font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
              {STEPS[step].title}
            </h1>

            {step === 0 && (
              <div className="mt-6 space-y-6">
                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">
                    Which best describes your contact with floodwater?
                  </legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {EXPOSURE_OPTIONS.map((option) => (
                      <OptionCard
                        key={option.key}
                        name="exposureType"
                        value={option.key}
                        checked={form.exposureType === option.key}
                        onChange={() => update({ exposureType: option.key })}
                        icon={option.icon}
                        label={option.label}
                        description={option.description}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">
                    How long were you in contact?
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((option) => (
                      <ChoicePill
                        key={option.value}
                        name="exposureHours"
                        value={option.value}
                        checked={form.exposureHours === option.value}
                        onChange={() => update({ exposureHours: option.value })}
                      >
                        {option.label}
                      </ChoicePill>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">When did it happen?</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {RECENCY_OPTIONS.map((option) => (
                      <ChoicePill
                        key={option.value}
                        name="exposureRecency"
                        value={option.value}
                        checked={form.exposureRecency === option.value}
                        onChange={() => update({ exposureRecency: option.value })}
                      >
                        {option.label}
                      </ChoicePill>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-mute">
                    This tells the clinician how much of the 72-hour prophylaxis window remains.
                  </p>
                </fieldset>

                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">
                    Do you have any open cuts, scrapes, or wounds?
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { value: true, label: 'Yes, open wound' },
                      { value: false, label: 'No open wound' },
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
                <p className="text-sm leading-relaxed text-ink-soft">
                  Select everything you notice today. These answers carry the most weight in the
                  score — this is not a diagnosis.
                </p>
                {urgentSelected && (
                  <div className="flex items-start gap-3 rounded-2xl border border-clay/25 bg-clay-mist p-4">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-clay" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-clay-deep">
                      Yellow eyes or very low urine needs to be seen today. Continue and tell the
                      nurse at the desk — you will be moved forward in the queue.
                    </p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {SYMPTOM_OPTIONS.map((symptom) => (
                    <SymptomChip
                      key={symptom.key}
                      symptom={symptom}
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
                  None of these
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="mt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="age" className="font-sans text-sm font-bold text-ink">
                      Age
                    </label>
                    <input
                      id="age"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="120"
                      value={form.age}
                      onChange={(event) => update({ age: event.target.value })}
                      placeholder="e.g. 34"
                      className="field numeric mt-2 h-12"
                    />
                  </div>
                  <div>
                    <span className="font-sans text-sm font-bold text-ink">Sex</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { value: 'female', label: 'Female' },
                        { value: 'male', label: 'Male' },
                        { value: 'other', label: 'Other' },
                        { value: 'undisclosed', label: 'Prefer not to say' },
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
                      <span className="block text-sm font-semibold text-ink">Currently pregnant</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        Pregnancy lowers the threshold for clinician review.
                      </span>
                    </span>
                  </label>
                )}

                <fieldset>
                  <legend className="font-sans text-sm font-bold text-ink">
                    Existing conditions
                  </legend>
                  <p className="mt-1 text-xs text-ink-mute">
                    Select any that apply. These add a small priority weight.
                  </p>
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
                        {COMORBIDITY_LABELS[key]}
                      </ChoicePill>
                    ))}
                  </div>
                </fieldset>

                <div className="rounded-2xl border border-ink-line/80 bg-surface p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                    <UserRound className="h-4 w-4 text-teal" aria-hidden="true" />
                    Optional details
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    You can stay anonymous. A name helps staff call you, but it is not required.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="text-xs font-semibold text-ink-soft">
                        Name (optional)
                      </label>
                      <input
                        id="name"
                        value={form.name}
                        onChange={(event) => update({ name: event.target.value })}
                        placeholder="First and last name"
                        maxLength={80}
                        className="field mt-1.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="barangay" className="text-xs font-semibold text-ink-soft">
                        Barangay (optional)
                      </label>
                      <input
                        id="barangay"
                        value={form.barangay}
                        onChange={(event) => update({ barangay: event.target.value })}
                        placeholder="Where you live or were flooded"
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
                      label: 'Exposure',
                      value:
                        EXPOSURE_OPTIONS.find((option) => option.key === form.exposureType)?.label ||
                        'Not answered',
                      stepIndex: 0,
                    },
                    {
                      label: 'Contact time',
                      value:
                        DURATION_OPTIONS.find((option) => option.value === form.exposureHours)?.label ||
                        'Not answered',
                      stepIndex: 0,
                    },
                    {
                      label: 'When',
                      value:
                        RECENCY_OPTIONS.find((option) => option.value === form.exposureRecency)?.label ||
                        'Not answered',
                      stepIndex: 0,
                    },
                    {
                      label: 'Open wound',
                      value: form.openCuts === null ? 'Not answered' : form.openCuts ? 'Yes' : 'No',
                      stepIndex: 0,
                    },
                    {
                      label: 'Symptoms',
                      value:
                        form.symptoms.length === 0
                          ? 'Not answered'
                          : form.symptoms
                              .map(
                                (key) =>
                                  SYMPTOM_OPTIONS.find((symptom) => symptom.key === key)?.label ||
                                  (key === 'none' ? 'None of these' : key),
                              )
                              .join(', '),
                      stepIndex: 1,
                    },
                    {
                      label: 'Age and sex',
                      value: `${form.age || '—'} · ${form.sex || '—'}${form.pregnant ? ' · pregnant' : ''}`,
                      stepIndex: 2,
                    },
                    {
                      label: 'Conditions',
                      value:
                        form.comorbidities.length === 0
                          ? 'None reported'
                          : form.comorbidities.map((key) => COMORBIDITY_LABELS[key]).join(', '),
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
                        Edit
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
                  <span className="text-sm leading-relaxed text-ink-soft">
                    I agree to be triaged and for this clinic to record these answers for my visit.
                    I understand this is decision support, not a diagnosis.
                  </span>
                </label>

                <div className="flex items-start gap-3 rounded-2xl border border-teal/20 bg-teal-mist p-4">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-teal-deep">
                    Your answers stay with this clinic. Submitting creates a priority token you can
                    show at the counter.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-clay/25 bg-clay-mist p-3.5" role="alert">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
                <p className="text-sm text-clay-deep">{error}</p>
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
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={next} className="btn-primary h-12 min-w-[160px] px-6">
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="btn-primary h-12 min-w-[200px] px-6"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Scoring your answers…
                    </>
                  ) : (
                    <>
                      Get my priority token
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </main>

        <aside className="space-y-5 lg:col-span-5 xl:col-span-4">
          <div className="panel p-5">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
              <HeartPulse className="h-4 w-4 text-teal" aria-hidden="true" />
              What happens after you submit
            </p>
            <ol className="mt-3 space-y-3">
              {[
                'You get a token with a colour and a score, plus the reasons behind it.',
                'High risk is called to Counter 1 and bypasses the standard line.',
                'Moderate and low risk wait in the flexible queue without losing their place.',
              ].map((item, index) => (
                <li key={item} className="flex gap-3 text-sm text-ink-soft">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-teal/25 bg-teal-mist font-mono text-2xs font-semibold text-teal-deep">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="label">Lobby queue</p>
              <LiveIndicator status={status} />
            </div>
            <div className="mt-3 flex items-end gap-4">
              <div>
                <span className="numeric font-serif text-4xl font-semibold leading-none text-ink">
                  {waitingCount}
                </span>
                <p className="mt-1 text-2xs uppercase tracking-[0.12em] text-ink-mute">waiting</p>
              </div>
              <div className="border-l border-ink-line/70 pl-4">
                <span className="numeric font-serif text-2xl font-semibold leading-none text-clay-deep">
                  {highCount}
                </span>
                <p className="mt-1 text-2xs uppercase tracking-[0.12em] text-ink-mute">high risk</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-mute">
              Your position updates live on the next screen.
            </p>
          </div>

          <div className="rounded-2xl border border-clay/25 bg-clay-mist p-5">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-clay-deep">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
              Tell the nurse immediately if
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-clay-deep/90">
              <li>You feel confused or very weak.</li>
              <li>You are passing very little or no urine.</li>
              <li>Your eyes or skin turn yellow.</li>
              <li>You have severe pain in your calves or abdomen.</li>
            </ul>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-ink-line/80 bg-surface p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-ink-mute">
              Prototype with synthetic data. In a real deployment, clinic staff would confirm every
              score before any treatment.
            </p>
          </div>
        </aside>
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
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="btn-primary h-12 flex-[1.4]">
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="btn-primary h-12 flex-[1.4]"
            >
              {submitting ? 'Scoring…' : 'Get token'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
