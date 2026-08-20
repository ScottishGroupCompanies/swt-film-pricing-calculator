"use client";

import { useState, useCallback, useMemo, useRef, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  PRICING_GROUPS, MIN_PRICE, MIN_DIM_DEFAULT, DEFAULT_FEE_PCT,
  FILMS, BRANDS, BRAND_COLORS,
  fmt$, fmtSF, getCommRate, getOverUnderComm, calcRowGeometry, newRow, initials,
  type User, type Film, type RowData, type RowCalc,
} from "@/lib/pricingData";
import {
  buildCustomerProposal, buildInternalRecord, buildCommissionSheet, buildPrintableHTML,
  downloadFile, printHTML, type ProposalData, type ProposalLine,
} from "@/lib/proposal";

// ─── BRAND THEME ──────────────────────────────────────────────────────────

const THEME = {
  green: "#82b45a",
  greenDark: "#6e9a47",
  greenLight: "#acc686",
  greenBg: "#f0f7e8",
  greenBorder: "#c8dea0",
  darkGray: "#515251",
  medGray: "#7a7b7a",
  lightGray: "#f7f8f5",
  border: "#e5e7eb",
  white: "#ffffff",
  textDark: "#3a3b3a",
  textMuted: "#888",
};

// ─── RESPONSIVE BREAKPOINT HOOK ───────────────────────────────────────────
// The whole component uses inline JS styles (no CSS modules/Tailwind), so
// responsive behavior is driven from here rather than @media queries.
// isMobile: phones (<640px) — single column everywhere, line items become
// stacked cards instead of a grid table.
// isTablet: iPads/small laptops (640–1023px) — sidebar stacks below the
// form instead of sitting beside it, but line items keep the grid table
// (just with fewer/narrower columns).
function useBreakpoint() {
  // useSyncExternalStore is the React-recommended way to subscribe to an
  // external mutable value like window.innerWidth: it has a built-in
  // server snapshot (so SSR and the first client render always agree —
  // no hydration mismatch) and needs no setState-in-effect at all.
  const width = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("resize", onStoreChange);
      return () => window.removeEventListener("resize", onStoreChange);
    },
    () => window.innerWidth,
    () => 1280 // server snapshot — must match what SSR renders (desktop default)
  );
  return {
    width,
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
  };
}

// ─── FILM PICKER (portal dropdown, escapes overflow clipping) ────────────

import { createPortal } from "react-dom";

function FilmPicker({
  film, pgOverride, onFilm, onPgOverride,
}: {
  film: Film | null;
  pgOverride: number | null;
  onFilm: (f: Film | null) => void;
  onPgOverride: (v: number | null) => void;
}) {
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 580 });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Calculate position when opening
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // On phones, use nearly the full viewport width instead of a fixed
      // 580px dropdown (which would overflow and force horizontal scroll).
      const dropdownWidth = isMobile ? Math.min(window.innerWidth - 24, 420) : 580;
      // Position below the trigger, aligned to left edge
      let left = isMobile ? 12 : rect.left;
      // If it would overflow the right edge, shift left
      if (!isMobile && left + dropdownWidth > window.innerWidth - 16) {
        left = window.innerWidth - dropdownWidth - 16;
      }
      // If it would overflow the left edge, align to left
      if (left < 16 && !isMobile) left = 16;

      const top = rect.bottom + 4;
      setDropdownPos({ top, left, width: dropdownWidth });
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, isMobile]);

  // Recalculate on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const dropdownWidth = isMobile ? Math.min(window.innerWidth - 24, 420) : 580;
        const left = isMobile ? 12 : rect.left;
        setDropdownPos({ top: rect.bottom + 4, left, width: dropdownWidth });
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, isMobile]);

  const filtered = useMemo(() => {
    const lo = q.toLowerCase();
    let list = FILMS;
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(lo));
    if (brandFilter) list = list.filter((f) => f.brand === brandFilter);
    return BRANDS.map((b) => ({
      brand: b,
      films: list.filter((f) => f.brand === b),
    })).filter((g) => g.films.length > 0);
  }, [q, brandFilter]);

  const effectivePg = pgOverride ?? film?.pg ?? null;

  return (
    <>
      {/* Trigger button — inline in the table */}
      <div
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 10px",
          border: `1px solid ${open ? THEME.green : THEME.border}`,
          borderRadius: 8,
          background: open ? THEME.white : film ? THEME.greenBg : THEME.white,
          cursor: "pointer", minWidth: 0,
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        {film ? (
          <>
            <span style={{
              fontSize: 10, fontWeight: 700, color: BRAND_COLORS[film.brand],
              background: BRAND_COLORS[film.brand] + "18", padding: "2px 6px", borderRadius: 4, flexShrink: 0,
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              {film.brand}
            </span>
            <span style={{
              fontSize: 12, color: THEME.textDark, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
            }}>
              {film.name}
            </span>
            <span style={{ fontSize: 10, color: THEME.textMuted, flexShrink: 0, fontWeight: 500 }}>
              Grp {effectivePg}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: "#aaa", flex: 1 }}>Select film…</span>
        )}
        <svg width="10" height="10" fill="none" stroke={THEME.textMuted} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Dropdown — rendered via portal at body level, fixed positioned */}
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            background: THEME.white,
            border: `1px solid ${THEME.border}`,
            borderRadius: 12,
            zIndex: 9999,
            boxShadow: "0 16px 48px rgba(0,0,0,.18)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "min(520px, calc(100vh - 80px))",
          }}
        >
          {/* Search + brand filters */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${THEME.border}` }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <svg style={{ position: "absolute", left: 10, top: 8, color: THEME.textMuted }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search 295 films by name…"
                  style={{
                    width: "100%", padding: "7px 10px 7px 32px",
                    border: `1px solid ${THEME.border}`, borderRadius: 8,
                    fontSize: 13, fontFamily: "inherit", outline: "none",
                    color: THEME.textDark,
                  }}
                />
              </div>
              <select
                value={pgOverride ?? film?.pg ?? ""}
                onChange={(e) => onPgOverride(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  padding: "7px 8px", border: `1px solid ${THEME.border}`, borderRadius: 8,
                  fontSize: 12, fontFamily: "inherit", color: THEME.textDark, background: THEME.white,
                }}
              >
                <option value="">Auto group</option>
                {Object.entries(PRICING_GROUPS).map(([g, p]) => (
                  <option key={g} value={g}>Grp {g} · ${p.toFixed(2)}/SF</option>
                ))}
              </select>
            </div>
            {/* Brand filter pills */}
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => setBrandFilter(null)}
                style={{
                  padding: "3px 10px", fontSize: 11, fontWeight: 500,
                  border: `1px solid ${brandFilter === null ? THEME.green : THEME.border}`,
                  borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                  background: brandFilter === null ? THEME.greenBg : THEME.white,
                  color: brandFilter === null ? THEME.greenDark : THEME.textMuted,
                }}
              >
                All
              </button>
              {BRANDS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBrandFilter(brandFilter === b ? null : b)}
                  style={{
                    padding: "3px 10px", fontSize: 11, fontWeight: 500,
                    border: `1px solid ${brandFilter === b ? BRAND_COLORS[b] : THEME.border}`,
                    borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                    background: brandFilter === b ? BRAND_COLORS[b] + "15" : THEME.white,
                    color: brandFilter === b ? BRAND_COLORS[b] : THEME.textMuted,
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Film list — 2 columns, many rows visible, scrollable */}
          <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", color: THEME.textMuted, fontSize: 13 }}>
                No films found matching &quot;{q}&quot;
              </div>
            )}
            {filtered.map(({ brand, films }) => (
              <div key={brand}>
                <div style={{
                  padding: "6px 14px 4px", fontSize: 10, fontWeight: 700,
                  color: BRAND_COLORS[brand], textTransform: "uppercase",
                  letterSpacing: ".08em", background: THEME.lightGray,
                  position: "sticky", top: 0,
                }}>
                  {brand} ({films.length})
                </div>
                <div style={{
                  display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: 0, padding: "0 4px",
                }}>
                  {films.map((f) => (
                    <div
                      key={f.name}
                      onClick={() => { onFilm(f); setOpen(false); setQ(""); setBrandFilter(null); }}
                      style={{
                        padding: "8px 10px", cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: 2,
                        fontSize: 12, color: THEME.textDark,
                        borderRadius: 6,
                        borderBottom: `1px solid ${THEME.lightGray}`,
                        background: film?.name === f.name ? THEME.greenBg : "transparent",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = film?.name === f.name ? THEME.greenBg : THEME.lightGray)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = film?.name === f.name ? THEME.greenBg : "transparent")}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.name}
                      </span>
                      <span style={{ fontSize: 10, color: THEME.textMuted, display: "flex", gap: 8 }}>
                        <span>Grp {f.pg}</span>
                        {f.psf != null && <span>${f.psf.toFixed(2)}/SF</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {film && (
            <div
              onClick={() => { onFilm(null); onPgOverride(null); setOpen(false); }}
              style={{
                padding: "9px 12px", borderTop: `1px solid ${THEME.border}`,
                fontSize: 12, color: "#e04d46", cursor: "pointer", textAlign: "center",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              ✕ Clear film selection
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── DESIGNER PICKER (portal dropdown) ────────────────────────────────────

// Read-only badge showing the signed-in user — no dropdown, no way to
// switch to another rep. The user's identity comes entirely from their
// login session (see /api/auth/me), never from client-side selection, so
// nobody can view another rep's commission data by picking their name.
function CurrentUserBadge({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const { isMobile } = useBreakpoint();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: THEME.white, border: `1px solid ${THEME.border}`,
      borderRadius: 8, padding: "5px 10px 5px 5px",
      maxWidth: isMobile ? 170 : undefined,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: THEME.green,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}>
        {user ? initials(user.name) : "?"}
      </div>
      <div style={{ overflow: "hidden", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user ? user.name : "…"}
        </div>
        {user && !isMobile && (
          <div style={{ fontSize: 10, color: THEME.textMuted }}>{user.loc}</div>
        )}
      </div>
      <button
        onClick={onLogout}
        title="Log out"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: THEME.textMuted, fontSize: 11, fontFamily: "inherit",
          padding: "4px 6px", flexShrink: 0,
        }}
      >
        Log out
      </button>
    </div>
  );
}

// ─── CONTACT SEARCH PICKER (search previous Zoho contacts, autofill) ─────

export interface ZohoContactResult {
  type: "contact" | "deal";
  id: string;
  dealId?: string | null;
  opportunityNumber?: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  cityStateZip: string;
  installationAddress?: string;
  installationCityStateZip?: string;
  isCommercial?: boolean;
  accountId?: string | null;
  companyName?: string;
  companyAddress?: string;
  companyCityStateZip?: string;
  companyPhone?: string;
  companyEmail?: string;
}

function ContactSearchPicker({
  onSelect,
}: {
  onSelect: (c: ZohoContactResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ZohoContactResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Debounced search — triggered directly from the input's onChange
  // handler (not a useEffect watching `q`) so we never call setState
  // synchronously inside an effect body.
  const runSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/zoho/search-contacts?q=${encodeURIComponent(value.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setResults(data.results || []);
          } else {
            setError(data.error || "Search failed");
            setResults([]);
          }
        })
        .catch(() => { setError("Network error"); setResults([]); })
        .finally(() => setLoading(false));
    }, 350);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
          border: `1px solid ${open ? THEME.green : THEME.greenBorder}`,
          borderRadius: 8, cursor: "pointer",
          background: THEME.greenBg,
          transition: "border-color 0.15s",
        }}
      >
        <svg width="14" height="14" fill="none" stroke={THEME.greenDark} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <span style={{ fontSize: 13, color: THEME.greenDark, fontWeight: 500 }}>
          Search previous contacts &amp; jobs in Zoho…
        </span>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: Math.min(Math.max(dropdownPos.width, 360), window.innerWidth - 24),
            background: THEME.white,
            border: `1px solid ${THEME.border}`,
            borderRadius: 12,
            zIndex: 9999,
            boxShadow: "0 16px 48px rgba(0,0,0,.18)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "min(400px, calc(100vh - 80px))",
          }}
        >
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${THEME.border}` }}>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { const v = e.target.value; setQ(v); runSearch(v); }}
              placeholder="Type a name, email, or phone…"
              style={{
                width: "100%", padding: "7px 10px",
                border: `1px solid ${THEME.border}`, borderRadius: 8,
                fontSize: 13, fontFamily: "inherit", outline: "none",
                color: THEME.textDark,
              }}
            />
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && (
              <div style={{ padding: "16px", textAlign: "center", color: THEME.textMuted, fontSize: 12 }}>
                Searching Zoho…
              </div>
            )}
            {!loading && error && (
              <div style={{ padding: "16px", textAlign: "center", color: "#e04d46", fontSize: 12 }}>
                {error}
              </div>
            )}
            {!loading && !error && q.trim().length >= 2 && results.length === 0 && (
              <div style={{ padding: "16px", textAlign: "center", color: THEME.textMuted, fontSize: 12 }}>
                No contacts or jobs found matching &quot;{q}&quot;
              </div>
            )}
            {!loading && q.trim().length < 2 && (
              <div style={{ padding: "16px", textAlign: "center", color: THEME.textMuted, fontSize: 12 }}>
                Type at least 2 characters to search
              </div>
            )}
            {results.map((c) => {
              const displayAddress = c.type === "deal"
                ? [c.installationAddress, c.installationCityStateZip].filter(Boolean).join(", ")
                : [c.address, c.cityStateZip].filter(Boolean).join(", ");
              return (
                <div
                  key={`${c.type}-${c.id}-${c.dealId || ""}`}
                  onClick={() => { onSelect(c); setOpen(false); setQ(""); setResults([]); }}
                  style={{
                    padding: "10px 14px", cursor: "pointer",
                    borderBottom: `1px solid ${THEME.lightGray}`,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = THEME.lightGray)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textDark }}>{c.name}</div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em",
                      padding: "2px 6px", borderRadius: 4,
                      background: c.type === "deal" ? THEME.greenBg : THEME.lightGray,
                      color: c.type === "deal" ? THEME.greenDark : THEME.textMuted,
                    }}>
                      {c.type === "deal" ? (c.opportunityNumber || "Job") : "Contact"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
                    {displayAddress || "No address on file"}
                  </div>
                  {(c.email || c.phone) && (
                    <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 1 }}>
                      {[c.phone, c.email].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── STYLE CONSTANTS ──────────────────────────────────────────────────────


const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: THEME.greenDark,
  textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8,
  fontFamily: "var(--font-inter), sans-serif",
};

const inputSt: React.CSSProperties = {
  padding: "9px 12px", border: `1px solid ${THEME.border}`, borderRadius: 8,
  background: THEME.white, color: THEME.textDark, fontSize: 13,
  fontFamily: "inherit", outline: "none", width: "100%",
  transition: "border-color 0.15s",
};

const cellSt: React.CSSProperties = {
  padding: "6px 8px", border: "1px solid transparent", borderRadius: 6,
  background: "transparent", color: THEME.textDark, fontSize: 12,
  fontFamily: "inherit", outline: "none",
};

const smallBtnSt: React.CSSProperties = {
  padding: "6px 12px", background: THEME.white, border: `1px solid ${THEME.border}`,
  borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer",
  fontFamily: "inherit", color: THEME.darkGray,
  transition: "all 0.15s",
};

// ─── MAIN APP ────────────────────────────────────────────────────────────

export default function PricingCalculator() {
  const { isMobile, isTablet } = useBreakpoint();
  // Collapses N-column form grids to 1 column on phones so fields never get
  // squeezed unreadably narrow; tablets keep multi-column but never more
  // than 2 wide (3-column grids become 2 on tablet).
  const gridCols = (n: 2 | 3): string => {
    if (isMobile) return "1fr";
    if (isTablet) return n === 3 ? "1fr 1fr" : "1fr 1fr";
    return n === 3 ? "1fr 1fr 1fr" : "1fr 1fr";
  };
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  // Fetch the logged-in user's own data on mount. Never fetches or shows
  // any other user's info — the server only ever returns the caller's own
  // record based on their signed session cookie (see /api/auth/me).
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("not authenticated");
        return res.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => {
        // Session invalid/expired — middleware would normally redirect
        // before this ever renders, but bounce to /login as a fallback.
        router.push("/login");
      });
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [cityStateZip, setCityStateZip] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [existingContactId, setExistingContactId] = useState<string | null>(null);
  const [jobType, setJobType] = useState<"Residential" | "Commercial">("Residential");
  const [companyName, setCompanyName] = useState(""); // Commercial: business/property name (e.g. "QuikTrip")
  const [companyAddress, setCompanyAddress] = useState(""); // Commercial: business street address (often different from job site)
  const [companyCityStateZip, setCompanyCityStateZip] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [contactPersonName, setContactPersonName] = useState(""); // Commercial: person we're dealing with, if different from the account
  const [contactPersonPhone, setContactPersonPhone] = useState("");
  const [contactPersonEmail, setContactPersonEmail] = useState("");
  const [contactBillingAddress, setContactBillingAddress] = useState(""); // Commercial: contact's own billing address (often different from job/business address)
  const [contactBillingCityStateZip, setContactBillingCityStateZip] = useState("");
  const [opportunityName, setOpportunityName] = useState("");
  const [opportunityNameTouched, setOpportunityNameTouched] = useState(false);
  const [minDim, setMinDim] = useState(MIN_DIM_DEFAULT);
  const [rows, setRows] = useState<RowData[]>([newRow(), newRow(), newRow()]);
  const [activeTab, setActiveTab] = useState<"customer" | "internal" | "commission">("customer");
  const [showProposals, setShowProposals] = useState(false);
  const [chargedToClient, setChargedToClient] = useState<string>("");
  const [zohoStatus, setZohoStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [zohoResult, setZohoResult] = useState<{ contactId?: string; dealId?: string; opportunityNumber?: string | null; sheetRowAdded?: boolean; errors?: string[] } | null>(null);
  const [zohoEnabled, setZohoEnabled] = useState<boolean | null>(null);
  const [estimateStatus, setEstimateStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [estimateResult, setEstimateResult] = useState<{ attachedTo?: string; pdfUrl?: string; errors?: string[] } | null>(null);
  const [estimateRecordStatus, setEstimateRecordStatus] = useState<"idle" | "submitting" | "success" | "error" | "not_configured">("idle");
  const [estimateRecordResult, setEstimateRecordResult] = useState<{ estimateId?: string; estimateNumber?: string; crmRecordId?: string | null; estimateUrl?: string | null; syncPending?: boolean; error?: string } | null>(null);

  // Editable post-calculation summary fields
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountPct, setDiscountPct] = useState<string>("");
  const [attachmentOther, setAttachmentOther] = useState<string>(""); // flat $ adjustment (e.g. "Other" line on the Film Commission sheet) — applied before the fee
  const [feePct, setFeePct] = useState<string>(String(DEFAULT_FEE_PCT));
  const [deposit, setDeposit] = useState<string>(""); 

  const updateRow = useCallback((id: number, field: keyof RowData, val: string | Film | number | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  }, []);
  const removeRow = useCallback((id: number) => setRows((prev) => prev.filter((r) => r.id !== id)), []);
  const addRow = useCallback(() => setRows((prev) => [...prev, newRow()]), []);

  // Suggested Opportunity Name, matching SWT's naming convention:
  // "LastName StreetNumber City ST MONYY" (e.g. "Vernon 32 Dallas TX AUG26")
  const suggestedOpportunityName = useMemo(() => {
    const nameParts = customer.trim().split(/\s+/).filter(Boolean);
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : (nameParts[0] || "");
    const streetNumMatch = address.match(/^\s*(\d+)/);
    const streetNum = streetNumMatch ? streetNumMatch[1] : "";
    const cszMatch = cityStateZip.match(/^(.+?),\s*([A-Za-z]{2})\b/);
    const city = cszMatch ? cszMatch[1].trim() : "";
    const state = cszMatch ? cszMatch[2].toUpperCase() : "";
    const monYY = new Date().toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", "").toUpperCase();
    const nameOrCompany = jobType === "Commercial" && companyName.trim() ? companyName.trim() : lastName;
    return [nameOrCompany, streetNum, city, state, monYY].filter(Boolean).join(" ");
  }, [customer, address, cityStateZip, jobType, companyName]);

  // Auto-fill the Opportunity Name with the suggestion, but only while the
  // rep hasn't manually edited it — once they type in that field directly,
  // stop overwriting their input. Computed directly (not synced via effect)
  // to avoid cascading-render setState-in-effect issues.
  const effectiveOpportunityName = opportunityNameTouched ? opportunityName : suggestedOpportunityName;

  const lineCalcs = useMemo<(RowCalc | null)[]>(() => {
    return rows.map((row) => {
      const geo = calcRowGeometry(row, minDim);
      if (!geo) return null;
      const pg = row.pgOverride ?? row.film?.pg ?? null;
      const psf = pg ? PRICING_GROUPS[pg] : null;
      const calculatedLineTotal = psf ? geo.chargedSF * psf : null;
      const overrideVal = row.lineTotalOverride.trim() !== "" ? parseFloat(row.lineTotalOverride) : null;
      const isOverridden = overrideVal != null && !isNaN(overrideVal);
      const lineTotal = isOverridden ? overrideVal : calculatedLineTotal;
      return { ...geo, pg, psf, lineTotal, calculatedLineTotal, isOverridden };
    });
  }, [rows, minDim]);

  const totals = useMemo(() => {
    let totalActual = 0, totalCharged = 0, totalPrice = 0, winCount = 0;
    let highestPg = 0;
    lineCalcs.forEach((c) => {
      if (!c) return;
      totalActual += c.actualSF;
      totalCharged += c.chargedSF;
      winCount += c.qty;
      if (c.lineTotal) totalPrice += c.lineTotal;
      if (c.pg && c.pg > highestPg) highestPg = c.pg;
    });
    const hasPrice = totalPrice > 0;
    const rawTotal = hasPrice ? totalPrice : null;
    const total = rawTotal != null ? Math.max(rawTotal, MIN_PRICE) : null;
    const minAdj = total != null && rawTotal != null && total > rawTotal ? total - rawTotal : 0;

    // Editable post-calculation summary: Film Total -> Discount -> Attachment/Other -> Subtotal -> Fees -> Total Cost -> Deposit -> Balance Due
    const filmTotal = total ?? 0;
    // Discount is entered as a % of the Film Total (applied before the fee).
    const discountPctNum = discountEnabled && discountPct ? parseFloat(discountPct) || 0 : 0;
    const discount = filmTotal * (discountPctNum / 100);
    // Attachment/Other is a flat $ adjustment (matches the "Other" line on the
    // Film Commission sheet) — applied after the discount, before the fee.
    // Enter a negative number for a deduction (e.g. -1904.17), positive for an add-on.
    const attachmentOtherAmt = attachmentOther ? parseFloat(attachmentOther) || 0 : 0;
    const subtotalAfterDiscount = Math.max(0, filmTotal - discount + attachmentOtherAmt);
    const feePctNum = feePct ? parseFloat(feePct) || 0 : 0;
    const feeAmount = subtotalAfterDiscount * (feePctNum / 100);
    const totalCost = subtotalAfterDiscount + feeAmount;
    const depositAmt = deposit ? parseFloat(deposit) || 0 : 0;
    const balanceDue = totalCost - depositAmt;

    // Commission — matches the Film Commission sheet exactly:
    //   Base commission = user's rate x Subtotal (Film Total after discount + Attachment/Other, before the fee)
    //   Difference = Charged to Client - Total Cost
    //   If Difference > 0 (overcharged the client): Over/Under = Difference x the user's own commission rate
    //   If Difference <= 0 (undercharged / a loss): Over/Under = Difference x 0.5 (a 50/50 split of the loss with the company)
    //   Total Commission = Base + Over/Under
    const commRate = user ? getCommRate(user) : null;
    const baseCommission = commRate != null ? subtotalAfterDiscount * commRate : null;

    const charged = chargedToClient ? parseFloat(chargedToClient) : null;
    const difference = charged != null ? charged - totalCost : 0;
    const overUnderComm = getOverUnderComm(difference, commRate);
    const totalCommission = baseCommission != null ? baseCommission + overUnderComm : null;

    return {
      totalActual, totalCharged, totalPrice, winCount, highestPg, rawTotal, total, minAdj,
      commRate, baseCommission, charged, difference, overUnderComm, totalCommission,
      filmTotal, discountPctNum, discount, attachmentOtherAmt, subtotalAfterDiscount, feePctNum, feeAmount, totalCost, depositAmt, balanceDue,
    };
  }, [lineCalcs, user, chargedToClient, discountEnabled, discountPct, attachmentOther, feePct, deposit]);

  const proposalData = useMemo<ProposalData | null>(() => {
    if (!totals.total) return null;
    const lines: ProposalLine[] = rows.map((row, i) => {
      const c = lineCalcs[i];
      if (!c || !c.lineTotal) return null as unknown as ProposalLine;
      return {
        desc: row.desc || `Window ${i + 1}`,
        dims: `${c.w}"×${c.h}"`,
        qty: c.qty,
        lineTotal: c.lineTotal,
        film: row.film?.name || "—",
        brand: row.film?.brand || "—",
        pg: c.pg,
        psf: c.psf,
        rollW: c.rollW,
        actualSF: c.actualSF,
        chargedSF: c.chargedSF,
        wastageSF: c.wastageSF,
      };
    }).filter(Boolean);

    return {
      customer, address, cityStateZip, phone, email,
      userName: user?.name || "",
      userLoc: user?.loc || "",
      date: new Date().toLocaleDateString(),
      lines,
      totalActual: totals.totalActual,
      totalCharged: totals.totalCharged,
      subtotal: totals.rawTotal || 0,
      minAdj: totals.minAdj,
      total: totals.total || 0,
      highestPg: totals.highestPg,
      commission: totals.totalCommission,
      commRate: totals.commRate,
      chargedToClient: totals.charged,
      difference: totals.difference,
      overUnderComm: totals.overUnderComm,
      baseCommission: totals.baseCommission,
      minDim,
      // Editable summary breakdown
      discount: totals.discount,
      attachmentOther: totals.attachmentOtherAmt,
      subtotalAfterDiscount: totals.subtotalAfterDiscount,
      feePct: totals.feePctNum,
      feeAmount: totals.feeAmount,
      totalCost: totals.totalCost,
      deposit: totals.depositAmt,
      balanceDue: totals.balanceDue,
      // Job type + Opportunity naming
      jobType,
      companyName,
      companyAddress,
      companyCityStateZip,
      companyPhone,
      companyEmail,
      contactPersonName,
      contactPersonPhone,
      contactPersonEmail,
      contactBillingAddress,
      contactBillingCityStateZip,
      opportunityName: effectiveOpportunityName,
    };
  }, [
    rows, lineCalcs, totals, customer, address, cityStateZip, phone, email, user, minDim,
    jobType, companyName, companyAddress, companyCityStateZip, companyPhone, companyEmail,
    contactPersonName, contactPersonPhone, contactPersonEmail, contactBillingAddress, contactBillingCityStateZip,
    effectiveOpportunityName,
  ]);

  function generateProposals() {
    if (!totals.total) return;
    setShowProposals(true);
    setActiveTab("customer");
  }

  function handlePrint() {
    if (!proposalData) return;
    if (activeTab === "commission") {
      // The branded customer template doesn't have commission fields — print
      // the plain-text Commission Sheet in a simple monospace wrapper instead.
      const text = buildCommissionSheet(proposalData);
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      printHTML(`<pre style="font-family: ui-monospace, 'SF Mono', monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; padding: 24px;">${escaped}</pre>`);
      return;
    }
    printHTML(buildPrintableHTML(proposalData));
  }

  function handleDownloadText() {
    if (!proposalData) return;
    const text = activeTab === "customer"
      ? buildCustomerProposal(proposalData)
      : activeTab === "internal"
        ? buildInternalRecord(proposalData)
        : buildCommissionSheet(proposalData);
    const filename = `SWT-${(customer || "proposal").replace(/\s+/g, "-")}-${activeTab}.txt`;
    downloadFile(filename, text, "text/plain");
  }

  function handleDownloadHTML() {
    if (!proposalData) return;
    if (activeTab === "commission") {
      const text = buildCommissionSheet(proposalData);
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<pre style="font-family: ui-monospace, 'SF Mono', monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; padding: 24px;">${escaped}</pre>`;
      const filename = `SWT-${(customer || "proposal").replace(/\s+/g, "-")}-commission.html`;
      downloadFile(filename, html, "text/html");
      return;
    }
    const html = buildPrintableHTML(proposalData);
    const filename = `SWT-${(customer || "proposal").replace(/\s+/g, "-")}.html`;
    downloadFile(filename, html, "text/html");
  }

  function resetJob() {
    setCustomer("");
    setAddress("");
    setCityStateZip("");
    setPhone("");
    setEmail("");
    setExistingContactId(null);
    setJobType("Residential");
    setCompanyName("");
    setCompanyAddress("");
    setCompanyCityStateZip("");
    setCompanyPhone("");
    setCompanyEmail("");
    setContactPersonName("");
    setContactPersonPhone("");
    setContactPersonEmail("");
    setContactBillingAddress("");
    setContactBillingCityStateZip("");
    setOpportunityName("");
    setOpportunityNameTouched(false);
    setRows([newRow(), newRow(), newRow()]);
    setShowProposals(false);
    setChargedToClient("");
    setZohoStatus("idle");
    setZohoResult(null);
    setEstimateStatus("idle");
    setEstimateResult(null);
    setEstimateRecordStatus("idle");
    setEstimateRecordResult(null);
    setDiscountEnabled(false);
    setDiscountPct("");
    setAttachmentOther("");
    setFeePct(String(DEFAULT_FEE_PCT));
    setDeposit("");
  }

  // Check if Zoho is configured on mount
  useEffect(() => {
    fetch("/api/zoho/health-check")
      .then((r) => r.json())
      .then((data) => setZohoEnabled(data.configured === true))
      .catch(() => setZohoEnabled(false));
  }, []);

  async function submitToZoho() {
    if (!proposalData || !user) return;
    setZohoStatus("submitting");
    setZohoResult(null);

    try {
      // Submit pricing data
      const resp = await fetch("/api/zoho/submit-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proposalData, existingContactId }),
      });
      const data = await resp.json();

      if (data.success) {
        setZohoResult(data);
        setZohoStatus("success");
      } else {
        setZohoResult(data);
        setZohoStatus("error");
      }
    } catch (e) {
      setZohoResult({ errors: [e instanceof Error ? e.message : "Network error"] });
      setZohoStatus("error");
    }
  }

  async function generateEstimate() {
    if (!proposalData) return;
    setEstimateStatus("submitting");
    setEstimateResult(null);

    try {
      const resp = await fetch("/api/zoho/generate-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...proposalData,
          contactId: zohoResult?.contactId,
          dealId: zohoResult?.dealId,
        }),
      });
      const data = await resp.json();

      if (data.success) {
        setEstimateResult(data);
        setEstimateStatus("success");
      } else {
        setEstimateResult(data);
        setEstimateStatus("error");
      }
    } catch (e) {
      setEstimateResult({ errors: [e instanceof Error ? e.message : "Network error"] });
      setEstimateStatus("error");
    }
  }

  async function fillOutEstimateRecord() {
    if (!proposalData || !zohoResult?.dealId) return;
    setEstimateRecordStatus("submitting");
    setEstimateRecordResult(null);

    try {
      const resp = await fetch("/api/zoho/create-estimate-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: zohoResult.dealId,
          opportunityNumber: zohoResult.opportunityNumber,
          contactId: zohoResult.contactId,
          customer: proposalData.customer,
          address: proposalData.address,
          cityStateZip: proposalData.cityStateZip,
          phone: proposalData.phone,
          email: proposalData.email,
          date: proposalData.date,
          jobType: proposalData.jobType,
          companyName: proposalData.companyName,
          companyAddress: proposalData.companyAddress,
          companyCityStateZip: proposalData.companyCityStateZip,
          companyPhone: proposalData.companyPhone,
          companyEmail: proposalData.companyEmail,
          userName: proposalData.userName,
          feeAmount: proposalData.feeAmount,
          feePct: proposalData.feePct,
          lines: proposalData.lines,
        }),
      });
      const data = await resp.json();

      if (data.success) {
        setEstimateRecordResult(data);
        setEstimateRecordStatus("success");
        if (data.estimateUrl) {
          window.open(data.estimateUrl, "_blank");
        }
      } else if (data.notConfigured) {
        setEstimateRecordResult(data);
        setEstimateRecordStatus("not_configured");
      } else {
        setEstimateRecordResult(data);
        setEstimateRecordStatus("error");
      }
    } catch (e) {
      setEstimateRecordResult({ error: e instanceof Error ? e.message : "Network error" });
      setEstimateRecordStatus("error");
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <div style={{
      fontFamily: "var(--font-inter), -apple-system, system-ui, sans-serif",
      background: THEME.lightGray, minHeight: "100vh",
      display: "flex", flexDirection: "column", color: THEME.textDark,
    }}>
      {/* ── HEADER ── */}
      <header style={{
        background: THEME.darkGray, padding: isMobile ? "10px 14px" : "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 8 : 0,
        height: isMobile ? "auto" : 60, flexShrink: 0,
        borderBottom: `3px solid ${THEME.green}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, minWidth: 0 }}>
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/swt-logo.png"
            alt="Scottish Window Tinting"
            style={{ height: isMobile ? 24 : 32, width: "auto", flexShrink: 0 }}
          />
          {!isMobile && (
            <>
              <div style={{
                height: 24, width: 1, background: "rgba(255,255,255,0.15)",
              }} />
              <span style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                color: "rgba(255,255,255,0.7)", fontSize: 16, fontStyle: "italic",
                whiteSpace: "nowrap",
              }}>
                Film Pricing Calculator
              </span>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexWrap: "wrap" }}>
          {/* Min dim */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Min dim</span>
              <input
                type="number" value={minDim} min={1} step={0.5}
                onChange={(e) => setMinDim(parseFloat(e.target.value) || MIN_DIM_DEFAULT)}
                style={{
                  width: 52, padding: "4px 8px",
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "inherit", textAlign: "center",
                }}
              />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>&quot;</span>
            </div>
          )}

          {/* Signed-in user (read-only — no switching) */}
          <CurrentUserBadge user={user} onLogout={handleLogout} />
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <div style={{
        flex: 1,
        display: isMobile || isTablet ? "flex" : "grid",
        flexDirection: isMobile || isTablet ? "column" : undefined,
        gridTemplateColumns: isMobile || isTablet ? undefined : "1fr 320px",
        overflow: isMobile || isTablet ? "visible" : "hidden",
      }}>
        {/* LEFT — form + proposals */}
        <div style={{
          padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "24px 28px",
          overflowY: isMobile || isTablet ? "visible" : "auto",
          display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24,
        }}>

          {/* Job info card */}
          <section style={{
            background: THEME.white, borderRadius: 12,
            border: `1px solid ${THEME.border}`, padding: isMobile ? "16px 16px" : "20px 24px",
          }}>
            <p style={labelSt}>Customer Information</p>

            {/* Residential / Commercial toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(["Residential", "Commercial"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setJobType(t)}
                  style={{
                    flex: 1, padding: isMobile ? "10px 10px" : "8px 14px", borderRadius: 8,
                    border: `1.5px solid ${jobType === t ? THEME.green : THEME.border}`,
                    background: jobType === t ? THEME.greenBg : THEME.white,
                    color: jobType === t ? THEME.greenDark : THEME.textMuted,
                    fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {t === "Residential" ? "🏠 Residential" : "🏢 Commercial"}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <ContactSearchPicker
                onSelect={(c) => {
                  if (c.type === "deal") {
                    // Picking an existing JOB (Opportunity) — prefill the
                    // customer name + real installation address so the rep
                    // can start a brand-new pricing job for the same
                    // customer/address, per Jenny's explicit confirmation
                    // this should NOT reopen/reuse the old Deal record.
                    setJobType(c.isCommercial ? "Commercial" : "Residential");
                    setCustomer(c.name);
                    setAddress(c.installationAddress || "");
                    setCityStateZip(c.installationCityStateZip || "");
                    if (c.isCommercial && c.companyName) {
                      setCompanyName(c.companyName);
                    }
                    // Deliberately NOT setting existingContactId here — a
                    // Deal search result doesn't carry full contact detail
                    // (phone/email), and reusing the wrong contact record
                    // would be worse than just creating a fresh one.
                    setExistingContactId(null);
                  } else if (c.isCommercial) {
                    // Commercial contact — split Business (Account) fields
                    // from the Contact Person's own fields, and switch the
                    // job type toggle automatically so the right section
                    // shows up filled in.
                    setJobType("Commercial");
                    setCompanyName(c.companyName || "");
                    setCompanyAddress(c.companyAddress || "");
                    setCompanyCityStateZip(c.companyCityStateZip || "");
                    setCompanyPhone(c.companyPhone || "");
                    setCompanyEmail(c.companyEmail || "");
                    setContactPersonName(c.name);
                    setContactPersonPhone(c.phone);
                    setContactPersonEmail(c.email);
                    setContactBillingAddress(c.address);
                    setContactBillingCityStateZip(c.cityStateZip);
                    // "customer" still drives the Deal/Contact display name
                    setCustomer(c.name);
                    setExistingContactId(c.id);
                  } else {
                    setJobType("Residential");
                    setCustomer(c.name);
                    setAddress(c.address);
                    setCityStateZip(c.cityStateZip);
                    setPhone(c.phone);
                    setEmail(c.email);
                    setExistingContactId(c.id);
                  }
                }}
              />
              {existingContactId && (
                <div style={{
                  marginTop: 6, fontSize: 11, color: THEME.greenDark,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Loaded from existing Zoho contact — will reuse this contact instead of creating a new one
                </div>
              )}
            </div>

            {jobType === "Commercial" && (
              <div style={{
                marginBottom: 12, padding: "12px",
                background: THEME.lightGray, borderRadius: 8,
                border: `1px solid ${THEME.border}`,
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Business (Zoho Account)
                </p>
                <div style={{ display: "grid", gridTemplateColumns: gridCols(2), gap: 12, marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: THEME.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Business Name
                    </p>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. QuikTrip"
                      style={inputSt}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: THEME.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Business Address
                    </p>
                    <input
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="e.g. corporate HQ street address"
                      style={inputSt}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: gridCols(3), gap: 12, marginBottom: 12 }}>
                  <input value={companyCityStateZip} onChange={(e) => setCompanyCityStateZip(e.target.value)} placeholder="Business City, State, ZIP" style={inputSt} />
                  <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="Business Phone" style={inputSt} />
                  <input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="Business Email" type="email" style={inputSt} />
                </div>

                <p style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Contact Person (Zoho Contact)
                </p>
                <div style={{ display: "grid", gridTemplateColumns: gridCols(2), gap: 12, marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: THEME.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Contact Name
                    </p>
                    <input
                      value={contactPersonName}
                      onChange={(e) => setContactPersonName(e.target.value)}
                      placeholder="e.g. facility manager name"
                      style={inputSt}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: THEME.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Billing Address
                    </p>
                    <input
                      value={contactBillingAddress}
                      onChange={(e) => setContactBillingAddress(e.target.value)}
                      placeholder="Contact's own billing address"
                      style={inputSt}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: gridCols(3), gap: 12 }}>
                  <input value={contactBillingCityStateZip} onChange={(e) => setContactBillingCityStateZip(e.target.value)} placeholder="Billing City, State, ZIP" style={inputSt} />
                  <input value={contactPersonPhone} onChange={(e) => setContactPersonPhone(e.target.value)} placeholder="Contact Phone" style={inputSt} />
                  <input value={contactPersonEmail} onChange={(e) => setContactPersonEmail(e.target.value)} placeholder="Contact Email" type="email" style={inputSt} />
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: gridCols(2), gap: 12, marginBottom: 12 }}>
              <input
                value={customer}
                onChange={(e) => { setCustomer(e.target.value); setExistingContactId(null); }}
                placeholder={jobType === "Commercial" ? "Contact / Account name" : "Customer name"}
                style={inputSt}
              />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={jobType === "Commercial" ? "Job / Installation address" : "Job address"} style={inputSt} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: gridCols(3), gap: 12, marginBottom: 12 }}>
              <input value={cityStateZip} onChange={(e) => setCityStateZip(e.target.value)} placeholder="City, State, ZIP" style={inputSt} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={inputSt} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={inputSt} />
            </div>

            {/* Opportunity Name — auto-suggested, editable */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: THEME.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Opportunity Name <span style={{ fontWeight: 400, textTransform: "none" }}>(what shows in Zoho — e.g. &quot;Vernon 32 Dallas TX AUG26&quot;)</span>
              </p>
              <input
                value={effectiveOpportunityName}
                onChange={(e) => { setOpportunityName(e.target.value); setOpportunityNameTouched(true); }}
                placeholder={suggestedOpportunityName || "Auto-suggested once customer info is filled in"}
                style={inputSt}
              />
              {opportunityNameTouched && suggestedOpportunityName && effectiveOpportunityName !== suggestedOpportunityName && (
                <button
                  onClick={() => { setOpportunityName(suggestedOpportunityName); setOpportunityNameTouched(false); }}
                  style={{
                    marginTop: 4, fontSize: 11, color: THEME.greenDark, cursor: "pointer",
                    background: "none", border: "none", padding: 0, fontFamily: "inherit", textDecoration: "underline",
                  }}
                >
                  Reset to suggested: &quot;{suggestedOpportunityName}&quot;
                </button>
              )}
            </div>
          </section>

          {/* Windows card */}
          <section style={{
            background: THEME.white, borderRadius: 12,
            border: `1px solid ${THEME.border}`, overflow: "hidden",
          }}>
            <div style={{ padding: "20px 24px 12px" }}>
              <p style={{ ...labelSt, marginBottom: 4 }}>Window Line Items</p>
              <p style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 0 }}>
                Each row can use a different film. Enter width, height, and quantity to calculate pricing.
              </p>
            </div>

            {/* Table (desktop/tablet) or stacked cards (mobile) */}
            <div>
              {isMobile ? (
                <>
                  {/* Mobile: each window is its own card instead of a table row —
                      table columns would be unreadably narrow on a phone screen. */}
                  {rows.map((row, idx) => {
                    const c = lineCalcs[idx];
                    return (
                      <div key={row.id} style={{
                        padding: "12px 14px",
                        borderBottom: `1px solid ${THEME.lightGray}`,
                        display: "flex", flexDirection: "column", gap: 8,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <input
                            value={row.desc}
                            onChange={(e) => updateRow(row.id, "desc", e.target.value)}
                            placeholder={`Window ${idx + 1}`}
                            style={{ ...cellSt, flex: 1, fontWeight: 600 }}
                          />
                          <button
                            onClick={() => removeRow(row.id)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "#ccc", padding: 6, borderRadius: 4, lineHeight: 1, flexShrink: 0,
                            }}
                          >
                            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <FilmPicker
                          film={row.film}
                          pgOverride={row.pgOverride}
                          onFilm={(f) => updateRow(row.id, "film", f)}
                          onPgOverride={(v) => updateRow(row.id, "pgOverride", v)}
                        />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                          <div>
                            <p style={{ fontSize: 9, color: THEME.textMuted, marginBottom: 2, textTransform: "uppercase" }}>Width&quot;</p>
                            <input
                              type="number" min={1} step={0.5} value={row.w}
                              onChange={(e) => updateRow(row.id, "w", e.target.value)}
                              placeholder="0" style={{ ...cellSt, width: "100%", textAlign: "center" }}
                            />
                          </div>
                          <div>
                            <p style={{ fontSize: 9, color: THEME.textMuted, marginBottom: 2, textTransform: "uppercase" }}>Height&quot;</p>
                            <input
                              type="number" min={1} step={0.5} value={row.h}
                              onChange={(e) => updateRow(row.id, "h", e.target.value)}
                              placeholder="0" style={{ ...cellSt, width: "100%", textAlign: "center" }}
                            />
                          </div>
                          <div>
                            <p style={{ fontSize: 9, color: THEME.textMuted, marginBottom: 2, textTransform: "uppercase" }}>Qty</p>
                            <input
                              type="number" min={1} step={1} value={row.qty}
                              onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                              style={{ ...cellSt, width: "100%", textAlign: "center" }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {c ? (
                              <span style={{
                                background: THEME.greenBg, color: THEME.greenDark,
                                fontWeight: 600, fontSize: 11, padding: "3px 8px", borderRadius: 6,
                              }}>
                                Roll {c.rollW}&quot;
                              </span>
                            ) : (
                              <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                            )}
                            {c && <span style={{ fontSize: 10, color: THEME.textMuted }}>{c.chargedSF.toFixed(1)} SF</span>}
                          </div>
                          {c ? (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                                <span style={{ position: "absolute", left: 6, fontSize: 13, color: THEME.textMuted, pointerEvents: "none" }}>$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.lineTotalOverride}
                                  onChange={(e) => updateRow(row.id, "lineTotalOverride", e.target.value)}
                                  placeholder={c.calculatedLineTotal != null ? c.calculatedLineTotal.toFixed(2) : "—"}
                                  style={{
                                    width: 90, padding: "5px 6px 5px 18px",
                                    fontSize: 14, fontWeight: 700, textAlign: "right",
                                    color: c.isOverridden ? THEME.greenDark : THEME.textDark,
                                    fontVariantNumeric: "tabular-nums",
                                    border: `1px solid ${c.isOverridden ? THEME.green : THEME.border}`,
                                    borderRadius: 6,
                                    background: c.isOverridden ? THEME.greenBg : THEME.white,
                                    outline: "none",
                                  }}
                                />
                              </div>
                              {c.isOverridden && c.calculatedLineTotal != null && (
                                <div
                                  onClick={() => updateRow(row.id, "lineTotalOverride", "")}
                                  style={{ fontSize: 9, color: THEME.greenDark, textDecoration: "underline", cursor: "pointer", marginTop: 2 }}
                                >
                                  reset (calc: {fmt$(c.calculatedLineTotal)})
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Header row */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: isTablet
                      ? "110px 1fr 46px 46px 40px 52px 84px 28px"
                      : "130px 1fr 52px 52px 48px 60px 90px 32px",
                    background: THEME.lightGray, borderBottom: `1px solid ${THEME.border}`,
                  }}>
                    {["Description", "Film", "W\"", "H\"", "Qty", "Roll", "Line Total", ""].map((h, i) => (
                      <div key={i} style={{
                        padding: "9px 8px", fontSize: 10, fontWeight: 600,
                        color: THEME.textMuted, textTransform: "uppercase", letterSpacing: ".06em",
                      }}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {/* Data rows */}
                  {rows.map((row, idx) => {
                    const c = lineCalcs[idx];
                    return (
                      <div key={row.id} style={{
                        display: "grid",
                        gridTemplateColumns: isTablet
                          ? "110px 1fr 46px 46px 40px 52px 84px 28px"
                          : "130px 1fr 52px 52px 48px 60px 90px 32px",
                        borderBottom: `1px solid ${THEME.lightGray}`, alignItems: "center",
                        background: THEME.white,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = THEME.lightGray)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = THEME.white)}
                      >
                        {/* Description */}
                        <div style={{ padding: "5px 6px" }}>
                          <input
                            value={row.desc}
                            onChange={(e) => updateRow(row.id, "desc", e.target.value)}
                            placeholder={`Window ${idx + 1}`}
                            style={{ ...cellSt, width: "100%" }}
                          />
                        </div>
                        {/* Film picker */}
                        <div style={{ padding: "5px 6px", minWidth: 0 }}>
                          <FilmPicker
                            film={row.film}
                            pgOverride={row.pgOverride}
                            onFilm={(f) => updateRow(row.id, "film", f)}
                            onPgOverride={(v) => updateRow(row.id, "pgOverride", v)}
                          />
                        </div>
                        {/* W */}
                        <div style={{ padding: "5px 4px" }}>
                          <input
                            type="number" min={1} step={0.5} value={row.w}
                            onChange={(e) => updateRow(row.id, "w", e.target.value)}
                            placeholder="0" style={{ ...cellSt, width: "100%", textAlign: "right" }}
                          />
                        </div>
                        {/* H */}
                        <div style={{ padding: "5px 4px" }}>
                          <input
                            type="number" min={1} step={0.5} value={row.h}
                            onChange={(e) => updateRow(row.id, "h", e.target.value)}
                            placeholder="0" style={{ ...cellSt, width: "100%", textAlign: "right" }}
                          />
                        </div>
                        {/* Qty */}
                        <div style={{ padding: "5px 4px" }}>
                          <input
                            type="number" min={1} step={1} value={row.qty}
                            onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                            style={{ ...cellSt, width: "100%", textAlign: "right" }}
                          />
                        </div>
                        {/* Roll badge */}
                        <div style={{ padding: "5px 8px" }}>
                          {c ? (
                            <span style={{
                              background: THEME.greenBg, color: THEME.greenDark,
                              fontWeight: 600, fontSize: 11, padding: "3px 8px", borderRadius: 6,
                            }}>
                              {c.rollW}&quot;
                            </span>
                          ) : (
                            <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                          )}
                        </div>
                        {/* Line total — editable override */}
                        <div style={{ padding: "5px 8px" }}>
                          {c ? (
                            <div>
                              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                <span style={{
                                  position: "absolute", left: 6, fontSize: 13, color: THEME.textMuted, pointerEvents: "none",
                                }}>$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.lineTotalOverride}
                                  onChange={(e) => updateRow(row.id, "lineTotalOverride", e.target.value)}
                                  placeholder={c.calculatedLineTotal != null ? c.calculatedLineTotal.toFixed(2) : "—"}
                                  title={c.isOverridden ? "Manually overridden — clear to use auto-calculated value" : "Auto-calculated — type to override (e.g. for a harder window)"}
                                  style={{
                                    width: "100%", padding: "4px 6px 4px 18px",
                                    fontSize: 13, fontWeight: 600,
                                    color: c.isOverridden ? THEME.greenDark : THEME.textDark,
                                    fontVariantNumeric: "tabular-nums",
                                    border: `1px solid ${c.isOverridden ? THEME.green : "transparent"}`,
                                    borderRadius: 6,
                                    background: c.isOverridden ? THEME.greenBg : "transparent",
                                    outline: "none",
                                  }}
                                />
                              </div>
                              <div style={{ fontSize: 10, color: THEME.textMuted, paddingLeft: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                {c.chargedSF.toFixed(1)} SF
                                {c.isOverridden && c.calculatedLineTotal != null && (
                                  <span
                                    title="Reset to auto-calculated value"
                                    onClick={() => updateRow(row.id, "lineTotalOverride", "")}
                                    style={{ cursor: "pointer", color: THEME.greenDark, textDecoration: "underline" }}
                                  >
                                    reset (calc: {fmt$(c.calculatedLineTotal)})
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                          )}
                        </div>
                        {/* Delete */}
                        <div style={{ padding: "5px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <button
                            onClick={() => removeRow(row.id)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "#ccc", padding: 4, borderRadius: 4, lineHeight: 1,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#e04d46"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#ccc"; }}
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Add row */}
              <button
                onClick={addRow}
                style={{
                  width: "100%", padding: "11px 12px", background: "none",
                  border: "none", borderTop: `1px solid ${THEME.lightGray}`, cursor: "pointer",
                  color: THEME.green, fontSize: 13, display: "flex",
                  alignItems: "center", gap: 6, fontFamily: "inherit", fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = THEME.greenBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add window
              </button>
            </div>
          </section>

          {/* Film summary badges */}
          {rows.some((r) => r.film) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: -8 }}>
              {[...new Map(rows.filter((r) => r.film).map((r) => [r.film!.name, r.film])).values()].map((f) => (
                <span key={f!.name} style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 14,
                  background: BRAND_COLORS[f!.brand] + "12", color: BRAND_COLORS[f!.brand],
                  fontWeight: 500, border: `1px solid ${BRAND_COLORS[f!.brand]}30`,
                }}>
                  {f!.name}
                </span>
              ))}
            </div>
          )}

          {/* PROPOSAL AREA */}
          {showProposals && proposalData && (
            <section style={{
              background: THEME.white, borderRadius: 12,
              border: `1px solid ${THEME.border}`, overflow: "hidden",
            }}>
              <div style={{
                padding: "16px 24px 12px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                borderBottom: `1px solid ${THEME.border}`,
              }}>
                <p style={{ ...labelSt, marginBottom: 0 }}>
                  <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 18, fontStyle: "italic", textTransform: "none", letterSpacing: "normal", color: THEME.darkGray }}>
                    Proposal
                  </span>
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handlePrint} style={smallBtnSt}>🖨 Print</button>
                  <button onClick={handleDownloadHTML} style={smallBtnSt}>📄 HTML</button>
                  <button onClick={handleDownloadText} style={smallBtnSt}>
                    📝 {activeTab === "customer" ? "Customer" : activeTab === "internal" ? "Internal" : "Commission"} .txt
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", padding: "0 24px", borderBottom: `1px solid ${THEME.border}` }}>
                {(["customer", "internal", "commission"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{
                      padding: "10px 16px", fontSize: 12,
                      fontWeight: activeTab === t ? 600 : 500,
                      color: activeTab === t ? THEME.greenDark : THEME.textMuted,
                      background: "none", border: "none",
                      borderBottom: `2px solid ${activeTab === t ? THEME.green : "transparent"}`,
                      cursor: "pointer", fontFamily: "inherit",
                      textTransform: "capitalize",
                    }}
                  >
                    {t === "customer" ? "Customer Proposal" : t === "internal" ? "Internal Record" : "Commission Sheet"}
                  </button>
                ))}
              </div>

              {/* Proposal content */}
              <div style={{
                padding: "16px 24px",
                fontSize: 12, lineHeight: 1.8, color: THEME.darkGray,
                whiteSpace: "pre-wrap", fontFamily: "ui-monospace, 'SF Mono', monospace",
                maxHeight: 500, overflowY: "auto",
              }}>
                {activeTab === "customer"
                  ? buildCustomerProposal(proposalData)
                  : activeTab === "internal"
                    ? buildInternalRecord(proposalData)
                    : buildCommissionSheet(proposalData)}
              </div>
            </section>
          )}
        </div>

        {/* ── RIGHT SIDEBAR (summary + actions) — beside the form on desktop,
              stacked below it as a full-width panel on mobile/tablet ── */}
        <div style={{
          background: THEME.white,
          borderLeft: isMobile || isTablet ? "none" : `1px solid ${THEME.border}`,
          borderTop: isMobile || isTablet ? `1px solid ${THEME.border}` : "none",
          display: "flex", flexDirection: "column",
          overflowY: isMobile || isTablet ? "visible" : "auto",
        }}>
          <div style={{ padding: isMobile ? "16px 14px 0" : "24px 20px 0" }}>
            <p style={labelSt}>Summary</p>

            {/* Summary card */}
            <div style={{
              background: THEME.lightGray, borderRadius: 10, marginBottom: 14,
              border: `1px solid ${THEME.border}`,
            }}>
              {([
                ["Windows", totals.winCount || "—"],
                ["Actual SF", totals.totalActual > 0 ? fmtSF(totals.totalActual) : "—"],
                ["Charged SF", totals.totalCharged > 0 ? fmtSF(totals.totalCharged) : "—"],
                ["Wastage", totals.totalCharged > 0 ? fmtSF(totals.totalCharged - totals.totalActual) : "—"],
                ["Subtotal", totals.rawTotal ? fmt$(totals.rawTotal) : "—"],
                ...(totals.minAdj > 0 ? [["Min adjustment", `+${fmt$(totals.minAdj)}`] as [string, string | number]] : []),
              ]).map(([l, v]) => (
                <div key={l} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 14px", borderBottom: `1px solid ${THEME.border}`,
                }}>
                  <span style={{ fontSize: 12, color: THEME.textMuted }}>{l}</span>
                  <span style={{ fontSize: 12, color: THEME.textDark, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                </div>
              ))}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "13px 14px",
                background: THEME.greenBg,
                borderRadius: "0 0 10px 10px",
              }}>
                <span style={{
                  fontSize: 15, fontWeight: 600, color: THEME.darkGray,
                  fontFamily: "var(--font-cormorant), serif",
                }}>
                  Film Total
                </span>
                <span style={{
                  fontSize: 22, fontWeight: 700, color: THEME.greenDark,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {totals.total ? fmt$(totals.total) : "—"}
                </span>
              </div>
            </div>

            {/* Editable summary: Discount / Fees / Deposit / Balance Due */}
            {totals.total != null && (
              <div style={{
                background: THEME.white, border: `1px solid ${THEME.border}`,
                borderRadius: 10, padding: "14px 16px", marginBottom: 14,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: THEME.darkGray,
                  textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10,
                }}>
                  Adjustments
                </div>

                {/* Discount / Other — entered as a % of the Film Total, applied before the fee */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{
                    fontSize: 11, color: THEME.textMuted, fontWeight: 500,
                    display: "flex", alignItems: "center", gap: 6, marginBottom: 4, cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={discountEnabled}
                      onChange={(e) => setDiscountEnabled(e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    Discount %
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="number"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(e.target.value)}
                      disabled={!discountEnabled}
                      placeholder="0"
                      step={0.5}
                      style={{
                        width: "100%", padding: "7px 24px 7px 10px",
                        border: `1px solid ${THEME.border}`, borderRadius: 6,
                        background: discountEnabled ? THEME.white : THEME.lightGray,
                        color: THEME.textDark, fontSize: 13, fontFamily: "inherit", outline: "none",
                        fontVariantNumeric: "tabular-nums",
                        opacity: discountEnabled ? 1 : 0.5,
                      }}
                    />
                    <span style={{
                      position: "absolute", right: 10, fontSize: 13, color: THEME.textMuted, pointerEvents: "none",
                    }}>%</span>
                  </div>
                </div>

                {discountEnabled && totals.discount > 0 && (
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "3px 0", fontSize: 12, color: "#e04d46",
                  }}>
                    <span>{totals.discountPctNum}% of {fmt$(totals.filmTotal)}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>−{fmt$(totals.discount)}</span>
                  </div>
                )}

                {/* Attachment / Other — flat $ adjustment (matches the Film Commission sheet's "Other" line). Use a negative number for a deduction. */}
                <div style={{ marginBottom: 10, marginTop: 6 }}>
                  <label style={{
                    fontSize: 11, color: THEME.textMuted, fontWeight: 500,
                    display: "block", marginBottom: 4,
                  }}>
                    Attachment / Other ($)
                  </label>
                  <input
                    type="number"
                    value={attachmentOther}
                    onChange={(e) => setAttachmentOther(e.target.value)}
                    placeholder="0.00 (negative = deduction)"
                    step={0.01}
                    style={{
                      width: "100%", padding: "7px 10px",
                      border: `1px solid ${THEME.border}`, borderRadius: 6,
                      background: THEME.white, color: THEME.textDark,
                      fontSize: 13, fontFamily: "inherit", outline: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>

                {totals.attachmentOtherAmt !== 0 && (
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "3px 0", fontSize: 12, color: totals.attachmentOtherAmt < 0 ? "#e04d46" : THEME.textMuted,
                  }}>
                    <span>Attachment / Other</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {totals.attachmentOtherAmt >= 0 ? "+" : "−"}{fmt$(Math.abs(totals.attachmentOtherAmt))}
                    </span>
                  </div>
                )}

                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "3px 0", fontSize: 12, color: THEME.textMuted,
                }}>
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt$(totals.subtotalAfterDiscount)}</span>
                </div>

                {/* Fee % */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 3px" }}>
                  <label style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 500 }}>
                    Fee %
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      value={feePct}
                      onChange={(e) => setFeePct(e.target.value)}
                      step={0.5}
                      style={{
                        width: 56, padding: "5px 8px", textAlign: "right",
                        border: `1px solid ${THEME.border}`, borderRadius: 6,
                        background: THEME.white, color: THEME.textDark,
                        fontSize: 12, fontFamily: "inherit", outline: "none",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                    <span style={{ fontSize: 12, color: THEME.textMuted }}>%</span>
                  </div>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "3px 0", fontSize: 12, color: THEME.textMuted,
                }}>
                  <span>Fee amount</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>+{fmt$(totals.feeAmount)}</span>
                </div>

                {/* Total Cost */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  borderTop: `1px solid ${THEME.border}`, marginTop: 6, paddingTop: 8,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: THEME.darkGray }}>Total Cost</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: THEME.darkGray, fontVariantNumeric: "tabular-nums" }}>
                    {fmt$(totals.totalCost)}
                  </span>
                </div>

                {/* Deposit */}
                <div style={{ margin: "10px 0 4px" }}>
                  <label style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 500, display: "block", marginBottom: 4 }}>
                    Deposit
                  </label>
                  <input
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: "100%", padding: "7px 10px",
                      border: `1px solid ${THEME.border}`, borderRadius: 6,
                      background: THEME.white, color: THEME.textDark,
                      fontSize: 13, fontFamily: "inherit", outline: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>

                {/* Balance Due */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  borderTop: `1px solid ${THEME.border}`, marginTop: 6, paddingTop: 8,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: THEME.darkGray, fontFamily: "var(--font-cormorant), serif" }}>
                    Balance Due
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: THEME.greenDark, fontVariantNumeric: "tabular-nums" }}>
                    {fmt$(totals.balanceDue)}
                  </span>
                </div>
              </div>
            )}

            {/* Charged to Client + Commission card */}
            {totals.total != null && user && (
              <div style={{
                background: THEME.greenBg, border: `1px solid ${THEME.greenBorder}`,
                borderRadius: 10, padding: "14px 16px", marginBottom: 14,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: THEME.greenDark,
                  textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8,
                }}>
                  Commission Breakdown
                </div>

                {/* Charged to Client input */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{
                    fontSize: 11, color: THEME.greenDark, fontWeight: 500,
                    display: "block", marginBottom: 4,
                  }}>
                    Charged to Client
                  </label>
                  <input
                    type="number"
                    value={chargedToClient}
                    onChange={(e) => setChargedToClient(e.target.value)}
                    placeholder={totals.total?.toFixed(2) || ""}
                    style={{
                      width: "100%", padding: "7px 10px",
                      border: `1px solid ${THEME.greenBorder}`, borderRadius: 6,
                      background: THEME.white, color: THEME.textDark,
                      fontSize: 13, fontFamily: "inherit", outline: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>

                {/* Base commission line */}
                {totals.baseCommission != null && (
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "3px 0", fontSize: 12, color: THEME.greenDark,
                  }}>
                    <span>{(totals.commRate! * 100).toFixed(0)}% of {fmt$(totals.subtotalAfterDiscount)}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt$(totals.baseCommission)}</span>
                  </div>
                )}

                {/* Over/under line — overcharge: user's own rate on the overage; undercharge/loss: 50/50 split with the company */}
                {totals.overUnderComm !== 0 && (
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "3px 0", fontSize: 12, color: totals.overUnderComm < 0 ? "#e04d46" : THEME.greenDark,
                  }}>
                    <span>
                      {totals.difference > 0
                        ? `${(totals.commRate! * 100).toFixed(0)}% of overage (${fmt$(totals.difference)})`
                        : `50/50 split of loss (${fmt$(totals.difference)})`}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {totals.overUnderComm >= 0 ? "+" : "−"}{fmt$(Math.abs(totals.overUnderComm))}
                    </span>
                  </div>
                )}

                {/* Total commission */}
                {totals.totalCommission != null && (
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    borderTop: `1px solid ${THEME.greenBorder}`, marginTop: 6, paddingTop: 8,
                  }}>
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: THEME.greenDark,
                    }}>
                      Total Commission
                    </span>
                    <span style={{
                      fontSize: 22, fontWeight: 700, color: THEME.greenDark,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {fmt$(totals.totalCommission)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ padding: isMobile ? "14px" : 16, display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
            <button
              onClick={generateProposals}
              disabled={!totals.total}
              style={{
                width: "100%", padding: 12, background: THEME.green, color: "#fff",
                border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                opacity: !totals.total ? 0.4 : 1,
                boxShadow: `0 4px 12px ${THEME.green}40`,
                transition: "all 0.15s",
              }}
            >
              Generate Proposal
            </button>
            <button
              onClick={handlePrint}
              disabled={!totals.total}
              style={{
                width: "100%", padding: 10, background: THEME.white,
                color: THEME.darkGray, border: `1px solid ${THEME.border}`,
                borderRadius: 8, fontSize: 12, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
                opacity: !totals.total ? 0.4 : 1,
              }}
            >
              🖨 Print / Save as PDF
            </button>

            {/* Zoho submit button — always visible once Zoho is configured */}
            {zohoEnabled && (
              <div style={{ marginTop: 4 }}>
                <div style={{ height: 1, background: THEME.border, margin: "8px 0" }} />
                {(!totals.total || !user) && (
                  <div style={{
                    padding: "6px 10px", background: THEME.lightGray, borderRadius: 6,
                    fontSize: 10, color: THEME.textMuted, textAlign: "center", marginBottom: 6,
                  }}>
                    {!user ? "Select a user to enable Zoho send" : "Add at least one priced window to enable Zoho send"}
                  </div>
                )}
                {zohoStatus === "idle" && (
                  <button
                    onClick={submitToZoho}
                    disabled={!totals.total || !user}
                    style={{
                      width: "100%", padding: 10,
                      background: (!totals.total || !user) ? THEME.lightGray : THEME.darkGray,
                      color: (!totals.total || !user) ? THEME.textMuted : "#fff",
                      border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: (!totals.total || !user) ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    📤 Send to Zoho Opportunities
                  </button>
                )}
                {zohoStatus === "submitting" && (
                  <div style={{
                    padding: 10, background: THEME.lightGray, borderRadius: 8,
                    textAlign: "center", fontSize: 12, color: THEME.textMuted,
                  }}>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⟳</span>
                    Sending to Zoho…
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                )}
                {zohoStatus === "success" && (
                  <div style={{
                    padding: 10, background: THEME.greenBg,
                    border: `1px solid ${THEME.greenBorder}`, borderRadius: 8,
                    fontSize: 12, color: THEME.greenDark,
                  }}>
                    ✅ Sent to Zoho Opportunities!
                    {zohoResult?.opportunityNumber && (
                      <div style={{ fontSize: 13, color: THEME.greenDark, fontWeight: 700, marginTop: 4 }}>
                        Opportunity #{zohoResult.opportunityNumber}
                      </div>
                    )}
                    {zohoResult?.dealId && (
                      <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 4 }}>
                        Opportunity ID: {zohoResult.dealId}
                      </div>
                    )}
                    {zohoResult?.sheetRowAdded && (
                      <div style={{ fontSize: 10, color: THEME.textMuted }}>Sheet row added ✅</div>
                    )}
                  </div>
                )}
                {zohoStatus === "error" && (
                  <div style={{
                    padding: 10, background: "#fef2f2",
                    border: "1px solid #fecaca", borderRadius: 8,
                    fontSize: 12, color: "#e04d46",
                  }}>
                    ❌ Submission failed
                    {zohoResult?.errors?.map((err, i) => (
                      <div key={i} style={{ fontSize: 10, marginTop: 2 }}>{err}</div>
                    ))}
                    <button
                      onClick={() => { setZohoStatus("idle"); setZohoResult(null); }}
                      style={{
                        marginTop: 6, padding: "3px 8px", background: "transparent",
                        border: `1px solid #fecaca`, borderRadius: 4,
                        fontSize: 11, color: "#e04d46", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Zoho not configured indicator */}
            {zohoEnabled === false && (
              <div style={{
                padding: "6px 10px", background: THEME.lightGray, borderRadius: 6,
                fontSize: 10, color: THEME.textMuted, textAlign: "center",
              }}>
                Zoho integration not configured
              </div>
            )}

            {/* Generate Estimate button — creates a formatted estimate note on the Deal */}
            {zohoEnabled && totals.total && zohoResult?.dealId && (
              <div style={{ marginTop: 4 }}>
                <div style={{ height: 1, background: THEME.border, margin: "8px 0" }} />
                {estimateStatus === "idle" && (
                  <button
                    onClick={generateEstimate}
                    style={{
                      width: "100%", padding: 10, background: THEME.green, color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    📄 Generate Estimate in Zoho
                  </button>
                )}
                {estimateStatus === "submitting" && (
                  <div style={{
                    padding: 10, background: THEME.lightGray, borderRadius: 8,
                    textAlign: "center", fontSize: 12, color: THEME.textMuted,
                  }}>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⟳</span>
                    Generating estimate…
                  </div>
                )}
                {estimateStatus === "success" && (
                  <div style={{
                    padding: 10, background: THEME.greenBg,
                    border: `1px solid ${THEME.greenBorder}`, borderRadius: 8,
                    fontSize: 12, color: THEME.greenDark,
                  }}>
                    ✅ Estimate PDF generated!
                    {estimateResult?.attachedTo && (
                      <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 4 }}>
                        Linked on {estimateResult.attachedTo}
                      </div>
                    )}
                    {estimateResult?.pdfUrl && (
                      <div style={{ marginTop: 6 }}>
                        <a
                          href={estimateResult.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: THEME.greenDark, fontWeight: 600, textDecoration: "underline" }}
                        >
                          📄 View / Download PDF
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {estimateStatus === "error" && (
                  <div style={{
                    padding: 10, background: "#fef2f2",
                    border: "1px solid #fecaca", borderRadius: 8,
                    fontSize: 12, color: "#e04d46",
                  }}>
                    ❌ Estimate creation failed
                    {estimateResult?.errors?.map((err, i) => (
                      <div key={i} style={{ fontSize: 10, marginTop: 2 }}>{err}</div>
                    ))}
                    <button
                      onClick={() => { setEstimateStatus("idle"); setEstimateResult(null); }}
                      style={{
                        marginTop: 6, padding: "3px 8px", background: "transparent",
                        border: `1px solid #fecaca`, borderRadius: 4,
                        fontSize: 11, color: "#e04d46", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Fill Out Estimate button — creates the real Zoho Estimate record and opens it */}
            {zohoEnabled && zohoResult?.dealId && (
              <div style={{ marginTop: 4 }}>
                <div style={{ height: 1, background: THEME.border, margin: "8px 0" }} />
                {estimateRecordStatus === "idle" && (
                  <button
                    onClick={fillOutEstimateRecord}
                    style={{
                      width: "100%", padding: 10, background: THEME.darkGray, color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    📝 Fill Out Estimate in Zoho
                  </button>
                )}
                {estimateRecordStatus === "submitting" && (
                  <div style={{
                    padding: 10, background: THEME.lightGray, borderRadius: 8,
                    textAlign: "center", fontSize: 12, color: THEME.textMuted,
                  }}>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⟳</span>
                    Creating estimate in Zoho…
                  </div>
                )}
                {estimateRecordStatus === "success" && (
                  <div style={{
                    padding: 10, background: THEME.greenBg,
                    border: `1px solid ${THEME.greenBorder}`, borderRadius: 8,
                    fontSize: 12, color: THEME.greenDark,
                  }}>
                    ✅ Estimate created in Zoho!
                    {estimateRecordResult?.estimateUrl ? (
                      <div style={{ marginTop: 6 }}>
                        <a
                          href={estimateRecordResult.estimateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: THEME.greenDark, fontWeight: 600, textDecoration: "underline" }}
                        >
                          📝 Open Estimate in Zoho
                        </a>
                      </div>
                    ) : estimateRecordResult?.syncPending ? (
                      <div style={{ fontSize: 10, color: "#8a6d1a", marginTop: 4 }}>
                        Created (Estimate #{estimateRecordResult?.estimateNumber}) — Zoho is still syncing it into the
                        Opportunity&apos;s Estimates list. Refresh the Opportunity page in Zoho in a few seconds and check
                        the Zoho Finance section at the bottom.
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 4 }}>
                        Estimate ID: {estimateRecordResult?.estimateId}
                      </div>
                    )}
                  </div>
                )}
                {estimateRecordStatus === "not_configured" && (
                  <div style={{
                    padding: 10, background: "#fff8e6",
                    border: "1px solid #f5d78e", borderRadius: 8,
                    fontSize: 12, color: "#8a6d1a",
                  }}>
                    ⏳ Estimate module not connected yet
                    <div style={{ fontSize: 10, marginTop: 4 }}>
                      This feature is fully built and ready to go — it just needs the production Zoho Estimates module connected (see ZOHO-SETUP.md).
                    </div>
                  </div>
                )}
                {estimateRecordStatus === "error" && (
                  <div style={{
                    padding: 10, background: "#fef2f2",
                    border: "1px solid #fecaca", borderRadius: 8,
                    fontSize: 12, color: "#e04d46",
                  }}>
                    ❌ Estimate creation failed
                    {estimateRecordResult?.error && (
                      <div style={{ fontSize: 10, marginTop: 2 }}>{estimateRecordResult.error}</div>
                    )}
                    <button
                      onClick={() => { setEstimateRecordStatus("idle"); setEstimateRecordResult(null); }}
                      style={{
                        marginTop: 6, padding: "3px 8px", background: "transparent",
                        border: `1px solid #fecaca`, borderRadius: 4,
                        fontSize: 11, color: "#e04d46", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={resetJob}
              style={{
                width: "100%", padding: 8, background: "transparent",
                color: THEME.textMuted, border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              New job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
