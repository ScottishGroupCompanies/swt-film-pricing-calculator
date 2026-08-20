"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const THEME = {
  green: "#82b45a",
  greenDark: "#6e9a47",
  darkGray: "#515251",
  border: "#e5e7eb",
  white: "#ffffff",
  textDark: "#3a3b3a",
  textMuted: "#888",
  bg: "#f7f8f5",
};

const USER_OPTIONS = [
  { id: "dana", name: "Dana" },
  { id: "amy", name: "Amy" },
  { id: "blake", name: "Blake" },
  { id: "katie", name: "Katie" },
  { id: "mike", name: "Mike" },
  { id: "jenny", name: "Jenny" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !password) {
      setError("Please select your name and enter your password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        setSubmitting(false);
        return;
      }
      const from = searchParams.get("from");
      router.push(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: THEME.white, borderRadius: 12, border: `1px solid ${THEME.border}`,
      padding: 32, width: 340, boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    }}>
      <h1 style={{
        fontFamily: "var(--font-cormorant), serif", fontStyle: "italic",
        fontSize: 26, color: THEME.darkGray, marginTop: 0, marginBottom: 4, textAlign: "center",
      }}>
        Scottish Window Tinting
      </h1>
      <p style={{ fontSize: 13, color: THEME.textMuted, textAlign: "center", marginBottom: 24 }}>
        Sign in to the pricing calculator
      </p>

      <label style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 500, display: "block", marginBottom: 6 }}>
        Your Name
      </label>
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        style={{
          width: "100%", padding: "10px 12px", marginBottom: 16,
          border: `1px solid ${THEME.border}`, borderRadius: 6,
          fontSize: 14, fontFamily: "inherit", color: THEME.textDark,
          background: THEME.white, boxSizing: "border-box",
        }}
      >
        <option value="">Select your name…</option>
        {USER_OPTIONS.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>

      <label style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 500, display: "block", marginBottom: 6 }}>
        Password
      </label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••"
        style={{
          width: "100%", padding: "10px 12px", marginBottom: 20,
          border: `1px solid ${THEME.border}`, borderRadius: 6,
          fontSize: 14, fontFamily: "inherit", color: THEME.textDark,
          boxSizing: "border-box",
        }}
      />

      {error && (
        <div style={{
          background: "#fdecea", color: "#c0392b", fontSize: 13,
          padding: "8px 12px", borderRadius: 6, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          width: "100%", padding: "11px 0", borderRadius: 6, border: "none",
          background: submitting ? THEME.greenDark : THEME.green,
          color: THEME.white, fontSize: 14, fontWeight: 600,
          cursor: submitting ? "default" : "pointer", fontFamily: "inherit",
        }}
      >
        {submitting ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: THEME.bg, fontFamily: "var(--font-jost), sans-serif",
    }}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
