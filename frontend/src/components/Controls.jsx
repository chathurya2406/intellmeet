import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff } from "lucide-react";

const Controls = ({ toggleMic, toggleCamera, shareScreen, leaveMeeting, micOn = true, camOn = true, isScreenSharing = false }) => {
  return (
    <div className="flex items-center gap-4">
      {/* Mic */}
      <button
        onClick={toggleMic}
        title={micOn ? "Mute microphone" : "Unmute microphone"}
        className={`p-4 rounded-full transition-all ${micOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-500"}`}
      >
        {micOn ? <Mic className="text-white w-5 h-5" /> : <MicOff className="text-white w-5 h-5" />}
      </button>

      {/* Camera */}
      <button
        onClick={toggleCamera}
        title={camOn ? "Turn off camera" : "Turn on camera"}
        className={`p-4 rounded-full transition-all ${camOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-500"}`}
      >
        {camOn ? <Video className="text-white w-5 h-5" /> : <VideoOff className="text-white w-5 h-5" />}
      </button>

      {/* Screen share */}
      <button
        onClick={shareScreen}
        title={isScreenSharing ? "Stop sharing" : "Share screen"}
        className={`p-4 rounded-full transition-all ${isScreenSharing ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-700 hover:bg-gray-600"}`}
      >
        {isScreenSharing ? <MonitorOff className="text-white w-5 h-5" /> : <Monitor className="text-white w-5 h-5" />}
      </button>

      {/* Leave */}
      <button
        onClick={leaveMeeting}
        title="Leave meeting"
        className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-all"
      >
        <PhoneOff className="text-white w-5 h-5" />
      </button>
    </div>
  );
};

export default Controls;
