import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createSocket, disconnectSocket } from "../socket/socket";
import VideoCard from "../components/VideoCard";
import Controls from "../components/Controls";
import ChatBox from "../components/ChatBox";

// ICE servers for WebRTC (public STUN + optional TURN)
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const MeetingRoom = () => {
  const { id: meetingId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // Media state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: { stream, name } }
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]);

  // Meeting state
  const [participants, setParticipants] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);

  // Refs
  const socketRef = useRef(null);
  const peerConnections = useRef({}); // { socketId: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const createPeerConnection = useCallback((targetSocketId) => {
    if (peerConnections.current[targetSocketId]) {
      return peerConnections.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to the peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // When we receive a remote track, add it to remoteStreams
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => ({
        ...prev,
        [targetSocketId]: {
          stream: remoteStream,
          name: prev[targetSocketId]?.name || "Participant",
        },
      }));
    };

    // Send ICE candidates to the remote peer via signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc-ice-candidate", {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setRemoteStreams((prev) => {
          const updated = { ...prev };
          delete updated[targetSocketId];
          return updated;
        });
        delete peerConnections.current[targetSocketId];
      }
    };

    peerConnections.current[targetSocketId] = pc;
    return pc;
  }, []);

  const closePeerConnection = useCallback((socketId) => {
    const pc = peerConnections.current[socketId];
    if (pc) {
      pc.close();
      delete peerConnections.current[socketId];
    }
    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });
  }, []);

  // ── Media setup ────────────────────────────────────────────────────────────

  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMediaError(null);
      return stream;
    } catch (err) {
      console.error("[media] getUserMedia failed:", err);
      setMediaError("Camera/microphone access denied. You can still use chat.");
      return null;
    }
  }, []);

  // ── Socket + WebRTC setup ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    let mounted = true;

    const init = async () => {
      // 1. Start local media
      await startLocalMedia();

      // 2. Create authenticated socket
      const socket = createSocket(token);
      socketRef.current = socket;

      socket.on("connect", () => {
        if (!mounted) return;
        setSocketConnected(true);
        // Join the meeting room
        socket.emit("join-room", { meetingId });
      });

      socket.on("connect_error", (err) => {
        console.error("[socket] connect error:", err.message);
      });

      socket.on("disconnect", () => {
        if (!mounted) return;
        setSocketConnected(false);
      });

      // ── Chat ──────────────────────────────────────────────────────────────

      socket.on("chat-history", (history) => {
        if (!mounted) return;
        setMessages(history);
      });

      socket.on("chat-message", (msg) => {
        if (!mounted) return;
        setMessages((prev) => {
          // Avoid duplicates (we optimistically add our own messages)
          const exists = prev.some(
            (m) => m._id && m._id === msg._id
          );
          return exists ? prev : [...prev, msg];
        });
      });

      // ── Meeting info ──────────────────────────────────────────────────────

      socket.on("meeting-info", ({ participants: p }) => {
        if (!mounted) return;
        setParticipants(p || []);
      });

      // ── WebRTC: new user joined — we initiate the offer ───────────────────

      socket.on("user-joined", async ({ userId: _uid, name, socketId: remoteSocketId }) => {
        if (!mounted) return;
        // Update remote stream name placeholder
        setRemoteStreams((prev) => ({
          ...prev,
          [remoteSocketId]: { stream: null, name },
        }));

        // Create peer connection and send offer
        const pc = createPeerConnection(remoteSocketId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-offer", { targetSocketId: remoteSocketId, offer });
        } catch (err) {
          console.error("[webrtc] offer error:", err);
        }
      });

      // ── WebRTC: received offer — send answer ──────────────────────────────

      socket.on("webrtc-offer", async ({ offer, fromSocketId, fromUser }) => {
        if (!mounted) return;
        setRemoteStreams((prev) => ({
          ...prev,
          [fromSocketId]: { stream: prev[fromSocketId]?.stream || null, name: fromUser?.name || "Participant" },
        }));

        const pc = createPeerConnection(fromSocketId);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc-answer", { targetSocketId: fromSocketId, answer });
        } catch (err) {
          console.error("[webrtc] answer error:", err);
        }
      });

      // ── WebRTC: received answer ───────────────────────────────────────────

      socket.on("webrtc-answer", async ({ answer, fromSocketId }) => {
        if (!mounted) return;
        const pc = peerConnections.current[fromSocketId];
        if (pc && pc.signalingState !== "stable") {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (err) {
            console.error("[webrtc] setRemoteDescription answer error:", err);
          }
        }
      });

      // ── WebRTC: ICE candidate ─────────────────────────────────────────────

      socket.on("webrtc-ice-candidate", async ({ candidate, fromSocketId }) => {
        if (!mounted) return;
        const pc = peerConnections.current[fromSocketId];
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("[webrtc] addIceCandidate error:", err);
          }
        }
      });

      // ── User left ─────────────────────────────────────────────────────────

      socket.on("user-left", ({ userId: _uid, name: _name, socketId: remoteSocketId }) => {
        if (!mounted) return;
        if (remoteSocketId) closePeerConnection(remoteSocketId);
      });

      socket.on("error", ({ message }) => {
        console.error("[socket] server error:", message);
      });
    };

    init();

    return () => {
      mounted = false;
      // Close all peer connections
      Object.keys(peerConnections.current).forEach(closePeerConnection);
      // Stop local media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      // Leave room and disconnect socket
      if (socketRef.current) {
        socketRef.current.emit("leave-room", { meetingId });
        disconnectSocket();
      }
    };
  }, [token, meetingId, createPeerConnection, closePeerConnection, startLocalMedia]);

  // ── Controls ───────────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }, []);

  const shareScreen = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen share, restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const camStream = await startLocalMedia();
      if (camStream) {
        // Replace video track in all peer connections
        const videoTrack = camStream.getVideoTracks()[0];
        Object.values(peerConnections.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && videoTrack) sender.replaceTrack(videoTrack);
        });
      }
      setIsScreenSharing(false);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      // Update local preview
      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      // When user stops screen share via browser UI
      screenTrack.onended = () => shareScreen();
      setIsScreenSharing(true);
    } catch (err) {
      console.error("[screen] getDisplayMedia failed:", err);
    }
  }, [isScreenSharing, startLocalMedia]);

  const leaveMeeting = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (socketRef.current) {
      socketRef.current.emit("leave-room", { meetingId });
      disconnectSocket();
    }
    navigate("/dashboard");
  }, [meetingId, navigate]);

  const sendMessage = useCallback((text) => {
    if (!text?.trim() || !socketRef.current) return;
    socketRef.current.emit("chat-message", {
      meetingId,
      text: text.trim(),
    });
    // Optimistically add own message (will be deduped on server echo)
    setMessages((prev) => [
      ...prev,
      { sender: user?.name || "You", text: text.trim(), createdAt: new Date().toISOString() },
    ]);
  }, [meetingId, user]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div className="h-screen bg-[#020617] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="text-white text-2xl font-bold">IntellMeet</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">Room: <span className="text-blue-400 font-mono">{meetingId}</span></span>
          <span className={`w-2 h-2 rounded-full ${socketConnected ? "bg-green-500" : "bg-red-500"}`} title={socketConnected ? "Connected" : "Disconnected"} />
          {participants.length > 0 && (
            <span className="text-gray-500 text-sm">{participants.length} participant{participants.length !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* Media error banner */}
      {mediaError && (
        <div className="bg-yellow-900/40 border-b border-yellow-700 text-yellow-300 px-6 py-2 text-sm flex-shrink-0">
          ⚠️ {mediaError}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video area */}
        <div className="flex-1 p-4 flex flex-col overflow-hidden">
          {/* Video grid */}
          <div className={`grid gap-4 flex-1 overflow-hidden ${
            remoteEntries.length === 0 ? "grid-cols-1" :
            remoteEntries.length === 1 ? "grid-cols-2" :
            remoteEntries.length <= 3 ? "grid-cols-2" :
            "grid-cols-3"
          }`}>
            {/* Local video */}
            <VideoCard stream={localStream} name={`${user?.name || "You"} (You)`} muted />

            {/* Remote videos */}
            {remoteEntries.map(([socketId, { stream, name }]) => (
              <VideoCard key={socketId} stream={stream} name={name} muted={false} />
            ))}

            {/* Waiting placeholder when alone */}
            {remoteEntries.length === 0 && (
              <div className="bg-gray-900 rounded-2xl flex flex-col items-center justify-center text-gray-500 gap-3">
                <div className="w-16 h-16 border-2 border-gray-700 rounded-full flex items-center justify-center text-3xl">👤</div>
                <p className="text-lg">Waiting for others to join...</p>
                <p className="text-sm text-gray-600">Share the Room ID: <span className="text-blue-500 font-mono">{meetingId}</span></p>
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="h-24 flex items-center justify-center flex-shrink-0">
            <Controls
              toggleMic={toggleMic}
              toggleCamera={toggleCamera}
              shareScreen={shareScreen}
              leaveMeeting={leaveMeeting}
              micOn={micOn}
              camOn={camOn}
              isScreenSharing={isScreenSharing}
            />
          </div>
        </div>

        {/* Chat sidebar */}
        <div className="w-80 border-l border-gray-800 flex-shrink-0">
          <ChatBox messages={messages} sendMessage={sendMessage} currentUser={user?.name} />
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;
