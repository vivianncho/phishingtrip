export default function Surfaces() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute left-[6vw] top-[8vh]"><h2 className="font-display font-bold tracking-tight text-[4vw] leading-[1.05] [text-wrap:balance]">Three places to turn</h2></div>
      <div className="absolute left-[6vw] top-[28vh] w-[56vw] flex flex-col">
        <div className="grid grid-cols-[14vw_1fr] border-t border-line py-[3vh]"><div className="font-display font-bold text-[2.6vw] text-accent">Check</div><div className="text-[2.2vw]">Explicit phone-number checks</div></div>
        <div className="grid grid-cols-[14vw_1fr] border-t border-line py-[3vh]"><div className="font-display font-bold text-[2.6vw] text-accent">Directory</div><div className="text-[2.2vw]">Sourced contacts</div></div>
        <div className="grid grid-cols-[14vw_1fr] border-y border-line py-[3vh]"><div className="font-display font-bold text-[2.6vw] text-accent">My Trips</div><div className="text-[2.2vw]">Saved company shortcuts</div></div>
        <div className="mt-[2vh] text-[1.6vw] text-muted">Mobile app. It cannot inspect Safari.</div>
      </div>
      <div className="absolute right-[6vw] top-[28vh] w-[24vw] h-[56vh] bg-accent text-primary px-[2vw] py-[4vh] flex flex-col">
        <div className="text-[1.5vw] uppercase tracking-[0.12em] font-bold">Separate companion</div>
        <div className="mt-[2vh] font-display font-bold text-[2.6vw] leading-tight">Browser extension</div>
        <div className="mt-[3vh] text-[1.9vw] leading-snug">Chrome / Edge source and Safari resources</div>
        <div className="mt-auto border-t border-primary pt-[2vh] text-[1.6vw] leading-snug font-bold">Safari packaging, signing and device validation still required</div>
      </div>
    </div>
  );
}
