import { io } from "socket.io-client";

export const socket = io("https://gamblevs-production.up.railway.app", {
  transports: ["websocket"],
  path: "/socket.io",
});
