import { createContext, useContext, useState, type ReactNode } from 'react';

type Saved = { companyId: string; contactId: string };
const key = 'phishing-trip-official-contacts-v1';
const pattern = /^[a-zA-Z0-9_-]{1,128}$/;
function read(): { items: Saved[]; error: string } {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(raw) || raw.length > 200 || !raw.every(v => v && typeof v === 'object' && Object.keys(v).length === 2 && typeof v.companyId === 'string' && typeof v.contactId === 'string' && pattern.test(v.companyId) && pattern.test(v.contactId))) throw new Error();
    return { items: raw, error: '' };
  } catch { return { items: [], error: 'Saved contacts could not be read. Storage may be unavailable or invalid. You can still use the directory.' }; }
}
const SavedContext = createContext<{ items: Saved[]; error: string; save: (value: Saved) => void; remove: (id: string) => void }>({ items: [], error: '', save: () => {}, remove: () => {} });
export function SavedProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(read);
  const [items, setItems] = useState(initial.items);
  const [error, setError] = useState(initial.error);
  function persist(next: Saved[]) {
    setItems(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setError(''); }
    catch { setError('Browser storage is unavailable. Changes apply to this session only and may not survive reopening.'); }
  }
  return <SavedContext.Provider value={{ items, error, save: value => {
    if (items.some(i => i.contactId === value.contactId)) return;
    if (items.length >= 200) { setError('Your local list is full. Remove a contact before saving another.'); return; }
    persist([...items, value]);
  }, remove: id => persist(items.filter(i => i.contactId !== id)) }}>{children}</SavedContext.Provider>;
}
export const useSavedContacts = () => useContext(SavedContext);
