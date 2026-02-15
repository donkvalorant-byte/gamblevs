import { io } from "socket.io-client";

export const socket = io({
  path: "/socket.io",
  transports: ["websocket"], // prod’da en stabil
  withCredentials: true,
});
