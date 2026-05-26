import React, { useState } from "react";

import { useNavigate } from "react-router-dom";

function Home() {

  const navigate = useNavigate();

  const [name, setName] = useState("");

  const [roomId, setRoomId] =
    useState("");

  const joinMeeting = () => {

    if (!name || !roomId) {

      alert("Enter name and room ID");

      return;
    }

    navigate(`/meeting/${roomId}`, {
      state: { name },
    });
  };

  return (

    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center">

      <h1 className="text-4xl font-bold mb-8">

        IntellMeet

      </h1>

      <div className="bg-slate-900 p-8 rounded-xl flex flex-col gap-4 w-96">

        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          className="p-3 rounded bg-slate-800"
        />

        <input
          type="text"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) =>
            setRoomId(e.target.value)
          }
          className="p-3 rounded bg-slate-800"
        />

        <button
          onClick={joinMeeting}
          className="bg-blue-600 p-3 rounded-lg"
        >
          Join Meeting
        </button>

      </div>

    </div>
  );
}

export default Home;