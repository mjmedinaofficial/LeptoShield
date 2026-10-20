export const MANILA_TZ = 'Asia/Manila';

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export const TIER_THEME = {
  high: {
    key: 'high',
    label: 'High risk',
    short: 'High',
    priority: 'Priority 1 · Fast-track',
    badge: 'border-clay/25 bg-clay-soft text-clay-deep',
    solid: 'bg-clay text-white',
    soft: 'bg-clay-soft',
    mist: 'bg-clay-mist',
    border: 'border-clay/25',
    text: 'text-clay-deep',
    dot: 'bg-clay',
    bar: 'bg-clay',
    hex: '#B23A32',
    guidance: 'Counter 1 · physician review and prophylaxis window',
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate risk',
    short: 'Moderate',
    priority: 'Priority 2 · Clinician review',
    badge: 'border-ochre/30 bg-ochre-soft text-ochre-deep',
    solid: 'bg-ochre text-white',
    soft: 'bg-ochre-soft',
    mist: 'bg-ochre-mist',
    border: 'border-ochre/30',
    text: 'text-ochre-deep',
    dot: 'bg-ochre',
    bar: 'bg-ochre',
    hex: '#B77A16',
    guidance: 'Counter 2 or 3 · flexible assessment',
  },
  low: {
    key: 'low',
    label: 'Low risk',
    short: 'Low',
    priority: 'Priority 3 · Standard queue',
    badge: 'border-moss/25 bg-moss-soft text-moss-deep',
    solid: 'bg-moss text-white',
    soft: 'bg-moss-soft',
    mist: 'bg-moss-mist',
    border: 'border-moss/25',
    text: 'text-moss-deep',
    dot: 'bg-moss',
    bar: 'bg-moss',
    hex: '#2F7D62',
    guidance: 'Standard line · self-monitoring advice',
  },
};

export function tierTheme(tier) {
  return TIER_THEME[tier] || TIER_THEME.low;
}

export const STATUS_THEME = {
  waiting: {
    label: 'Waiting',
    badge: 'border-ink-line bg-paper-100 text-ink-soft',
    description: 'In the queue',
  },
  serving: {
    label: 'In consultation',
    badge: 'border-teal/25 bg-teal-soft text-teal-deep',
    description: 'At a counter now',
  },
  completed: {
    label: 'Completed',
    badge: 'border-moss/25 bg-moss-soft text-moss-deep',
    description: 'Visit closed',
  },
  referred: {
    label: 'Referred',
    badge: 'border-teal/25 bg-teal-mist text-teal-deep',
    description: 'Sent for further care',
  },
  no_show: {
    label: 'No-show',
    badge: 'border-ink-line bg-ink/[0.06] text-ink-mute',
    description: 'Did not present',
  },
};

export function statusTheme(status) {
  return STATUS_THEME[status] || STATUS_THEME.waiting;
}

export function formatTime(value, options = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function manilaLongDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function clockParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return {
    time: new Intl.DateTimeFormat('en-PH', {
      timeZone: MANILA_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date),
    seconds: new Intl.DateTimeFormat('en-PH', {
      timeZone: MANILA_TZ,
      second: '2-digit',
    }).format(date),
    date: new Intl.DateTimeFormat('en-PH', {
      timeZone: MANILA_TZ,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date),
  };
}

export function timeAgo(value, now = Date.now()) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function waitLabel(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const value = Math.max(0, Math.round(minutes));
  if (value < 1) return 'under a minute';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function compactNumber(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-PH').format(value);
}

export function initialsFrom(name) {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'AG';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function scorePercent(score) {
  return Math.round(Math.max(0, Math.min(1, score ?? 0)) * 100);
}

export function isHighRisk(ticket) {
  return ticket?.tier === 'high';
}

export const EXPOSURE_ICON_KEYS = {
  flood_swim: 'Waves',
  flood_wade: 'Footprints',
  rodent_urine: 'Rat',
  mud_contact: 'Hand',
  cleanup: 'Brush',
  none: 'ShieldQuestion',
};

export const SYMPTOM_ICON_KEYS = {
  fever: 'Thermometer',
  muscle_pain: 'Activity',
  red_eyes: 'Eye',
  headache: 'Brain',
  chills: 'Snowflake',
  nausea: 'Wind',
  jaundice: 'Sun',
  low_urine: 'Droplets',
};

export const COMORBIDITY_LABELS = {
  diabetes: 'Diabetes',
  kidney: 'Kidney disease',
  liver: 'Liver disease',
  immuno: 'Weakened immune system',
  heart: 'Heart disease',
};
