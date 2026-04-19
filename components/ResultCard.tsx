"use client";

import { useState } from "react";

export type Result = {
  id: string;
  linkedin_url: string;
  first_name: string;
  last_name: string;
  domain_name: string;
  context: string;
  email: string;
  email_subject: string;
  email_body: string;
};

export default function ResultCard({ result }: { result: Result }) {
  const [showEmail, setShowEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  const initials =
    `${result.first_name?.[0] ?? ""}${result.last_name?.[0] ?? ""}`.toUpperCase();

  const copyEmail = () => {
    navigator.clipboard.writeText(
      `Subject: ${result.email_subject}\n\n${result.email_body}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
            {initials || "?"}
          </div>

          {/* Name + company + email */}
          <div>
            <h3 className="font-semibold text-white text-lg leading-tight">
              {result.first_name} {result.last_name}
            </h3>
            {result.domain_name && (
              <p className="text-gray-400 text-sm mt-0.5">{result.domain_name}</p>
            )}
            {result.email && (
              <p className="text-blue-400 text-sm mt-1">{result.email}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0">
          {result.linkedin_url && (
            <a
              href={result.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-2 rounded-lg transition-colors"
            >
              LinkedIn →
            </a>
          )}
          {result.email_subject && (
            <button
              onClick={() => setShowEmail(!showEmail)}
              className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-colors"
            >
              {showEmail ? "Hide draft" : "View draft"}
            </button>
          )}
        </div>
      </div>

      {/* Context */}
      {result.context && (
        <p className="text-gray-500 text-sm mt-4 pt-4 border-t border-gray-800 leading-relaxed">
          {result.context}
        </p>
      )}

      {/* Email draft */}
      {showEmail && result.email_subject && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              Email Draft
            </p>
            <button
              onClick={copyEmail}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-white">
              Subject: {result.email_subject}
            </p>
            <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
              {result.email_body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
