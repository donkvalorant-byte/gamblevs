import { io } from "socket.io-client";

const KEY = "gamblevs_clientId_v1";

export function getClientId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = cryptoRandom();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "no_ls_" + Date.now();
  }
}

function cryptoRandom() {
  // browser safe id
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const socket = io("https://gamblevs-production.up.railway.app", {
  path: "/socket.io",
  transports: ["polling"],
  upgrade: false,
  withCredentials: true,
  timeout: 20000,
});

if (typeof window !== "undefined") {
  socket.on("connect", () => {
    socket.emit("auth", { clientId: getClientId() });
  });
}
