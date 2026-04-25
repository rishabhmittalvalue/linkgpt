import { createSupabaseServerClient, supabaseServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";

const ADMIN_EMAIL = "rishabhmkellogg@gmail.com";

interface Search {
  id: string;
  query: string;
  status: string;
  created_at: string;
  result_count?: number;
}

async function getUserStats(userId: string) {
  const db = supabaseServer();

  // Total searches by this user
  const { count: totalSearches } = await db
    .from("searches")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Completed searches
  const { count: completedSearches } = await db
    .from("searches")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");

  // Total results generated (via search_id join)
  const { data: userSearchIds } = await db
    .from("searches")
    .select("id")
    .eq("user_id", userId);

  const ids = userSearchIds?.map((s) => s.id) ?? [];
  let totalResults = 0;
  if (ids.length > 0) {
    const { count } = await db
      .from("results")
      .select("*", { count: "exact", head: true })
      .in("search_id", ids);
    totalResults = count ?? 0;
  }

  // Recent searches (last 8), with result count per search
  const { data: recentSearches } = await db
    .from("searches")
    .select("id, query, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);

  // Get result counts per search
  const searchesWithCounts: Search[] = await Promise.all(
    (recentSearches ?? []).map(async (s) => {
      const { count } = await db
        .from("results")
        .select("*", { count: "exact", head: true })
        .eq("search_id", s.id);
      return { ...s, result_count: count ?? 0 };
    })
  );

  return {
    totalSearches: totalSearches ?? 0,
    completedSearches: completedSearches ?? 0,
    totalResults,
    recentSearches: searchesWithCounts,
  };
}

async function getAdminStats() {
  const db = supabaseServer();

  // Total users via auth.users
  const { data: usersData } = await db.auth.admin.listUsers();
  const totalUsers = usersData?.users?.length ?? 0;

  // Total searches all time
  const { count: totalSearches } = await db
    .from("searches")
    .select("*", { count: "exact", head: true });

  // Searches today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: searchesToday } = await db
    .from("searches")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  // Total results generated
  const { count: totalResults } = await db
    .from("results")
    .select("*", { count: "exact", head: true });

  // Signups in last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentSignups = usersData?.users?.filter(
    (u) => new Date(u.created_at) >= weekAgo
  ).length ?? 0;

  return {
    totalUsers,
    recentSignups,
    totalSearches: totalSearches ?? 0,
    searchesToday: searchesToday ?? 0,
    totalResults: totalResults ?? 0,
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-900/30 text-green-400 border-green-800/40",
    running: "bg-blue-900/30 text-blue-400 border-blue-800/40",
    error: "bg-red-900/30 text-red-400 border-red-800/40",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}
    >
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = user.email === ADMIN_EMAIL;
  const [userStats, adminStats] = await Promise.all([
    getUserStats(user.id),
    isAdmin ? getAdminStats() : Promise.resolve(null),
  ]);

  const avgResultsPerSearch =
    userStats.completedSearches > 0
      ? Math.round(userStats.totalResults / userStats.completedSearches)
      : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">LinkGPT</span>
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-400 text-sm">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm hidden sm:block">{user.email}</span>
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
          >
            New Search
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            {isAdmin ? "Platform Overview" : "Your Activity"}
          </h1>
          <p className="text-gray-500 text-sm">
            Welcome back, {user.email?.split("@")[0]}
          </p>
        </div>

        {/* ── Admin Stats ─────────────────────────────────────────────────── */}
        {isAdmin && adminStats && (
          <div className="mb-10">
            <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">
              Platform Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-2">
              <StatCard label="Total Users" value={adminStats.totalUsers} />
              <StatCard label="New (7 days)" value={adminStats.recentSignups} accent="blue" />
              <StatCard label="All-time Searches" value={adminStats.totalSearches} />
              <StatCard label="Searches Today" value={adminStats.searchesToday} accent="purple" />
              <StatCard label="Profiles Found" value={adminStats.totalResults} accent="green" />
            </div>
          </div>
        )}

        {/* ── User Stats ──────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">
            {isAdmin ? "Your Stats" : "Overview"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Searches" value={userStats.totalSearches} />
            <StatCard label="Completed" value={userStats.completedSearches} accent="green" />
            <StatCard label="Profiles Found" value={userStats.totalResults} accent="blue" />
            <StatCard label="Avg per Search" value={avgResultsPerSearch} accent="purple" />
          </div>
        </div>

        {/* ── Recent Searches ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
              Recent Searches
            </h2>
            <Link
              href="/"
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Run new search →
            </Link>
          </div>

          {userStats.recentSearches.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-12 text-center">
              <p className="text-gray-500 mb-3">No searches yet</p>
              <Link
                href="/"
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                Run your first search →
              </Link>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">
                      Query
                    </th>
                    <th className="text-left text-xs text-gray-500 font-medium px-5 py-3 hidden sm:table-cell">
                      Date
                    </th>
                    <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">
                      Status
                    </th>
                    <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">
                      Profiles
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userStats.recentSearches.map((search, i) => (
                    <tr
                      key={search.id}
                      className={`${i < userStats.recentSearches.length - 1 ? "border-b border-gray-800/50" : ""}`}
                    >
                      <td className="px-5 py-3.5 text-sm text-white max-w-xs">
                        <span className="truncate block" title={search.query}>
                          {search.query}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 hidden sm:table-cell whitespace-nowrap">
                        {formatDate(search.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={search.status} />
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-400 text-right">
                        {search.status === "completed"
                          ? search.result_count
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "blue" | "green" | "purple";
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
  };
  const accentColor = accent ? (colorMap[accent] ?? "text-white") : "text-white";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-5">
      <p className="text-gray-500 text-xs mb-2 uppercase tracking-wide font-medium">
        {label}
      </p>
      <p className={`text-3xl font-bold tabular-nums ${accentColor}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
