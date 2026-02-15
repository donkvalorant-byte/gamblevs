/* 
1) Bu görseli: public/stitch.png olarak kaydet.
2) Bu dosyayı app/page.tsx içine yapıştır.
*/

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

    const onBalance = (p: { balance: number }) =>
      setBalance(Number(p?.balance || 0));

    const onRoomCreated = (p: { roomCode: string; bet: number }) => {
      setRoomCode(p.roomCode);
      setStatus("✅ Oda oluşturuldu.");
      try {
        localStorage.setItem("gamblevs_room", p.roomCode);
        localStorage.setItem("gamblevs_bet", String(p.bet));
      } catch {}
    };

    const onGameStart = (p: {
      roomCode: string;
      bet: number;
      startedAt: number;
      durationSec: number;
    }) => {
      try {
        localStorage.setItem("gamblevs_room", p.roomCode);
        localStorage.setItem("gamblevs_bet", String(p.bet));
        localStorage.setItem("gamblevs_startedAt", String(p.startedAt));
        localStorage.setItem("gamblevs_durationSec", String(p.durationSec));
      } catch {}
      router.push("/mines");
    };

    socket.on("connect", onConnect);
    socket.on("balance:update", onBalance);
    socket.on("roomCreated", onRoomCreated);
    socket.on("gameStart", onGameStart);

    return () => {
      socket.off("connect", onConnect);
      socket.off("balance:update", onBalance);
      socket.off("roomCreated", onRoomCreated);
      socket.off("gameStart", onGameStart);
    };
  }, [router]);

  return (
    <main className="min-h-screen text-white bg-[#02040B]">
      <div className="mx-auto max-w-6xl px-4 py-6">

        {/* TOP */}
        <header className="flex items-center justify-between mb-8">

          <div className="flex items-center gap-4">

            {/* STITCH LOGO */}
            <div className="relative w-[90px] h-[70px]">
              <img
                src="/stitch.jpg"
                alt="stitch"
                className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(0,145,255,0.5)] animate-float"
              />
            </div>

            <div>
              <div className="text-2xl font-extrabold tracking-tight">
                GAMBLE<span className="text-sky-400">VS</span>
              </div>
              <div className="text-sm text-white/60">
                Black • Blue • Stitch Theme
              </div>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              BAKİYE: <b>{balance} 💰</b>
            </div>
            <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              {status}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* CREATE */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
            <h2 className="text-lg font-bold mb-4">Oda Oluştur</h2>

            <div className="mb-3 text-sm opacity-70">Seçili bahis: {bet} 💰</div>

            <div className="flex flex-wrap gap-2 mb-4">
              {presets.map((x) => (
                <button
                  key={x}
                  onClick={() => setBet(x)}
                  className={`px-3 py-2 rounded-lg font-bold transition 
                  ${bet === x
                      ? "bg-sky-500 shadow-[0_0_20px_rgba(0,145,255,0.5)]"
                      : "bg-black/40 hover:bg-black/60"}`}
                >
                  {x}
                </button>
              ))}
            </div>

            <input
              type="number"
              value={bet}
              min={10}
              max={10000}
              onChange={(e) =>
                setBet(clamp(Number(e.target.value || 0), 0, 10000))
              }
              className="w-full mb-4 px-3 py-2 rounded-lg bg-black/40 border border-white/10"
            />

            {!roomCode ? (
              <button
                onClick={() => socket.emit("createRoom", { bet })}
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 font-extrabold transition shadow-[0_0_30px_rgba(0,145,255,0.5)]"
              >
                ODA OLUŞTUR
              </button>
            ) : (
              <div className="text-center mt-4">
                <div className="text-xs opacity-70">ODA KODU</div>
                <div className="text-2xl font-extrabold tracking-widest">
                  {roomCode}
                </div>
              </div>
            )}
          </div>

          {/* JOIN */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
            <h2 className="text-lg font-bold mb-4">Odaya Katıl</h2>

            <input
              value={joinCode}
              onChange={(e) =>
                setJoinCode(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                )
              }
              placeholder="ODA KODU"
              className="w-full mb-4 px-3 py-2 rounded-lg bg-black/40 border border-white/10 tracking-widest font-bold"
            />

            <button
              onClick={() => socket.emit("joinRoom", joinCode)}
              className="w-full py-3 rounded-xl bg-sky-400 hover:bg-sky-300 font-extrabold transition shadow-[0_0_30px_rgba(0,220,255,0.5)]"
            >
              KATIL
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
