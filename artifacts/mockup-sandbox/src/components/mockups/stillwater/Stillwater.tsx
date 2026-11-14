import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { SafariCompanion, Sheet } from './SafariCompanion';
import './_group.css';
import './BrowserCompanion.css';

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
  const fishId = useId();
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
      <svg key={tick} className="sw-fish-art" viewBox="0 0 300 210" fill="none" role="img" aria-label={`Hook the fish, ${state}`}>
        <defs>
          <linearGradient id={`${fishId}-body`} x1="134" y1="46" x2="189" y2="161" gradientUnits="userSpaceOnUse"><stop stopColor="#a2ffeb" /><stop offset=".45" stopColor="#52dbc8" /><stop offset="1" stopColor="#158b99" /></linearGradient>
          <linearGradient id={`${fishId}-tail`} x1="50" y1="90" x2="109" y2="127"><stop stopColor="#1c7488" /><stop offset="1" stopColor="#63ebd7" /></linearGradient>
          <linearGradient id={`${fishId}-belly`} x1="120" y1="120" x2="190" y2="160"><stop stopColor="#d4fff0" stopOpacity=".7" /><stop offset="1" stopColor="#89f5da" stopOpacity=".1" /></linearGradient>
          <radialGradient id={`${fishId}-lantern`}><stop stopColor="#c9fff5" /><stop offset=".3" stopColor="#3ef0d8" stopOpacity=".4" /><stop offset="1" stopColor="#3ef0d8" stopOpacity="0" /></radialGradient>
        </defs>
        <g className="sw-hook"><path d="M258 0v76c0 21-28 24-28 4v-9l8 9" stroke="#ff858b" strokeWidth="3" strokeLinecap="round" /><path d="M258 0v45" stroke="#6d879d" strokeWidth="1.5" /></g>
        <g className="sw-tail"><path d="M106 101C86 93 66 71 55 76c-7 4 7 26 8 32 1 9-9 25-4 30 8 8 31-11 48-12" fill={`url(#${fishId}-tail)`} stroke="#72ead6" strokeOpacity=".45" /><path d="m63 87 34 23-35 17m10-22 24 7" stroke="#a1fce5" strokeOpacity=".4" strokeWidth="1.4" /></g>
        <path d="M125 70c4-21 23-34 30-30 7 4 4 17 10 28" fill="#2cb5ab" stroke="#85eed6" strokeOpacity=".4" />
        <path d="M105 90c13-30 46-42 76-30 31 12 54 41 49 62-5 23-39 43-74 39-39-4-68-31-51-71Z" fill={`url(#${fishId}-body)`} />
        <path d="M109 118c22 13 59 22 111 12-13 24-42 33-64 30-26-2-43-15-47-42Z" fill={`url(#${fishId}-belly)`} />
        <path d="M121 82c11-12 28-16 44-14" stroke="#e1fff1" strokeOpacity=".65" strokeWidth="3" strokeLinecap="round" />
        <path d="M174 63c-2-26 18-37 31-22" stroke="#6ae4cf" strokeWidth="2" strokeLinecap="round" /><circle cx="208" cy="44" r="28" fill={`url(#${fishId}-lantern)`} /><circle cx="208" cy="44" r="6" fill="#baffec" /><circle cx="207" cy="42" r="2" fill="#e7fff5" />
        <g className="sw-fin"><path d="M163 117c-4 7-7 26 2 31 9 5 20-12 22-24-10 0-17-3-24-7Z" fill="#239eaa" stroke="#7ae5d6" strokeOpacity=".6" /><path d="m168 123 1 17m5-14 1 8" stroke="#a2ffe5" strokeOpacity=".3" /></g>
        <path className="sw-gill" d="M151 92c-6 7-7 13-4 19m-7-22c-5 5-7 10-6 15" stroke="#136f80" strokeWidth="2" strokeLinecap="round" />
        <g className="sw-eye-open"><ellipse cx="196" cy="95" rx="10" ry="12" fill="#e1fff1" /><ellipse cx="199" cy="96" rx="6.5" ry="8.5" fill="#102d40" /><circle cx="201" cy="92" r="2.6" fill="#eafff4" /></g>
        <path className="sw-eye-sleep" d="M188 98q9 8 18-2" stroke="#143e4b" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="208" cy="113" rx="7" ry="3.5" fill="#89e3cf" opacity=".7" /><path d="M218 113q5 5 10 1" stroke="#135668" strokeWidth="2" strokeLinecap="round" />
        <circle cx="119" cy="109" r="2" fill="#b6fbe4" opacity=".7" /><circle cx="127" cy="119" r="1.7" fill="#b6fbe4" opacity=".5" /><circle cx="125" cy="99" r="1.3" fill="#b6fbe4" opacity=".7" />
        <g className="sw-search-waves" stroke="#3ef0d8" strokeWidth="1.5" strokeLinecap="round"><path d="M240 88q9 12 0 24m9-31q16 19 0 38m9-45q23 26 0 52" /></g>
        <g className="sw-sleep-letters" fill="#83bfce" fontFamily="Space Grotesk" fontWeight="500"><text x="239" y="74" fontSize="13">z</text><text x="254" y="58" fontSize="17">z</text></g>
      </svg>
    </button>
    <p className="sw-fish-caption" aria-live="polite"><Icon name={state === 'suspicious' ? 'alert' : state === 'unverified' ? 'help' : 'spark'} size={12} />{captions[state]}</p>
  </div>;
}

export function Stillwater() {
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
  return <div className="stillwater">
    <div className="sw-shell">
      <header className="sw-header">
        <div className="sw-brand"><svg className="sw-brand-mark" width="29" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 17C11 7 24 8 29 17c-5 9-18 10-22 0ZM7 17 2 11v12l5-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="23" cy="16" r="1.3" fill="currentColor" /><path d="M17 10c0-5 4-6 6-4" stroke="currentColor" strokeWidth="1.4" /><circle cx="24" cy="7" r="2" fill="currentColor" /></svg><div><div className="sw-brand-name">stillwater</div><p className="sw-slogan">Sleep with the phishes.</p></div></div>
        <span className="sw-demo-badge">LOCAL DEMO</span>
      </header>

      {tab === 'check' && <><SafariCompanion initialNumber={initialNumber} exampleContacts={COMPANIES} onOfficialContact={openDirectory} renderFish={(state, tick, onActivate, label) => <Fish state={state} tick={tick} onActivate={onActivate} label={label} compact />} /><button className="bc-link-card" onClick={() => window.open('/__mockup/preview/stillwater/BrowserCompanion', '_blank', 'noopener,noreferrer')}><Icon name="shield" size={23} /><span><strong>Check right where you search.</strong><small>Explore the desktop extension concept.<br />A second look at numbers in AI answers.</small></span><Icon name="arrow" size={17} /></button></>}

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
