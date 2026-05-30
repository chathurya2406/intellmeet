import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";

const MeetingHistory = () => {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page, limit: 10 });
        if (statusFilter) params.set("status", statusFilter);
        const res = await authFetch(`/api/meetings?${params}`);
        if (!res.ok) throw new Error("Failed to load meetings");
        const data = await res.json();
        setMeetings(data.meetings || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, [page, statusFilter, authFetch]);

  const formatDuration = (secs) => {
    if (!secs) return "—";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h > 0 ? `${h}h` : null, m > 0 ? `${m}m` : null, `${s}s`].filter(Boolean).join(" ");
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#020617] to-blue-950 text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Meeting History</h1>
          <span className="text-gray-400">{pagination.total} total meetings</span>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          {["", "active", "ended"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/40 border border-red-600 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">{error}</div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-xl">No meetings found</p>
            <button onClick={() => navigate("/dashboard")} className="mt-4 text-blue-400 hover:text-blue-300">
              Start your first meeting →
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {meetings.map((m) => (
                <div key={m._id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-blue-400 text-lg font-semibold">{m.meetingId}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          m.status === "active" ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400">
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Started</p>
                          <p>{formatDate(m.startTime)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Duration</p>
                          <p>{formatDuration(m.durationSeconds)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Participants</p>
                          <p>{m.peakParticipantCount || m.participants?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Status</p>
                          <p className="capitalize">{m.status}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/analytics/${m.meetingId}`)}
                        className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl text-sm transition-colors"
                      >
                        Analytics
                      </button>
                      {m.status === "active" && (
                        <button
                          onClick={() => navigate(`/meeting/${m.meetingId}`)}
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm transition-colors"
                        >
                          Rejoin
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-xl text-sm transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-gray-400 text-sm">Page {page} of {pagination.pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-xl text-sm transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MeetingHistory;
