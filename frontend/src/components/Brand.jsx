import { LeptoShieldWordmark } from './LeptoShieldWordmark';

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="LeptoShield">
      <rect x="0" y="0" width="40" height="40" rx="12" fill="#0E6B62" />
      <path
        d="M20 7.5c4.7 6 7.9 10.2 7.9 14.2A7.9 7.9 0 0 1 20 29.6a7.9 7.9 0 0 1-7.9-7.9c0-4 3.2-8.2 7.9-14.2Z"
        fill="#F7F4EE"
      />
      <path
        d="M13.4 23.2c2.3-1.5 4.5-1.5 7 0s4.6 1.5 6.9-.1"
        stroke="#0E6B62"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Brand({ compact = false, subtitle, className = '', markClass = 'h-9 w-9' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClass} />
      <span className="flex flex-col items-start leading-none">
        <LeptoShieldWordmark className="h-4 w-auto text-teal sm:h-5" />
        {!compact && (
          <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            {subtitle || 'Flood-response triage'}
          </span>
        )}
      </span>
    </span>
  );
}

export function BrandOnDark({ subtitle = 'Waiting-room board' }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className="h-8 w-8" />
      <span className="flex flex-col items-start leading-none">
        <LeptoShieldWordmark className="h-5 w-auto text-night-text" />
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-night-mute">
          {subtitle}
        </span>
      </span>
    </span>
  );
}
