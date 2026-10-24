import { useEffect, useId, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Menu,
  MonitorSmartphone,
  Tv,
  X,
} from 'lucide-react';

import { classNames } from '../lib/format';

const ITEMS = [
  { to: '/', key: 'overview', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/kiosk', key: 'kiosk', label: 'Kiosk', icon: MonitorSmartphone },
  { to: '/triage', key: 'intake', label: 'Patient intake', icon: ClipboardList },
  { to: '/overhead', key: 'board', label: 'Waiting-room board', icon: Tv },
  { to: '/admin', key: 'desk', label: 'Duty desk', icon: Gauge },
];

export function NavMenu({ tone = 'light', className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();
  const dark = tone === 'dark';

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={classNames('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className={classNames(
          'btn h-10 w-10 rounded-xl border p-0',
          dark
            ? 'border-night-line bg-night-soft text-night-text hover:bg-night-line'
            : 'border-ink-line bg-surface text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
        )}
      >
        {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
      </button>

      {open && (
        <nav
          id={menuId}
          aria-label="Primary"
          className={classNames(
            'absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border p-1.5',
            dark
              ? 'border-night-line bg-night-soft text-night-text shadow-night'
              : 'border-ink-line bg-surface shadow-lift',
          )}
        >
          <ul>
            {ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    classNames(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? dark
                          ? 'bg-teal/20 text-teal-mid'
                          : 'bg-teal-mist text-teal-deep'
                        : dark
                          ? 'text-night-mute hover:bg-night-line hover:text-night-text'
                          : 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
