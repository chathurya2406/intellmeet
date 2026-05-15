import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function MeetingRoom() {

  const { roomId } = useParams();

  const location = useLocation();

  const navigate = useNavigate();

  const name = location.state?.name;

  const [participants, setParticipants] = useState([]);

  // Video reference
  const localVideoRef = useRef();

  useEffect(() => {

    // Redirect if no name
    if (!name) {
      navigate("/");
      return;
    }

    // Join room
    socket.emit("join-room", roomId, name);

    // Add current user
    setParticipants((prev) => [...prev, name]);

    // Access camera and mic
    startVideo();

    // User joined
    socket.on("user-joined", (data) => {

      setParticipants((prev) => [
        ...prev,
        data.userId,
      ]);
    });

    // User left
    socket.on("user-left", (userId) => {

      setParticipants((prev) =>
        prev.filter((user) => user !== userId)
      );
    });

    return () => {
      socket.off("user-joined");
      socket.off("user-left");
    };

  }, [roomId, name, navigate]);

  // Start camera and microphone
  const startVideo = async () => {

    try {

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      // Show own video
      localVideoRef.current.srcObject = stream;

    } catch (error) {

      console.log("Error accessing media devices:", error);
    }
  };

  // Leave room
  const leaveMeeting = () => {

    socket.emit("leave-room", roomId, name);

    navigate("/");
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>

      <h1>Meeting Room</h1>

      <h2>Room ID: {roomId}</h2>

      <h3>User: {name}</h3>

      {/* Local Video */}
      <div style={{ marginTop: "30px" }}>

        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "400px",
            borderRadius: "10px",
            border: "2px solid black",
          }}
        />

      </div>

      <button
        onClick={leaveMeeting}
        style={{
          padding: "10px 20px",
          cursor: "pointer",
          marginTop: "20px",
        }}
      >
        Leave Meeting
      </button>

      <div style={{ marginTop: "40px" }}>

        <h2>Participants</h2>

        {participants.map((user, index) => (
          <p key={index}>{user}</p>
        ))}

      </div>

    </div>
  );
}

export default MeetingRoom;