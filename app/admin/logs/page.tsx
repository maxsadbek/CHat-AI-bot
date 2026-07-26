"use client";

import { useEffect, useState } from "react";

interface LogEntry {
  id: string;
  action: string;
  adminId: number;
  details: string;
  createdAt: string;
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/logs?page=${page}&limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs ?? data ?? []);
          setTotal(data.total ?? data.length ?? 0);
        }
      } catch (e) {
        console.error("Failed to fetch logs", e);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  const getActionColor = (action: string) => {
    if (action.includes("grant") || action.includes("upgrade")) return "text-green-400";
    if (action.includes("revoke") || action.includes("downgrade")) return "text-red-400";
    if (action.includes("broadcast")) return "text-blue-400";
    return "text-gray-300";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Logs</h1>
        <p className="text-gray-500 text-sm mt-1">Admin action history</p>
      </div>

      <div className="bg-[#12121a] rounded-xl border border-[#1e1e2a] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No logs found</div>
        ) : (
          <div className="divide-y divide-[#1e1e2a]">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-[#1a1a25] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium capitalize ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, " ")}
                    </p>
                    <p className="text-gray-500 text-xs mt-1 truncate">{log.details}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">Admin #{log.adminId}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
