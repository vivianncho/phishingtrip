import { useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/travel';

export function Hook({ state = 'idle' }: { state?: 'idle' | 'pending' | 'green' | 'red' }) {
  const [boost, setBoost] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <div className={`fish-wrap fish-${state}`}>
    <button type="button" className={`fish-button ${boost ? 'fish-boost' : ''}`} data-testid="button-hook-swim" aria-label="Let Hook swim a little" onClick={() => { setBoost(false); requestAnimationFrame(() => setBoost(true)); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setBoost(false), 1100); }}>
      <svg className="fish-art" viewBox="0 0 480 400" fill="none" role="img" aria-label={`Hook the lantern fish, ${state === 'green' ? 'green lantern for official match' : state === 'red' ? 'red lantern means pause, not proof of scam' : 'awake, neutral lantern'}`}>
        <image href={asset('hook-figma-fins.svg')} x="174" y="101" width="269.636" height="244.031" />
        <image href={asset('hook-figma-body.svg')} x="77.245" y="134.627" width="275.822" height="194.202" />
        <image href={asset('hook-figma-face.svg')} x="87" y="160.5" width="91.403" height="111.492" />
        <image className="fish-lantern" href={asset('hook-figma-lantern.svg')} x="40.904" y="44.917" width="160.632" height="125.966" />
        {(state === 'green' || state === 'red') && <g transform="translate(40.904 44.917)">
          <path d="M30.0955 60.0774C35.0955 50.0774 49.0955 47.0774 61.0955 52.0774C75.0955 58.0774 80.0955 75.0774 73.0955 88.0774C67.0955 100.077 49.0955 105.077 36.0955 97.0774C23.0955 90.0774 22.0955 73.0774 30.0955 60.0774Z" fill={state === 'green' ? '#38c85b' : '#e53e46'} />
          <path d="M36.0955 65.0774C39.0955 60.0774 46.0955 57.0774 51.0955 60.0774C54.0955 62.0774 52.0955 65.0774 48.0955 67.0774C43.0955 69.0774 42.0955 75.0774 38.0955 75.0774C34.0955 75.0774 33.0955 70.0774 36.0955 65.0774Z" fill={state === 'green' ? '#b4edbf' : '#ffb3b6'} />
        </g>}
      </svg>
    </button>
    <p className="fish-caption" aria-live="polite">{state === 'pending' ? 'Hook is checking the available evidence…' : state === 'red' ? 'Red means pause. Not proof of a scam.' : state === 'green' ? 'A listed contact, not a guarantee. Take your time.' : 'One step at a time. Hook is here with you.'}</p>
  </div>;
}
