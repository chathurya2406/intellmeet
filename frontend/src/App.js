import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";

function MeetingRoom() {
  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Meeting Room</h2>
      <p>Coming soon...</p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<MeetingRoom />} />
    </Routes>
  );
}

export default App;