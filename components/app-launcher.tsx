"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Grid3X3, Plus, Search, X } from "lucide-react";
import { appTiles, grcNav, quickCreates, utilityNav } from "@/lib/navigation";

export function AppLauncher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const tiles = useMemo(() => [...appTiles, ...grcNav, ...utilityNav].filter((item) => item.label.toLowerCase().includes(query.toLowerCase().trim())), [query]);

  useEffect(() => {
    function close(event: MouseEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);

  return <div ref={root} className="relative shrink-0">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Open app launcher" aria-haspopup="dialog" aria-expanded={open} className="grid size-10 place-items-center rounded-md text-slate-300 transition-colors hover:bg-white/[.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {open ? <X className="size-5"/> : <Grid3X3 className="size-5" strokeWidth={1.8}/>} 
    </button>
    {open && <div role="dialog" aria-label="BeyondBeams apps" className="absolute left-0 top-12 z-50 w-[min(94vw,620px)] overflow-hidden rounded-lg border border-white/10 bg-[#1f1f1f] text-white shadow-2xl shadow-black/50">
      <div className="p-4 pb-2">
        <label className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-4 focus-within:border-primary/70">
          <Search className="size-4 text-slate-400"/><span className="sr-only">Find apps</span>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find apps…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"/>
        </label>
      </div>
      <div className="max-h-[56vh] overflow-y-auto p-3">
        {tiles.length ? <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">{tiles.map(({ href, label, icon: Icon, ...item }) => <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-md px-2 py-3 text-center text-[11px] leading-4 text-slate-300 transition duration-150 hover:scale-[1.02] hover:bg-white/[.07] hover:text-white focus-visible:bg-white/[.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"><Icon className={`size-6 ${"color" in item ? item.color : "text-teal-300"}`} strokeWidth={1.7}/><span>{label}</span></Link>)}</div> : <p className="py-12 text-center text-sm text-slate-400">No apps match “{query}”.</p>}
      </div>
      <div className="border-t border-white/10 bg-[#292929] p-3"><p className="mb-2 px-2 text-[10px] font-bold uppercase text-slate-500">Quick create</p><div className="grid grid-cols-2 gap-1 sm:grid-cols-4">{quickCreates.map(({ href, label, icon: Icon }) => <Link key={label} href={href} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 text-[11px] text-slate-300 hover:bg-white/[.07] hover:text-white"><span className="relative"><Icon className="size-4"/><Plus className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-primary text-[#071c2f]" strokeWidth={3}/></span>{label}</Link>)}</div></div>
    </div>}
  </div>;
}