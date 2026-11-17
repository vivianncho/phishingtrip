import { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { BookOpen, CircleHelp, Luggage, ShieldCheck } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { SavedProvider, useSavedContacts } from '@/hooks/use-saved-contacts';
import CheckPage, { type Prefill } from '@/pages/CheckPage';
import DirectoryPage from '@/pages/DirectoryPage';
import TripsPage from '@/pages/TripsPage';
import HelpPage from '@/pages/HelpPage';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
const navigation = [{ path: '/', label: 'Check', icon: ShieldCheck }, { path: '/directory', label: 'Directory', icon: BookOpen }, { path: '/trips', label: 'My Trips', icon: Luggage }, { path: '/help', label: 'Help', icon: CircleHelp }];

function BrowserApp() {
  const [location, navigate] = useLocation();
  const [prefill, setPrefill] = useState<Prefill>(null);
  const saved = useSavedContacts();
  const consumePrefill = useCallback(() => setPrefill(null), []);
  const onUse = useCallback((number: string, company: string) => { setPrefill({ number, company }); navigate('/'); window.scrollTo({ top: 0, behavior: 'auto' }); }, [navigate]);
  useEffect(() => {
    const visibility = () => { document.documentElement.dataset.hidden = String(document.hidden); if (document.hidden) setPrefill(null); };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); if (location !== '/') setPrefill(null); }, [location]);
  return <div className="app"><div className="ambient" aria-hidden="true" /><a className="skip" href="#main" data-testid="link-skip-main">Skip to main content</a><div className="shell">
    <header className="header"><Link className="brand-link" href="/" data-testid="link-brand" aria-label="Phishing Trip home"><svg className="brand-icon" viewBox="0 0 40 42" fill="none" aria-hidden="true"><path d="M9 24C14 12 29 12 36 24c-7 11-22 12-27 0ZM9 24 3 17v14l6-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="29" cy="23" r="1.7" fill="currentColor" /><path d="M21 16c0-7 5-10 9-8" stroke="currentColor" strokeWidth="1.5" /><circle cx="31" cy="8" r="3" fill="currentColor" /></svg><div><div className="brand">Phishing Trip</div><small>Sleep with the phishes.</small></div></Link><nav className="nav" aria-label="Main navigation">{navigation.map(item => <Link key={item.path} href={item.path} aria-current={location === item.path ? 'page' : undefined} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><item.icon size={16} /><span>{item.label}</span></Link>)}</nav></header>
    <main className="main" id="main" tabIndex={-1}>
      {saved.error && location !== '/trips' && <div className="error" role="alert" data-testid="status-storage-error">{saved.error}</div>}
      <ErrorBoundary resetKey={location}><Switch>
        <Route path="/"><CheckPage prefill={prefill} consumePrefill={consumePrefill} onUse={onUse} /></Route>
        <Route path="/directory"><DirectoryPage onUse={onUse} /></Route>
        <Route path="/trips"><TripsPage onUse={onUse} /></Route>
        <Route path="/help" component={HelpPage} />
        <Route component={NotFound} />
      </Switch></ErrorBoundary>
    </main><footer className="footer"><div><em>A little clarity. A calmer journey.</em><br />Evidence is not a guarantee. Caller ID can be spoofed.</div><Link href="/help" data-testid="link-footer-privacy">Privacy & limitations<ArrowMark /></Link></footer>
  </div></div>;
}
function ArrowMark() { return <span aria-hidden="true" style={{ marginLeft: 6 }}>↗</span>; }
function App() {
  return <QueryClientProvider client={queryClient}><SavedProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><BrowserApp /></WouterRouter></SavedProvider></QueryClientProvider>;
}
export default App;
