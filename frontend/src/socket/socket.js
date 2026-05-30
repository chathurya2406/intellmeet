import { io } from "socket.io-client";

const URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Socket is created lazily with the JWT token so auth works.
// Call createSocket(token) once after login; call getSocket() anywhere else.
let socketInstance = null;

export const createSocket = (token) => {
  if (socketInstance) {
    socketInstance.disconnect();
  }
  socketInstance = io(URL, {
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  return socketInstance;
};

export const getSocket = () => socketInstance;

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
