const { io } = require("socket.io-client");

const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  socket.emit("join-room", "room123", "user1");
});

socket.on("user-joined", (data) => {
  console.log("Someone joined:", data);
});