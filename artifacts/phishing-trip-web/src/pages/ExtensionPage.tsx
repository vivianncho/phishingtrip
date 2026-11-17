import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Compass, Globe, Monitor, ShieldCheck } from 'lucide-react';
import { Hook } from '@/components/Hook';
import { extensionStores } from '@/lib/extension-release';
import './ExtensionPage.css';

type DemoResult = 'idle' | 'pending' | 'green' | 'red' | 'failure';
type Scenario = 'green' | 'red' | 'failure';

const results: Record<DemoResult, { title: string; description: string }> = {
  idle: { title: 'A moment before you call.', description: 'Choose a simulated outcome, then try the demo. Hook stays beside the selected fictional number.' },
  pending: { title: 'Simulating a check…', description: 'This is only a short on-page animation. No lookup or real check is happening.' },
  green: { title: 'Demo: official source match', description: 'Green means a match to an official source, not a guarantee of safety. Caller ID can be spoofed; review the source before calling.' },
  red: { title: 'Demo: unverified — pause', description: 'Red means the number is unverified, not proof of a scam. Find contact details independently on the company’s official website.' },
  failure: { title: 'Demo: unable to check', description: 'No result is available. Hook stays neutral: a failed check says nothing about whether a number is safe. You can try this demo again.' },
};

export default function ExtensionPage() {
  const [scenario, setScenario] = useState<Scenario>('green');
  const [result, setResult] = useState<DemoResult>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setResult('idle');
  };
  const simulate = () => {
    if (timer.current) clearTimeout(timer.current);
    setResult('pending');
    timer.current = setTimeout(() => { setResult(scenario); timer.current = null; }, 900);
  };
  const hookState = result === 'failure' ? 'idle' : result;

  return <div className="extension-page">
    <section className="extension-intro" aria-labelledby="extension-title">
      <div className="eyebrow"><span className="dot" />Hook, a little closer</div>
      <h1 id="extension-title">A pause before you call.<br /><span>Right where you browse.</span></h1>
      <p>The Phishing Trip extension is being prepared to bring Hook beside a phone number you select on a webpage. A little help reviewing the evidence, before you decide what to do next.</p>
    </section>

    <div className="extension-release-note" data-testid="status-extension-release"><Compass size={19} aria-hidden="true" /><p>{extensionStores.some(store => store.url) ? <><strong>Install through your browser’s official store.</strong> Available browser listings are linked below. Your browser will ask you to confirm installation.</> : <><strong>Coming soon — not published yet.</strong> No store listing is available today. When released, installation will happen through your browser’s official store, not a download from this page.</>}</p></div>

    <section aria-labelledby="extension-stores-title">
      <div className="lower-heading"><h2 id="extension-stores-title">Choose your browser</h2><small>Official stores only</small></div>
      <div className="extension-store-list">
        {extensionStores.map(store => <article className="extension-store" key={store.browser}>
          <div className="extension-store-icon" aria-hidden="true">{store.browser === 'safari' ? <Compass size={23} /> : store.browser === 'chrome' ? <Globe size={23} /> : <Monitor size={23} />}</div>
          <div><h3>{store.label}</h3><p>{store.browser === 'safari' ? 'For Safari on iPhone. After installing the app, enable the extension in Safari’s Manage Extensions.' : 'For desktop browsing. Your browser’s store will ask you to review and confirm installation.'}</p></div>
          {store.url ? <a className="btn primary" href={store.url} target="_blank" rel="noopener noreferrer" data-testid={`link-extension-store-${store.browser}`} aria-label={`Open ${store.label} store listing in a new tab`}>Open store listing<ArrowUpRight size={16} aria-hidden="true" /></a> : <span className="extension-store-status" data-testid={`status-extension-store-${store.browser}`}>Not published yet</span>}
        </article>)}
      </div>
    </section>

    <section className="extension-setup" aria-label="How installation will work when released">
      <article><h2>Chrome & Edge on desktop</h2><ol><li>When published, follow the official store link above.</li><li>Review the listing and permissions. Confirm installation in the store’s browser prompt.</li><li>Pin Phishing Trip. On a webpage, open it and choose <strong>Turn on for this page</strong>. Then select a phone number to bring Hook alongside it.</li></ol></article>
      <article><h2>Safari on iPhone</h2><ol><li>When published, install the app from its App Store listing.</li><li>In Safari, open the page menu, then <strong>Manage Extensions</strong>, and enable Phishing Trip. Menu names can vary by iOS version.</li><li>Review Safari’s website permissions before using Hook on a page.</li></ol></article>
    </section>

    <section className="extension-demo" aria-labelledby="extension-demo-title">
      <header className="extension-demo-heading"><div className="eyebrow"><span className="dot" />Interactive demonstration</div><h2 id="extension-demo-title">Meet Hook beside a number.</h2><p>This is an on-page demo, not the installed extension. The number and every result are fictional. No real check happens, no number is uploaded, and your demo choices are not saved.</p></header>
      <div className="extension-demo-body">
        <div className="extension-demo-scene">
          <small>Fictional travel webpage</small><h3>Lantern Quay Guesthouse</h3>
          <div className="extension-demo-number-row"><span className="extension-demo-number" data-testid="text-demo-number" aria-label="Selected fictional phone number, plus one, two zero two, five five five, zero one four six">+1 202 555 0146</span><Hook state={hookState} /></div>
          <p className="extension-demo-disclaimer">Highlighted number: selected for this demonstration only. It is not a contact to call.</p>
        </div>
        <div className="extension-demo-controls">
          <fieldset disabled={result === 'pending'}><legend>1. Choose a simulated outcome</legend><div className="extension-demo-options">
            {([{ value: 'green', label: 'Official match' }, { value: 'red', label: 'Unverified' }, { value: 'failure', label: 'Unable to check' }] as const).map(option => <button className="btn" type="button" key={option.value} aria-pressed={scenario === option.value} data-testid={`button-demo-outcome-${option.value}`} onClick={() => { reset(); setScenario(option.value); }}>{option.label}</button>)}
          </div></fieldset>
          <button type="button" className="btn primary" disabled={result === 'pending'} onClick={simulate} data-testid="button-run-extension-demo">{result === 'pending' ? 'Simulating…' : '2. Try simulated check'}</button>
          <div className="extension-demo-result" data-result={result} role="status" aria-live="polite" aria-atomic="true" data-testid="status-extension-demo"><h3>{results[result].title}</h3><p>{results[result].description}</p></div>
          <button type="button" className="btn subtle extension-reset" onClick={reset} data-testid="button-reset-extension-demo">Reset demo</button>
        </div>
      </div>
    </section>
    <aside className="extension-safety"><ShieldCheck size={20} aria-hidden="true" /><p>When released, the consumer extension will not ask you to supply API keys or server addresses. You stay in control of installation and browser permissions. Evidence helps you pause; it cannot guarantee that a call is safe.</p></aside>
  </div>;
}
