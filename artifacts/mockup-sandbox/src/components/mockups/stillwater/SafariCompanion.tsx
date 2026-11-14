import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

export type CompanionFishState = 'idle' | 'searching' | 'official' | 'suspicious' | 'unverified';
type Verdict = 'official' | 'suspicious' | 'unverified';
type Phase = 'idle' | 'swimming' | 'checking' | 'result';
type Target = { id: Verdict; number: string; title: string; source: string; domain: string; description: string };
type Check = { verdict: Verdict; number: string; company: string };
const TARGETS: Target[] = [
  { id: 'official', number: '+1 (202) 555-0142', title: 'Aster Air | Changes & reservations', source: 'Aster Air · sample official page', domain: 'aster-air.example / contact', description: 'Plans changed? Our sample help desk handles reservations and flight changes.' },
  { id: 'suspicious', number: '+1 (202) 555-0187', title: 'Aster Air support — change your flight', source: 'Travel Help Desk · sample listing', domain: 'travel-help.example / aster-air', description: 'An independent listing claiming airline support. A familiar name is not proof of a connection.' },
  { id: 'unverified', number: '+1 (202) 555-0116', title: 'Aster Air contact shared by travelers', source: 'Journey Board · sample discussion', domain: 'journey-board.example / discussion', description: 'A number shared in a sample travel discussion. Its relationship to the airline is unclear.' },
];
const LABELS: Record<Verdict, string> = { official: 'Official match', suspicious: 'Reports found', unverified: 'Not verified' };
const SUMMARIES: Record<Verdict, string> = {
  official: 'Matches the example company’s listed contact. A clue, not a guarantee.',
  suspicious: 'Invented reports and conflicting sources. Pause before paying.',
  unverified: 'Too little sample evidence. Unknown does not mean safe—or fraudulent.',
};
function Mark({ kind, size = 18 }: { kind: Verdict | 'arrow' | 'close' | 'lock' | 'help' | 'search' | 'back'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'official' ? <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8 12 3 3 5-6" /></> : kind === 'suspicious' ? <><path d="m12 3 10 18H2zM12 9v5m0 3h.01" /></> : kind === 'arrow' ? <path d="M4 12h16m-6-6 6 6-6 6" /> : kind === 'close' ? <path d="m6 6 12 12M6 18 18 6" /> : kind === 'lock' ? <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></> : kind === 'search' ? <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></> : kind === 'back' ? <path d="m15 5-7 7 7 7" /> : <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01" /></>}
  </svg>;
}

export function Sheet({ title, kicker, children, onClose }: { title: string; kicker: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('.sw-nav button[aria-current="page"]')?.focus();
    };
  }, []);
  return <dialog ref={ref} className="sw-sheet-backdrop sw-sheet-dialog" aria-modal="true" aria-labelledby={id} onCancel={e => { e.preventDefault(); closeRef.current(); }} onClick={e => { if (e.target === e.currentTarget) closeRef.current(); }} onKeyDown={e => {
    if (e.key !== 'Tab') return;
    const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href], [tabindex="0"]') || []);
    const first = elements[0]; const last = elements[elements.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }}>
    <section className="sw-sheet">
      <div className="sw-sheet-header"><div><p className="sw-sheet-kicker">{kicker}</p><h2 id={id}>{title}</h2></div><button className="sw-sheet-close" data-testid="button-close-sheet" onClick={onClose} aria-label={`Close ${title}`}><Mark kind="close" /></button></div>
      {children}
    </section>
  </dialog>;
}

export function SafariCompanion({ renderFish, onOfficialContact, initialNumber, exampleContacts }: {
  renderFish: (state: CompanionFishState, tick: number, onActivate: () => void, label: string) => ReactNode;
  onOfficialContact: (number?: string) => void;
  initialNumber?: string;
  exampleContacts: { name: string; number: string }[];
}) {
  const [mode, setMode] = useState<'safari' | 'manual'>(initialNumber ? 'manual' : 'safari');
  const [selected, setSelected] = useState<Verdict>('official');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Check | null>(null);
  const [sheet, setSheet] = useState<'evidence' | 'help' | null>(null);
  const [input, setInput] = useState(initialNumber || '');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [enabledPreview, setEnabledPreview] = useState(false);
  const [announcement, setAnnouncement] = useState('Hook is waiting beside the first number. Tap Hook to start a local demo check.');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const generation = useRef(0);
  const targetElements = useRef<Record<string, HTMLElement | null>>({});
  function cancel() {
    generation.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  useEffect(() => () => { generation.current += 1; timers.current.forEach(clearTimeout); }, []);
  function reset(message = 'Demo reset. Tap Hook beside any number to check again.') {
    cancel(); setPhase('idle'); setResult(null); setSheet(null); setTick(v => v + 1); setAnnouncement(message);
  }
  function changeMode(next: typeof mode) { reset(next === 'safari' ? 'Back in the Safari preview. Tap Hook to check.' : 'Manual demo. Enter a number; nothing is sent.'); setMode(next); setError(''); }
  function choose(id: Verdict) {
    reset(`${LABELS[id]} scene selected. Tap Hook beside ${TARGETS.find(t => t.id === id)?.number} to begin.`); setSelected(id);
    if (mode === 'safari') targetElements.current[id]?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  function check(number: string, verdict: Verdict, company = 'Aster Air') {
    cancel();
    const request = generation.current;
    setResult(null); setSheet(null); setSelected(verdict); setPhase('swimming'); setTick(v => v + 1); setError('');
    setAnnouncement(`Hook is swimming to ${number}. Local simulation only.`);
    timers.current.push(setTimeout(() => {
      if (request !== generation.current) return;
      setPhase('checking'); setAnnouncement(`Checking illustrative sources for ${number}. No live lookup.`);
    }, 720));
    timers.current.push(setTimeout(() => {
      if (request !== generation.current) return;
      setResult({ verdict, number, company }); setPhase('result'); setTick(v => v + 1);
      setAnnouncement(`${LABELS[verdict]} for ${number}. ${SUMMARIES[verdict]} Open the result to read the example evidence.`);
    }, 2220));
  }
  function runManual() {
    const value = input.trim();
    if (!value) { setError('Give Hook a number or a fictional company name first.'); return; }
    const digits = value.replace(/\D/g, '');
    const target = TARGETS.find(t => t.number.replace(/\D/g, '').replace(/^1/, '') === digits.replace(/^1/, ''));
    const company = exampleContacts.find(c => c.name.toLowerCase() === value.toLowerCase() || c.number.replace(/\D/g, '').replace(/^1/, '') === digits.replace(/^1/, ''));
    if (company) check(company.number, 'official', company.name);
    else check(target?.number || value, target?.id || 'unverified', target ? 'Aster Air' : 'Not supplied · no company inferred');
  }
  function submit(e: FormEvent) { e.preventDefault(); runManual(); }
  function resultButton(checkResult: Check) {
    return <button data-testid={`button-evidence-${checkResult.verdict}`} className={`sw-target-status ${checkResult.verdict}`} onClick={() => setSheet('evidence')}>
      <Mark kind={checkResult.verdict} /><span>{LABELS[checkResult.verdict]}<small>{checkResult.verdict === 'official' ? 'Example directory match · see evidence' : checkResult.verdict === 'suspicious' ? 'Invented reports · see evidence' : 'Missing evidence · see what’s unknown'}</small></span><Mark kind="arrow" size={16} />
    </button>;
  }
  const working = phase === 'swimming' || phase === 'checking';
  const listedContact = exampleContacts.find(c => c.name === result?.company) || exampleContacts[0];
  return <main className="sw-browser-screen">
    <div className="sw-companion-layout">
      <aside className="sw-introduction">
        <div className="sw-preview-label"><span className="sw-dot" />Safari companion · local preview</div>
        <h1 className="sw-title">Coast is clear?<br /><span>Check with Hook.</span></h1>
        <p className="sw-subtitle">Fishing for travel support? Watch for phishing. Let Hook look at the clues before you call.</p>
        <div className="sw-intro-note"><strong>You tap. Hook checks.</strong>Try a fish beside a number. Hook will swim over, check sample clues, then show what they do—and don’t—tell us.</div>
        <button data-testid="button-safari-help" className="sw-help-link" onClick={() => setSheet('help')}><Mark kind="help" size={18} />How this would work in Safari<Mark kind="arrow" size={15} /></button>
        <div className="sw-view-switch" aria-label="Check mode">
          <button data-testid="button-mode-safari" aria-pressed={mode === 'safari'} onClick={() => changeMode('safari')}>Safari preview</button>
          <button data-testid="button-mode-manual" aria-pressed={mode === 'manual'} onClick={() => changeMode('manual')}>Enter manually</button>
        </div>
        <p className="sw-section-label">Three waters to explore</p>
        <div className="sw-scenarios">{TARGETS.map(t => <button data-testid={`button-scenario-${t.id}`} className={`sw-scenario ${selected === t.id ? 'sw-scenario-selected' : ''}`} key={t.id} aria-pressed={selected === t.id} onClick={() => { choose(t.id); if (mode === 'manual') setInput(t.number); }}><Mark kind={t.id} size={13} />{LABELS[t.id]}</button>)}</div>
        <p className="sw-local-status" role="status" aria-live="polite" aria-atomic="true" data-testid="status-companion">{announcement}</p>
        <p className="sw-privacy"><Mark kind="lock" size={15} /><span>A local, interactive design—not a working extension. Fictional companies and numbers. No searches, page content, or numbers leave this prototype. No live verification. No calls.</span></p>
      </aside>
      <section aria-label={mode === 'safari' ? 'Fictional Safari browsing scene' : 'Manual example check'}>
        {mode === 'safari' ? <>
          <div className="sw-scene-label"><span>01 / A moment before the call</span><span>Simulated Safari</span></div>
          <div className="sw-browser">
            <div className="sw-safari-top">
              <div className="sw-phone-status"><span>9:41</span><span className="sw-phone-indicators"><svg width="17" height="12" viewBox="0 0 17 12" aria-hidden="true"><path d="M1 11V8h2v3M5 11V6h2v5M9 11V3h2v8M13 11V0h2v11" stroke="currentColor" strokeWidth="1.5" /></svg><span>5G</span><svg width="23" height="12" viewBox="0 0 23 12" aria-hidden="true"><rect x="1" y="1" width="18" height="10" rx="2" stroke="currentColor" fill="none" /><path d="M21 4v4" stroke="currentColor" strokeWidth="2" /><rect x="3" y="3" width="13" height="6" rx="1" fill="currentColor" /></svg></span></div>
              <div className="sw-address"><span aria-hidden="true">aA</span><Mark kind="lock" size={12} /><span>search.example</span><Mark kind="search" size={14} /></div>
            </div>
            <div className="sw-search-page">
              <div className="sw-google">Google<small>Search results · fictional scene</small></div>
              <div className="sw-query"><Mark kind="search" size={17} /><span>Aster Air customer service number</span></div>
              <div className="sw-search-tabs" aria-hidden="true"><strong>All</strong><span>Flights</span><span>News</span><span>Maps</span></div>
              <p className="sw-browser-disclaimer">All listings below are invented. Nothing here opens a website or places a call.</p>
              {TARGETS.map((target, index) => {
                const active = target.id === selected;
                const fishState = active && phase === 'result' ? result?.verdict || 'idle' : active && working ? 'searching' : 'idle';
                return <article ref={element => { targetElements.current[target.id] = element; }} data-testid={`card-search-${target.id}`} className={`sw-search-result ${active ? `sw-phase-${phase}` : 'sw-target-idle'}`} key={target.id}>
                  <div className="sw-source"><span className="sw-source-symbol">{index === 0 ? 'aa' : index === 1 ? 'th' : 'jb'}</span><div><strong>{target.source}</strong>{target.domain}</div></div>
                  <h2 className="sw-result-headline">{target.title}</h2>
                  <p className="sw-search-snippet">{target.description}</p>
                  <div className="sw-number-target">
                    <div className="sw-target-copy"><span className="sw-browser-number" data-testid={`text-number-${target.id}`}>{target.number}</span><small>{active && working ? phase === 'swimming' ? 'Hook is swimming over…' : 'Checking sample clues…' : active && phase === 'result' ? 'Tap the clue below for evidence' : 'Tap Hook to check this number'}</small></div>
                    {renderFish(fishState, active ? tick : 0, () => check(target.number, target.id), `${active && phase === 'result' ? 'Replay' : 'Start'} local demo check for ${target.number}, claimed Aster Air. ${LABELS[target.id]} scenario.`)}
                  </div>
                  {active && working && <div className="sw-target-progress"><div className="sw-progress-track" aria-hidden="true" />{phase === 'swimming' ? 'Following your tap—not scanning the page' : 'Comparing illustrative evidence only'}</div>}
                  {active && result && phase === 'result' && resultButton(result)}
                </article>;
              })}
            </div>
            <div className="sw-safari-bottom" aria-label="Illustrative browser toolbar, non-interactive"><span><Mark kind="back" size={21} /></span><span style={{ transform: 'rotate(180deg)', opacity: .45 }}><Mark kind="back" size={21} /></span><svg width="21" height="24" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.6" aria-hidden="true"><path d="M7 9H4v13h16V9h-3M12 16V2m-4 4 4-4 4 4" /></svg><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 5C8 2 3 4 3 4v16s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v16" /></svg><svg width="21" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="7" width="14" height="14" rx="2" /><path d="M8 7V3h13v14h-4" /></svg></div>
          </div>
          <p className="sw-browser-footer">Hook stays beside your chosen number. A match is not a promise; caller IDs can still be spoofed. Don’t share passwords or one-time codes.</p>
        </> : <div className="sw-manual-panel">
          <p className="sw-sheet-kicker">A second way to ask Hook</p><h2>Have a number already?</h2><p>Paste it here, or try a sample scene. Fictional hotel, rental, airline, booking, and other directory contacts can match in this demo. Unknown entries stay unverified.</p>
          <form onSubmit={submit}>
            <label htmlFor="sw-manual-number" className="sw-input-label">Number or fictional company</label>
            <div className="sw-input-wrap"><Mark kind="search" size={18} /><input data-testid="input-manual-number" id="sw-manual-number" value={input} maxLength={90} placeholder="+1 (202) 555-0142" onChange={e => { reset('Entry changed. Tap Check to start a new local simulation.'); setInput(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'sw-manual-error' : undefined} autoComplete="off" /></div>
            {error && <p className="sw-error" id="sw-manual-error" role="alert">{error}</p>}
            <button data-testid="button-manual-check" className="sw-primary" type="submit"><Mark kind="official" />{working ? 'Restart demo check' : 'Check this example'}<Mark kind="arrow" /></button>
          </form>
          {(working || result) && renderFish(working ? 'searching' : result?.verdict || 'idle', tick, runManual, working ? 'Restart Hook’s local example check' : 'Replay this example check')}
          {working && <div className="sw-loading"><strong>{phase === 'swimming' ? 'Hook’s on the way.' : 'Looking at sample clues.'}</strong><p>No live lookup. Stay a moment.</p><div className="sw-skeleton" /><div className="sw-skeleton short" /></div>}
          {result && <><p className="sw-manual-number">{result.number}</p>{resultButton(result)}<p className="sw-sheet-description">{SUMMARIES[result.verdict]}</p></>}
        </div>}
        <div className="sw-browser-controls"><button data-testid="button-reset-demo" onClick={() => reset()}>Reset test swim</button><span>Tap-led. Device-local. Always.</span></div>
      </section>
    </div>
    {sheet === 'evidence' && result && <Sheet title={LABELS[result.verdict]} kicker="Sample evidence · not live verification" onClose={() => setSheet(null)}>
      <p className="sw-sheet-description">{SUMMARIES[result.verdict]}</p>
      <div className="sw-evidence-target" data-testid="text-evidence-target"><small>SELECTED NUMBER</small><strong>{result.number}</strong><p>Claimed company: {result.company}{exampleContacts.some(c => c.name === result.company) ? ' · fictional company' : ''}</p></div>
      <div className="sw-evidence-item"><h3><Mark kind="official" size={17} />Illustrative official-contact source</h3><p>{result.verdict === 'official' ? `Exact match with ${listedContact.name}’s fictional directory entry: ${listedContact.number}. This is a sample match, not an endorsement.` : result.company === 'Aster Air' ? 'The sample directory lists +1 (202) 555-0142 for Aster Air. The selected entry does not match. A mismatch alone is not evidence of fraud.' : 'No company ownership is inferred for this entry. Nothing in this sample directory establishes who controls the number. A missing match alone is not evidence of fraud.'}</p><small>Source: Stillwater prototype directory{result.company === 'Aster Air' ? ' / aster-air.example/contact' : ' · local sample list'}<br />Sample last checked: 18 June 2026 · fixed example date, not refreshed</small></div>
      <div className="sw-evidence-item"><h3><Mark kind={result.verdict === 'suspicious' ? 'suspicious' : 'unverified'} size={17} />{result.verdict === 'suspicious' ? 'Two invented traveler reports' : 'Report coverage & missing data'}</h3><p>{result.verdict === 'suspicious' ? 'Invented report 01: a traveler was asked for a “flight transfer fee” by bank transfer. Invented report 02: a traveler was asked to read out a one-time code. These are scripted examples, not real complaints about this number.' : result.verdict === 'official' ? 'No reports are included in this sample. That does not mean no reports exist or that a call is safe. No real reputation service or user-report database was checked.' : 'No reliable ownership record, live website check, or real reports are available in this demo for the selected entry. Missing evidence is uncertainty—not a clean bill of health.'}</p><small>{result.verdict === 'suspicious' ? 'Source: invented Stillwater report cards · sample dates 16–17 June 2026' : 'Source: limited local demonstration dataset · no live coverage'}</small></div>
      <div className="sw-evidence-item"><h3><Mark kind="unverified" size={17} />Source conflicts stay visible</h3><p>{result.verdict === 'official' ? 'The sample official entry agrees with the selected number. No conflicting source is included here; the small dataset cannot rule out conflicts elsewhere.' : result.verdict === 'suspicious' ? 'The travel-help listing claims to be Aster Air support, but its number conflicts with the example airline directory. The invented reports add a reason to pause; they do not establish who controls the number.' : result.company === 'Aster Air' ? 'The discussion claims an airline connection; the sample official contact differs. This could reflect an old, regional, or unrelated number. The prototype cannot resolve that conflict.' : 'No comparable sources are available for this entry. Without ownership or provenance, the prototype cannot determine whether sources agree or conflict.'}</p></div>
      <p className="sw-caveat">A listed number can still be impersonated through caller-ID spoofing. Hook cannot identify who is on the other end. Use your booking or the company’s own app for real support; never share passwords or one-time codes.</p>
      <button data-testid="button-evidence-official-contact" className="sw-primary" onClick={() => { reset(); onOfficialContact(listedContact.number); }}>{result.company.startsWith('Not supplied') ? 'Explore Aster Air’s demo official contact' : 'Open demo official-contact detail'}<Mark kind="arrow" size={18} /></button>
      <button data-testid="button-evidence-return" className="sw-secondary" onClick={() => setSheet(null)}>Return to {mode === 'safari' ? 'browsing' : 'manual check'}</button>
    </Sheet>}
    {sheet === 'help' && <Sheet title="Hook, beside the page." kicker="Safari setup · a future flow" onClose={() => setSheet(null)}>
      <p className="sw-sheet-description">This design does not install an extension or change any device settings. Here’s how a future Safari companion could be enabled on iPhone.</p>
      <ol className="sw-setup-steps">
        <li><div><strong>Install the future companion</strong>A real release would need a separate app and Safari Web Extension. Neither is installed by this preview.</div></li>
        <li><div><strong>Enable it in Safari settings</strong>On recent iOS versions: Settings → Apps → Safari → Extensions → Stillwater → Allow Extension. Older iOS versions may show Safari directly in Settings.</div></li>
        <li><div><strong>Choose website access</strong>In Safari’s page menu → Manage Extensions, select Stillwater. Allow access for the current site only when you’re comfortable; permissions can be changed or revoked in Safari settings. Labels may vary by iOS version.</div></li>
        <li><div><strong>Tap a fish when you want a clue</strong>The proposed flow is tap-to-check, not automatic browsing-history collection. Website permission would enable a companion on that site—not silently verify every number.</div></li>
      </ol>
      <div className="sw-setup-state" role="status"><strong>{enabledPreview ? 'Simulated enabled · preview only' : 'Not installed · preview only'}</strong>{enabledPreview ? 'Hook is shown as enabled in this design. No real Safari or website permission was granted.' : 'Try the visual enabled state below. It changes this local demo only; the browsing scene works either way.'}<button data-testid="button-toggle-setup-preview" className="sw-setup-toggle" aria-pressed={enabledPreview} onClick={() => setEnabledPreview(v => !v)}>{enabledPreview ? 'Reset simulated setup' : 'Preview an enabled companion'}</button></div>
      <div className="sw-evidence-item"><h3><Mark kind="lock" size={17} />Your tap sets the boundary</h3><p>This prototype sends no searches, page content, phone numbers, or history anywhere. It only plays local, scripted states after your tap. Saved example contacts and your trip name stay in this browser.</p></div>
      <p className="sw-caveat">Safari only—not inside Messages, phone calls, other apps, or every browser. This design is not a security service, and its results cannot guarantee safety.</p>
      <button data-testid="button-help-return" className="sw-primary" onClick={() => setSheet(null)}>Back to Hook<Mark kind="arrow" size={18} /></button>
    </Sheet>}
  </main>;
}
