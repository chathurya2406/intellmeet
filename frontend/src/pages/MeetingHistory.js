import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function MeetingHistory() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

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
      console.log("Error fetching meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  const joinMeeting = (roomId) => {
    navigate(`/meeting/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">

        <h1 className="text-4xl font-bold text-cyan-400">
          Meeting History
        </h1>

        <button
          onClick={() => navigate("/dashboard")}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          Back to Dashboard
        </button>

      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center text-lg">
          Loading meetings...
        </div>
      ) : meetings.length === 0 ? (

        <div className="text-center bg-slate-900 p-8 rounded-lg">
          <h2 className="text-2xl mb-2">
            No Meetings Found
          </h2>

          <p className="text-gray-400">
            Create a meeting to see it here.
          </p>
        </div>

      ) : (

        <div className="grid gap-5 max-w-5xl mx-auto">

          {meetings.map((meeting) => (
            <div
              key={meeting._id}
              className="bg-slate-900 rounded-xl p-5 shadow-lg border border-slate-800"
            >

              <div className="flex justify-between items-center">

                <div>

                  <h2 className="text-2xl font-bold text-cyan-400">
                    Room ID: {meeting.roomId}
                  </h2>

                  <p className="mt-2">
                    <span className="font-semibold">
                      Created By:
                    </span>{" "}
                    {meeting.createdBy || "Unknown"}
                  </p>

                  <p>
                    <span className="font-semibold">
                      Participants:
                    </span>{" "}
                    {meeting.participants?.length || 0}
                  </p>

                  <p>
                    <span className="font-semibold">
                      Date:
                    </span>{" "}
                    {meeting.createdAt
                      ? new Date(
                          meeting.createdAt
                        ).toLocaleString()
                      : "N/A"}
                  </p>

                </div>

                <button
                  onClick={() =>
                    joinMeeting(meeting.roomId)
                  }
                  className="bg-green-600 hover:bg-green-700 px-5 py-3 rounded font-semibold"
                >
                  Join Again
                </button>

              </div>

            </div>
          ))}

        </div>
      )}

    </div>
  );
}

export default MeetingHistory;