export default function Trust() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute left-[6vw] top-[8vh]"><h2 className="font-display font-bold tracking-tight text-[4vw] leading-[1.05] [text-wrap:balance]">Trust includes uncertainty</h2></div>
      <div className="absolute left-[6vw] right-[6vw] top-[30vh] grid grid-cols-2 gap-x-[4vw] gap-y-[6vh]">
        <div><div className="font-display font-bold text-[3vw] text-accent">Match ≠ safe</div><div className="mt-[1vh] text-[2vw] text-muted">An official-source match is not a safety guarantee</div></div>
        <div><div className="font-display font-bold text-[3vw] text-accent">Unknown ≠ fraud</div><div className="mt-[1vh] text-[2vw] text-muted">Missing evidence is shown as missing, nothing more</div></div>
        <div><div className="font-display font-bold text-[3vw]">No check history</div><div className="mt-[1vh] text-[2vw] text-muted">Submitted checks are not saved as history</div></div>
        <div><div className="font-display font-bold text-[3vw]">IDs, not bookings</div><div className="mt-[1vh] text-[2vw] text-muted">My Trips stores curated company IDs only</div></div>
      </div>
      <div className="absolute left-[6vw] bottom-[8vh] text-[1.6vw] text-muted">Source dates and provider limitations stay visible in the app.</div>
    </div>
  );
}
