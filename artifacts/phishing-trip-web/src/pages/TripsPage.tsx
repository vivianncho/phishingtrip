import { useGetCompany } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ArrowRight, Bookmark, LockKeyhole, Luggage } from 'lucide-react';
import { useSavedContacts } from '@/hooks/use-saved-contacts';
import { usePageMeta } from '@/hooks/use-page-meta';
import { Busy, ContactCard, External, Failure } from '@/components/TravelUI';

function SavedContact({ companyId, contactId, onUse }: { companyId: string; contactId: string; onUse: (number: string, company: string) => void }) {
  const saved = useSavedContacts();
  const query = useGetCompany(companyId, { query: { staleTime: 0, refetchOnMount: 'always' }, request: { cache: 'no-store', credentials: 'include' } });
  if (query.isLoading || query.isFetching) return <Busy text="Refreshing this saved contact from the current directory…" />;
  if (query.isError) return <div className="company-card"><Failure message="This saved contact could not be refreshed. It is not being shown as current." retry={() => void query.refetch()} /><button className="btn danger" data-testid={`button-remove-unavailable-${contactId}`} onClick={() => { if (window.confirm('Remove this saved reference from this browser?')) saved.remove(contactId); }}>Remove saved reference</button></div>;
  const contact = query.data?.contacts.find(c => c.id === contactId);
  return <article className="company-card" data-testid={`saved-${contactId}`}><p className="eyebrow">Refreshed from the directory</p><h3>{query.data?.name || 'Saved official contact'}</h3><p className="small">{query.data?.city}</p><External href={query.data?.website} testId={`link-saved-website-${companyId}`}>Official website</External>{contact ? <ContactCard contact={contact} onUse={onUse} removable /> : <><p className="notice warning">This contact is no longer in the directory. No saved phone snapshot is used.</p><button className="btn danger" data-testid={`button-remove-missing-${contactId}`} onClick={() => { if (window.confirm('Remove this missing contact reference?')) saved.remove(contactId); }}>Remove reference</button></>}</article>;
}
export default function TripsPage({ onUse }: { onUse: (number: string, company: string) => void }) {
  usePageMeta('My Trips', 'Keep official travel contact references in this browser only. No account, sync or saved phone-check history. Contacts are refreshed before use.');
  const saved = useSavedContacts();
  return <><div className="page-heading"><p className="eyebrow">A little less to worry about</p><h1>Your trip.<br /><span className="green-text">Your backup plan.</span></h1><p>A few official contacts, ready when plans change.<br />No account. No new thing to remember.</p></div><div className="trip-banner"><div><h2>Your local travel contacts</h2><p className="small">{saved.items.length} saved {saved.items.length === 1 ? 'reference' : 'references'} · only in this browser</p></div><Luggage size={38} /></div>
    <p className="notice"><LockKeyhole size={15} style={{ display: 'inline', marginRight: 8 }} />Only official company/contact IDs are stored in this browser. No checked phone numbers, problem text, Google content or search history. Nothing syncs to an account. Clearing browser storage removes this list. We re-fetch each saved contact before showing its current details; offline access is not available.</p>
    {saved.error && <Failure message={saved.error} />}
    {saved.items.length > 0 ? <div className="directory-grid">{saved.items.map(i => <SavedContact key={i.contactId} {...i} onUse={onUse} />)}</div> : <div className="empty"><Bookmark size={34} /><h2>A little preparation goes far.</h2><p>Save a sourced hotel, airline or travel contact from the directory. Your future self can take a breath.</p><Link href="/directory" className="btn primary" data-testid="link-trip-find-contacts">Find a contact<ArrowRight size={16} /></Link></div>}
    {saved.items.length > 0 && <div className="actions"><Link href="/directory" className="btn primary" data-testid="link-trip-add-contact">Find another contact<ArrowRight size={16} /></Link></div>}
  </>;
}
