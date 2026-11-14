export default function Replit() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg text-text font-body">
      <div className="absolute left-0 top-0 h-full w-[38vw] bg-accent text-primary px-[6vw] py-[8vh] flex flex-col">
        <h2 className="font-display font-bold tracking-tight text-[4vw] leading-[1.05]">Built together in Replit</h2>
        <p className="mt-auto text-[1.8vw] leading-snug font-bold">AI helped build the product. It does not judge numbers at runtime.</p>
      </div>
      <div className="absolute left-[44vw] right-[6vw] top-[10vh] flex flex-col">
        <div className="border-t border-line py-[2.6vh]"><div className="font-display font-bold text-[2.2vw]">Agent-assisted development</div><div className="text-[1.8vw] text-muted">Iterated task by task</div></div>
        <div className="border-t border-line py-[2.6vh]"><div className="font-display font-bold text-[2.2vw]">One shared workspace</div><div className="text-[1.8vw] text-muted">Mobile, API and design side by side</div></div>
        <div className="border-t border-line py-[2.6vh]"><div className="font-display font-bold text-[2.2vw]">Expo and API previews</div><div className="text-[1.8vw] text-muted">Checked while building</div></div>
        <div className="border-t border-line py-[2.6vh]"><div className="font-display font-bold text-[2.2vw]">PostgreSQL-backed service</div><div className="text-[1.8vw] text-muted">Curated directory data</div></div>
        <div className="border-y border-line py-[2.6vh]"><div className="font-display font-bold text-[2.2vw]">Test and build workflows</div><div className="text-[1.8vw] text-muted">Run before changes land</div></div>
      </div>
    </div>
  );
}
