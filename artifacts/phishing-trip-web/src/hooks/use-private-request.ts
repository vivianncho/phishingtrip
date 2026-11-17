import { useCallback, useEffect, useRef, useState } from 'react';

export function errorText(error: unknown) {
  const e = error as { status?: number; data?: { code?: string }; headers?: Headers };
  if (e.status === 429) {
    const seconds = Number(e.headers?.get('Retry-After'));
    return seconds > 0 ? `Please pause and try again in ${Math.ceil(seconds)} seconds.` : 'The request limit has been reached. Please wait before trying again. Google discovery has a shared limit of 10 attempts per day.';
  }
  if (e.data?.code === 'INVALID_NUMBER') return 'Check the full number and selected country. No conclusion was reached.';
  if (e.data?.code === 'COMPANY_NOT_FOUND') return 'That company is no longer listed. Choose another company or “Not sure”.';
  return 'The service could not be reached. No conclusion was reached. Check your connection, then try again.';
}

export function usePrivateRequest<T>() {
  const [data, setData] = useState<T | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const version = useRef(0);
  const clear = useCallback(() => {
    version.current++;
    request.current?.abort();
    request.current = null;
    setData(null); setPending(false); setError('');
  }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) clear(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); version.current++; request.current?.abort(); };
  }, [clear]);
  const run = useCallback(async (fn: (options: RequestInit) => Promise<T>) => {
    clear();
    if (document.hidden) return;
    const current = version.current;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    const timer = setTimeout(() => {
      if (version.current !== current) return;
      version.current++; controller.abort(); request.current = null;
      setPending(false); setError('This is taking too long. No conclusion was reached. Please try again.');
    }, 15000);
    try {
      const result = await fn({ signal: controller.signal, cache: 'no-store', credentials: 'include' });
      if (version.current === current && !document.hidden) setData(result);
    } catch (e) {
      if (version.current === current && !controller.signal.aborted) setError(errorText(e));
    } finally {
      clearTimeout(timer);
      if (version.current === current) { setPending(false); request.current = null; }
    }
  }, [clear]);
  return { data, pending, error, run, clear };
}
