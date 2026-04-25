import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, supabaseServer } from "@/lib/supabase";

// POST /api/search — create a search record and fire the n8n workflow
export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query?.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  // Get the authenticated user from session cookies
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service-role client to insert with explicit user_id
  const db = supabaseServer();

  const { data: search, error } = await db
    .from("searches")
    .insert({ query: query.trim(), status: "running", user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json(
      { error: "Failed to create search" },
      { status: 500 }
    );
  }

  // Fire n8n webhook — fire-and-forget (avoids Vercel timeout)
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatInput: query,
        searchId: search.id,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/results`,
      }),
    }).catch((err) => console.error("n8n trigger error:", err));
  } else {
    console.warn("N8N_WEBHOOK_URL is not set — workflow not triggered");
  }

  return NextResponse.json({ searchId: search.id });
}

// GET /api/search?searchId=xxx — poll for search status and results
export async function GET(req: NextRequest) {
  const searchId = req.nextUrl.searchParams.get("searchId");

  if (!searchId) {
    return NextResponse.json({ error: "searchId is required" }, { status: 400 });
  }

  // Verify user owns this search
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseServer();

  const { data: search, error: searchError } = await db
    .from("searches")
    .select("*")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();

  if (searchError || !search) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  const { data: results } = await db
    .from("results")
    .select("*")
    .eq("search_id", searchId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    status: search.status,
    query: search.query,
    results: results ?? [],
  });
}
