import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Search } from 'lucide-react';
import { useListCompanies, type TravelCategory } from '@workspace/api-client-react';
import { Form } from '@/components/ui/form';
import { Busy, CompanyCard, Failure } from '@/components/TravelUI';
import { PlacesDiscovery } from '@/components/PlacesDiscovery';
import { usePageMeta } from '@/hooks/use-page-meta';

const categories: { value: TravelCategory | ''; label: string }[] = [{ value: '', label: 'All travel' }, { value: 'hotel', label: 'Hotels' }, { value: 'airline', label: 'Airlines' }, { value: 'vacation_rental', label: 'Vacation rentals' }, { value: 'car_rental', label: 'Car rentals' }, { value: 'booking_service', label: 'Booking sites' }, { value: 'rail_transfer', label: 'Rail & transfers' }, { value: 'cruise', label: 'Cruises' }, { value: 'tour', label: 'Tours' }];
export default function DirectoryPage({ onUse }: { onUse: (number: string, company: string) => void }) {
  usePageMeta('Official travel directory', 'Search sourced airlines, hotels, rentals, rail, cruises and travel services. Optional Google Places discovery stays separate and unverified.');
  const [search, setSearch] = useState({ company: '', city: '' });
  const [category, setCategory] = useState<TravelCategory | ''>('');
  const [offset, setOffset] = useState(0);
  const [google, setGoogle] = useState(false);
  const form = useForm({ defaultValues: { company: '', city: '' } });
  const directory = useListCompanies({ search: search.company || undefined, city: search.city || undefined, category: category || undefined, offset, limit: 12 }, { query: { staleTime: 30000 } });
  return <><div className="page-heading"><p className="eyebrow">Support for your whole trip</p><h1>A familiar port.<br /><span className="green-text">In unfamiliar waters.</span></h1><p>Find a sourced contact for the exact business you need.<br />Hotels, flights, rentals and everything in between.</p></div>
    <Form {...form}><form className="search-bar" onSubmit={form.handleSubmit(v => { setSearch({ company: v.company.trim(), city: v.city.trim() }); setOffset(0); setGoogle(false); })}><input data-testid="input-directory-search" aria-label="Company or property name" placeholder="Company or property name" maxLength={80} {...form.register('company')} /><input aria-label="City for hotel or branch" data-testid="input-directory-city" placeholder="City (optional)" maxLength={80} {...form.register('city')} /><button className="btn primary" data-testid="button-search-directory" type="submit"><Search size={16} />Find contacts</button></form></Form>
    <div className="filters" aria-label="Travel category">{categories.map(c => <button className={`chip ${category === c.value ? 'active' : ''}`} aria-pressed={category === c.value} data-testid={`button-category-${c.value || 'all'}`} key={c.value} onClick={() => { setCategory(c.value); setOffset(0); }}>{c.label}</button>)}</div>
    <div className="notice">Source-backed listings are not safety endorsements. Confirm the property, city, dialing region and service. A hotel main line is not a verified direct front desk. <span className="green-text">Use in Check</span> only fills the form; it does not run a check or place a call.</div>
    {directory.isLoading && <Busy text="Opening the sourced travel directory…" />}
    {directory.isError && <Failure message="The directory could not load. Please check your connection and try again." retry={() => void directory.refetch()} />}
    {directory.data && !directory.isError && <><p className="eyebrow" data-testid="text-directory-count">{directory.data.total} sourced companies · {directory.isFetching ? 'updating…' : 'browse at your pace'}</p><div className="directory-grid">{directory.data.items.map(company => <CompanyCard key={company.id} company={company} onUse={onUse} />)}</div>{!directory.data.items.length && <div className="empty"><Search size={30} /><h2>Let’s try another way.</h2><p>No sourced listing matched. Try the exact name, a different city spelling, or remove the city for brand-wide support.</p><button className="btn" data-testid="button-clear-directory" onClick={() => { form.reset(); setSearch({ company: '', city: '' }); setCategory(''); setOffset(0); }}>Show all contacts</button></div>}<div className="pagination"><button className="btn" data-testid="button-directory-previous" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 12))}>Previous</button><small>Showing {directory.data.items.length ? offset + 1 : 0}–{offset + directory.data.items.length} of {directory.data.total}</small><button className="btn" data-testid="button-directory-next" disabled={directory.data.nextOffset === null} onClick={() => setOffset(directory.data!.nextOffset!)}>Next</button></div></>}
    {!google ? <section className="places"><p className="eyebrow">Need to look further?</p><h2>Not every place is in our directory.</h2><p className="small" style={{ margin: '12px 0 18px' }}>Google Places can help you discover a listing. It cannot verify the number or the person calling you. No search is sent until you explicitly request it.</p><button className="btn" data-testid="button-enable-google" onClick={() => setGoogle(true)}>Explore Google Places options</button></section> : <PlacesDiscovery initialQuery={`${search.company} ${search.city}`.trim()} onUse={onUse} />}
  </>;
}
