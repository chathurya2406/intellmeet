import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Dashboard() {
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState("");
  const [meetings, setMeetings] = useState([]);

  // =========================
  // LOAD MEETING HISTORY
  // =========================
  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/meetings"
      );

      setMeetings(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // CREATE MEETING
  // =========================
  const createMeeting = () => {
    const newRoomId = Math.random()
      .toString(36)
      .substring(2, 10);

    navigate(`/meeting/${newRoomId}`);
  };

  // =========================
  // JOIN MEETING
  // =========================
  const joinMeeting = () => {
    if (!roomId.trim()) {
      alert("Please enter a Meeting ID");
      return;
    }

    navigate(`/meeting/${roomId}`);
  };

  // =========================
  // LOGOUT
  // =========================
  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">

      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">

          <h1 className="text-4xl font-bold text-cyan-400">
            IntellMeet Dashboard
          </h1>

          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            Logout
          </button>

        </div>

        {/* ACTION CARDS */}
        <div className="grid md:grid-cols-3 gap-5 mb-8">

          <div className="bg-slate-900 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-3">
              Create Meeting
            </h2>

            <button
              onClick={createMeeting}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded"
            >
              New Meeting
            </button>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-3">
              Join Meeting
            </h2>

            <input
              type="text"
              placeholder="Meeting ID"
              value={roomId}
              onChange={(e) =>
                setRoomId(e.target.value)
              }
              className="w-full p-3 rounded bg-slate-800 mb-3"
            />

            <button
              onClick={joinMeeting}
              className="w-full bg-green-600 hover:bg-green-700 py-3 rounded"
            >
              Join
            </button>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-3">
              Meeting History
            </h2>

            <button
              onClick={() =>
                navigate("/history")
              }
              className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded"
            >
              View History
            </button>
          </div>

        </div>

        {/* RECENT MEETINGS */}
        <div className="bg-slate-900 rounded-xl p-6 shadow-lg">

          <h2 className="text-2xl font-bold mb-4">
            Recent Meetings
          </h2>

          {meetings.length === 0 ? (
            <p className="text-gray-400">
              No meetings found
            </p>
          ) : (
            meetings.map((meeting) => (
              <div
                key={meeting._id}
                className="flex justify-between items-center bg-slate-800 p-4 rounded mb-3"
              >
                <div>

                  <p className="font-semibold text-cyan-400">
                    Room ID: {meeting.roomId}
                  </p>

                  <p className="text-gray-300">
                    Participants:{" "}
                    {meeting.participants?.length || 0}
                  </p>

                  <p className="text-gray-400 text-sm">
                    {meeting.createdAt
                      ? new Date(
                          meeting.createdAt
                        ).toLocaleString()
                      : "N/A"}
                  </p>

                </div>

                <button
                  onClick={() =>
                    navigate(
                      `/meeting/${meeting.roomId}`
                    )
                  }
                  className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded"
                >
                  Join Again
                </button>
              </div>
            ))
          )}

        </div>

      </div>

    </div>
  );
}

export default Dashboard;