import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Draft = { number: string; country: string; companyId: string };
const emptyDraft: Draft = { number: '', country: '', companyId: '' };
const STORAGE_KEY = 'stillwater-saved-company-ids';
type Companion = {
  draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  savedIds: string[]; ready: boolean; storageError: string;
  toggleSaved: (id: string) => Promise<void>;
};
const Context = createContext<Companion | null>(null);

export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const writing = useRef(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      const ids: unknown = value ? JSON.parse(value) : [];
      if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(id))) {
        throw new Error('Invalid saved companies');
      }
      if (alive) setSavedIds(ids);
    }).catch(() => {
      if (alive) setStorageError('Saved companies could not be loaded. You can still browse the directory.');
    }).finally(() => { if (alive) setReady(true); });
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') setDraft(emptyDraft);
    });
    return () => { alive = false; subscription.remove(); };
  }, []);
  async function toggleSaved(id: string) {
    if (!ready || writing.current) return;
    writing.current = true;
    const next = savedIds.includes(id) ? savedIds.filter(item => item !== id) : [...savedIds, id];
    try {
      // Only curated company IDs persist. Never submitted numbers or check results.
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedIds(next);
      setStorageError('');
    } catch {
      setStorageError('This change could not be saved on this device. Please try again.');
    } finally { writing.current = false; }
  }
  return <Context.Provider value={{ draft, setDraft, savedIds, ready, storageError, toggleSaved }}>{children}</Context.Provider>;
}
export function useCompanion() {
  const value = useContext(Context);
  if (!value) throw new Error('CompanionProvider is required');
  return value;
}
