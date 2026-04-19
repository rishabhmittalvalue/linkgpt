"use client";

import { useState, useRef } from "react";
import ResultCard, { type Result } from "@/components/ResultCard";

type SearchStatus = "idle" | "running" | "completed" | "error";

export default function Home() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const pollForResults = (searchId: string) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 100; // 5 minutes at 3s intervals

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
        body: JSON.stringify({ query }),
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
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <span className="font-semibold text-lg tracking-tight">LinkGPT</span>
        </div>
        <span className="text-gray-500 text-sm">AI LinkedIn Outreach</span>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-600/20 text-blue-400 text-sm px-4 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
          Powered by n8n + Gemini
        </div>
        <h1 className="text-5xl font-bold mb-5 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
          Find your next connection
        </h1>
        <p className="text-gray-400 text-xl mb-10 leading-relaxed">
          Describe who you want to reach. We&apos;ll find their LinkedIn profiles,
          verify their emails, and write personalised cold outreach — in minutes.
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
          Searches take 1–3 minutes depending on how many profiles are found
        </p>
      </div>

      {/* Loading state */}
      {status === "running" && (
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-6 py-5">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="font-medium text-white">Running your search</p>
              <p className="text-gray-500 text-sm mt-0.5">
                Searching Google → Finding LinkedIn profiles → Verifying emails → Writing outreach
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && error && (
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="bg-red-900/20 border border-red-800/50 text-red-300 rounded-xl px-6 py-4">
            {error}
          </div>
        </div>
      )}

      {/* Results */}
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
