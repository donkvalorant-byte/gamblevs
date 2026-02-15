import { io } from "socket.io-client";

export const socket = io("https://gamblevs-production.up.railway.app", {
  path: "/socket.io",
  transports: ["polling"],   // ✅ sadece polling
  upgrade: false,            // ✅ websocket’e yükseltme yok
  withCredentials: true,
  timeout: 20000,
});
