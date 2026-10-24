import { Component } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import HubView from './components/HubView';
import KioskView from './components/KioskView';
import PatientTriageView from './components/PatientTriageView';
import TokenPassView from './components/TokenPassView';
import OverheadBoardView from './components/OverheadBoardView';
import AdminDashboardView from './components/AdminDashboardView';
import { AppShell } from './components/AppShell';
import { LanguageProvider, useLanguage } from './components/LanguageToggle';
import { EmptyState } from './components/Primitives';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

const NOT_FOUND_COPY = {
  en: {
    title: 'That screen does not exist',
    message: 'The route you followed is not part of the LeptoShield prototype.',
    action: 'Back to overview',
  },
  fil: {
    title: 'Wala ang screen na iyon',
    message: 'Ang link na sinundan mo ay hindi bahagi ng LeptoShield prototype.',
    action: 'Bumalik sa pangkalahatan',
  },
};

function NotFoundView() {
  const { language } = useLanguage();
  const copy = NOT_FOUND_COPY[language] ?? NOT_FOUND_COPY.en;
  return (
    <AppShell>
      <EmptyState
        title={copy.title}
        message={copy.message}
        action={
          <Link to="/" className="btn-primary">
            {copy.action}
          </Link>
        }
      />
    </AppShell>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-paper px-6">
          <div className="panel max-w-lg p-8 text-center">
            <h1 className="font-serif text-2xl font-semibold text-ink">This screen stopped responding</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Reload to reconnect to the clinic feed. If the problem continues, use the duty desk
              terminal.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
                Reload
              </button>
              <a className="btn-secondary" href="/">
                Overview
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <ScrollToTop />
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Routes>
            <Route path="/" element={<HubView />} />
            <Route path="/kiosk" element={<KioskView />} />
            <Route path="/triage" element={<PatientTriageView />} />
            <Route path="/token/:id" element={<TokenPassView />} />
            <Route path="/overhead" element={<OverheadBoardView />} />
            <Route path="/admin" element={<AdminDashboardView />} />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
