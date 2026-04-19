import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

// POST /api/results — called by n8n when the workflow finishes
// n8n should POST: { searchId, results: [ { linkedin_url, first_name, ... } ] }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { searchId, results } = body;

  if (!searchId) {
    return NextResponse.json({ error: "searchId is required" }, { status: 400 });
  }

  const db = supabaseServer();

  // Insert results if any were found
  if (Array.isArray(results) && results.length > 0) {
    const rows = results.map((r: Record<string, string>) => ({
      search_id: searchId,
      linkedin_url: r.linkedin_url ?? "",
      first_name: r.first_name ?? "",
      last_name: r.last_name ?? "",
      domain_name: r.domain_name ?? "",
      context: r.context ?? "",
      email: r.email ?? "",
      email_subject: r.email_subject ?? "",
      email_body: r.email_body ?? "",
    }));

    const { error: insertError } = await db.from("results").insert(rows);

    if (insertError) {
      console.error("Failed to insert results:", insertError);
      return NextResponse.json(
        { error: "Failed to save results" },
        { status: 500 }
      );
    }
  }

  // Mark the search as completed
  await db
    .from("searches")
    .update({ status: "completed" })
    .eq("id", searchId);

  return NextResponse.json({ success: true, saved: results?.length ?? 0 });
}
