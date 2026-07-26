"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AdminStats {
  totalUsers: number;
  activeUsersToday: number;
  totalRequests: number;
  requestsToday: number;
  premiumUsers: number;
  newUsersToday: number;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, { status: string; message: string }>;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, healthRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/health"),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (healthRes.ok) setHealth(await healthRes.json());
      } catch (e) {
        setError("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-gray-500 text-sm">Make sure ADMIN_SECRET is configured in your .env</p>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? "—", icon: "👥", color: "from-blue-500 to-blue-600" },
    { label: "Active Today", value: stats?.activeUsersToday ?? "—", icon: "⚡", color: "from-green-500 to-green-600" },
    { label: "Premium Users", value: stats?.premiumUsers ?? "—", icon: "⭐", color: "from-yellow-500 to-yellow-600" },
    { label: "New Today", value: stats?.newUsersToday ?? "—", icon: "🎉", color: "from-pink-500 to-pink-600" },
    { label: "Total Requests", value: stats?.totalRequests ?? "—", icon: "📡", color: "from-purple-500 to-purple-600" },
    { label: "Requests Today", value: stats?.requestsToday ?? "—", icon: "🔥", color: "from-orange-500 to-orange-600" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-gray-500 text-sm mt-1">System statistics and health monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-[#12121a] rounded-xl border border-[#1e1e2a] p-5 hover:border-[#2e2e3a] transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${card.color}`} />
            </div>
            <p className="text-3xl font-bold">{card.value}</p>
            <p className="text-gray-500 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* System Health */}
      {health && (
        <div className="bg-[#12121a] rounded-xl border border-[#1e1e2a] p-5">
          <h2 className="font-semibold mb-4">System Health</h2>
          <div className="flex items-center gap-2 mb-4">
            <div
              className={`w-3 h-3 rounded-full ${
                health.status === "healthy" ? "bg-green-500" : health.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm capitalize">{health.status}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(health.checks ?? {}).map(([key, check]) => (
              <div key={key} className="bg-[#0a0a0f] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      check.status === "healthy" ? "bg-green-500" : check.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-xs font-medium capitalize">{key}</span>
                </div>
                <p className="text-[10px] text-gray-500 truncate">{check.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: "/admin/users", label: "Users", icon: "👥", desc: "Manage users" },
          { href: "/admin/analytics", label: "Analytics", icon: "📈", desc: "View reports" },
          { href: "/admin/premium", label: "Premium", icon: "⭐", desc: "Subscriptions" },
          { href: "/admin/logs", label: "Logs", icon: "📋", desc: "Activity log" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-[#12121a] rounded-xl border border-[#1e1e2a] p-4 hover:border-indigo-500/30 transition-all text-center"
          >
            <span className="text-2xl block mb-2">{link.icon}</span>
            <p className="font-medium text-sm">{link.label}</p>
            <p className="text-gray-500 text-xs mt-0.5">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
