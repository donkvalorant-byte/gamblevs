const http = require("http");
const next = require("next");
const { Server } = require("socket.io");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000;

const rooms = new Map();
const balances = new Map();

const START_BALANCE = 10000;
const SIZE = 25;
const MINES = 3;
const MATCH_DURATION = 60000;

// ---------------- BALANCE ----------------
function getBalance(id) {
  if (!balances.has(id)) balances.set(id, START_BALANCE);
  return balances.get(id);
}

function setBalance(id, v) {
  balances.set(id, Math.max(0, Math.floor(v)));
}

// ---------------- HELPERS ----------------
function genRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function genMines() {
  const s = new Set();
  while (s.size < MINES) {
    s.add(Math.floor(Math.random() * SIZE));
  }
  return Array.from(s);
}

function calcMultiplier(picks) {
  return Number((1 + picks * 0.25).toFixed(2));
}

// ---------------- SERVER ----------------
app.prepare().then(() => {
  const server = http.createServer((req, res) => handle(req, res));

  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // give 10k
    getBalance(socket.id);
    socket.emit("balance:update", { balance: getBalance(socket.id) });

    socket.on("balance:get", () => {
      socket.emit("balance:update", { balance: getBalance(socket.id) });
    });

    socket.on("createRoom", ({ bet }) => {
      bet = Number(bet);

      if (!bet || bet < 10 || bet > 10000)
        return socket.emit("errorMessage", "Bet 10-10000 arası olmalı.");

      if (getBalance(socket.id) < bet)
        return socket.emit("errorMessage", "Bakiye yetersiz.");

      const code = genRoomCode();

      rooms.set(code, {
        code,
        bet,
        players: [socket.id],
        started: false,
        states: {},
      });

      socket.join(code);
      socket.emit("roomCreated", { roomCode: code, bet });
    });

    socket.on("joinRoom", (code) => {
      code = String(code || "").toUpperCase();
      const room = rooms.get(code);
      if (!room) return socket.emit("errorMessage", "Oda yok.");
      if (room.players.length >= 2)
        return socket.emit("errorMessage", "Oda dolu.");

      if (getBalance(socket.id) < room.bet)
        return socket.emit("errorMessage", "Bakiye yetersiz.");

      room.players.push(socket.id);
      socket.join(code);

      if (room.players.length === 2) {
        room.started = true;
        room.startedAt = Date.now();

        for (const pid of room.players) {
          setBalance(pid, getBalance(pid) - room.bet);
          room.states[pid] = {
            mines: genMines(),
            revealed: [],
            multiplier: 1,
            busted: false,
            cashed: false,
          };

          io.to(pid).emit("gameStart", {
            roomCode: code,
            bet: room.bet,
            startedAt: room.startedAt,
            durationSec: 60,
          });

          io.to(pid).emit("balance:update", {
            balance: getBalance(pid),
          });
        }
      }
    });

    socket.on("mines:reveal", ({ roomCode, index }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      const ps = room.states[socket.id];
      if (!ps || ps.busted || ps.cashed) return;

      if (ps.revealed.includes(index)) return;

      ps.revealed.push(index);

      if (ps.mines.includes(index)) {
        ps.busted = true;
      } else {
        ps.multiplier = calcMultiplier(ps.revealed.length);
      }

      socket.emit("mines:update", {
        your: {
          revealed: ps.revealed,
          multiplier: ps.multiplier,
          busted: ps.busted,
          cashedOut: ps.cashed,
          mines: ps.busted ? ps.mines : undefined,
        },
      });
    });

    socket.on("mines:cashout", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      const ps = room.states[socket.id];
      if (!ps || ps.busted || ps.cashed) return;

      ps.cashed = true;

      const win = Math.floor(room.bet * ps.multiplier);
      setBalance(socket.id, getBalance(socket.id) + win);

      socket.emit("balance:update", {
        balance: getBalance(socket.id),
      });

      socket.emit("mines:finish", {
        you: "win",
        yourFinalMult: ps.multiplier,
        oppFinalMult: 1,
        totalMult: ps.multiplier,
        paid: win,
        yourBalance: getBalance(socket.id),
      });
    });

    socket.on("disconnect", () => {
      balances.delete(socket.id);
    });
  });

  server.listen(PORT, () => {
    console.log("Server running on port", PORT);
  });
});
