import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { searchTravelPlaces, type PlaceSearchResult } from '@workspace/api-client-react';
import { usePrivateRequest } from '@/hooks/use-private-request';
import { asset, date, samePhone } from '@/lib/travel';
import { Busy, CallButton, External, Failure } from '@/components/TravelUI';

export function PlacesDiscovery({ initialQuery = '', excludedNumber = '', onUse }: { initialQuery?: string; excludedNumber?: string; onUse: (number: string, company: string) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const request = usePrivateRequest<PlaceSearchResult>();
  useEffect(() => {
    const hide = () => { if (document.hidden) setQuery(''); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  function search() { if (query.trim().length >= 3) void request.run(options => searchTravelPlaces({ query: query.trim() }, options)); }
  return <section className="places" aria-labelledby="places-title" data-testid="section-places"><p className="eyebrow">Optional · separate from official sources</p><h2 id="places-title">Look a little further.</h2>
    <p className="small" style={{ marginTop: 12 }}>Only clicking the button below sends this company-and-city search to Google. Do not enter phone numbers, booking references or personal details. Google listings are unverified, not evidence of safety, and cannot be saved to your trip. Shared server limit: 10 attempts per day, including failed requests.</p>
    <div className="search-bar"><input aria-label="Company and city for Google Places" data-testid="input-google-query" value={query} maxLength={120} placeholder="Company or hotel name and city" onChange={e => { request.clear(); setQuery(e.target.value); }} /><button className="btn" data-testid="button-google-search" disabled={request.pending || query.trim().length < 3} onClick={search}><Search size={15} />Search with Google Places</button></div>
    {request.pending && <><Busy text="Searching Google listings, not verifying numbers…" /><button className="btn" data-testid="button-cancel-google" onClick={request.clear}>Cancel search</button></>}
    {request.error && <Failure message={request.error} retry={search} />}
    {request.data && <><img className="google-attribution" src={asset('google-maps-attribution.png')} alt="Google Maps" /><p className="small">Google listings · checked {date(request.data.checkedAt)} · not verified</p>
      {request.data.items.filter(p => !p.phone || !samePhone(p.phone, excludedNumber)).map(place => <article className="places-card" key={place.id} data-testid={`place-${place.id}`}><span className="badge unknown">Unverified Google listing</span><h3 style={{ marginTop: 8 }}>{place.name}</h3><p className="small">{place.address}</p>{place.phone && <p className="number">{place.phone}</p>}<div className="actions"><External href={place.website} testId={`link-place-site-${place.id}`}>Website</External><External href={place.mapsUrl} testId={`link-place-map-${place.id}`}>Google Maps</External></div>
        {place.phone && <div className="actions"><button className="btn" data-testid={`button-place-use-${place.id}`} onClick={() => onUse(place.phone!, '')}>Use in Check</button><CallButton number={place.phone} /></div>}
        {place.attributions.map((a, i) => <div className="small" key={`${a.name}-${i}`}><External href={a.uri} testId={`link-attribution-${place.id}-${i}`}>{a.name}</External></div>)}
      </article>)}
      {!request.data.items.some(p => !p.phone || !samePhone(p.phone, excludedNumber)) && <div className="empty"><h3>No different listing found.</h3><p>Try the exact property and city, or go back to your booking confirmation.</p></div>}
      <button className="btn subtle" style={{ marginTop: 16 }} data-testid="button-clear-google" onClick={() => { request.clear(); setQuery(''); }}>Clear Google results</button>
    </>}
  </section>;
}
