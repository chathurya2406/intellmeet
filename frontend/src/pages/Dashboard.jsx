import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");

  const createMeeting = () => {
    const id = Math.random().toString(36).substring(2, 10);
    navigate(`/meeting/${id}`);
  };

  const joinMeeting = () => {
    if (!roomId.trim()) return;
    navigate(`/meeting/${roomId.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#020617] to-blue-950 text-white">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, <span className="text-blue-400">{user?.name}</span> 👋
          </h1>
          <p className="text-gray-400 text-lg">Start or join a meeting to collaborate with your team.</p>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Create meeting */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-xl">
            <div className="text-5xl mb-4">🎥</div>
            <h2 className="text-2xl font-bold mb-2">New Meeting</h2>
            <p className="text-gray-400 mb-6">Start an instant meeting with a unique room ID.</p>
            <button
              onClick={createMeeting}
              className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl text-lg font-semibold transition-colors"
            >
              Start Meeting
            </button>
          </div>

          {/* Join meeting */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-xl">
            <div className="text-5xl mb-4">🔗</div>
            <h2 className="text-2xl font-bold mb-2">Join Meeting</h2>
            <p className="text-gray-400 mb-4">Enter a room ID to join an existing meeting.</p>
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
              className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl outline-none focus:border-blue-500 transition-colors mb-3"
            />
            <button
              onClick={joinMeeting}
              disabled={!roomId.trim()}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed py-4 rounded-xl text-lg font-semibold transition-colors"
            >
              Join Now
            </button>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate("/history")}
            className="bg-gray-900 border border-gray-800 hover:border-blue-600 rounded-2xl p-6 text-left transition-all group"
          >
            <div className="text-3xl mb-3">📋</div>
            <h3 className="text-lg font-semibold group-hover:text-blue-400 transition-colors">Meeting History</h3>
            <p className="text-gray-500 text-sm mt-1">View past meetings and analytics</p>
          </button>

          <button
            onClick={() => navigate("/profile")}
            className="bg-gray-900 border border-gray-800 hover:border-blue-600 rounded-2xl p-6 text-left transition-all group"
          >
            <div className="text-3xl mb-3">👤</div>
            <h3 className="text-lg font-semibold group-hover:text-blue-400 transition-colors">Profile</h3>
            <p className="text-gray-500 text-sm mt-1">Update your name and avatar</p>
          </button>

          <button
            onClick={() => navigate("/about")}
            className="bg-gray-900 border border-gray-800 hover:border-blue-600 rounded-2xl p-6 text-left transition-all group"
          >
            <div className="text-3xl mb-3">ℹ️</div>
            <h3 className="text-lg font-semibold group-hover:text-blue-400 transition-colors">About</h3>
            <p className="text-gray-500 text-sm mt-1">Learn about IntellMeet features</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
