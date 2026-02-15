// app/lib/socket.ts
import { io } from "socket.io-client";

export const socket = io("https://gamblevs-production.up.railway.app", {
  path: "/socket.io",
  transports: ["polling"],
  upgrade: false,
  withCredentials: true,
  timeout: 20000,
});
