"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import * as Dialog from "@radix-ui/react-dialog";
import { LogOut, Menu, Moon, Search, Settings, Sun, X } from "lucide-react";
import { AppLauncher } from "@/components/app-launcher";
import { Brand } from "@/components/brand";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { appTiles, grcNav, utilityNav } from "@/lib/navigation";
import { cn, formatEnum } from "@/lib/utils";

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = [{ label: "Workspace", items: appTiles.slice(0, 3) }, { label: "GRC operations", items: grcNav }, { label: "Intelligence", items: utilityNav }];
  return <nav className="space-y-5">{groups.map((group) => <div key={group.label}><p className="mb-2 px-3 text-[10px] font-bold uppercase text-slate-600">{group.label}</p><div className="space-y-0.5">{group.items.map(({ href, label, icon: Icon }) => { const active = pathname === href || href !== "/app" && pathname.startsWith(href); return <Link key={label} href={href} onClick={onNavigate} className={cn("flex min-h-9 items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/[.06] hover:text-white", active && "bg-primary/15 text-primary")}><Icon className="size-4 shrink-0"/><span>{label}</span></Link>; })}</div></div>)}</nav>;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) { return <div className="flex h-full flex-col bg-[#071c2f] p-4"><Brand className="h-14 px-2"/><div className="mt-4 flex-1 overflow-y-auto pr-1"><Navigation onNavigate={onNavigate}/></div><div className="mt-4 border-t border-white/10 pt-3"><Link href="/app/settings" onClick={onNavigate} className="flex h-9 items-center gap-3 px-3 text-xs text-slate-400 hover:text-white"><Settings className="size-4"/>Settings</Link><button onClick={() => signOut({ callbackUrl: "/login" })} className="flex h-9 w-full items-center gap-3 px-3 text-xs text-slate-400 hover:text-white"><LogOut className="size-4"/>Sign out</button></div></div>; }

export function AppShell({ children, user }: { children: React.ReactNode; user: { name?: string | null; email?: string | null; tenantName: string; role: string } }) {
  const [palette, setPalette] = useState(false); const [mobile, setMobile] = useState(false); const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); setPalette(true); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  return <div className="min-h-screen overflow-x-hidden bg-background"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 lg:block"><Sidebar/></aside><div className="min-w-0 lg:pl-64"><header className="sticky top-0 z-40 flex min-h-16 items-center gap-2 border-b bg-background/90 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:px-5"><AppLauncher/><div className="hidden h-7 w-px bg-border sm:block"/><div className="hidden min-w-0 sm:block"><p className="truncate text-sm font-bold">{user.tenantName}</p><p className="text-[11px] text-muted-foreground">{formatEnum(user.role)}</p></div><button onClick={() => setPalette(true)} className="ml-auto hidden h-10 w-56 items-center gap-2 rounded-md border bg-card px-3 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"><Search className="size-3.5" aria-hidden="true"/>Find anything <kbd className="ml-auto">Ctrl K</kbd></button><Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{resolvedTheme === "dark" ? <Sun className="size-4" aria-hidden="true"/> : <Moon className="size-4" aria-hidden="true"/>}</Button><div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{user.name?.split(" ").map((part) => part[0]).join("").slice(0,2) || "U"}</div><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu className="size-5" aria-hidden="true"/></Button></header><main id="main-content" className="mx-auto w-full max-w-[1500px] overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main></div><CommandPalette open={palette} onOpenChange={setPalette}/><Dialog.Root open={mobile} onOpenChange={setMobile}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/70"/><Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(88vw,300px)] overscroll-contain"><Dialog.Title className="sr-only">Navigation</Dialog.Title><Dialog.Close className="absolute right-3 top-4 z-10 grid size-10 place-items-center rounded-md text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close navigation"><X className="size-5" aria-hidden="true"/></Dialog.Close><Sidebar onNavigate={() => setMobile(false)}/></Dialog.Content></Dialog.Portal></Dialog.Root></div>;
}