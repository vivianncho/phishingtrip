import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Bookmark, Check, Phone, ShieldCheck, Trash2 } from 'lucide-react';
import type { Company, Evidence, OfficialContact } from '@workspace/api-client-react';
import { useSavedContacts } from '@/hooks/use-saved-contacts';
import { date, safeUrl } from '@/lib/travel';

export function External({ href, children, testId }: { href?: string; children: ReactNode; testId?: string }) {
  const url = safeUrl(href);
  return url ? <a className="text-link" data-testid={testId || 'link-external'} href={url} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={12} /></a> : <span>{children} (link unavailable)</span>;
}
export function Busy({ text = 'Finding the available evidence…' }: { text?: string }) {
  return <div aria-busy="true" role="status" data-testid="status-loading" className="loading-stack"><p className="small">{text}</p><div className="skeleton" /><div className="skeleton" style={{ minHeight: 65 }} /></div>;
}
export function Failure({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error" role="alert" data-testid="status-error">{message}{retry && <div className="actions"><button className="btn" data-testid="button-retry" onClick={retry}>Try again</button></div>}</div>;
}
export function Sources({ sources, id = 'evidence' }: { sources: Evidence[]; id?: string }) {
  return <details className="evidence" data-testid={`details-${id}`}><summary data-testid={`button-evidence-${id}`}>Sources & review dates · {sources.length}</summary>{sources.length ? sources.map(source => <div className="source" key={source.id} data-testid={`source-${source.id}`}>
    <External href={source.sourceUrl} testId={`link-source-${source.id}`}>{source.sourceName}</External>
    <small>{source.assertion} · {source.freshness} · {source.kind.replaceAll('_', ' ')}</small>
    <small>Reviewed {date(source.reviewedAt)} · expires {date(source.expiresAt)}</small>
    <small>{source.number}</small>
  </div>) : <p className="helper">No attributable evidence is available for this number.</p>}</details>;
}
export function CallButton({ number }: { number: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  useEffect(() => { const hide = () => { if (document.hidden) dialog.current?.close(); }; document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide); }, []);
  return <><button className="btn" data-testid={`button-call-${number}`} onClick={() => dialog.current?.showModal()}><Phone size={13} />Call options</button>
    <dialog ref={dialog} aria-labelledby={dialogId} data-testid="dialog-call"><h2 id={dialogId}>Before you call.</h2><p>Confirm the company, service and dialing region. Caller ID can be spoofed. Even a listed number is not a guarantee. Your phone app may charge for this call.</p><p className="number">{number}</p><div className="actions"><button className="btn" autoFocus data-testid="button-cancel-call" onClick={() => dialog.current?.close()}>Not now</button><a className="btn primary" data-testid="link-confirm-call" href={`tel:${number.replace(/[^\d+]/g, '')}`} onClick={() => dialog.current?.close()}>Open phone app<Phone size={14} /></a></div></dialog>
  </>;
}
export function ContactCard({ contact, onUse, removable = false }: { contact: OfficialContact; onUse: (number: string, company: string) => void; removable?: boolean }) {
  const saved = useSavedContacts();
  const [confirm, setConfirm] = useState(false);
  const isSaved = saved.items.some(i => i.contactId === contact.id);
  return <div className="contact" data-testid={`contact-${contact.id}`}>
    <p className="number">{contact.number}</p><div className="contact-meta"><span>{contact.service}</span><span>· {contact.region}</span><span className={`badge ${contact.freshness}`}>{contact.freshness} evidence</span></div>
    {contact.serviceType === 'property_main' && <p className="helper">Published property main line — not a confirmed direct front desk.</p>}
    <div className="actions"><button className="btn" data-testid={`button-use-${contact.id}`} onClick={() => onUse(contact.number, contact.companyId)}><ShieldCheck size={13} />Use in Check</button><CallButton number={contact.number} />
      {!removable && <button className="btn subtle" data-testid={`button-save-${contact.id}`} disabled={isSaved} onClick={() => saved.save({ companyId: contact.companyId, contactId: contact.id })}>{isSaved ? <Check size={13} /> : <Bookmark size={13} />}{isSaved ? 'Saved locally' : 'Save to trip'}</button>}
      {removable && <button className="btn danger" data-testid={`button-remove-${contact.id}`} onClick={() => setConfirm(true)}><Trash2 size={13} />Remove</button>}
    </div>
    {confirm && <div className="notice" role="group" aria-label="Confirm contact removal">Remove this contact from your local trip?<div className="actions"><button className="btn danger" data-testid={`button-confirm-remove-${contact.id}`} onClick={() => saved.remove(contact.id)}>Remove contact</button><button className="btn" data-testid={`button-keep-${contact.id}`} onClick={() => setConfirm(false)}>Keep contact</button></div></div>}
    <Sources sources={contact.sources} id={contact.id} />
  </div>;
}
export function CompanyCard({ company, onUse, excludedContacts }: { company: Company; onUse: (number: string, company: string) => void; excludedContacts?: OfficialContact[] }) {
  return <article className="company-card" data-testid={`company-${company.id}`}><div className="company-heading"><span className="initials">{company.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span><div><h3>{company.name}</h3><p className="category">{company.category.replaceAll('_', ' ')}{company.city ? ` · ${company.city}, ${company.countryCode}` : ''}</p></div></div><External href={company.website} testId={`link-company-${company.id}`}>Official website</External>{(excludedContacts || company.contacts).map(contact => <ContactCard key={contact.id} contact={contact} onUse={onUse} />)}{!(excludedContacts || company.contacts).length && <p className="notice">No different current contact is available. Use the official website.</p>}</article>;
}
