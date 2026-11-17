import { Link } from 'wouter';
import { Hook } from '@/components/Hook';
import { usePageMeta } from '@/hooks/use-page-meta';
export default function NotFound() {
  usePageMeta('Page not found', 'This page has drifted out of reach. Return to the Phishing Trip phone-number checker.');
  return <section className="empty"><p className="eyebrow">404 · A little off course</p><h1>This page drifted away.</h1><Hook /><p>Hook can help you find your way back.</p><Link href="/" className="btn primary" data-testid="link-not-found-home">Back to Check</Link></section>;
}
