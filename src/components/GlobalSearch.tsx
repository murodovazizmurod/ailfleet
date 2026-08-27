"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

type Hit = { type: string; label: string; sublabel: string; href: string };

const TYPE_COLORS: Record<string, string> = {
  Vehicle: "bg-blue-50 text-blue-700",
  Contact: "bg-purple-50 text-purple-700",
  Issue: "bg-amber-50 text-amber-700",
  "Work Order": "bg-indigo-50 text-indigo-700",
  "Service Entry": "bg-emerald-50 text-emerald-700",
  Part: "bg-orange-50 text-orange-700",
  Vendor: "bg-slate-100 text-slate-600",
};

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Ctrl+K / Cmd+K / "/" focuses the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !inField)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { hits: Hit[] };
          setHits(data.hits);
          setActive(0);
          setOpen(true);
        }
      } catch {
        /* aborted or offline — keep previous results */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = useCallback(
    (hit: Hit) => {
      setOpen(false);
      setQ("");
      setHits([]);
      inputRef.current?.blur();
      router.push(hit.href);
    },
    [router]
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={onInputKey}
          placeholder="Search AIlFleet…"
          className="block w-full rounded-lg border-0 bg-white py-1.5 pl-9 pr-16 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <kbd>Ctrl K</kbd>}
        </span>
      </div>

      {open && q.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-black/40">
          {hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              {loading ? "Searching…" : `No results for “${q.trim()}”`}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 py-1">
              {hits.map((h, i) => (
                <li key={`${h.href}-${i}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                      i === active ? "bg-slate-100" : ""
                    }`}
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        TYPE_COLORS[h.type] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {h.type}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {h.label}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{h.sublabel}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
