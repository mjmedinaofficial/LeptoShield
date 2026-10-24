import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { classNames } from '../lib/format';

const STORAGE_KEY = 'leptoshield.language';

const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'fil', label: 'FIL', name: 'Filipino' },
];

const LanguageContext = createContext(null);

function readStoredLanguage() {
  if (typeof window === 'undefined') return 'en';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'fil' ? 'fil' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language === 'fil' ? 'fil' : 'en';
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage can be unavailable; the toggle still works for the session.
    }
  }, [language]);

  const setLanguage = useCallback((next) => {
    setLanguageState(next === 'fil' ? 'fil' : 'en');
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside a LanguageProvider');
  return context;
}

const TONE = {
  light: {
    group: 'border-ink-line bg-surface',
    idle: 'text-ink-soft hover:bg-ink/[0.05]',
    active: 'bg-teal text-white',
  },
  dark: {
    group: 'border-night-line bg-night-soft',
    idle: 'text-night-mute hover:bg-night-line hover:text-night-text',
    active: 'bg-teal text-white',
  },
};

export function LanguageToggle({ tone = 'light', size = 'md', className = '' }) {
  const { language, setLanguage } = useLanguage();
  const theme = TONE[tone] ?? TONE.light;
  const sizing = size === 'sm' ? 'h-9 px-2.5' : 'min-h-[40px] px-3';

  return (
    <div
      className={classNames(
        'inline-flex shrink-0 overflow-hidden rounded-xl border',
        theme.group,
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {LANGUAGES.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => setLanguage(item.code)}
          aria-pressed={language === item.code}
          title={item.name}
          className={classNames(
            'inline-flex items-center text-xs font-semibold transition-colors',
            sizing,
            language === item.code ? theme.active : theme.idle,
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
