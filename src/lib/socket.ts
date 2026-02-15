import { io, type Socket } from "socket.io-client";

export const socket: Socket = io("http://localhost:3000", {
  autoConnect: true,
});
