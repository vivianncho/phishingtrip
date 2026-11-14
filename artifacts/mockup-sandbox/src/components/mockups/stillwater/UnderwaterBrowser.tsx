import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Fish, LockKeyhole, Search, ShieldCheck, Sparkles, TriangleAlert, Waves, X } from 'lucide-react';
import './UnderwaterBrowser.css';

type Example = 'official' | 'reports' | 'unknown';
type Phase = 'idle' | 'swimming' | 'result';
const examples = {
  official: { label: 'Listed hotel number', number: '+1 (202) 555-0168', verdict: 'Official match', bubble: 'A match. Here’s the source.', note: 'This matches the fictional hotel’s listed contact. A match does not authenticate an incoming caller or guarantee safety.' },
  reports: { label: 'Scam-report example', number: '+1 (202) 555-0187', verdict: 'Reports found · demo', bubble: 'Reports found. Pause before calling.', note: 'In this invented scenario, reviewed reports describe urgent room-payment requests. Reports are a warning, not a definitive fraud ruling.' },
  unknown: { label: 'Unknown number', number: '+1 (202) 555-0116', verdict: 'Not verified', bubble: 'Not enough clues. Let’s check another way.', note: 'No current source confirms this number. Unknown does not mean scam. Use your original booking to reach the hotel.' },
};

function SwimmingHook({ sleeping }: { sleeping: boolean }) {
  const id = useId();
  return <svg viewBox="0 0 190 130" fill="none" role="img" aria-label="Hook swimming toward the selected number">
    <defs><linearGradient id={id} x1="70" y1="25" x2="140" y2="120" gradientUnits="userSpaceOnUse"><stop stopColor="#afffe7" /><stop offset=".5" stopColor="#59d8c5" /><stop offset="1" stopColor="#16849a" /></linearGradient></defs>
    <g className="ub-tail"><path d="M65 65C43 51 20 36 23 48l7 24-7 22c-3 13 27-5 45-17" fill="#2b8b98" stroke="#7ae2cd" /><path d="m28 49 29 21-30 21" stroke="#a3e8d2" strokeOpacity=".4" /></g>
    <path d="M83 42c2-22 22-31 23-13l4 15" fill="#2eb4aa" /><ellipse cx="103" cy="72" rx="51" ry="39" fill={`url(#${id})`} /><path d="M56 82c30 14 66 17 91-3-10 25-34 34-53 28-20-4-32-11-38-25" fill="#d2ffe8" opacity=".35" /><path d="M73 51q18-13 34-11" stroke="#d9ffeb" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
    <path d="M108 36c-1-24 18-33 27-13" stroke="#67e2c7" strokeWidth="2" /><circle cx="136" cy="24" r="18" fill="#3ef0d8" opacity=".06" /><circle cx="136" cy="24" r="6" fill="#c5ffdc" />
    {sleeping ? <path d="M123 66q8 7 15-1" stroke="#153c4c" strokeWidth="3" strokeLinecap="round" /> : <><ellipse cx="131" cy="66" rx="8.5" ry="10" fill="#e0fff1" /><ellipse cx="134" cy="67" rx="5" ry="7" fill="#173647" /><circle cx="135" cy="64" r="2" fill="#eafff4" /></>}
    <path d="M100 81c-7 19 7 28 19 4" fill="#2197a2" stroke="#8fe6d0" strokeOpacity=".5" /><path d="M85 62c-5 5-6 11-3 16m-9-13c-3 4-4 8-2 10" stroke="#238b93" strokeWidth="2" strokeLinecap="round" /><path d="M145 82q5 3 8-1" stroke="#215968" strokeWidth="2" strokeLinecap="round" /><circle cx="66" cy="77" r="1.5" fill="#c9ffe1" />
  </svg>;
}

export function UnderwaterBrowser() {
  const [example, setExample] = useState<Example>('official');
  const [phase, setPhase] = useState<Phase>('idle');
  const [depth, setDepth] = useState(0);
  const [details, setDetails] = useState(false);
  const [alternative, setAlternative] = useState(false);
  const [panel, setPanel] = useState(true);
  const [motionOff, setMotionOff] = useState(false);
  const [fishPosition, setFishPosition] = useState({ x: 185, y: 220 });
  const prefersReduced = useReducedMotion();
  const reduced = motionOff || prefersReduced;
  const scroll = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = examples[example];
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const width = stage.current?.clientWidth || 900;
    setFishPosition({ x: width > 700 ? width * .46 : Math.max(10, width - 145), y: width > 700 ? 325 : 70 });
  }, []);
  function reset(next: Example) {
    if (timer.current) clearTimeout(timer.current);
    const width = stage.current?.clientWidth || 900;
    setExample(next); setPhase('idle'); setDetails(false); setAlternative(false); setFishPosition({ x: width > 700 ? width * .46 : Math.max(10, width - 145), y: width > 700 ? 325 : 70 });
  }
  function check() {
    if (!stage.current || !target.current) return;
    if (timer.current) clearTimeout(timer.current);
    const box = stage.current.getBoundingClientRect();
    const number = target.current.getBoundingClientRect();
    setPanel(true); setPhase('swimming'); setDetails(false); setAlternative(false);
    setFishPosition({ x: Math.max(10, number.right - box.left - 64), y: number.top - box.top - 96 });
    timer.current = setTimeout(() => setPhase('result'), reduced ? 350 : 1800);
  }
  const showResult = phase === 'result';
  return <div className={`ub-world ${reduced ? 'ub-no-motion' : ''}`} style={{ '--depth': depth } as CSSProperties}>
    <div className="ub-sea" aria-hidden="true"><div className="ub-deep" /><div className="ub-sun" /><div className="ub-surface" />{Array.from({ length: 18 }, (_, i) => <i key={i} className="ub-bubble" style={{ left: `${4 + (i * 17) % 94}%`, top: `${20 + (i * 13) % 78}%`, animationDelay: `${-i * 1.7}s`, width: i % 3 ? 4 : 8, height: i % 3 ? 4 : 8 }} />)}</div>
    <div className="ub-depth-meter" aria-hidden="true"><span>00</span><i /><span>{Math.round(depth * 120)} M</span></div>
    <div ref={scroll} className="ub-scroll" onScroll={event => { const el = event.currentTarget; setDepth(Math.min(1, el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight))); }}>
      <div className="ub-wrap">
        <header className="ub-header"><div className="ub-logo"><Fish size={29} strokeWidth={1.3} />Phishing Trip</div><div className="ub-header-meta"><span>SLEEP WITH THE PHISHES.</span><button className="ub-motion-switch" onClick={() => setMotionOff(v => !v)} aria-pressed={motionOff}><Waves size={15} /><span>Motion {motionOff ? 'off' : 'on'}</span></button><span className="ub-pill">INTERACTIVE DEMO</span></div></header>
        <section className="ub-intro"><div><p className="ub-eyebrow"><i />A second look. A little less worry.</p><h1>Search the web.<br /><span>Let Hook check the waters.</span></h1></div><p className="ub-intro-copy">A number in an AI answer isn’t proof.<br />Choose a number. Hook follows the clues.<br />You stay in control of the call.</p></section>
        <div className="ub-browser">
          <div className="ub-browser-toolbar"><div className="ub-dots"><i /><i /><i /></div><ArrowLeft size={13} /><div className="ub-url"><LockKeyhole size={10} />search.example / the cove hotel phone number</div><button className="ub-extension" onClick={() => setPanel(v => !v)} aria-expanded={panel}><Fish size={15} />Phishing Trip</button></div>
          <div className="ub-body" ref={stage}>
            <main className="ub-page">
              <div className="ub-searchbar"><span className="ub-searchlogo">Search</span><div className="ub-query"><span>the cove hotel phone number</span><Search size={15} /></div></div>
              <div className="ub-tabs"><strong>All</strong><span>Maps</span><span>Images</span><span>More</span></div>
              <section className="ub-ai"><div className="ub-ai-top"><span><Sparkles size={12} />AI overview</span><span>Fictional search page</span></div><h2>How to contact The Cove Hotel</h2><p>For reservations, late arrivals, or a question about your stay, you can reach the hotel’s guest support team at:</p><div className="ub-number"><button ref={target} className={`ub-number-button ${showResult ? 'checked' : ''}`} onClick={check} aria-label={`Check selected example number ${current.number}`}>{current.number}</button><button className="ub-inline-check" onClick={check} disabled={phase === 'swimming'}><Fish size={16} />{phase === 'swimming' ? 'Hook is on the way…' : 'Send Hook to check'}</button></div>{showResult ? <p className={`ub-result-label ${example === 'reports' ? 'report' : example === 'unknown' ? 'unknown' : ''}`}>{example === 'official' ? <ShieldCheck size={13} /> : <TriangleAlert size={13} />}{current.verdict} · See evidence on the side</p> : <p style={{ fontSize: 9 }}>This answer is simulated. It is not verification evidence.</p>}</section>
              <article className="ub-search-result"><small>EXAMPLE ORGANIC RESULT</small><div className="ub-result-domain"><i>c.</i>The Cove Hotel · thecove.example</div><h3>Reservations & guest support — The Cove Hotel</h3><p>A quieter arrival starts here. Find check-in information, reservation help, and the contact details for your upcoming stay.</p></article>
              <article className="ub-search-result"><small>EXAMPLE TRAVEL GUIDE</small><div className="ub-result-domain"><i>s.</i>Shore Guide · shoreguide.example</div><h3>Your first evening by the water</h3><p>Where to stay, how to arrive, and a few places worth slowing down for.</p></article>
              <div className="ub-more-results"><h4>People also ask</h4><div>What time is check-in?<ChevronDown size={13} /></div><div>How do I change my hotel reservation?<ChevronDown size={13} /></div><div>What if I’m arriving late?<ChevronDown size={13} /></div></div>
            </main>
            <motion.div className="ub-flight-fish" animate={{ x: fishPosition.x, y: fishPosition.y }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 44, damping: 15, mass: 1.3 }} initial={false}>{showResult && <span className="ub-fish-word" role="status">{current.bubble}</span>}<SwimmingHook sleeping={showResult && example === 'official'} /></motion.div>
            <aside className="ub-side" aria-label="Number evidence panel">
              {panel ? <><div className="ub-side-top"><div className="ub-side-brand"><Fish size={22} />Phishing Trip</div><button className="ub-icon-button" aria-label="Close evidence panel" onClick={() => setPanel(false)}><X size={15} /></button></div><h2>Under the surface.<br />Not a guess.</h2><p className="ub-side-intro">Hook looks for evidence.<br />You get the reason, not just a verdict.</p>
                <section className="ub-status-card" aria-live="polite"><div className={`ub-status-heading ${showResult ? example : ''}`}>{showResult && example === 'official' ? <ShieldCheck size={16} /> : showResult ? <TriangleAlert size={16} /> : <Search size={16} />}{phase === 'idle' ? 'Ready when you are' : phase === 'swimming' ? 'Following the clues…' : current.verdict}</div><div className="ub-side-number">{current.number}</div><div className="ub-side-company">The Cove Hotel · fictional example</div>{phase === 'swimming' ? <><div className="ub-skeleton" /><div className="ub-skeleton" style={{ width: '65%' }} /></> : <p className="ub-conclusion">{showResult ? current.note : 'Tap the number or send Hook over. This demo checks only the number you choose.'}</p>}</section>
                <div className="ub-evidence-title"><span>WHAT WE FOUND</span><span>{showResult ? 'DEMO EVIDENCE' : 'AWAITING YOUR CHECK'}</span></div>
                {showResult ? <><div className="ub-evidence-row">{example === 'official' ? <Check size={14} /> : <Search size={14} />}<div><strong>{example === 'official' ? 'Exact listed-number match' : 'No official match for this number'}</strong><p>Example listed contact: +1 (202) 555-0168</p><code>thecove.example/contact</code></div></div><div className="ub-evidence-row">{example === 'reports' ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />}<div><strong>{example === 'reports' ? 'Invented payment-pressure reports' : 'No reputation check performed'}</strong><p>{example === 'reports' ? 'Fictional reviewed reports describe urgent payments to keep a room. No real report feed is connected.' : 'No report data is available in this demo. Missing reports are not proof of safety.'}</p></div></div><button className="ub-secondary" onClick={() => setDetails(v => !v)} aria-expanded={details}>Source and decision details<ChevronDown size={13} /></button>{details && <div className="ub-source-details">Source: prototype-only fictional listing.<br />Review: demo snapshot, not a live review.<br />The AI answer, search rank, and number format do not verify ownership. {example === 'reports' ? 'Reports shown here are invented educational evidence, not allegations about a real number.' : 'This result is not a safety guarantee.'}</div>}<button className="ub-primary" onClick={() => setAlternative(v => !v)}>{example === 'official' ? 'View the example source' : 'Find another way to contact'}<ArrowRight size={14} /></button>{alternative && <div className="ub-source-details"><strong>Example hotel contact</strong><br />+1 (202) 555-0168<br />thecove.example/contact<br />For a real stay, open your original booking or the hotel’s own app. No calls are made here.</div>}<button className="ub-secondary" onClick={check}><Fish size={14} />Replay Hook’s swim</button></> : <><div className="ub-evidence-row"><LockKeyhole size={15} /><div><strong>Your choice. Your number.</strong><p>No automatic scanning. No search history or page text is sent.</p></div></div><button className="ub-primary" onClick={check} disabled={phase === 'swimming'}><Fish size={16} />{phase === 'swimming' ? 'Hook is checking…' : 'Check selected number'}<ArrowRight size={14} /></button></>}
                <p className="ub-private"><LockKeyhole size={12} />Local design demo. All companies, numbers, and reports here are fictional. No live lookup. Not an installed extension.</p>
              </> : <div className="ub-closed-note"><Fish size={42} /><h2>Here when you need us.</h2><p>Hook can still point out the number.<br />Open the panel to see the evidence.</p><button className="ub-primary" onClick={() => setPanel(true)}>Open evidence panel<ArrowRight size={14} /></button></div>}
            </aside>
          </div>
        </div>
        <section className="ub-scenarios" aria-label="Try demo evidence scenarios"><p><strong>Different clues. Different outcomes.</strong>Try an example and send Hook to the number.</p><div className="ub-scenario-buttons">{(Object.keys(examples) as Example[]).map(key => <button key={key} aria-pressed={example === key} onClick={() => reset(key)}>{examples[key].label}</button>)}</div></section>
        <div className="ub-dive-note"><ArrowDown size={12} />Scroll deeper. The water gets quieter.</div>
        <section className="ub-below"><div><p className="ub-eyebrow"><Waves size={15} />Less panic. More perspective.</p><h2>Some things deserve<br /><span>a deeper look.</span></h2><p>A rushed call can turn a small travel problem into a bigger one. Hook gives you a moment to pause—and a clear way forward.</p></div><div className="ub-steps"><div className="ub-step"><small>01 / YOU CHOOSE</small><h3>Pick the number. Not the whole page.</h3><p>Checking starts with your tap, never with background browsing.</p></div><div className="ub-step"><small>02 / HOOK FOLLOWS THE CLUES</small><h3>A source matters more than a search rank.</h3><p>See what matched, where it came from, and what couldn’t be confirmed.</p></div><div className="ub-step"><small>03 / YOU TAKE THE NEXT STEP</small><h3>Unknown isn’t the same as unsafe.</h3><p>When the evidence is thin, go back to your booking or the company’s own app.</p></div></div></section>
        <footer className="ub-footer"><span>Sleep with the phishes.<br />Interactive design concept · no Google affiliation.</span><button onClick={() => scroll.current?.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })}>Back to the surface<ArrowUp size={13} /></button></footer>
      </div>
    </div>
  </div>;
}
