import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");

  const navigate = useNavigate();

  const joinMeeting = () => {
    if (name.trim() === "" || roomId.trim() === "") {
      alert("Please enter Name and Room ID");
      return;
    }

    navigate(`/room/${roomId}`, {
      state: { name },
    });
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>IntellMeet </h1>

      <input
        type="text"
        placeholder="Enter Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          padding: "10px",
          width: "250px",
          marginBottom: "10px",
        }}
      />

      <br />

      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        style={{
          padding: "10px",
          width: "250px",
          marginTop: "10px",
          marginRight: "10px",
        }}
      />

      <button
        onClick={joinMeeting}
        style={{
          padding: "10px 20px",
          cursor: "pointer",
        }}
      >
        Join Meeting
      </button>
    </div>
  );
}

export default Home;