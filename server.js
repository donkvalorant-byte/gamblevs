/**
 * GambleVS - Custom Next.js server + Socket.IO
 * Client events supported (per your Home page):
 *   - createRoom { bet }
 *   - joinRoom (roomCodeString)
 * Server emits:
 *   - roomCreated { roomCode, bet }
 *   - gameStart { roomCode, bet, startedAt, durationSec }
 *
 * Mines in-game events:
 *   - mines:reveal { roomCode, index }
 *   - mines:cashout { roomCode }
 *   - mines:update / mines:finish
 * Balance:
 *   - balance:get / balance:update
 */

const http = require("http");
const next = require("next");
const { Server } = require("socket.io");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = Number(process.env.PORT || 3000);

// ---------- In-memory state ----------
/**
 * rooms: Map<roomCode, roomObj>
 * roomObj = {
 *   roomCode,
 *   bet,
 *   players: [{ socketId }],
 *   startedAt,
 *   endsAt,
 *   stateBySocketId: { [socketId]: playerState },
 *   finished
 * }
 */
const rooms = new Map(); // roomCode -> room
const balances = new Map(); // socket.id -> balance

// ---------- Anti-cheat helpers ----------
function makeRateLimiter() {
  const buckets = new Map(); // key -> {tokens, updatedAt}
  return function rateLimit(key, opts = {}) {
    const now = Date.now();
    const cap = opts.capacity ?? 6;
    const refillPerSec = opts.refillPerSec ?? 6;
    const refillMs = 1000 / refillPerSec;

    let b = buckets.get(key);
    if (!b) {
      b = { tokens: cap, updatedAt: now };
      buckets.set(key, b);
    }
    const delta = Math.max(0, now - b.updatedAt);
    const refill = delta / refillMs;
    b.tokens = Math.min(cap, b.tokens + refill);
    b.updatedAt = now;

    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };
}

function requireRoom(roomsMap, socket, roomCode) {
  if (typeof roomCode !== "string" || roomCode.length < 2 || roomCode.length > 32) return null;
  const room = roomsMap.get(roomCode);
  if (!room) return null;
  const isMember = room.players && room.players.some((p) => p && p.socketId === socket.id);
  if (!isMember) return null;
  return room;
}

function validIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < 25;
}

function canAct(ps) {
  if (!ps) return false;
  if (ps.finished) return false;
  if (ps.busted) return false;
  if (ps.cashedOut) return false;
  return true;
}

function ensureNotRevealed(ps, idx) {
  if (!ps.revealedSet) ps.revealedSet = new Set(ps.revealed || []);
  return !ps.revealedSet.has(idx);
}

function markRevealed(ps, idx) {
  if (!ps.revealedSet) ps.revealedSet = new Set(ps.revealed || []);
  ps.revealedSet.add(idx);
  ps.revealed = Array.from(ps.revealedSet);
}

// ---------- Game helpers ----------
const SIZE = 25;
const MINES = 3;
const MATCH_DURATION_MS = 60_000;

function genRoomCode() {
  for (let tries = 0; tries < 12; tries++) {
    const code = crypto
      .randomBytes(4)
      .toString("base64")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 6);
    if (code.length === 6 && !rooms.has(code)) return code;
  }
  let code = "AB12CD";
  while (rooms.has(code)) code = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
  return code;
}

function genMines() {
  const set = new Set();
  while (set.size < MINES) set.add(Math.floor(Math.random() * SIZE));
  return Array.from(set);
}

// Replace with your own exact multiplier table if you already have one.
function calcMultiplier(safePicks) {
  const base = 1 + safePicks * 0.22 + Math.max(0, safePicks - 1) * 0.08;
  return Number(base.toFixed(2));
}

function getBalance(socketId) {
  if (!balances.has(socketId)) balances.set(socketId, 1000);
  return balances.get(socketId) || 0;
}
function setBalance(socketId, v) {
  balances.set(socketId, Math.max(0, Math.floor(Number(v) || 0)));
}

function emitBalance(io, socketId) {
  io.to(socketId).emit("balance:update", { balance: getBalance(socketId) });
}

function roomSnapshotFor(room, viewerSocketId) {
  const you = room.stateBySocketId[viewerSocketId];
  return {
    your: {
      revealed: you.revealed || [],
      multiplier: you.multiplier || 1,
      busted: !!you.busted,
      cashedOut: !!you.cashedOut,
      mines: you.busted || room.finished ? you.mines : undefined,
    },
  };
}

function startMatch(io, room) {
  if (!room || room.players.length !== 2) return;

  const [pA, pB] = room.players;
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + MATCH_DURATION_MS;
  room.finished = false;

  setBalance(pA.socketId, getBalance(pA.socketId) - room.bet);
  setBalance(pB.socketId, getBalance(pB.socketId) - room.bet);

  room.stateBySocketId[pA.socketId] = {
    mines: genMines(),
    revealed: [],
    revealedSet: new Set(),
    multiplier: 1,
    busted: false,
    cashedOut: false,
    finished: false,
  };
  room.stateBySocketId[pB.socketId] = {
    mines: genMines(),
    revealed: [],
    revealedSet: new Set(),
    multiplier: 1,
    busted: false,
    cashedOut: false,
    finished: false,
  };

  io.to(pA.socketId).emit("gameStart", {
    roomCode: room.roomCode,
    bet: room.bet,
    startedAt: room.startedAt,
    durationSec: Math.floor(MATCH_DURATION_MS / 1000),
  });
  io.to(pB.socketId).emit("gameStart", {
    roomCode: room.roomCode,
    bet: room.bet,
    startedAt: room.startedAt,
    durationSec: Math.floor(MATCH_DURATION_MS / 1000),
  });

  emitBalance(io, pA.socketId);
  emitBalance(io, pB.socketId);
}

function tryFinishRoom(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.finished) return;

  const [pA, pB] = room.players;
  if (!pA || !pB) return;

  const a = room.stateBySocketId[pA.socketId];
  const b = room.stateBySocketId[pB.socketId];
  if (!a || !b) return;

  const timeEnded = !!room.endsAt && Date.now() >= room.endsAt;

  const aDone = !!a.finished || !!a.busted || !!a.cashedOut || timeEnded;
  const bDone = !!b.finished || !!b.busted || !!b.cashedOut || timeEnded;

  if (!aDone || !bDone) return;

  if (timeEnded) {
    if (!a.busted && !a.cashedOut) {
      a.cashedOut = true;
      a.finished = true;
    }
    if (!b.busted && !b.cashedOut) {
      b.cashedOut = true;
      b.finished = true;
    }
  }

  const bet = room.bet;
  const mA = Number(a.multiplier || 1);
  const mB = Number(b.multiplier || 1);

  const aBusted = !!a.busted;
  const bBusted = !!b.busted;

  let totalMult = Number((mA + mB - 1).toFixed(2));

  let paidA = 0;
  let paidB = 0;
  let youA = "draw";
  let youB = "draw";

  if (!aBusted && !bBusted) {
    if (mA > mB) {
      youA = "win";
      youB = "lose";
      paidA = Math.floor(bet * totalMult);
    } else if (mB > mA) {
      youB = "win";
      youA = "lose";
      paidB = Math.floor(bet * totalMult);
    } else {
      youA = "draw";
      youB = "draw";
      paidA = Math.floor(bet * mA);
      paidB = Math.floor(bet * mB);
    }
  } else if (aBusted && bBusted) {
    youA = "lose";
    youB = "lose";
    paidA = 0;
    paidB = 0;
  } else {
    const winner = aBusted ? b : a;
    const winnerM = Number(winner.multiplier || 1);
    const winnerPaid = Math.floor(bet * (winnerM + 1));

    if (aBusted) {
      youA = "lose";
      youB = "win";
      paidB = winnerPaid;
    } else {
      youA = "win";
      youB = "lose";
      paidA = winnerPaid;
    }
    totalMult = Number((winnerM + 1).toFixed(2));
    a.finished = true;
    b.finished = true;
  }

  if (paidA > 0) setBalance(pA.socketId, getBalance(pA.socketId) + paidA);
  if (paidB > 0) setBalance(pB.socketId, getBalance(pB.socketId) + paidB);

  room.finished = true;

  io.to(pA.socketId).emit("mines:finish", {
    you: youA,
    yourFinalMult: mA,
    oppFinalMult: mB,
    totalMult,
    paid: paidA,
    yourBalance: getBalance(pA.socketId),
  });
  io.to(pB.socketId).emit("mines:finish", {
    you: youB,
    yourFinalMult: mB,
    oppFinalMult: mA,
    totalMult,
    paid: paidB,
    yourBalance: getBalance(pB.socketId),
  });

  emitBalance(io, pA.socketId);
  emitBalance(io, pB.socketId);
}

// ---------- Server ----------
app.prepare().then(() => {
  const server = http.createServer((req, res) => handle(req, res));
  const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

  const rateLimit = makeRateLimiter();

  io.on("connection", (socket) => {
    getBalance(socket.id);
    emitBalance(io, socket.id);

    socket.on("balance:get", () => emitBalance(io, socket.id));

    socket.on("createRoom", (data) => {
      try {
        if (!rateLimit(`${socket.id}:create`, { capacity: 3, refillPerSec: 1 })) return;

        const bet = Math.floor(Number(data?.bet || 0));
        if (!Number.isFinite(bet) || bet < 10 || bet > 10000) {
          return socket.emit("errorMessage", "Bet 10-10000 arası olmalı.");
        }

        const b = getBalance(socket.id);
        if (b < bet) return socket.emit("errorMessage", "Bakiye yetersiz.");

        const roomCode = genRoomCode();
        const room = {
          roomCode,
          bet,
          players: [{ socketId: socket.id }],
          startedAt: 0,
          endsAt: 0,
          stateBySocketId: {},
          finished: false,
        };

        rooms.set(roomCode, room);
        socket.join(roomCode);

        socket.emit("roomCreated", { roomCode, bet });
      } catch (e) {}
    });

    socket.on("joinRoom", (joinCode) => {
      try {
        if (!rateLimit(`${socket.id}:join`, { capacity: 4, refillPerSec: 1 })) return;

        const roomCode = String(joinCode || "").trim().toUpperCase();
        if (!roomCode || roomCode.length > 32) return socket.emit("errorMessage", "Room code hatalı.");

        const room = rooms.get(roomCode);
        if (!room) return socket.emit("errorMessage", "Oda bulunamadı.");
        if (room.players.length >= 2) return socket.emit("errorMessage", "Oda dolu.");
        if (room.players.some((p) => p.socketId === socket.id)) return;

        const b = getBalance(socket.id);
        if (b < room.bet) return socket.emit("errorMessage", "Bakiye yetersiz.");

        room.players.push({ socketId: socket.id });
        socket.join(roomCode);

        if (room.players.length === 2) startMatch(io, room);
      } catch (e) {}
    });

    socket.on("mines:reveal", (data) => {
      try {
        if (!rateLimit(`${socket.id}:reveal`, { capacity: 10, refillPerSec: 8 })) return;

        const roomCode = data?.roomCode;
        const index = data?.index;
        if (!validIndex(index)) return;

        const room = requireRoom(rooms, socket, roomCode);
        if (!room) return;

        if (room.endsAt && Date.now() >= room.endsAt) return;

        const ps = room.stateBySocketId[socket.id];
        if (!canAct(ps)) return;

        if (!ensureNotRevealed(ps, index)) return;

        const isMine = ps.mines.includes(index);

        if (isMine) {
          markRevealed(ps, index);
          ps.busted = true;
          ps.finished = true;
        } else {
          markRevealed(ps, index);
          const safePicks = ps.revealed.length - ps.mines.filter((m) => ps.revealedSet.has(m)).length;
          ps.multiplier = calcMultiplier(safePicks);
        }

        io.to(socket.id).emit("mines:update", roomSnapshotFor(room, socket.id));

        tryFinishRoom(io, roomCode);
      } catch (e) {}
    });

    socket.on("mines:cashout", (data) => {
      try {
        if (!rateLimit(`${socket.id}:cashout`, { capacity: 3, refillPerSec: 1 })) return;

        const roomCode = data?.roomCode;
        const room = requireRoom(rooms, socket, roomCode);
        if (!room) return;

        if (room.endsAt && Date.now() >= room.endsAt) return;

        const ps = room.stateBySocketId[socket.id];
        if (!canAct(ps)) return;

        ps.cashedOut = true;
        ps.finished = true;

        io.to(socket.id).emit("mines:update", roomSnapshotFor(room, socket.id));

        tryFinishRoom(io, roomCode);
      } catch (e) {}
    });

    socket.on("disconnect", () => {
      for (const [code, room] of rooms) {
        if (!room.players.some((p) => p.socketId === socket.id)) continue;

        const ps = room.stateBySocketId?.[socket.id];
        if (ps && !ps.finished) {
          ps.finished = true;
          ps.cashedOut = false;
          ps.busted = true;
        }

        tryFinishRoom(io, code);

        room.players = room.players.filter((p) => p.socketId !== socket.id);
        if (room.players.length === 0) rooms.delete(code);
      }
      balances.delete(socket.id);
    });
  });

  server.listen(PORT, () => {
    console.log(`✅ GambleVS server ready on http://localhost:${PORT}`);
  });
});
