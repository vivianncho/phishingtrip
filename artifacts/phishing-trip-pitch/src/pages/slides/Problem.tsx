export default function Problem() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute left-[6vw] top-[8vh] w-[54vw]">
        <h2 className="font-display font-bold tracking-tight text-[4vw] leading-[1.05] [text-wrap:balance]">Travelers in distress have no time to fact-check everything.</h2>
        <p className="mt-[4vh] text-[2.2vw] leading-relaxed text-muted w-[46vw]">Stress shrinks attention. Checking whether a number is genuine becomes one more task at the worst moment.</p>
      </div>
      <div className="absolute right-[6vw] top-[8vh] bottom-[8vh] w-[30vw] bg-deep border border-line px-[2.4vw] py-[4vh] flex flex-col">
        <div className="text-[1.5vw] uppercase tracking-[0.12em] text-accent font-bold">Illustrative scenario</div>
        <div className="mt-[4vh] flex flex-col gap-[3.5vh]">
          <div className="border-t border-line pt-[2vh]"><div className="font-display font-bold text-[2.2vw]">Flight disrupted</div><div className="text-[1.8vw] text-muted">Rebooking needed tonight</div></div>
          <div className="border-t border-line pt-[2vh]"><div className="font-display font-bold text-[2.2vw]">Hotel plans changed</div><div className="text-[1.8vw] text-muted">New stay, new contact</div></div>
          <div className="border-t border-line pt-[2vh]"><div className="font-display font-bold text-[2.2vw] text-accent">An unfamiliar number</div><div className="text-[1.8vw] text-muted">Is this really support?</div></div>
        </div>
        <div className="mt-auto text-[1.5vw] text-muted">Composite example, not research or a testimonial.</div>
      </div>
    </div>
  );
}
