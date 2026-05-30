import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

const JoinMeeting = () => {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!roomId.trim()) return;
    navigate(`/meeting/${roomId.trim()}`);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />
      <div className="flex items-center justify-center h-[85vh]">
        <div className="bg-gray-900 p-10 rounded-3xl w-[450px] border border-gray-800 shadow-2xl">
          <h1 className="text-4xl font-bold mb-2 text-center">Join Meeting</h1>
          <p className="text-gray-400 text-center mb-8">Enter the room ID shared with you</p>
          <input
            type="text"
            placeholder="Enter Meeting ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="w-full p-4 rounded-xl bg-gray-800 border border-gray-700 text-white outline-none focus:border-blue-500 transition-colors mb-4"
          />
          <button
            onClick={handleJoin}
            disabled={!roomId.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed p-4 rounded-xl text-xl font-semibold transition-colors"
          >
            Join Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinMeeting;
