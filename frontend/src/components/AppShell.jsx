import { Link, NavLink } from 'react-router-dom';
import {
  ArrowUpRight,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  MonitorSmartphone,
  Tv,
} from 'lucide-react';

import { Brand } from './Brand';
import { LiveIndicator, ManilaClock } from './Primitives';
import { classNames } from '../lib/format';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/kiosk', label: 'Kiosk', icon: MonitorSmartphone },
  { to: '/triage', label: 'Intake', icon: ClipboardList },
  { to: '/overhead', label: 'Board', icon: Tv },
  { to: '/admin', label: 'Duty desk', icon: Gauge },
];

function navClass({ isActive }) {
  return classNames(
    'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-teal-mist text-teal-deep' : 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
  );
}

export function AppShell({ children, status = 'connecting', maxWidth = 'max-w-[1320px]', footer = true }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-ink-line/70 bg-paper/90 backdrop-blur">
        <div className={classNames('mx-auto flex items-center gap-4 px-4 py-3 sm:px-6', maxWidth)}>
          <Link to="/" className="shrink-0" aria-label="LeptoShield overview">
            <Brand compact markClass="h-8 w-8" />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LiveIndicator status={status} />
            <ManilaClock className="hidden text-sm sm:inline-flex" />
            <Link to="/kiosk" className="btn-primary hidden h-9 px-3 text-xs sm:inline-flex">
              Open kiosk
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <nav
          className="flex items-center gap-1 overflow-x-auto border-t border-ink-line/60 px-3 py-2 lg:hidden"
          aria-label="Primary mobile"
        >
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className={classNames('mx-auto px-4 pb-24 pt-6 sm:px-6 sm:pt-8', maxWidth)}>
        {children}
      </main>

      {footer && (
        <footer className="border-t border-ink-line/70 bg-surface">
          <div className={classNames('mx-auto flex flex-col gap-3 px-4 py-6 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between sm:px-6', maxWidth)}>
            <div className="flex items-center gap-3">
              <Brand compact markClass="h-7 w-7" />
              <span>
                Prototype · synthetic demo data · clinical decision support, not a diagnosis.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/admin" className="font-semibold text-teal-deep hover:underline">
                Duty desk
              </Link>
              <Link to="/overhead" className="font-semibold text-teal-deep hover:underline">
                Waiting-room board
              </Link>
              <span>Manila, Philippines · PHT (UTC+8)</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
