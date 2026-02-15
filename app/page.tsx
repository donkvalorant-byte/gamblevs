"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { socket } from "../src/lib/socket";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function Home() {
  const router = useRouter();

  const [status, setStatus] = useState("Bağlanıyor...");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(100);

  const presets = useMemo(() => [50, 100, 250, 500, 1000, 2500, 5000], []);

  useEffect(() => {
    const onConnect = () => {
      setStatus("✅ Bağlandı");
      socket.emit("balance:get");
    };

    const onBalance = (p: { balance: number }) => setBalance(Number(p?.balance || 0));

    const onRoomCreated = (p: { roomCode: string; bet: number }) => {
      setRoomCode(p.roomCode);
      setStatus("✅ Oda oluşturuldu.");
      try {
        localStorage.setItem("gamblevs_room", p.roomCode);
        localStorage.setItem("gamblevs_bet", String(p.bet));
      } catch {}
    };

    const onGameStart = (p: { roomCode: string; bet: number; startedAt: number; durationSec: number }) => {
      try {
        localStorage.setItem("gamblevs_room", p.roomCode);
        localStorage.setItem("gamblevs_bet", String(p.bet));
        localStorage.setItem("gamblevs_startedAt", String(p.startedAt));
        localStorage.setItem("gamblevs_durationSec", String(p.durationSec));
      } catch {}
      router.push("/mines");
    };

    const onErrorMessage = (msg: string) => {
      setStatus("⚠️ Hata");
      alert(msg);
      setTimeout(() => setStatus(socket.connected ? "✅ Bağlandı" : "Bağlanıyor..."), 650);
    };

    socket.on("connect", onConnect);
    socket.on("balance:update", onBalance);
    socket.on("roomCreated", onRoomCreated);
    socket.on("gameStart", onGameStart);
    socket.on("errorMessage", onErrorMessage);

    return () => {
      socket.off("connect", onConnect);
      socket.off("balance:update", onBalance);
      socket.off("roomCreated", onRoomCreated);
      socket.off("gameStart", onGameStart);
      socket.off("errorMessage", onErrorMessage);
    };
  }, [router]);

  const isConnected = status.includes("Bağlandı");

  return (
    <main className="min-h-screen bg-[#060913] text-white relative overflow-hidden">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="bgGlow"
          style={{
            left: -360,
            top: -380,
            background:
              "radial-gradient(circle at 30% 30%, rgba(0,210,255,.90), rgba(0,0,0,0) 60%)",
            animation: "floaty 10s ease-in-out infinite",
          }}
        />
        <div
          className="bgGlow"
          style={{
            right: -380,
            bottom: -420,
            opacity: 0.18,
            background:
              "radial-gradient(circle at 40% 40%, rgba(30,120,255,.85), rgba(0,0,0,0) 62%)",
            animation: "floaty2 12s ease-in-out infinite",
          }}
        />
        <div className="bgGrid" />
        <div className="bgVignette" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-7">
        {/* HEADER */}
        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <div className="logoWrap">
              <img src="/stitch.jpg" alt="logo" className="logoImg" draggable={false} />
            </div>

            <div className="min-w-0">
              <h1 className="title">
                GAMBLE<span className="titleVS">VS</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="stat">
              <div className="statLabel">BAKİYE</div>
              <div className="statValue">
                {balance} <span className="coin">💰</span>
              </div>
            </div>

            <div className={`stat ${isConnected ? "statOk" : ""}`}>
              <div className="statLabel">DURUM</div>
              <div className="statValueRow">
                <span className={`statusDot ${isConnected ? "statusDotOk" : ""}`} />
                <span className="statValue">{status}</span>
              </div>
            </div>
          </div>
        </header>

        {/* BODY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CREATE */}
          <section className="card">
            <div className="cardHead">
              <h2 className="cardTitle">Oda Oluştur</h2>
              <div className="cardHint">
                Bahis: <b className="accent">{bet}</b> <span className="coin">💰</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {presets.map((x) => {
                const active = bet === x;
                return (
                  <button
                    key={x}
                    onClick={() => setBet(x)}
                    className={`chip ${active ? "chipOn" : ""}`}
                  >
                    {x} <span className="coin">💰</span>
                  </button>
                );
              })}
            </div>

            <label className="fieldWrap">
              <span className="fieldLabel">Özel bahis</span>
              <input
                type="number"
                value={bet}
                min={10}
                max={10000}
                onChange={(e) => setBet(clamp(Number(e.target.value || 0), 0, 10000))}
                className="field"
              />
            </label>

            {!roomCode ? (
              <button onClick={() => socket.emit("createRoom", { bet })} className="btnPrimary">
                ODA OLUŞTUR
              </button>
            ) : (
              <div className="text-center mt-3">
                <div className="text-xs font-extrabold tracking-[0.22em] text-white/55">ODA KODU</div>
                <div className="mt-2 text-3xl font-black tracking-[0.24em] text-white drop-shadow">
                  {roomCode}
                </div>
              </div>
            )}
          </section>

          {/* JOIN */}
          <section className="card">
            <div className="cardHead">
              <h2 className="cardTitle">Katıl</h2>
              <div className="cardHint">Kodu gir</div>
            </div>

            <label className="fieldWrap">
              <span className="fieldLabel">Oda kodu</span>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="AB12CD"
                className="field tracking-widest font-extrabold"
              />
            </label>

            <button onClick={() => socket.emit("joinRoom", joinCode)} className="btnSecondary">
              KATIL
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
