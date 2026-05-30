import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";

const Stat = ({ label, value, sub }) => (
  <div className="bg-gray-800 rounded-2xl p-5">
    <p className="text-gray-500 text-sm mb-1">{label}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
    {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
  </div>
);

const MeetingAnalytics = () => {
  const { meetingId } = useParams();
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // AI Summary state
  const [summaryText, setSummaryText] = useState("");
  const [actionItemsText, setActionItemsText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState({ text: "", type: "" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [analyticsRes, meetingRes] = await Promise.all([
          authFetch(`/api/meetings/${meetingId}/analytics`),
          authFetch(`/api/meetings/${meetingId}`),
        ]);
        if (!analyticsRes.ok) throw new Error("Meeting not found");
        const analyticsData = await analyticsRes.json();
        const meetingData = meetingRes.ok ? await meetingRes.json() : {};
        setAnalytics(analyticsData.analytics);
        setMeeting(meetingData.meeting);
        if (meetingData.meeting?.aiSummary) setSummaryText(meetingData.meeting.aiSummary);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [meetingId, authFetch]);

  const handleSaveSummary = async (e) => {
    e.preventDefault();
    setSummaryMsg({ text: "", type: "" });
    setSummaryLoading(true);
    try {
      // Parse action items from textarea (one per line)
      const items = actionItemsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((text) => ({ text }));

      const res = await authFetch(`/api/meetings/${meetingId}/ai-summary`, {
        method: "POST",
        body: JSON.stringify({ summary: summaryText, actionItems: items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSummaryMsg({ text: "Summary saved successfully!", type: "success" });
      setMeeting((prev) => ({ ...prev, aiSummary: data.aiSummary, actionItems: data.actionItems }));
    } catch (err) {
      setSummaryMsg({ text: err.message || "Failed to save summary.", type: "error" });
    } finally {
      setSummaryLoading(false);
    }
  };

  const toggleActionItem = async (itemId, completed) => {
    try {
      const res = await authFetch(`/api/meetings/${meetingId}/action-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      if (res.ok) {
        const data = await res.json();
        setMeeting((prev) => ({
          ...prev,
          actionItems: prev.actionItems.map((item) =>
            item._id === itemId ? { ...item, completed: data.actionItem.completed } : item
          ),
        }));
      }
    } catch (err) {
      console.error("Failed to update action item:", err);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : "—";
  const formatDuration = (s) => {
    if (!s) return "—";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return [h > 0 ? `${h}h` : null, m > 0 ? `${m}m` : null, `${sec}s`].filter(Boolean).join(" ");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-xl">{error}</p>
      <button onClick={() => navigate("/history")} className="text-blue-400 hover:text-blue-300">← Back to History</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#020617] to-blue-950 text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/history")} className="text-gray-400 hover:text-white transition-colors">←</button>
          <div>
            <h1 className="text-3xl font-bold">Meeting Analytics</h1>
            <p className="text-blue-400 font-mono">{meetingId}</p>
          </div>
          <span className={`ml-auto text-sm px-3 py-1 rounded-full font-medium ${
            analytics?.status === "active" ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"
          }`}>
            {analytics?.status}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Duration" value={formatDuration(analytics?.durationSeconds)} />
          <Stat label="Participants" value={analytics?.participantCount || 0} sub={`Peak: ${analytics?.peakParticipantCount || 0}`} />
          <Stat label="Messages" value={analytics?.messageCount || 0} />
          <Stat label="Action Items" value={analytics?.actionItemCount || 0} sub={`${analytics?.completedActionItems || 0} completed`} />
        </div>

        {/* Time info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Timeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><p className="text-gray-500 mb-1">Started</p><p>{formatDate(analytics?.startTime)}</p></div>
            <div><p className="text-gray-500 mb-1">Ended</p><p>{formatDate(analytics?.endTime)}</p></div>
            <div><p className="text-gray-500 mb-1">Participants</p><p>{analytics?.participants?.join(", ") || "—"}</p></div>
          </div>
        </div>

        {/* AI Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">🤖 AI Meeting Summary</h2>
          {summaryMsg.text && (
            <div className={`px-4 py-3 rounded-xl mb-4 text-sm ${
              summaryMsg.type === "success" ? "bg-green-900/40 border border-green-600 text-green-300" : "bg-red-900/40 border border-red-600 text-red-300"
            }`}>{summaryMsg.text}</div>
          )}
          <form onSubmit={handleSaveSummary} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Summary</label>
              <textarea
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                placeholder="Enter or paste the AI-generated meeting summary here..."
                rows={5}
                className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl outline-none focus:border-blue-500 transition-colors resize-none text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Action Items (one per line)</label>
              <textarea
                value={actionItemsText}
                onChange={(e) => setActionItemsText(e.target.value)}
                placeholder={"Follow up with the team\nPrepare Q3 report\nSchedule next meeting"}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl outline-none focus:border-blue-500 transition-colors resize-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={summaryLoading || !summaryText.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
            >
              {summaryLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : "Save Summary"}
            </button>
          </form>
        </div>

        {/* Saved action items */}
        {meeting?.actionItems?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">✅ Action Items</h2>
            <div className="space-y-3">
              {meeting.actionItems.map((item) => (
                <div key={item._id} className="flex items-start gap-3 p-3 bg-gray-800 rounded-xl">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => toggleActionItem(item._id, e.target.checked)}
                    className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${item.completed ? "line-through text-gray-500" : "text-white"}`}>{item.text}</p>
                    {item.assignedTo && <p className="text-xs text-gray-500 mt-1">Assigned to: {item.assignedTo}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${item.completed ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}`}>
                    {item.completed ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingAnalytics;
