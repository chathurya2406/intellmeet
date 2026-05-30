import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const createMeeting = () => {
    if (!user) { navigate("/login"); return; }
    const roomId = Math.random().toString(36).substring(2, 10);
    navigate(`/meeting/${roomId}`);
  };

  const handleJoin = () => {
    if (!user) { navigate("/login"); return; }
    navigate("/join");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#020617] to-blue-950 text-white">
      <Navbar />

      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6">
        <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-sm px-4 py-2 rounded-full mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          AI-Powered Meeting Platform
        </div>

        <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
          Connect.{" "}
          <span className="text-blue-500">Collaborate.</span>
          <br />
          <span className="text-gray-300">Achieve More.</span>
        </h1>

        <p className="text-gray-400 text-xl max-w-2xl mb-12 leading-relaxed">
          High-quality video meetings with real-time chat, screen sharing,
          AI meeting summaries, and action item tracking.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={createMeeting}
            className="bg-blue-600 hover:bg-blue-700 px-10 py-5 rounded-2xl text-xl font-semibold transition-all hover:scale-105 shadow-lg shadow-blue-900/40"
          >
            🎥 Start Meeting
          </button>
          <button
            onClick={handleJoin}
            className="border border-gray-600 hover:border-gray-400 hover:bg-gray-900 px-10 py-5 rounded-2xl text-xl font-semibold transition-all"
          >
            🔗 Join Meeting
          </button>
        </div>

        {user && (
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Go to Dashboard →
          </button>
        )}
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "🎥", title: "HD Video Calls", desc: "Crystal-clear WebRTC video with multi-participant support" },
            { icon: "💬", title: "Persistent Chat", desc: "Messages saved to database, full history on reconnect" },
            { icon: "🤖", title: "AI Summaries", desc: "Save meeting summaries and track action items" },
            { icon: "📊", title: "Analytics", desc: "Duration, participant count, message stats per meeting" },
            { icon: "🔒", title: "Secure Auth", desc: "JWT + refresh tokens, bcrypt passwords, audit logs" },
            { icon: "🖥️", title: "Screen Sharing", desc: "Share your screen with all meeting participants" },
          ].map((f) => (
            <div key={f.title} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:border-blue-700/50 transition-colors">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
