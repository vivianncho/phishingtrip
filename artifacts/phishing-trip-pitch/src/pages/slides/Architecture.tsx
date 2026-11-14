export default function Architecture() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute left-[6vw] top-[8vh]"><h2 className="font-display font-bold tracking-tight text-[4vw] leading-[1.05] [text-wrap:balance]">APIs with distinct jobs</h2></div>
      <div className="absolute left-[6vw] top-[27vh] flex items-center gap-[1.6vw]">
        <div className="w-[17vw] border-2 border-text px-[1.4vw] py-[2.4vh]"><div className="font-display font-bold text-[2.2vw]">Mobile app</div><div className="text-[1.6vw] text-muted">+ separate extension</div></div>
        <div className="font-display text-[3vw] text-accent">→</div>
        <div className="w-[17vw] bg-accent text-primary px-[1.4vw] py-[2.4vh]"><div className="font-display font-bold text-[2.2vw]">Express API</div><div className="text-[1.6vw]">our own service</div></div>
        <div className="font-display text-[3vw] text-accent">→</div>
        <div className="w-[20vw] border-2 border-text px-[1.4vw] py-[2.4vh]"><div className="font-display font-bold text-[2.2vw]">PostgreSQL</div><div className="text-[1.6vw] text-muted">curated directory</div></div>
      </div>
      <div className="absolute left-[30.8vw] top-[46vh] text-[1.5vw] uppercase tracking-[0.12em] text-muted">Optional branches from the API</div>
      <div className="absolute left-[30.8vw] right-[6vw] top-[52vh] grid grid-cols-2 gap-[2.4vw]">
        <div className="border-t-2 border-dashed border-accent pt-[2vh]">
          <div className="font-display font-bold text-[2.2vw]">Google Places</div>
          <div className="mt-[0.8vh] text-[2vw] leading-snug text-muted">Places API (New), Text Search: business discovery</div>
          <div className="mt-[1.6vh] inline-block border border-accent text-accent px-[0.8vw] py-[0.6vh] text-[1.5vw] font-bold">Implemented; live access unverified</div>
        </div>
        <div className="border-t-2 border-dashed border-accent pt-[2vh]">
          <div className="font-display font-bold text-[2.2vw]">Twilio Lookup</div>
          <div className="mt-[0.8vh] text-[2vw] leading-snug text-muted">Lookup v2 Basic: validity and format only</div>
          <div className="mt-[1.6vh] inline-block border border-accent text-accent px-[0.8vw] py-[0.6vh] text-[1.5vw] font-bold">Optional, off by default</div>
        </div>
      </div>
      <div className="absolute left-[6vw] bottom-[8vh] w-[22vw] text-[1.6vw] leading-snug text-muted">No scam-report API. No runtime LLM API.</div>
    </div>
  );
}
