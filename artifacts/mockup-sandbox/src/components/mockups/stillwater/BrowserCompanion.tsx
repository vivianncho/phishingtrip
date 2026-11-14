import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Fish, LockKeyhole, Search, Settings2, ShieldCheck, Sparkles, TriangleAlert, X } from 'lucide-react';
import './BrowserCompanion.css';

type Scenario = 'unverified' | 'official' | 'mismatch';
type Status = 'idle' | 'scanning' | 'official_match' | 'not_verified';
const scenarios = {
  unverified: { label: 'Unverified number', number: '+1 (202) 555-0116' },
  official: { label: 'Listed hotel number', number: '+1 (202) 555-0168' },
  mismatch: { label: 'Wrong hotel number', number: '+1 (202) 555-0187' },
};

function Hook({ status }: { status: Status }) {
  return <div className={`bc-fish ${status}`}><svg viewBox="0 0 190 130" fill="none" role="img" aria-label={`Hook the fish, ${status === 'scanning' ? 'checking the number' : status === 'official_match' ? 'resting' : 'keeping you company'}`}>
    <defs><linearGradient id="browser-hook-body" x1="70" y1="33" x2="120" y2="115" gradientUnits="userSpaceOnUse"><stop stopColor="#a2ffeb" /><stop offset="1" stopColor="#1996a6" /></linearGradient></defs>
    <path d="M61 65C41 51 24 37 24 47l6 25-6 23c0 10 25-7 41-17" fill="#288694" stroke="#71d8c5" />
    <path d="M82 43c4-22 22-30 24-12l5 15" fill="#29aea6" />
    <ellipse cx="102" cy="71" rx="50" ry="39" fill="url(#browser-hook-body)" />
    <path d="M57 82c28 15 65 18 88-2-9 25-32 33-51 28-18-4-30-12-37-26" fill="#b2ffe5" opacity=".4" />
    <path d="M108 35c-1-23 18-31 26-13" stroke="#6ae4cf" strokeWidth="2" />
    <circle cx="135" cy="23" r="7" fill="#a6ffea" /><circle cx="135" cy="23" r="14" fill="#3ef0d8" opacity=".08" />
    {status === 'official_match' ? <path d="M123 66q7 7 14-1" stroke="#153c4c" strokeWidth="3" strokeLinecap="round" /> : <><ellipse cx="130" cy="65" rx="8" ry="10" fill="#dbfff0" /><ellipse cx="133" cy="66" rx="5" ry="7" fill="#102d40" /><circle cx="134" cy="63" r="2" fill="#eafff4" /></>}
    <path d="M98 79c-6 18 7 29 19 5" fill="#239eaa" stroke="#7ae5d6" strokeOpacity=".5" /><path d="M86 61c-5 5-6 11-3 17m-9-15c-3 4-4 8-2 11" stroke="#1b8f99" strokeWidth="2" strokeLinecap="round" /><path d="M144 81q5 4 8-1" stroke="#205567" strokeWidth="2" strokeLinecap="round" />
    {status === 'not_verified' && <path d="M170 0v51c0 13-17 14-17 2v-5l5 6" stroke="#efab84" strokeWidth="2" />}
  </svg></div>;
}

export function BrowserCompanion() {
  const [scenario, setScenario] = useState<Scenario>('unverified');
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState(false);
  const [permission, setPermission] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const [alternative, setAlternative] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function select(next: Scenario) {
    if (timer.current) clearTimeout(timer.current);
    setScenario(next); setStatus('idle'); setEvidence(false); setAlternative(false);
  }
  function check() {
    setOpen(true);
    if (!permission) { setSettings(true); return; }
    setSettings(false); setEvidence(false); setAlternative(false); setStatus('scanning');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(scenario === 'official' ? 'official_match' : 'not_verified'), 1350);
  }
  const current = scenarios[scenario];
  return <div className="sw-browser-demo">
    <div className="bc-prototype-bar"><b>STILLWATER / BROWSER COMPANION</b><span>Interactive concept · fictional search results · not installed</span></div>
    <div className="bc-browser"><div className="bc-dots"><i /><i /><i /></div><ArrowLeft size={16} aria-hidden="true" /><ArrowRight size={16} aria-hidden="true" /><div className="bc-address">search.example / the cove hotel contact number</div><button className="bc-toolbar" onClick={() => setOpen(v => !v)} aria-expanded={open}><Fish size={19} />Stillwater</button></div>
    <div className="bc-layout">
      <main className="bc-search-page">
        <div className="bc-search-header"><span className="bc-search-logo">Search</span><div className="bc-search-box"><span>the cove hotel contact number</span><Search size={18} /></div></div>
        <div className="bc-search-tabs"><strong>All</strong><span>Maps</span><span>Images</span><span>More</span></div>
        <section className="bc-answer"><div className="bc-answer-label"><span><Sparkles size={13} style={{ display: 'inline', marginRight: 6 }} />AI answer</span><span>SIMULATED EXAMPLE</span></div><h2>Contact The Cove Hotel</h2><p>For questions about your reservation or a late arrival, contact the hotel’s guest support team.</p><div className="bc-inline-number"><span className="bc-number-chip">{current.number}</span><button className="bc-check-inline" onClick={check}><ShieldCheck size={14} />Check with Stillwater</button></div><p className="bc-caption">An AI answer or a search ranking is not proof that a number is official.</p></section>
        <article className="bc-result"><small>FICTIONAL SEARCH RESULT</small><span className="bc-domain">The Cove Hotel · thecove.example</span><h3>Reservations & guest support — The Cove Hotel</h3><p>Need help with an upcoming stay? Find arrival information, booking support, and ways to contact our team.</p></article>
        <article className="bc-result"><small>FICTIONAL SEARCH RESULT</small><span className="bc-domain">Travel journal · shoreguide.example</span><h3>A quieter stay by the water</h3><p>Planning a little time away? A guide to arrivals, rooms, and the neighborhood.</p></article>
        <section className="bc-scene-controls" aria-label="Prototype scenarios"><span>Explore the demo</span><div className="bc-scene-buttons">{(Object.keys(scenarios) as Scenario[]).map(id => <button key={id} aria-pressed={scenario === id} onClick={() => select(id)}>{scenarios[id].label}</button>)}</div></section>
      </main>
      {!open ? <aside className="bc-closed"><Fish size={40} color="#3ef0d8" /><h2>Here when you need us.</h2><p>Open Stillwater to check the example number before making a call.</p><button className="bc-primary" onClick={() => setOpen(true)}>Open companion<ArrowRight size={16} /></button></aside> : <aside className="bc-panel" aria-label="Stillwater browser extension concept">
        <header className="bc-panel-header"><div className="bc-brand"><Fish size={26} />stillwater</div><div style={{ display: 'flex', gap: 6 }}><button className="bc-settings" onClick={() => setSettings(v => !v)} aria-label="Check permissions" aria-expanded={settings}><Settings2 size={16} /></button><button className="bc-settings" onClick={() => setOpen(false)} aria-label="Close companion"><X size={16} /></button></div></header>
        <p className="bc-panel-kicker">A little calm. Right where you search.</p><h1>Before you call,<br />check the source.</h1><p className="bc-panel-intro">AI answers can get numbers wrong.<br />Hook helps you take a second look.</p>
        {settings ? <section className="bc-permission"><h3>You choose what to check.</h3><p>This demo checks only the number you select. It does not read your search history or send page text. A real extension would request permission separately.</p><div className="bc-toggle-row"><span>Allow this demo check</span><button className="bc-toggle" role="switch" aria-checked={permission} aria-label="Allow selected-number demo checks" onClick={() => setPermission(v => !v)}><i /></button></div><button className="bc-primary" onClick={() => { if (!permission) setPermission(true); setSettings(false); }}>Use selected numbers only<Check size={16} /></button></section> : <Hook status={status} />}
        <div className="bc-contact"><small>SELECTED NUMBER · HOTEL</small><strong>{current.number}</strong><p>The Cove Hotel · fictional example</p></div>
        <div aria-live="polite">
          <div className={`bc-status ${status}`}>{status === 'official_match' ? <ShieldCheck size={17} /> : status === 'not_verified' ? <TriangleAlert size={17} /> : <Search size={17} />}{status === 'idle' ? 'Not checked yet' : status === 'scanning' ? 'Checking the example source…' : status === 'official_match' ? 'Matches an example listing' : 'Not verified'}</div>
          {status === 'scanning' ? <div role="status" aria-label="Checking example source"><div className="bc-skeleton" /><div className="bc-skeleton" /></div> : <p className="bc-explanation">{status === 'idle' ? 'A number in an AI answer is just a starting point. Check it before you call.' : status === 'official_match' ? 'This number matches our fictional hotel listing. A match is not a safety guarantee or proof of who is calling.' : scenario === 'mismatch' ? 'This differs from the example hotel listing. A mismatch alone does not mean scam. Use your booking or the hotel’s own site.' : 'We do not have enough evidence to confirm this number. Unknown does not mean scam. You still have another way to get help.'}</p>}
        </div>
        {status === 'idle' || status === 'scanning' ? <button className="bc-primary" onClick={check} disabled={status === 'scanning'}><ShieldCheck size={17} />{status === 'scanning' ? 'One moment…' : 'Check this number'}<ArrowRight size={16} /></button> : <><button className="bc-primary" onClick={() => setAlternative(v => !v)}>{status === 'official_match' ? 'View example source' : 'Find a listed alternative'}<ArrowRight size={16} /></button>{alternative && <div className="bc-source"><strong>The Cove Hotel · example listing</strong><p>+1 (202) 555-0168<br />thecove.example/contact<br />Fictional source for this demo. No real calls or external checks are made.</p></div>}<button className="bc-secondary" onClick={() => setEvidence(v => !v)} aria-expanded={evidence}>Why this result?<ChevronDown size={15} /></button>{evidence && <div className="bc-source">{status === 'official_match' ? 'Exact match with the fictional 0168 listing.' : 'No exact match with the fictional 0168 listing.'} No reputation reports were checked. The simulated AI answer is not verification evidence.</div>}</>}
        <p className="bc-privacy"><LockKeyhole size={12} />Only the number you choose. Not your whole page. This prototype sends nothing.</p>
        <p className="bc-footnote">Extension design preview, not an installed extension. Safari on iPhone and desktop browsers need separate extension packages. No Google affiliation.</p>
      </aside>}
    </div>
  </div>;
}
