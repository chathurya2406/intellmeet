import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import socket from "../socket";

function MeetingRoom() {
  const { roomId } = useParams();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  const pendingCandidates = useRef([]);

  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [notification, setNotification] = useState("");

  const [participants, setParticipants] = useState([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // =========================
  // CREATE PEER
  // =========================
  const createPeer = () => {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "stun:stun1.l.google.com:19302",
        },
      ],
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    peer.ontrack = (event) => {
      console.log("🔥 Remote stream received");

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peer.onconnectionstatechange = () => {
      console.log(
        "Connection State:",
        peer.connectionState
      );
    };

    peer.oniceconnectionstatechange = () => {
      console.log(
        "ICE State:",
        peer.iceConnectionState
      );
    };

    return peer;
  };

  // =========================
  // ENSURE PEER
  // =========================
  const ensurePeer = () => {
    if (
      !peerRef.current &&
      localStreamRef.current
    ) {
      peerRef.current = createPeer();

      localStreamRef.current
        .getTracks()
        .forEach((track) => {
          peerRef.current.addTrack(
            track,
            localStreamRef.current
          );
        });

      console.log(
        "Peer created and tracks added"
      );
    }
  };

  // =========================
  // START CAMERA + MIC
  // =========================
  const startMedia = async () => {
    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  };

  // =========================
  // JOIN ROOM
  // =========================
  const joinRoom = async () => {
    try {
      if (!username.trim()) {
        alert("Enter username");
        return;
      }

      await startMedia();

      ensurePeer();

      socket.emit("join-room", {
        roomId,
        username,
      });

      console.log("Joined room:", roomId);
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // MUTE
  // =========================
  const toggleMute = () => {
    const track =
      localStreamRef.current
        ?.getAudioTracks()[0];

    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  };

  // =========================
  // VIDEO ON/OFF
  // =========================
  const toggleVideo = () => {
    const track =
      localStreamRef.current
        ?.getVideoTracks()[0];

    if (track) {
      track.enabled = !track.enabled;
      setIsVideoOff(!track.enabled);
    }
  };

  // =========================
  // SCREEN SHARE
  // =========================
  const shareScreen = async () => {
    try {
      const screenStream =
        await navigator.mediaDevices.getDisplayMedia(
          {
            video: true,
          }
        );

      const screenTrack =
        screenStream.getVideoTracks()[0];

      const sender =
        peerRef.current
          ?.getSenders()
          .find(
            (s) =>
              s.track &&
              s.track.kind === "video"
          );

      if (sender) {
        sender.replaceTrack(screenTrack);
      }

      localVideoRef.current.srcObject =
        screenStream;

      setIsSharing(true);

      screenTrack.onended = async () => {
        const cameraStream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: true,
              audio: true,
            }
          );

        const cameraTrack =
          cameraStream.getVideoTracks()[0];

        if (sender) {
          sender.replaceTrack(cameraTrack);
        }

        localStreamRef.current =
          cameraStream;

        localVideoRef.current.srcObject =
          cameraStream;

        setIsSharing(false);
      };
    } catch (err) {
      console.log(err);
    }
  };

  const copyMeetingLink = async () => {
  try {
    await navigator.clipboard.writeText(
      window.location.href
    );

    setNotification(
      "Meeting link copied to clipboard!"
    );

    setTimeout(() => {
      setNotification("");
    }, 3000);
  } catch (err) {
    console.log(err);
  }
};
  // =========================
  // LEAVE
  // =========================
  
const leaveMeeting = () => {
    socket.emit("leave-room", {
      roomId,
      username,
    });

    localStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    peerRef.current?.close();

    peerRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setParticipants([]);
  };

  // =========================
  // CHAT
  // =========================
 const sendMessage = () => {
  console.log("SEND BUTTON CLICKED");

  if (!message.trim()) return;

  const msg = {
    username,
    text: message,
  };

  socket.emit("send-message", {
    roomId,
    message: msg,
  });

  setMessage("");
};
  // =========================
  // SOCKET EVENTS
  // =========================
  useEffect(() => {
    socket.on(
      "participant-list",
      (users) => {
        setParticipants(users);
      }
    );

    socket.on(
      "user-joined",
      async ({ username }) => {
        setNotification(
          `${username} joined the meeting`
        );

        setTimeout(() => {
          setNotification("");
        }, 3000);

        try {
          ensurePeer();

          const offer =
            await peerRef.current.createOffer();

          await peerRef.current.setLocalDescription(
            offer
          );

          socket.emit("offer", {
            roomId,
            offer,
          });
        } catch (err) {
          console.log(err);
        }
      }
    );

    socket.on(
      "offer",
      async ({ offer }) => {
        console.log("Offer received");
        try {
          ensurePeer();

          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(
              offer
            )
          );

          for (const candidate of pendingCandidates.current) {
            await peerRef.current.addIceCandidate(
              new RTCIceCandidate(
                candidate
              )
            );
          }

          pendingCandidates.current = [];

          const answer =
            await peerRef.current.createAnswer();

          await peerRef.current.setLocalDescription(
            answer
          );

          socket.emit("answer", {
            roomId,
            answer,
          });
        } catch (err) {
          console.log(err);
        }
      }
    );

    socket.on(
      "answer",
      async ({ answer }) => {
        console.log("Answer received");
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(
              answer
            )
          );

          for (const candidate of pendingCandidates.current) {
            await peerRef.current.addIceCandidate(
              new RTCIceCandidate(
                candidate
              )
            );
          }

          pendingCandidates.current = [];
        } catch (err) {
          console.log(err);
        }
      }
    );

    socket.on(
      "ice-candidate",
      async ({ candidate }) => {
        console.log("ICE received");
        try {
          if (!peerRef.current) return;

          if (
            peerRef.current.remoteDescription
          ) {
            await peerRef.current.addIceCandidate(
              new RTCIceCandidate(
                candidate
              )
            );
          } else {
            pendingCandidates.current.push(
              candidate
            );
          }
        } catch (err) {
          console.log(err);
        }
      }
    );

    socket.on(
      "receive-message",
      ({ message }) => {
        setMessages((prev) => [
          ...prev,
          message,
        ]);
      }
    );

    socket.on(
      "user-left",
      (username) => {
        setNotification(
          `${username} left the meeting`
        );

        setTimeout(() => {
          setNotification("");
        }, 3000);
      }
    );

    return () => {
      socket.off("participant-list");
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("receive-message");
      socket.off("user-left");
    };
  }, [roomId]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">

      <h1 className="text-3xl font-bold text-center mb-6">
        IntellMeet Video Call
      </h1>

      <div className="flex flex-col items-center gap-3">

        <input
          value={roomId}
          disabled
          className="w-72 p-3 bg-slate-800 rounded"
        />

        <input
          value={username}
          onChange={(e) =>
            setUsername(e.target.value)
          }
          placeholder="Username"
          className="w-72 p-3 bg-slate-800 rounded"
        />

        <button
          onClick={joinRoom}
          className="bg-blue-600 px-5 py-2 rounded"
        >
          Join Room
        </button>

        <div className="flex flex-wrap gap-3 mt-3">

          <button
            onClick={toggleMute}
            className="bg-yellow-500 px-4 py-2 rounded"
          >
            {isMuted
              ? "Unmute"
              : "Mute"}
          </button>

          <button
            onClick={toggleVideo}
            className="bg-purple-600 px-4 py-2 rounded"
          >
            {isVideoOff
              ? "Video On"
              : "Video Off"}
          </button>

          <button
            onClick={shareScreen}
            className="bg-green-600 px-4 py-2 rounded"
          >
            {isSharing
              ? "Sharing..."
              : "Share Screen"}
          </button>

          <button
           onClick={copyMeetingLink}
           className="bg-cyan-600 px-4 py-2 rounded"
        >
            Copy Link
           </button>
           
          <button
            onClick={leaveMeeting}
            className="bg-red-600 px-4 py-2 rounded"
          >
            Leave
          </button>

        </div>
      </div>

      {notification && (
        <div className="text-center mt-4 bg-green-600 p-2 rounded">
          {notification}
        </div>
      )}

      {/* PARTICIPANTS */}
      <div className="max-w-md mx-auto mt-6 bg-slate-900 rounded p-4">
        <h2 className="font-bold text-lg mb-2">
          Participants
        </h2>

        {participants.length === 0 ? (
          <p>No participants</p>
        ) : (
          participants.map((user, index) => (
            <p
              key={index}
              className="text-cyan-400"
            >
              👤 {user}
            </p>
          ))
        )}
      </div>

      <div className="flex justify-center gap-8 mt-8">

        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-[400px] h-[300px] bg-black rounded"
        />

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-[400px] h-[300px] bg-black rounded"
        />

      </div>

      <div className="max-w-xl mx-auto mt-8">

        <div className="h-60 overflow-y-auto bg-slate-900 p-3 rounded">
          {messages.map((msg, index) => (
            <p key={index}>
              <b className="text-cyan-400">
                {msg.username}:
              </b>{" "}
              {msg.text}
            </p>
          ))}
        </div>

        <div className="flex gap-2 mt-3">

          <input
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            placeholder="Type message..."
            className="flex-1 p-2 bg-slate-800 rounded"
          />

          <button
            onClick={sendMessage}
            className="bg-cyan-600 px-4 rounded"
          >
            Send
          </button>

        </div>

      </div>

    </div>
  );
}

export default MeetingRoom;