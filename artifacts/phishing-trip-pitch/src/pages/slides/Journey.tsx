export default function Journey() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute left-[6vw] top-[8vh]"><h2 className="font-display font-bold tracking-tight text-[4vw] leading-[1.05] [text-wrap:balance]">A deliberate three-step journey</h2></div>
      <div className="absolute left-[6vw] right-[6vw] top-[32vh] grid grid-cols-3 gap-[4vw]">
        <div><div className="font-display font-bold text-[9vw] leading-none text-accent">1</div><div className="mt-[3vh] border-t border-line pt-[2vh] font-display font-bold text-[2.4vw]">Enter or select</div><div className="mt-[1vh] text-[2vw] text-muted">a number to check</div></div>
        <div><div className="font-display font-bold text-[9vw] leading-none text-accent">2</div><div className="mt-[3vh] border-t border-line pt-[2vh] font-display font-bold text-[2.4vw]">Read the evidence</div><div className="mt-[1vh] text-[2vw] text-muted">and its limitations</div></div>
        <div><div className="font-display font-bold text-[9vw] leading-none text-accent">3</div><div className="mt-[3vh] border-t border-line pt-[2vh] font-display font-bold text-[2.4vw]">Choose a channel</div><div className="mt-[1vh] text-[2vw] text-muted">sourced contact or company</div></div>
      </div>
      <div className="absolute left-[6vw] bottom-[8vh] bg-accent text-primary px-[2vw] py-[1.6vh] text-[2vw] font-bold">Selecting only prefills. A tap submits. The app never calls for you.</div>
    </div>
  );
}
