const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute right-0 top-0 h-full w-[44vw] bg-accent" />
      <img src={`${base}hook.png`} crossOrigin="anonymous" alt="Hook, a calm teal anglerfish carrying a lime lantern" className="absolute right-[3vw] top-[22vh] w-[46vw]" />
      <div className="absolute left-[6vw] top-[8vh] font-display font-bold text-[1.6vw] uppercase tracking-[0.12em] text-accent">Product pitch</div>
      <div className="absolute left-[6vw] top-[26vh] w-[48vw]">
        <h1 className="font-display font-bold tracking-tighter text-[7.4vw] leading-[0.95]">Phishing Trip</h1>
        <p className="mt-[4vh] font-display font-medium text-[2.8vw] leading-[1.2] text-accent">Less checking effort.</p>
        <p className="font-display font-medium text-[2.8vw] leading-[1.2]">A clearer next call.</p>
      </div>
      <div className="absolute left-[6vw] bottom-[8vh] w-[40vw] text-[2vw] leading-snug text-muted">Meet Hook, a calm companion for travelers checking a phone number before they dial.</div>
    </div>
  );
}
