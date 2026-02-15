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
      {/* soft premium background (clean) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="bgGlow glowA" />
        <div className="bgGlow glowB" />
        <div className="bgGrid" />
        <div className="bgVignette" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-7">
        {/* HEADER */}
        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <div className="logoWrap">
              <img
                src="/stitch.jpg"
                alt="stitch"
                className="logoImg"
                draggable={false}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-end gap-2 flex-wrap">
                <h1 className="title">
                  GAMBLE<span className="titleVS">VS</span>
                </h1>
                <span className="pill">
                  <span className={`pillDot ${isConnected ? "pillDotOk" : ""}`} />
                  Stitch • Black/Blue
                </span>
              </div>
              <p className="subtitle">
                5x5 Mines • Realtime VS • Rakip bilgisi gizli
              </p>
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
                Seçili bahis: <b className="accent">{bet}</b> <span className="coin">💰</span>
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
              <span className="fieldHint">10 – 10000 arası</span>
            </label>

            {!roomCode ? (
              <button onClick={() => socket.emit("createRoom", { bet })} className="btnPrimary">
                ODA OLUŞTUR
              </button>
            ) : (
              <div className="codeBox">
                <div className="codeLabel">ODA KODU</div>
                <div className="code">{roomCode}</div>
                <div className="codeHint">Arkadaşın “Katıl” kısmından bu kodu girsin.</div>
              </div>
            )}
          </section>

          {/* JOIN */}
          <section className="card">
            <div className="cardHead">
              <h2 className="cardTitle">Odaya Katıl</h2>
              <div className="cardHint">Kodu girip maça bağlan</div>
            </div>

            <label className="fieldWrap">
              <span className="fieldLabel">Oda kodu</span>
              <input
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                }
                placeholder="ÖRN: AB12CD"
                className="field tracking-widest font-extrabold"
              />
              <span className="fieldHint">Sadece A–Z ve 0–9</span>
            </label>

            <button onClick={() => socket.emit("joinRoom", joinCode)} className="btnSecondary">
              KATIL
            </button>

            <div className="note">
              <div className="noteDot" />
              <div className="noteText">
                Rakip çekti mi/patladı mı <b>görmezsin</b>. İki oyuncu bitince sonuç gelir.
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-white/40">
          GAMBLEVS • Stitch Neon (Clean)
        </footer>
      </div>

      <style jsx global>{`
        /* background */
        .bgGlow{
          position:absolute;
          width:720px;
          height:720px;
          border-radius:9999px;
          filter: blur(110px);
          opacity:.22;
          mix-blend-mode: screen;
        }
        .glowA{
          left:-360px; top:-380px;
          background: radial-gradient(circle at 30% 30%, rgba(0,210,255,.90), rgba(0,0,0,0) 60%);
          animation: floaty 10s ease-in-out infinite;
        }
        .glowB{
          right:-380px; bottom:-420px;
          background: radial-gradient(circle at 40% 40%, rgba(30,120,255,.85), rgba(0,0,0,0) 62%);
          animation: floaty2 12s ease-in-out infinite;
          opacity:.18;
        }
        .bgGrid{
          position:absolute; inset:0;
          background:
            linear-gradient(rgba(90,190,255,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(90,190,255,.038) 1px, transparent 1px);
          background-size: 76px 76px;
          mask-image: radial-gradient(circle at 50% 20%, black 0%, transparent 68%);
          opacity:.55;
        }
        .bgVignette{
          position:absolute; inset:-2px;
          background: radial-gradient(circle at 50% 15%, rgba(0,0,0,0) 0%, rgba(0,0,0,.45) 60%, rgba(0,0,0,.80) 100%);
        }
        @keyframes floaty{
          0%{ transform: translate(-4%, -3%) scale(1); }
          50%{ transform: translate(4%, 3%) scale(1.05); }
          100%{ transform: translate(-4%, -3%) scale(1); }
        }
        @keyframes floaty2{
          0%{ transform: translate(4%, 3%) scale(1.05); }
          50%{ transform: translate(-4%, -3%) scale(1); }
          100%{ transform: translate(4%, 3%) scale(1.05); }
        }

        /* header typography */
        .title{
          font-size: 30px;
          font-weight: 950;
          letter-spacing: -0.02em;
          line-height: 1;
          background: linear-gradient(90deg,#ffffff 0%, #bfefff 35%, #2ab8ff 70%, #ffffff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 16px rgba(0,200,255,.18);
        }
        .titleVS{
          margin-left: 6px;
          background: linear-gradient(90deg,#2ab8ff 0%, #00e5ff 55%, #bfefff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 18px rgba(0,220,255,.22);
        }
        .subtitle{
          margin-top: 6px;
          font-size: 13px;
          color: rgba(255,255,255,.62);
        }

        /* logo */
        .logoWrap{
          width: 92px;
          height: 74px;
          border-radius: 18px;
          border: 1px solid rgba(120,200,255,.16);
          background: rgba(10,12,18,.55);
          box-shadow: 0 0 35px rgba(0,170,255,.10), inset 0 0 0 1px rgba(255,255,255,.03);
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
        }
        .logoImg{
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 0 26px rgba(0,190,255,.52));
          transform: translateZ(0);
          animation: bob 3.4s ease-in-out infinite;
        }
        @keyframes bob{
          0%{ transform: translateY(0); }
          50%{ transform: translateY(-6px); }
          100%{ transform: translateY(0); }
        }

        /* pills + stats */
        .pill{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(120,200,255,.16);
          background: rgba(0,120,255,.10);
          color: rgba(255,255,255,.82);
          font-size: 12px;
          box-shadow: 0 0 18px rgba(0,170,255,.10);
        }
        .pillDot{
          width: 8px; height: 8px;
          border-radius: 999px;
          background: rgba(0,200,255,.9);
          box-shadow: 0 0 14px rgba(0,200,255,.38);
          animation: pulse 1.2s ease-in-out infinite;
        }
        .pillDotOk{
          background: rgba(0,255,180,.9);
          box-shadow: 0 0 14px rgba(0,255,180,.35);
        }
        @keyframes pulse{
          0%{ transform: scale(1); opacity:.8; }
          50%{ transform: scale(1.18); opacity:1; }
          100%{ transform: scale(1); opacity:.8; }
        }
        .stat{
          min-width: 150px;
          padding: 10px 12px;
          border-radius: 18px;
          border: 1px solid rgba(120,200,255,.14);
          background: rgba(10,12,18,.55);
          box-shadow: 0 0 35px rgba(0,170,255,.08), inset 0 0 0 1px rgba(255,255,255,.03);
          backdrop-filter: blur(12px);
        }
        .statOk{
          border-color: rgba(0,255,180,.16);
          box-shadow: 0 0 35px rgba(0,255,180,.06), inset 0 0 0 1px rgba(255,255,255,.03);
        }
        .statLabel{
          font-size: 10px;
          letter-spacing: .14em;
          color: rgba(255,255,255,.52);
          font-weight: 900;
        }
        .statValue{
          margin-top: 3px;
          font-weight: 950;
          font-size: 14px;
          color: rgba(255,255,255,.92);
          white-space: nowrap;
        }
        .statValueRow{
          margin-top: 3px;
          display:flex;
          align-items:center;
          gap: 8px;
        }
        .statusDot{
          width: 10px; height: 10px;
          border-radius: 999px;
          background: rgba(0,200,255,.95);
          box-shadow: 0 0 16px rgba(0,200,255,.40);
          animation: pulse 1.2s ease-in-out infinite;
        }
        .statusDotOk{
          background: rgba(0,255,180,.9);
          box-shadow: 0 0 16px rgba(0,255,180,.35);
        }
        .coin{ filter: drop-shadow(0 0 10px rgba(0,200,255,.18)); }

        /* cards */
        .card{
          border-radius: 22px;
          border: 1px solid rgba(120,200,255,.14);
          background: rgba(10,12,18,.60);
          box-shadow: 0 0 45px rgba(0,170,255,.10), inset 0 0 0 1px rgba(255,255,255,.03);
          backdrop-filter: blur(14px);
          padding: 20px;
          position: relative;
          overflow:hidden;
        }
        .card:before{
          content:"";
          position:absolute; inset:-2px;
          background: radial-gradient(circle at 20% 20%, rgba(0,210,255,.10), rgba(0,0,0,0) 55%);
          pointer-events:none;
        }
        .cardHead{ position:relative; margin-bottom: 12px; }
        .cardTitle{ font-size: 18px; font-weight: 950; }
        .cardHint{ margin-top: 6px; font-size: 13px; color: rgba(255,255,255,.62); }
        .accent{ color: rgba(120,220,255,.95); }

        /* chips */
        .chip{
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(120,200,255,.14);
          background: rgba(0,0,0,.26);
          font-weight: 950;
          font-size: 13px;
          color: rgba(255,255,255,.90);
          transition: transform .12s ease, border-color .2s ease, box-shadow .2s ease, filter .2s ease;
        }
        .chip:hover{
          transform: translateY(-1px);
          filter: brightness(1.05);
          box-shadow: 0 10px 28px rgba(0,170,255,.08);
        }
        .chipOn{
          border-color: rgba(0,220,255,.45);
          background: linear-gradient(180deg, rgba(0,170,255,.24), rgba(0,0,0,.22));
          box-shadow: 0 0 0 3px rgba(0,220,255,.09), 0 0 32px rgba(0,220,255,.12);
        }

        /* fields */
        .fieldWrap{ display:block; margin-bottom: 14px; position:relative; }
        .fieldLabel{
          display:block;
          font-size: 12px;
          font-weight: 900;
          color: rgba(255,255,255,.72);
          margin-bottom: 8px;
        }
        .field{
          width: 100%;
          padding: 12px 12px;
          border-radius: 14px;
          background: rgba(0,0,0,.30);
          border: 1px solid rgba(120,200,255,.14);
          outline: none;
          color: white;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .field:focus{
          border-color: rgba(0,210,255,.34);
          box-shadow: 0 0 0 4px rgba(0,200,255,.10), inset 0 0 0 1px rgba(255,255,255,.03);
        }
        .fieldHint{
          display:block;
          margin-top: 8px;
          font-size: 11px;
          color: rgba(255,255,255,.45);
        }

        /* buttons */
        .btnPrimary, .btnSecondary{
          width: 100%;
          padding: 14px 14px;
          border-radius: 18px;
          font-weight: 950;
          letter-spacing: .06em;
          transition: transform .12s ease, filter .2s ease, box-shadow .2s ease;
          border: 1px solid rgba(255,255,255,.08);
        }
        .btnPrimary{
          background: linear-gradient(90deg, rgba(10,170,255,1), rgba(0,230,255,1));
          box-shadow: 0 16px 40px rgba(0,170,255,.18), 0 0 40px rgba(0,220,255,.14);
        }
        .btnPrimary:hover{ filter: brightness(1.06); box-shadow: 0 18px 50px rgba(0,170,255,.22), 0 0 52px rgba(0,220,255,.18); }
        .btnSecondary{
          background: linear-gradient(90deg, rgba(0,140,255,1), rgba(45,220,255,1));
          box-shadow: 0 16px 40px rgba(0,170,255,.14), 0 0 40px rgba(0,220,255,.12);
        }
        .btnSecondary:hover{ filter: brightness(1.06); box-shadow: 0 18px 50px rgba(0,170,255,.18), 0 0 52px rgba(0,220,255,.15); }
        .btnPrimary:active, .btnSecondary:active{ transform: scale(.985); }

        /* code box */
        .codeBox{
          margin-top: 14px;
          text-align:center;
          padding: 14px 12px;
          border-radius: 18px;
          border: 1px solid rgba(120,200,255,.18);
          background: rgba(0,0,0,.22);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
        }
        .codeLabel{
          font-size: 11px;
          letter-spacing: .18em;
          color: rgba(255,255,255,.55);
          font-weight: 900;
        }
        .code{
          margin-top: 6px;
          font-size: 28px;
          font-weight: 950;
          letter-spacing: .24em;
          text-shadow: 0 0 18px rgba(0,220,255,.14);
        }
        .codeHint{
          margin-top: 10px;
          font-size: 12px;
          color: rgba(255,255,255,.55);
        }

        /* note */
        .note{
          margin-top: 14px;
          display:flex;
          gap: 10px;
          align-items:flex-start;
          padding: 12px 12px;
          border-radius: 16px;
          border: 1px solid rgba(120,200,255,.14);
          background: rgba(0,0,0,.16);
        }
        .noteDot{
          width: 10px; height: 10px;
          border-radius: 999px;
          margin-top: 3px;
          background: rgba(0,220,255,.85);
          box-shadow: 0 0 16px rgba(0,220,255,.30);
          flex: 0 0 auto;
        }
        .noteText{
          font-size: 12px;
          color: rgba(255,255,255,.62);
          line-height: 1.4;
        }

        @media (prefers-reduced-motion: reduce) {
          .glowA, .glowB, .logoImg, .pillDot, .statusDot { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
