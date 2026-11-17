import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { ArrowRight, BookOpen, CircleHelp, Fingerprint, LockKeyhole, Search, ShieldCheck, Waves } from 'lucide-react';
import { checkNumber, getGetCompanyQueryKey, useGetCompany, useListCompanies, type CheckResult } from '@workspace/api-client-react';
import { Form } from '@/components/ui/form';
import { Hook } from '@/components/Hook';
import { Busy, ContactCard, Failure, Sources } from '@/components/TravelUI';
import { TravelRecovery } from '@/components/TravelRecovery';
import { usePrivateRequest } from '@/hooks/use-private-request';
import { usePageMeta } from '@/hooks/use-page-meta';
import { date, eligible, makeInput } from '@/lib/travel';

export type Prefill = { number: string; company: string } | null;
type CheckFields = { number: string; country: string; company: string; service: string };
export default function CheckPage({ prefill, consumePrefill, onUse }: { prefill: Prefill; consumePrefill: () => void; onUse: (number: string, company: string) => void }) {
  usePageMeta('Check a travel number', 'Before you call, check the waters. Compare a phone number with sourced official travel contacts. No account or phone history.');
  const form = useForm<CheckFields>({ defaultValues: { number: prefill?.number || '', country: prefill?.number.startsWith('+') ? 'international' : '', company: prefill?.company || '', service: '' } });
  const [companySearch, setCompanySearch] = useState('');
  const directory = useListCompanies({ search: companySearch.trim() || undefined, limit: 50 }, { query: { staleTime: 30000 } });
  const selectedCompanyId = form.watch('company');
  const selectedCompany = useGetCompany(selectedCompanyId || '', { query: { queryKey: getGetCompanyQueryKey(selectedCompanyId || ''), enabled: !!selectedCompanyId, staleTime: 30000 } });
  const request = usePrivateRequest<CheckResult>();
  const [validation, setValidation] = useState('');
  const resultRef = useRef<HTMLElement>(null);
  const consume = useRef(consumePrefill); consume.current = consumePrefill;
  const { reset, setFocus } = form;
  useEffect(() => {
    if (prefill) { reset({ number: prefill.number, country: prefill.number.startsWith('+') ? 'international' : '', company: prefill.company, service: '' }); request.clear(); setValidation(''); consume.current(); setFocus('number'); }
  }, [prefill, reset, setFocus, request.clear]);
  useEffect(() => {
    // Keep the unfinished form in memory when a browser picker or another tab
    // takes focus. Results and pending requests still clear on document hide.
    const hide = () => { if (document.hidden) { setCompanySearch(''); setValidation(''); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [reset]);
  useEffect(() => { if (request.data) resultRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }); }, [request.data]);
  function submit(values: CheckFields) {
    setValidation('');
    try { const input = makeInput(values.number, values.country, values.company, values.service); void request.run(options => checkNumber(input, options)); }
    catch (e) { request.clear(); setValidation((e as Error).message); }
  }
  const result = request.data;
  return <>
    <section className="hero" aria-labelledby="check-title"><div className="hero-copy"><p className="eyebrow"><span className="dot" />A calmer way to make the call</p><h1 id="check-title">Before you call,<br />check the <span>waters.</span></h1><p className="lead">An unfamiliar number. A change of plans.<br />Take a breath. Hook will help you look for<br className="desktop-break" /> the evidence, one number at a time.</p><Hook state={request.pending ? 'pending' : result ? result.outcome === 'official_match' ? 'green' : 'red' : 'idle'} /></div>
      <div className="panel check-panel"><div className="panel-top"><span className="step">01 / CHECK A NUMBER</span><span className="private-tag"><LockKeyhole size={11} />No account. No history.</span></div><h2 style={{ marginBottom: 8 }}>Let’s take a look.</h2><p className="small" style={{ marginBottom: 24 }}>Start with the full phone number you’re unsure about.</p>
        <Form {...form}><form className="form-stack" onSubmit={form.handleSubmit(submit)} onChange={() => { request.clear(); setValidation(''); }}>
          <div><label htmlFor="phone-number">Phone number</label><input className="phone-input" id="phone-number" data-testid="input-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+1 (___) ___-____" maxLength={64} {...form.register('number', { required: true })} required aria-describedby="number-help" /><p id="number-help" className="helper" style={{ marginTop: 7 }}>One full number. No extensions or booking details.</p></div>
          <div className="field-row"><div><label htmlFor="country">Number’s country / format</label><select id="country" data-testid="select-country" {...form.register('country', { required: true })} required><option value="">Choose a country</option><option value="US">United States (+1)</option><option value="MX">Mexico (+52)</option><option value="CA">Canada (+1)</option><option value="international">International (+ format)</option></select></div>
            <div><label htmlFor="claimed-company">Who should it belong to?</label><select id="claimed-company" data-testid="select-company" {...form.register('company')} value={selectedCompanyId}><option value="">Not sure / optional</option>{selectedCompanyId && !directory.data?.items.some(c => c.id === selectedCompanyId) && <option value={selectedCompanyId}>{selectedCompany.data?.name || 'Selected directory company'}</option>}{directory.data?.items.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</option>)}</select></div></div>
          <details className="evidence"><summary data-testid="button-more-company-options">Can’t find the company? Search its name.</summary><label htmlFor="company-search" style={{ marginTop: 10 }}>Filter the company choices above</label><input id="company-search" data-testid="input-claim-company-search" value={companySearch} maxLength={80} placeholder="Exact company or property name" onChange={e => setCompanySearch(e.target.value)} /><p className="helper">Company-name search uses the public directory. Choose a result above; a name alone is never verification.</p></details>
          {directory.isError && <p className="helper">Company choices couldn’t load. You can still check without a company. <button type="button" className="text-link" data-testid="button-retry-companies" onClick={() => void directory.refetch()}>Reload choices</button></p>}
          <details className="evidence"><summary data-testid="button-service-options">Checking a specific department? (optional)</summary><label htmlFor="claimed-service" style={{ marginTop: 10 }}>Expected service</label><select id="claimed-service" data-testid="select-service" {...form.register('service')}><option value="">No department claim</option><option value="general">General support</option><option value="central_reservations">Central reservations</option><option value="property_main">Property main line</option><option value="front_desk">Direct front desk</option></select></details>
          <button className="btn primary full" type="submit" data-testid="button-check-number" disabled={request.pending}><Search size={17} />{request.pending ? 'Checking available evidence…' : 'Check the number'}<ArrowRight size={17} style={{ marginLeft: 'auto' }} /></button>
        </form></Form>
        <div className="privacy-note"><LockKeyhole size={13} /><span>Your number goes only to the check service and any configured number-metadata provider. It isn’t saved as browser history in this app.</span></div>
        {validation && <Failure message={validation} />}
        {request.error && <Failure message={request.error} retry={() => submit(form.getValues())} />}
        {request.pending && <><Busy text="Hook is looking at the available sources. No verdict yet." /><button className="btn subtle" data-testid="button-cancel-check" onClick={request.clear}>Cancel check</button></>}
      </div>
    </section>
    {result && <section ref={resultRef} className="result panel" data-testid="section-check-result" aria-live="polite" aria-labelledby="result-title">
      <div className="result-header"><div><p className="eyebrow">Available evidence · {result.freshness}</p><h2 id="result-title" className={result.outcome === 'official_match' ? 'green-text' : 'red-text'} data-testid="text-result-label">{result.outcome === 'official_match' ? 'Official match' : result.outcome === 'reports_found' ? 'Reports found' : 'Not verified'}</h2>{result.outcome !== 'official_match' && <h3 className="red-text" style={{ marginTop: 9 }}>Pause before calling.</h3>}</div><div><p className="number" data-testid="text-normalized-number">{result.normalizedNumber}</p><small>Checked {date(result.checkedAt)}</small></div></div>
      <p className="result-explanation">{result.explanation}</p><p className="helper">Reason: {result.reason.replaceAll('_', ' ').toLowerCase()}</p>
      <p className={`notice ${result.outcome !== 'official_match' ? 'warning' : ''}`}>{result.outcome !== 'official_match' ? 'Red means pause, not proof of a scam. Missing, outdated or conflicting evidence cannot tell us who is on the other end.' : 'This number matches a sourced official contact. That is evidence of a listing, not a safety guarantee.'} Caller ID can be spoofed. Hang up and independently contact the business if you are unsure.</p>
      <Sources sources={result.evidence} id="check-result" />
      <details className="evidence"><summary data-testid="button-result-providers">Providers, metadata & limitations</summary><div className="notice"><p>Directory: {result.providers.directory} · Reputation: {result.providers.reputation} · Metadata: {result.providers.metadata}</p><p className="small">No live reputation provider is available. Number validity is not identity verification.</p>{result.metadata && <p className="small">{result.metadata.provider}: {result.metadata.valid ? 'valid number format' : 'number validity not confirmed'} · {result.metadata.countryCode} · {result.metadata.nationalFormat} · fetched {date(result.metadata.fetchedAt)} · expires {date(result.metadata.expiresAt)} · {result.metadata.cached ? 'cached' : 'fresh response'}</p>}<ul>{result.limitations.map((s, i) => <li key={i}>{s}</li>)}</ul></div></details>
      {eligible(result.alternatives, result.normalizedNumber).length > 0 && <div style={{ marginTop: 25 }}><h3>Other published contact options</h3><p className="small">Confirm the exact business, region and department. These are not automatically a match for your issue.</p>{eligible(result.alternatives, result.normalizedNumber).map(c => <ContactCard key={c.id} contact={c} onUse={onUse} />)}</div>}
      <button className="btn subtle" style={{ marginTop: 20 }} data-testid="button-clear-result" onClick={() => { request.clear(); reset({ number: '', country: '', company: '', service: '' }); setFocus('number'); }}>Clear this check</button>
    </section>}
    {result && result.outcome !== 'official_match' && <TravelRecovery excludedNumber={result.normalizedNumber} onUse={onUse} />}
    <section className="trust-strip" aria-label="How your check works"><div className="trust-item"><ShieldCheck size={21} /><div><strong>Evidence, not a hunch.</strong><small>Official sources you can open yourself.</small></div></div><div className="trust-item"><Fingerprint size={22} /><div><strong>A check, not a guarantee.</strong><small>Caller ID can still be spoofed.</small></div></div><div className="trust-item"><Waves size={22} /><div><strong>One step at a time.</strong><small>No pressure. There’s always another way.</small></div></div></section>
    <div className="lower-heading"><h2>A little backup for the journey.</h2><Link href="/help" className="text-link" data-testid="link-how-checks-work">How it works<ArrowRight size={14} /></Link></div><section className="support-links"><Link href="/directory" className="support-link" data-testid="link-browse-directory"><BookOpen size={25} /><div><strong>Find an official contact</strong><small>From your first flight to your last check-out.</small></div><ArrowRight size={17} /></Link><Link href="/help" className="support-link" data-testid="link-travel-guidance"><CircleHelp size={25} /><div><strong>Feeling unsure? Start here.</strong><small>Clear guidance. A calmer next step.</small></div><ArrowRight size={17} /></Link></section>
  </>;
}
