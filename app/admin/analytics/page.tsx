"use client";

import { useEffect, useState } from "react";

interface AnalyticsOverview {
  users: { total: number; activeToday: number; activeThisWeek: number; newToday: number };
  usage: { total: number; today: number; thisWeek: number };
  features: { messagesToday: number; imagesToday: number; videosToday: number; topFeatures: Array<{ feature: string; count: number }> };
  tokens: { tokensIn: number; tokensOut: number };
  premium: { totalPremium: number; byPlan: Array<{ plan: string; count: number }> };
  conversion: { free: number; premium: number; rate: number };
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/admin/analytics/overview");
        if (res.ok) setData(await res.json());
        else setError("Failed to load analytics");
      } catch (e) {
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400">{error ?? "No data available"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Usage metrics and insights</p>
      </div>

      {/* User Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-3">👥 Users</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: data.users.total, color: "from-blue-500 to-blue-600" },
            { label: "Active Today", value: data.users.activeToday, color: "from-green-500 to-green-600" },
            { label: "Active This Week", value: data.users.activeThisWeek, color: "from-purple-500 to-purple-600" },
            { label: "New Today", value: data.users.newToday, color: "from-pink-500 to-pink-600" },
          ].map((m) => (
            <div key={m.label} className="bg-[#12121a] rounded-xl border border-[#1e1e2a] p-4">
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-gray-500 text-xs mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-3">📡 Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Requests", value: data.usage.total.toLocaleString() },
            { label: "Today", value: data.usage.today.toLocaleString() },
            { label: "This Week", value: data.usage.thisWeek.toLocaleString() },
          ].map((m) => (
            <div key={m.label} className="bg-[#12121a] rounded-xl border border-[#1e1e2a] p-4">
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-gray-500 text-xs mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Usage */}
      <div>
        <h2 className="text-lg font-semibold mb-3">🛠 Feature Usage (Today)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Chat", value: data.features.messagesToday, emoji: "💬" },
            { label: "Images", value: data.features.imagesToday, emoji: "🖼️" },
            { label: "Videos", value: data.features.videosToday, emoji: "🎬" },
            ...(data.features.topFeatures?.map((f) => ({
              label: f.feature.charAt(0).toUpperCase() + f.feature.slice(1),
              value: f.count,
              emoji: "📊",
            })) ?? []),
          ].slice(0, 8).map((f) => (
            <div key={f.label} className="bg-[#12121a] rounded-xl border border-[#1e1e2a] p-4">
              <div className="flex items-center justify-between mb-2">
                <span>{f.emoji}</span>
                <span className="text-lg font-bold">{f.value}</span>
              </div>
              <p className="text-gray-500 text-xs">{f.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Token Usage & Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tokens */}
        <div className="bg-[#12121a] rounded-xl border border-[#1e1e2a] p-5">
          <h2 className="font-semibold mb-4">💰 Token Usage</h2>
          <div className="space-y-3">
            {[
              { label: "Tokens In", value: data.tokens.tokensIn.toLocaleString() },
              { label: "Tokens Out", value: data.tokens.tokensOut.toLocaleString() },
              { label: "Total", value: (data.tokens.tokensIn + data.tokens.tokensOut).toLocaleString() },
            ].map((t) => (
              <div key={t.label} className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">{t.label}</span>
                <span className="font-mono text-sm">{t.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Stats */}
        <div className="bg-[#12121a] rounded-xl border border-[#1e1e2a] p-5">
          <h2 className="font-semibold mb-4">⭐ Premium</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Premium Users</span>
              <span className="font-bold">{data.premium.totalPremium}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Conversion Rate</span>
              <span className="font-bold">{(data.conversion.rate * 100).toFixed(1)}%</span>
            </div>
            <div className="border-t border-[#1e1e2a] pt-3 mt-3">
              <p className="text-xs text-gray-500 mb-2">By Plan</p>
              {data.premium.byPlan.map((p) => (
                <div key={p.plan} className="flex justify-between items-center py-1">
                  <span className="text-sm capitalize">{p.plan.replace(/_/g, " ")}</span>
                  <span className="text-sm font-mono">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
