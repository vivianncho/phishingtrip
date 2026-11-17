import { useEffect } from 'react';
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} — Phishing Trip`;
    for (const [selector, value] of [['meta[name="description"]', description], ['meta[property="og:title"]', `${title} — Phishing Trip`], ['meta[property="og:description"]', description], ['meta[name="twitter:title"]', `${title} — Phishing Trip`], ['meta[name="twitter:description"]', description]]) {
      document.querySelector(selector)?.setAttribute('content', value);
    }
  }, [title, description]);
}
