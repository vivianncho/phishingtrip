import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SafariCompanion, Sheet } from './SafariCompanion';
import './_group.css';
import './BrowserCompanion.css';
import './Stillwater.css';

type IconName = 'check' | 'shield' | 'search' | 'arrow' | 'book' | 'trip' | 'alert' | 'help' | 'close' | 'lock' | 'plus' | 'trash' | 'back' | 'plane' | 'edit' | 'spark';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    check: <path d="m5 12 4 4L19 6" />, shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8 12 3 3 5-6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>, arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    book: <><rect x="5" y="3" width="15" height="18" rx="3" /><path d="M5 17h15M9 7h7M9 10h5M3 7h4M3 12h4" /></>,
    trip: <><rect x="4" y="7" width="16" height="14" rx="3" /><path d="M9 7V4h6v3M8 11v6m8-6v6" /></>,
    alert: <><path d="m12 3 10 18H2zM12 9v5" /><path d="M12 17h.01" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />, lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
    plus: <path d="M12 5v14M5 12h14" />, trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></>,
    back: <path d="m14 5-7 7 7 7" />, plane: <path d="m21 3-6 18-4-8-8-4 18-6ZM11 13l10-10" />,
    edit: <><path d="m15 4 5 5-11 11H4v-5L15 4Zm-2 2 5 5" /></>, spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

type Verdict = 'official' | 'suspicious' | 'unverified';
type FishState = Verdict | 'idle' | 'searching';
type Company = { id: string; name: string; category: string; number: string; initials: string; detail: string; hours: string };
const COMPANIES: Company[] = [
  { id: 'aer', name: 'Aster Air', category: 'Airlines', number: '+1 (202) 555-0142', initials: 'aa', detail: 'Flight changes & reservations', hours: '24-hour example support' },
  { id: 'hotel', name: 'The Cove Hotel', category: 'Hotels', number: '+1 (202) 555-0168', initials: 'c.', detail: 'Late arrivals & reservations', hours: '24-hour example front desk' },
  { id: 'rail', name: 'Northline Rail', category: 'Rail & transfers', number: '+1 (202) 555-0193', initials: 'nr', detail: 'Tickets & journey changes', hours: 'Example hours: 6am–10pm' },
  { id: 'rental', name: 'Drift Car Rental', category: 'Car rentals', number: '+1 (202) 555-0124', initials: 'dr', detail: 'Pickups & roadside help', hours: '24-hour example support' },
  { id: 'stays', name: 'Nest Vacation Stays', category: 'Vacation rentals', number: '+1 (202) 555-0136', initials: 'ns', detail: 'Check-in & host support', hours: '24-hour example support' },
  { id: 'booking', name: 'Wayfarer Bookings', category: 'Booking sites', number: '+1 (202) 555-0151', initials: 'wb', detail: 'Booking changes & refunds', hours: '24-hour example support' },
  { id: 'cruise', name: 'Bluewake Cruises', category: 'Cruises', number: '+1 (202) 555-0174', initials: 'bc', detail: 'Boarding & reservation help', hours: 'Example hours: 7am–10pm' },
  { id: 'tours', name: 'Roam Local Tours', category: 'Tours', number: '+1 (202) 555-0182', initials: 'rl', detail: 'Meeting points & tour changes', hours: 'Example hours: 6am–9pm' },
];
function Fish({ state, tick, onActivate, label, compact = false }: { state: FishState; tick: number; onActivate?: () => void; label?: string; compact?: boolean }) {
  const [boost, setBoost] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const captions: Record<FishState, string> = {
    idle: 'One step at a time. Hook is here with you.',
    searching: 'Hook is checking sample clues after your tap…',
    official: 'An example match. Hook can rest a little.',
    suspicious: 'Invented reports found. Hook suggests a pause.',
    unverified: 'Not sure yet. You still have a next step.',
  };
  function swim() { setBoost(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setBoost(false), 950); }
  return <div className={`sw-fish-stage sw-status-${state} ${compact ? 'sw-fish-compact' : ''}`}>
    <i className="sw-bubble" /><i className="sw-bubble b2" /><i className="sw-bubble b3" />
    <button data-testid={`button-pip-${label?.match(/0142|0187|0116/)?.[0] || 'manual'}`} className={`sw-fish-button ${boost ? 'sw-boost' : ''}`} onClick={onActivate || swim} aria-label={label || `Tap to make Hook the fish swim. ${captions[state]}`} data-swim={tick}>
      <svg key={tick} className="sw-fish-art sw-figma-fish" viewBox="0 0 480 400" fill="none" role="img" aria-label={`Hook the fish, ${state}`}>
        <g className="sw-hook"><path d="M62 6v65c0 24-29 26-29 7v-9l9 9" stroke="#ff858b" strokeWidth="3" strokeLinecap="round" /></g>
        <g className="sw-tail"><image href="/__mockup/images/hook-figma-fins.svg" x="174" y="101" width="269.636" height="244.031" /></g>
        <image href="/__mockup/images/hook-figma-body.svg" x="77.245" y="134.627" width="275.822" height="194.202" />
        <image href="/__mockup/images/hook-figma-face.svg" x="87" y="160.5" width="91.403" height="111.492" />
        <g className="sw-figma-eye-rest"><ellipse cx="143" cy="209" rx="32" ry="34" fill="#174854" /><path d="M122 209q21 17 42-2" stroke="#9dded0" strokeWidth="3.5" strokeLinecap="round" /></g>
        <image className="sw-figma-lantern" href="/__mockup/images/hook-figma-lantern.svg" x="40.904" y="44.917" width="160.632" height="125.966" />
        <g className="sw-search-waves" stroke="#d5f995" strokeWidth="2" strokeLinecap="round"><path d="M61 186q-14 24 0 48m-15-62q-23 37 0 76" /></g>
        <g className="sw-sleep-letters" fill="#d5f995" fontFamily="Space Grotesk" fontWeight="500"><text x="193" y="111" fontSize="17">z</text><text x="218" y="87" fontSize="23">z</text></g>
      </svg>
    </button>
    <p className="sw-fish-caption" aria-live="polite"><Icon name={state === 'suspicious' ? 'alert' : state === 'unverified' ? 'help' : 'spark'} size={12} />{captions[state]}</p>
  </div>;
}

export function Stillwater() {
  const [dive, setDive] = useState(0);
  useEffect(() => {
    let pending = 0;
    const update = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        const el = document.scrollingElement;
        setDive(Math.min(1, (el?.scrollTop || 0) / Math.max(200, (el?.scrollHeight || 0) - window.innerHeight)));
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', update); cancelAnimationFrame(pending); };
  }, []);
  const [tab, setTab] = useState<'check' | 'directory' | 'trips'>('check');
  const [initialNumber, setInitialNumber] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [detail, setDetail] = useState<Company | null>(null);
  const [saved, setSaved] = useState<string[]>(() => { try { const value: unknown = JSON.parse(localStorage.getItem('stillwater-demo-contacts') || '[]'); return Array.isArray(value) ? [...new Set(value.filter((id: unknown): id is string => typeof id === 'string' && COMPANIES.some(c => c.id === id)))] : []; } catch { return []; } });
  const [tripName, setTripName] = useState(() => { try { return localStorage.getItem('stillwater-demo-trip') || 'A little time away'; } catch { return 'A little time away'; } });
  const [editingTrip, setEditingTrip] = useState(false);
  const [draftName, setDraftName] = useState(tripName);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  function notify(message: string) { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2800); }
  function saveContact(company: Company) {
    if (saved.includes(company.id)) { setTab('trips'); setDetail(null); return; }
    const next = [...saved, company.id]; setSaved(next);
    try { localStorage.setItem('stillwater-demo-contacts', JSON.stringify(next)); notify('Contact saved to My Trips on this device.'); } catch { notify('Saved for this session. Device storage is unavailable.'); }
  }
  function removeContact(id: string) { const next = saved.filter(v => v !== id); setSaved(next); setRemoveId(null); try { localStorage.setItem('stillwater-demo-contacts', JSON.stringify(next)); } catch { /* In-memory state remains available. */ } notify('Contact removed from your trip.'); }
  function changeTab(next: typeof tab) { setTab(next); setDetail(null); setRemoveId(null); setInitialNumber(undefined); setEditingTrip(false); }
  function openDirectory(number?: string) { setTab('directory'); setQuery(''); setCategory('All'); setDetail(COMPANIES.find(c => c.number === number) || COMPANIES[0]); }
  const filtered = COMPANIES.filter(c => (category === 'All' || category === c.category) && `${c.name} ${c.number} ${c.category} ${c.detail} ${c.number.replace(/\D/g, '')}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="stillwater sw-underwater sw-figma-ocean" style={{ '--sw-dive': dive } as CSSProperties}>
    <div className="sw-ambient-ocean" aria-hidden="true"><div className="sw-ambient-depth" /><div className="sw-ambient-surface" /><div className="sw-ambient-ray" />{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--bubble-x': `${(i * 23 + 7) % 100}%`, '--bubble-y': `${(i * 17 + 20) % 90}%`, '--bubble-delay': `${-i * 2}s` } as CSSProperties} />)}</div>
    <div className="sw-shell">
      <header className="sw-header">
        <div className="sw-brand"><svg className="sw-brand-mark" width="29" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 17C11 7 24 8 29 17c-5 9-18 10-22 0ZM7 17 2 11v12l5-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="23" cy="16" r="1.3" fill="currentColor" /><path d="M17 10c0-5 4-6 6-4" stroke="currentColor" strokeWidth="1.4" /><circle cx="24" cy="7" r="2" fill="currentColor" /></svg><div><div className="sw-brand-name">Phishing Trip</div><p className="sw-slogan">Sleep with the phishes.</p></div></div>
        <span className="sw-demo-badge">LOCAL DEMO</span>
      </header>

      {tab === 'check' && <><SafariCompanion initialNumber={initialNumber} exampleContacts={COMPANIES} onOfficialContact={openDirectory} renderFish={(state, tick, onActivate, label) => <Fish state={state} tick={tick} onActivate={onActivate} label={label} compact />} /><button className="bc-link-card" onClick={() => window.open('/__mockup/preview/stillwater/UnderwaterBrowser', '_blank', 'noopener,noreferrer')}><Icon name="shield" size={23} /><span><strong>Dive beneath the number.</strong><small>Watch Hook swim to a browser number.<br />Keep the evidence right beside you.</small></span><Icon name="arrow" size={17} /></button><p className="sw-dive-teaser"><Icon name="spark" size={14} />Scroll deeper. Hook keeps you company below the surface.</p></>}

      {tab === 'directory' && <main className="sw-screen-enter">
        {detail ? <>
          <button data-testid="button-directory-back" className="sw-back" onClick={() => setDetail(null)}><Icon name="back" size={17} />Example directory</button>
          <button data-testid="button-return-browsing" className="sw-help-link" onClick={() => changeTab('check')}><Icon name="back" size={16} />Return to Safari preview</button>
          <div className="sw-company-symbol sw-detail-logo">{detail.initials}</div>
          <p className="sw-eyebrow">{detail.category} · fictional company</p>
          <h1 className="sw-title">{detail.name}</h1><p className="sw-subtitle">{detail.detail}. A familiar port in unfamiliar waters.</p>
          <div className="sw-detail-card"><small>EXAMPLE LISTED CONTACT</small><p className="sw-number">{detail.number}</p><div className="sw-detail-facts"><div><span>Service</span><span>Travel support</span></div><div><span>Availability</span><span>{detail.hours}</span></div><div><span>Source</span><span>Prototype sample list</span></div></div><button data-testid="button-save-contact" className="sw-primary" onClick={() => saveContact(detail)}><Icon name="plus" size={18} />{saved.includes(detail.id) ? 'View saved contact' : 'Save to My Trips'}</button><button className="sw-secondary" onClick={() => { setInitialNumber(detail.number); setTab('check'); }}><Icon name="shield" size={18} />Prepare a manual demo check</button></div>
          <div className="sw-info-note"><Icon name="help" size={18} /><span>Not a real company or phone number. Calling is intentionally unavailable. For real travel support, use your booking or the company’s own app.</span></div>
        </> : <>
          <p className="sw-eyebrow">Support for your whole trip</p><h1 className="sw-title">From check-in<br /><span>to heading home.</span></h1><p className="sw-subtitle">Hotels, stays, rentals, bookings, and more.<br />Choose an example. Take one step at a time.</p>
          <div className="sw-input-wrap sw-directory-search"><Icon name="search" size={18} /><input data-testid="input-directory-search" aria-label="Search example directory" placeholder="Search companies or numbers" value={query} onChange={e => setQuery(e.target.value)} />{query && <button data-testid="button-clear-directory-search" className="sw-clear" onClick={() => setQuery('')} aria-label="Clear directory search"><Icon name="close" size={16} /></button>}</div>
          <div className="sw-filter-row">{['All', 'Hotels', 'Vacation rentals', 'Car rentals', 'Booking sites', 'Airlines', 'Rail & transfers', 'Cruises', 'Tours'].map(c => <button data-testid={`button-filter-${c.toLowerCase()}`} key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)} aria-pressed={category === c}>{c}</button>)}</div>
          <p className="sw-section-label">{filtered.length} example {filtered.length === 1 ? 'contact' : 'contacts'}</p>
          <div className="sw-company-list">{filtered.map(c => <button data-testid={`button-company-${c.id}`} className="sw-company" key={c.id} onClick={() => setDetail(c)}><span className="sw-company-symbol">{c.initials}</span><div className="sw-company-info"><strong>{c.name}</strong><p>{c.category} · fictional example</p></div><Icon name="arrow" size={17} /></button>)}</div>
          {!filtered.length && <div className="sw-empty"><Icon name="search" size={30} /><h3>Let’s try another way.</h3><p>No example contacts match. Try “hotel”, “rental”, or browse all travel contacts.</p><button className="sw-secondary" onClick={() => { setQuery(''); setCategory('All'); }}>Show all examples</button></div>}
          <div className="sw-info-note"><Icon name="book" size={18} /><span>This is a small, fictional directory for exploring the prototype. No entries have been verified against real companies.</span></div>
        </>}
      </main>}

      {tab === 'trips' && <main className="sw-screen-enter">
        <p className="sw-eyebrow">A little less to worry about</p><h1 className="sw-title">Your trip.<br /><span>Your backup plan.</span></h1><p className="sw-subtitle">Keep hotel, rental, and travel contacts together.<br />Example contacts saved here. No account needed.</p>
        <section className="sw-trip-hero"><div className="sw-trip-top"><span>My example trip</span><button data-testid="button-edit-trip" className="sw-trip-edit" aria-label="Edit trip name" onClick={() => { setDraftName(tripName); setEditingTrip(v => !v); }}><Icon name="edit" size={16} /></button></div><h2 data-testid="text-trip-name" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 21, marginTop: 4, overflowWrap: 'anywhere' }}>{tripName}</h2><div className="sw-trip-route"><span>JFK</span><Icon name="plane" size={26} /><span>LIS</span></div><div className="sw-trip-small"><span>New York</span><span>Lisbon</span></div>
          {editingTrip && <form className="sw-trip-form" onSubmit={e => { e.preventDefault(); if (!draftName.trim()) return; setTripName(draftName.trim()); setEditingTrip(false); try { localStorage.setItem('stillwater-demo-trip', draftName.trim()); } catch { /* Session-only storage fallback. */ } notify('Your trip has a new name.'); }}><label htmlFor="sw-trip-name">Give this trip a name</label><input id="sw-trip-name" value={draftName} maxLength={48} onChange={e => setDraftName(e.target.value)} required /><button className="sw-primary" type="submit">Save trip name<Icon name="check" size={17} /></button></form>}
        </section>
        <p className="sw-section-label">Your example contacts · {saved.length}</p>
        {saved.length ? <>{COMPANIES.filter(c => saved.includes(c.id)).map(c => <div key={c.id} className="sw-saved-row"><button className="sw-company-symbol" style={{ border: 0 }} onClick={() => { setTab('directory'); setDetail(c); }} aria-label={`View ${c.name}`}>{c.initials}</button><div className="sw-company-info"><strong>{c.name}</strong><p>{c.number}</p></div><button className="sw-remove" aria-label={`Remove ${c.name}`} onClick={() => setRemoveId(c.id)}><Icon name="trash" size={17} /></button></div>)}<button className="sw-secondary" onClick={() => { setTab('directory'); setDetail(null); }}><Icon name="plus" size={18} />Add an example contact</button></> : <div className="sw-empty"><Icon name="trip" size={32} /><h3>A little preparation goes far.</h3><p>Save a fictional airline, hotel, or rail contact. Your future self can take a breath.</p><button className="sw-primary" onClick={() => { setTab('directory'); setDetail(null); }}>Find an example contact<Icon name="arrow" size={18} /></button></div>}
        {removeId && <Sheet title="Let this contact go?" kicker="My Trips · saved locally" onClose={() => setRemoveId(null)}><p className="sw-sheet-description">Remove {COMPANIES.find(c => c.id === removeId)?.name} from this trip? You can save it again from Directory. Your trip name and other contacts stay as they are.</p><button data-testid="button-confirm-remove-contact" className="sw-secondary" onClick={() => removeContact(removeId)}><Icon name="trash" size={17} />Remove contact</button><button data-testid="button-keep-contact" className="sw-primary" onClick={() => setRemoveId(null)}>Keep it for the journey</button></Sheet>}
        <p className="sw-privacy"><Icon name="lock" size={14} /><span>Only example contacts are stored in this browser. This prototype doesn’t store real bookings or make phone calls.</span></p>
      </main>}
    </div>
    {toast && <div className="sw-toast" role="status">{toast}</div>}
    <nav className="sw-nav" aria-label="Main navigation">{([{ id: 'check', label: 'Check', icon: 'shield' }, { id: 'directory', label: 'Directory', icon: 'book' }, { id: 'trips', label: 'My Trips', icon: 'trip' }] as const).map(item => <button data-testid={`button-nav-${item.id}`} key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => changeTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}><Icon name={item.icon} size={22} /><span>{item.label}</span></button>)}</nav>
  </div>;
}
