"use client";

import { useEffect, useState } from "react";

interface User {
  id: number;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  isPremium: boolean;
  requestsToday: number;
  totalRequests: number;
  dailyLimit: number;
  createdAt: string;
  lastActiveAt: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const limit = 20;

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      try {
        const url = search
          ? `/api/admin/users/search?q=${encodeURIComponent(search)}&page=${page}&limit=${limit}`
          : `/api/admin/users?page=${page}&limit=${limit}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users ?? data ?? []);
          setTotal(data.total ?? data.length ?? 0);
        }
      } catch (e) {
        console.error("Failed to fetch users", e);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [page, search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all registered users</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name, username, or ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full bg-[#12121a] border border-[#1e1e2a] rounded-lg px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
      </div>

      {/* Users Table */}
      <div className="bg-[#12121a] rounded-xl border border-[#1e1e2a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2a] text-gray-500">
                <th className="text-left p-4 font-medium">User</th>
                <th className="text-left p-4 font-medium">Telegram ID</th>
                <th className="text-center p-4 font-medium">Plan</th>
                <th className="text-center p-4 font-medium">Requests Today</th>
                <th className="text-center p-4 font-medium">Total Requests</th>
                <th className="text-left p-4 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-[#1e1e2a] hover:bg-[#1a1a25] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                          {user.firstName?.charAt(0) ?? "?"}
                        </div>
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName ?? ""}</p>
                          {user.username && <p className="text-gray-500 text-xs">@{user.username}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-xs">{user.telegramId}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.isPremium ? "bg-yellow-500/10 text-yellow-400" : "bg-gray-500/10 text-gray-400"
                      }`}>
                        {user.isPremium ? "PREMIUM" : "FREE"}
                      </span>
                    </td>
                    <td className="p-4 text-center">{user.requestsToday}/{user.dailyLimit}</td>
                    <td className="p-4 text-center">{user.totalRequests}</td>
                    <td className="p-4 text-gray-400 text-xs">
                      {new Date(user.lastActiveAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-[#1e1e2a]">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-[#1a1a25] hover:bg-[#2a2a35] disabled:opacity-50 transition-all"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-[#1a1a25] hover:bg-[#2a2a35] disabled:opacity-50 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
