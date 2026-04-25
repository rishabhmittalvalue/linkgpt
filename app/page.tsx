"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ResultCard, { type Result } from "@/components/ResultCard";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type SearchStatus = "idle" | "running" | "completed" | "error";

type SenderProfile = {
  name: string;
  role: string;
  company: string;
  offering: string;
  reason: string;
};

const EMPTY_PROFILE: SenderProfile = {
  name: "",
  role: "",
  company: "",
  offering: "",
  reason: "",
};

const PROFILE_STORAGE_KEY = "linkgpt_sender_profile";

export default function Home() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");

  // Sender profile state
  const [profile, setProfile] = useState<SenderProfile>(EMPTY_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  // Load saved sender profile from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        setProfile(JSON.parse(saved) as SenderProfile);
        setProfileSaved(true);
      } else {
        setProfileOpen(true); // First visit – open profile panel automatically
      }
    } catch {
      /* ignore */
    }
  }, []);

  const profileComplete =
    profile.name.trim() && profile.role.trim() && profile.company.trim();

  const saveProfile = () => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      setProfileSaved(true);
      setProfileOpen(false);
    } catch {
      /* ignore */
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const pollForResults = (searchId: string) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 100;

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        stopPolling();
        setError("Search is taking longer than expected. Please try again.");
        setStatus("error");
        return;
      }

      const res = await fetch(`/api/search?searchId=${searchId}`);
      const data = await res.json();

      if (data.status === "completed") {
        stopPolling();
        setResults(data.results ?? []);
        setStatus("completed");
      } else if (data.status === "error") {
        stopPolling();
        setError("Something went wrong in the workflow. Please try again.");
        setStatus("error");
      }
    }, 3000);
  };

  const handleSearch = async () => {
    if (!query.trim() || status === "running") return;

    setStatus("running");
    setError("");
    setResults([]);
    stopPolling();

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          senderProfile: profileComplete ? profile : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");

      pollForResults(data.searchId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <span className="font-semibold text-lg tracking-tight">LinkGPT</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Profile toggle button */}
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              profileComplete
                ? "border-green-700/50 bg-green-900/20 text-green-400 hover:bg-green-900/30"
                : "border-yellow-700/40 bg-yellow-900/10 text-yellow-400 hover:bg-yellow-900/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                profileComplete ? "bg-green-400" : "bg-yellow-400 animate-pulse"
              }`}
            />
            {profileComplete
              ? `${profile.name} · ${profile.company}`
              : "Set up your profile"}
          </button>

          {/* Auth section */}
          {user && (
            <>
              <Link
                href="/dashboard"
                className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block"
              >
                Dashboard
              </Link>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {user.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <span className="text-gray-300 text-sm hidden sm:block max-w-[140px] truncate">
                  {user.email}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── Sender Profile Panel ─────────────────────────────── */}
      {profileOpen && (
        <div className="border-b border-gray-800 bg-gray-900/60 px-6 py-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-semibold text-white text-lg">Your Outreach Profile</h2>
                <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                  This context is sent with every search so GPT-4o knows exactly who you are
                  and can write emails that clearly explain why <em>you</em> are reaching out
                  to each specific person.
                </p>
              </div>
              <button
                onClick={() => setProfileOpen(false)}
                className="text-gray-500 hover:text-gray-300 text-2xl leading-none ml-6 flex-shrink-0"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                  Your Name <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Rish Kellogg"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                  Your Role / Title <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                  placeholder="Founder, Head of Sales, Investor…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                  Your Company <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                  placeholder="Acme Corp, Self-employed…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                  What You Do / Offer
                </label>
                <input
                  type="text"
                  value={profile.offering}
                  onChange={(e) => setProfile({ ...profile, offering: e.target.value })}
                  placeholder="AI outreach tools for B2B sales teams"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                Why You&apos;re Reaching Out
              </label>
              <textarea
                value={profile.reason}
                onChange={(e) => setProfile({ ...profile, reason: e.target.value })}
                placeholder="e.g. I'm looking to connect with sales leaders at Series A startups to share how we've helped similar teams cut outreach time by 80%…"
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm transition-colors resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveProfile}
                disabled={!profileComplete}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                Save Profile
              </button>
              {profileSaved && (
                <span className="text-green-400 text-sm flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Saved — all emails will be personalised to you</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile incomplete warning */}
      {!profileOpen && !profileComplete && (
        <div
          className="bg-yellow-900/20 border-b border-yellow-800/30 px-6 py-3 cursor-pointer hover:bg-yellow-900/30 transition-colors"
          onClick={() => setProfileOpen(true)}
        >
          <p className="text-yellow-400 text-sm text-center max-w-3xl mx-auto">
            ⚡ Set up your profile to get hyper-personalised emails that mention who you are —{" "}
            <span className="underline font-medium">click to complete it</span>
          </p>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-600/20 text-blue-400 text-sm px-4 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
          Powered by GPT-4o + Google Search
        </div>
        <h1 className="text-5xl font-bold mb-5 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
          Find your next connection
        </h1>
        <p className="text-gray-400 text-xl mb-10 leading-relaxed">
          Describe who you want to reach. We&apos;ll find their LinkedIn profiles
          and write personalised cold outreach — in minutes.
        </p>

        {/* Search input */}
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. CTOs at Series A AI startups in San Francisco"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-base transition-colors"
            disabled={status === "running"}
          />
          <button
            onClick={handleSearch}
            disabled={status === "running" || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-semibold transition-colors whitespace-nowrap"
          >
            {status === "running" ? "Searching…" : "Search"}
          </button>
        </div>

        <p className="text-gray-600 text-sm mt-3">
          Searches take 1–3 minutes · GPT-4o crafts the query + writes every email
        </p>
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {status === "running" && (
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-6 py-5">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="font-medium text-white">Running your search</p>
              <p className="text-gray-500 text-sm mt-0.5">
                Optimising query → Finding LinkedIn profiles → Writing personalised outreach
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {status === "error" && error && (
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="bg-red-900/20 border border-red-800/50 text-red-300 rounded-xl px-6 py-4">
            {error}
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────── */}
      {status === "completed" && (
        <div className="max-w-3xl mx-auto px-6 pb-20">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold">
              {results.length > 0
                ? `Found ${results.length} profile${results.length !== 1 ? "s" : ""}`
                : "No results found"}
            </h2>
            {results.length > 0 && (
              <button
                onClick={() => {
                  setStatus("idle");
                  setResults([]);
                  setQuery("");
                }}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                New search
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg mb-2">No profiles found for this query.</p>
              <p className="text-sm">Try broadening your search terms.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {results.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
