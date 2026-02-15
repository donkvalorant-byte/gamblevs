import { io } from "socket.io-client";

export const socket = io("https://gamblevs-production.up.railway.app", {
  path: "/socket.io",
  transports: ["polling", "websocket"], // ✅ önce polling, sonra websocket
  upgrade: true,
  rememberUpgrade: true,
  withCredentials: true,
  timeout: 20000,
});
