import { Link, NavLink } from 'react-router-dom';
import {
  ClipboardList,
  Gauge,
  LayoutDashboard,
  MonitorSmartphone,
  Tv,
} from 'lucide-react';

import { Brand } from './Brand';
import { LanguageToggle, useLanguage } from './LanguageToggle';
import { NavMenu } from './NavMenu';
import { LiveIndicator, ManilaClock } from './Primitives';
import { classNames } from '../lib/format';

const COPY = {
  en: {
    nav: { overview: 'Overview', kiosk: 'Kiosk', intake: 'Intake', board: 'Board', desk: 'Duty desk' },
    brand: 'LeptoShield overview',
    kioskCta: 'Open kiosk',
    primaryNav: 'Primary',
    mobileNav: 'Primary mobile',
    footerNote: 'Prototype · synthetic demo data · clinical decision support, not a diagnosis.',
    footerDesk: 'Duty desk',
    footerBoard: 'Waiting-room board',
    footerPlace: 'Manila, Philippines · PHT (UTC+8)',
  },
};

const NAV = [
  { to: '/', key: 'overview', icon: LayoutDashboard, end: true },
  { to: '/kiosk', key: 'kiosk', icon: MonitorSmartphone },
  { to: '/triage', key: 'intake', icon: ClipboardList },
  { to: '/overhead', key: 'board', icon: Tv },
  { to: '/admin', key: 'desk', icon: Gauge },
];

function navClass({ isActive }) {
  return classNames(
    'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-teal-mist text-teal-deep' : 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
  );
}

export function AppShell({
  children,
  status = 'connecting',
  maxWidth = 'max-w-[1320px]',
  footer = true,
  kioskLink = true,
  navMenu = false,
  footerLinks = false,
}) {
  const copy = COPY.en;
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-ink-line/70 bg-paper/90 backdrop-blur">
        <div className={classNames('mx-auto flex flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 sm:gap-x-4 sm:px-6', maxWidth)}>
          <Link to="/" className="shrink-0" aria-label={copy.brand}>
            <Brand compact markClass="h-8 w-8" />
          </Link>
          {!navMenu && (
            <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label={copy.primaryNav}>
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {copy.nav[item.key]}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-4">
            <LiveIndicator status={status} labelClassName="sr-only sm:not-sr-only" />
            <ManilaClock className="hidden text-sm sm:inline-flex" />
            {navMenu ? (
              <NavMenu />
            ) : (
              kioskLink && (
                <Link to="/kiosk" className="btn-primary hidden h-9 px-3 text-xs sm:inline-flex">
                  {copy.kioskCta}
                </Link>
              )
            )}
          </div>
        </div>
        {!navMenu && (
          <nav
            className="flex items-center gap-1 overflow-x-auto border-t border-ink-line/60 px-3 py-2 lg:hidden"
            aria-label={copy.mobileNav}
          >
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {copy.nav[item.key]}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main id="main" className={classNames('mx-auto px-4 pb-24 pt-6 sm:px-6 sm:pt-8', maxWidth)}>
        {children}
      </main>

      {footer && (
        <footer className="border-t border-ink-line/70 bg-surface">
          <div className={classNames('mx-auto flex flex-col gap-3 px-4 py-6 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between sm:px-6', maxWidth)}>
            <div className="flex items-center gap-3">
              <Brand compact markClass="h-7 w-7" />
              <span>{copy.footerNote}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {footerLinks && (
                <>
                  <Link to="/admin" className="font-semibold text-teal-deep hover:underline">
                    {copy.footerDesk}
                  </Link>
                  <Link to="/overhead" className="font-semibold text-teal-deep hover:underline">
                    {copy.footerBoard}
                  </Link>
                </>
              )}
              <span>{copy.footerPlace}</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
