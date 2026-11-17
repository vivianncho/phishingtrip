import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { listCompanies, type CompanyPage } from '@workspace/api-client-react';
import { Form } from '@/components/ui/form';
import { PlacesDiscovery } from '@/components/PlacesDiscovery';
import { Busy, CompanyCard, Failure } from '@/components/TravelUI';
import { usePrivateRequest } from '@/hooks/use-private-request';
import { eligible, topic } from '@/lib/travel';

type RecoveryInput = { problem: string; company: string; city: string };
export function TravelRecovery({ excludedNumber, onUse }: { excludedNumber: string; onUse: (number: string, company: string) => void }) {
  const form = useForm<RecoveryInput>({ defaultValues: { problem: '', company: '', city: '' } });
  const request = usePrivateRequest<CompanyPage>();
  const [submitted, setSubmitted] = useState<RecoveryInput | null>(null);
  const [google, setGoogle] = useState(false);
  const { reset } = form;
  useEffect(() => { const hide = () => { if (document.hidden) { reset(); setSubmitted(null); setGoogle(false); } }; document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide); }, [reset]);
  function invalidate() { request.clear(); setSubmitted(null); setGoogle(false); }
  const find = (values: RecoveryInput) => {
    setSubmitted(values); setGoogle(false);
    void request.run(options => listCompanies({ search: values.company.trim(), city: values.city.trim() || undefined, limit: 20 }, options));
  };
  const guidance = topic(submitted?.problem || '');
  return <section className="recovery panel" data-testid="section-recovery"><p className="eyebrow">Your next step</p><h2>Let’s find another way.</h2><p>Tell us what you need. We’ll help you find a published route back.</p>
    <Form {...form}><form className="form-stack" onSubmit={form.handleSubmit(find)} onChange={invalidate}>
      <div><label htmlFor="travel-problem">What do you need help with?</label><textarea id="travel-problem" data-testid="input-travel-problem" placeholder="e.g. I need to change my flight time" maxLength={240} {...form.register('problem', { required: true })} required /><p className="helper">This problem text stays in this page’s memory. It is never sent to the server or Google. No payment details, booking codes or passwords.</p></div>
      <div className="field-row"><div><label htmlFor="recovery-company">Airline, hotel or company</label><input id="recovery-company" data-testid="input-recovery-company" maxLength={80} minLength={2} {...form.register('company', { required: true, minLength: 2 })} required /></div><div><label htmlFor="recovery-city">City (optional)</label><input id="recovery-city" data-testid="input-recovery-city" maxLength={80} {...form.register('city')} /></div></div>
      <p className="helper">Only company and city are sent to our sourced directory search.</p><button type="submit" className="btn primary" data-testid="button-find-recovery" disabled={request.pending}>Find contact options</button>
    </form></Form>
    {request.pending && <Busy text="Finding sourced travel contacts…" />}
    {submitted && <div style={{ marginTop: 25 }}><h3>{guidance.title}</h3><p className="small">{guidance.advice}</p></div>}
    {request.error && <Failure message={request.error} retry={() => submitted && find(submitted)} />}
    {request.data && submitted && <div style={{ marginTop: 20 }}>
      <p className="eyebrow">Sourced options · confirm company, region and service</p>
      {!request.data.items.length && <div className="empty"><h3>No sourced company matched.</h3><p>Try the exact company name, remove the city for a brand-wide service, or explicitly search Google below.</p></div>}
      {request.data.items.map(company => {
        const contacts = eligible(company.contacts, excludedNumber);
        const matching = contacts.filter(c => guidance.terms.test(c.service));
        const other = contacts.filter(c => !guidance.terms.test(c.service));
        return <div key={company.id} style={{ marginBottom: 18 }}>
          {matching.length > 0 && <><p className="small" style={{ marginBottom: 8 }}>Published service matches your issue — confirm they can help.</p><CompanyCard company={company} onUse={onUse} excludedContacts={matching} /></>}
          {other.length > 0 && <><p className="small" style={{ margin: '12px 0 8px' }}>Other published contacts — help with this issue is not confirmed.</p><CompanyCard company={company} onUse={onUse} excludedContacts={other} /></>}
          {!contacts.length && <CompanyCard company={company} onUse={onUse} excludedContacts={[]} />}
        </div>;
      })}
      {request.data.nextOffset !== null && <p className="notice">More matches exist. Narrow the name or city to find the exact company.</p>}
    </div>}
    {submitted && !request.pending && (!google ? <button className="btn" style={{ marginTop: 20 }} data-testid="button-enable-recovery-google" onClick={() => setGoogle(true)}>Find more with Google Places</button> : <PlacesDiscovery initialQuery={`${submitted.company} ${submitted.city}`.trim()} excludedNumber={excludedNumber} onUse={onUse} />)}
  </section>;
}
