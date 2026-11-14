const base = import.meta.env.BASE_URL;

export default function Evidence() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute left-[6vw] top-[8vh] w-[44vw]">
        <h2 className="font-display font-bold tracking-tight text-[4vw] leading-[1.05] [text-wrap:balance]">Evidence in one place</h2>
        <div className="mt-[6vh] flex flex-col gap-[3.5vh] text-[2.2vw]">
          <div className="border-t border-line pt-[1.6vh]"><span className="font-bold text-accent">Check</span> a number you were given</div>
          <div className="border-t border-line pt-[1.6vh]"><span className="font-bold text-accent">See</span> its source and freshness</div>
          <div className="border-t border-line pt-[1.6vh]"><span className="font-bold text-accent">Understand</span> what remains unknown</div>
        </div>
        <p className="mt-[5vh] text-[1.8vw] leading-snug text-muted">Hook reacts to the check state. It is not a runtime AI verdict.</p>
      </div>
      <div className="absolute right-[8vw] top-[7vh] w-[28vw] h-[80vh] rounded-[2.4vw] bg-accent p-[1vw]">
        <div className="h-full w-full rounded-[1.8vw] bg-deep px-[1.8vw] py-[3vh] flex flex-col">
          <div className="text-[1.5vw] uppercase tracking-[0.12em] text-accent font-bold">UI illustration</div>
          <div className="mt-[2vh] font-display font-bold text-[2.2vw]">Selected travel number</div>
          <div className="mt-[2vh] rounded-[0.8vw] bg-primary border border-line p-[1.2vw]">
            <div className="text-[1.6vw] font-bold">Matches a published contact</div>
            <div className="text-[1.5vw] text-muted">Source named on record</div>
            <div className="text-[1.5vw] text-muted">Review date and expiry</div>
          </div>
          <div className="mt-[1.6vh] rounded-[0.8vw] border border-dashed border-muted p-[1.2vw]">
            <div className="text-[1.6vw] font-bold">Still unknown</div>
            <div className="text-[1.5vw] text-muted">Caller identity remains unknown</div>
          </div>
          <img src={`${base}hook.png`} crossOrigin="anonymous" alt="Hook reacting to a check state" className="mt-auto self-end w-[11vw]" />
        </div>
      </div>
      <div className="absolute right-[8vw] bottom-[4vh] w-[28vw] text-center text-[1.5vw] text-muted">Illustrative mockup, not live results</div>
    </div>
  );
}
