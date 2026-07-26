"use client";

import { useEffect, useState } from "react";

interface PremiumUser {
  id: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  isPremium: boolean;
  subscription?: { planType: string; expiresAt: string | null };
}

export default function AdminPremium() {
  const [users, setUsers] = useState<PremiumUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    async function fetchPremium() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/premium?page=${page}&limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users ?? []);
          setTotal(data.total ?? 0);
        }
      } catch (e) {
        console.error("Failed to fetch premium users", e);
      } finally {
        setLoading(false);
      }
    }
    fetchPremium();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Premium Management</h1>
        <p className="text-gray-500 text-sm mt-1">Manage premium subscriptions</p>
      </div>

      <div className="bg-[#12121a] rounded-xl border border-[#1e1e2a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2a] text-gray-500">
                <th className="text-left p-4 font-medium">User</th>
                <th className="text-left p-4 font-medium">Plan</th>
                <th className="text-left p-4 font-medium">Expires</th>
                <th className="text-center p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">No premium users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-[#1e1e2a] hover:bg-[#1a1a25] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-xs font-bold">
                          {user.firstName?.charAt(0) ?? "?"}
                        </div>
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName ?? ""}</p>
                          {user.username && <p className="text-gray-500 text-xs">@{user.username}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 capitalize">{user.subscription?.planType?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="p-4 text-gray-400 text-xs">
                      {user.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-400">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-[#1e1e2a]">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-[#1a1a25] hover:bg-[#2a2a35] disabled:opacity-50 transition-all"
              >← Prev</button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-[#1a1a25] hover:bg-[#2a2a35] disabled:opacity-50 transition-all"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
