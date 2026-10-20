import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clock3,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Activity,
} from 'lucide-react';

import { classNames, clockParts, scorePercent, statusTheme, tierTheme, waitLabel } from '../lib/format';

export function TierIcon({ tier, className = 'h-4 w-4' }) {
  if (tier === 'high') return <AlertTriangle className={className} aria-hidden="true" />;
  if (tier === 'moderate') return <Clock3 className={className} aria-hidden="true" />;
  return <ShieldCheck className={className} aria-hidden="true" />;
}

export function TierBadge({ tier, size = 'md', withIcon = true, className = '' }) {
  const theme = tierTheme(tier);
  const sizes = {
    sm: 'px-2 py-0.5 text-2xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        theme.badge,
        sizes[size],
        className,
      )}
    >
      {withIcon && <TierIcon tier={tier} className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />}
      {theme.label}
    </span>
  );
}

export function StatusPill({ status, className = '' }) {
  const theme = statusTheme(status);
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.08em]',
        theme.badge,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {theme.label}
    </span>
  );
}

export function RiskMeter({ score, tier, className = '', showTicks = true, compact = false }) {
  const theme = tierTheme(tier);
  const pct = scorePercent(score);
  return (
    <div className={className}>
      <div
        className={classNames(
          'relative w-full overflow-hidden rounded-full bg-ink/[0.07]',
          compact ? 'h-1.5' : 'h-2.5',
        )}
        role="img"
        aria-label={`Risk score ${pct} percent, ${theme.label}`}
      >
        <div
          className={classNames('h-full rounded-full transition-[width] duration-700', theme.bar)}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
      {showTicks && !compact && (
        <div className="relative mt-1.5 h-3 text-2xs text-ink-faint">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: '32%' }}>
            mod
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: '60%' }}>
            high
          </span>
          <span className="absolute right-0">1.0</span>
        </div>
      )}
    </div>
  );
}

export function ThresholdBar({ value, alert, epidemic, max, className = '', label }) {
  const ceiling = max || Math.max(epidemic * 1.4, value * 1.15, 1);
  const position = (input) => `${Math.min(100, Math.max(0, (input / ceiling) * 100))}%`;
  const status = value >= epidemic ? 'epidemic' : value >= alert ? 'alert' : 'normal';
  const fill =
    status === 'epidemic' ? 'bg-clay' : status === 'alert' ? 'bg-ochre' : 'bg-moss';
  return (
    <div className={className} role="img" aria-label={label || `${value} cases against ${alert} alert and ${epidemic} epidemic thresholds`}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]">
        <div className={classNames('h-full rounded-full', fill)} style={{ width: position(value) }} />
      </div>
      <div className="relative mt-1 h-4">
        <span
          className="absolute top-0 h-2.5 w-0.5 -translate-x-1/2 rounded bg-ochre/80"
          style={{ left: position(alert) }}
          title={`Alert threshold ${alert}`}
        />
        <span
          className="absolute top-0 h-2.5 w-0.5 -translate-x-1/2 rounded bg-clay/80"
          style={{ left: position(epidemic) }}
          title={`Epidemic threshold ${epidemic}`}
        />
      </div>
    </div>
  );
}

const LIVE_STATES = {
  live: { dot: 'bg-moss', label: 'Live', tone: 'text-moss-deep' },
  connecting: { dot: 'bg-ochre animate-breathe', label: 'Connecting', tone: 'text-ochre-deep' },
  reconnecting: { dot: 'bg-ochre animate-breathe', label: 'Reconnecting', tone: 'text-ochre-deep' },
  offline: { dot: 'bg-clay', label: 'Offline', tone: 'text-clay-deep' },
};

export function LiveIndicator({ status = 'connecting', className = '', showLabel = true }) {
  const state = LIVE_STATES[status] || LIVE_STATES.connecting;
  return (
    <span className={classNames('inline-flex items-center gap-2 text-2xs font-semibold', className)} aria-live="polite">
      <span className={classNames('h-2 w-2 rounded-full', state.dot)} />
      {showLabel && <span className={classNames('uppercase tracking-[0.14em]', state.tone)}>{state.label}</span>}
    </span>
  );
}

export function ManilaClock({ className = '', withDate = false, withSeconds = false, tone = 'text-ink' }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const parts = clockParts(now);
  return (
    <span className={classNames('numeric inline-flex items-baseline gap-2', className, tone)}>
      <span className="font-semibold" aria-label={`Manila time ${parts.time}`}>
        {parts.time}
        {withSeconds && <span className="ml-0.5 text-ink-faint">{parts.seconds}</span>}
      </span>
      {withDate && <span className="text-2xs uppercase tracking-[0.14em] opacity-70">{parts.date}</span>}
    </span>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const previous = document.activeElement;
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      window.clearTimeout(timer);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={classNames(
          'panel relative z-10 max-h-[92dvh] w-full overflow-hidden rounded-t-3xl shadow-lift animate-rise sm:rounded-2xl',
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-line/70 px-5 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost -mr-2 -mt-1 h-9 w-9 rounded-lg p-0" aria-label="Close dialog">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[62dvh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-line/70 bg-paper-50 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Activity, title, message, action, className = '' }) {
  return (
    <div className={classNames('flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-line px-6 py-12 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-mist text-teal-deep">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 font-serif text-lg font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-ink-soft">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Sparkline({ values = [], height = 40, className = '', stroke = '#0E6B62', fill = 'rgba(14,107,98,.12)', label = 'Trend' }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const width = 100;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={label}
    >
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function WaitValue({ minutes, className = '' }) {
  return <span className={classNames('numeric', className)}>{waitLabel(minutes)}</span>;
}

export function SectionTitle({ children, meta, id, action }) {
  return (
    <div id={id} className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-line/70 pb-3">
      <h2 className="font-serif text-xl font-semibold tracking-tight text-ink">{children}</h2>
      <div className="flex items-center gap-3">
        {meta && <span className="label">{meta}</span>}
        {action}
      </div>
    </div>
  );
}

export function DataRow({ label, value, tone = 'text-ink', className = '' }) {
  return (
    <div className={classNames('flex items-baseline justify-between gap-3 py-2', className)}>
      <span className="text-sm text-ink-soft">{label}</span>
      <span className={classNames('numeric text-sm font-semibold', tone)}>{value}</span>
    </div>
  );
}

export function SuccessNote({ children, className = '' }) {
  return (
    <span className={classNames('inline-flex items-center gap-2 text-sm font-medium text-moss-deep', className)}>
      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      {children}
    </span>
  );
}

export function ArrowCue({ className = 'h-4 w-4' }) {
  return <ArrowRight className={className} aria-hidden="true" />;
}
