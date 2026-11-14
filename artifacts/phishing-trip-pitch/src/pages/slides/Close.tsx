const base = import.meta.env.BASE_URL;

export default function Close() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute left-0 top-0 h-full w-[44vw] bg-accent" />
      <img src={`${base}hook.png`} crossOrigin="anonymous" alt="Hook returns with its lantern lit" className="absolute left-[2vw] top-[24vh] w-[42vw] -scale-x-100" />
      <div className="absolute left-[50vw] top-[14vh] w-[44vw]">
        <h2 className="font-display font-bold tracking-tighter text-[5.2vw] leading-[1.0]">Less time fact-checking.</h2>
        <h2 className="mt-[1vh] font-display font-bold tracking-tighter text-[5.2vw] leading-[1.0] text-accent">More attention for your trip.</h2>
      </div>
      <div className="absolute left-[50vw] bottom-[10vh] w-[42vw]">
        <div className="text-[1.6vw] uppercase tracking-[0.12em] text-muted font-bold">Try the demo</div>
        <div className="mt-[2vh] flex flex-col gap-[1.4vh] text-[2.2vw]">
          <div className="border-t border-line pt-[1.4vh]">Pick a number</div>
          <div className="border-t border-line pt-[1.4vh]">Inspect the evidence</div>
          <div className="border-t border-line pt-[1.4vh]">Decide your next step</div>
        </div>
      </div>
    </div>
  );
}
