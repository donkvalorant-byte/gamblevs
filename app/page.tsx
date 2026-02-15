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
      setTimeout(() => setStatus(socket.connected ? "✅ Bağlandı" : "Bağlanıyor..."), 800);
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

  const connected = typeof status === "string" && status.includes("Bağlandı");

  return (
    <main className="min-h-screen text-white bg-[#02040B] relative overflow-hidden">
      {/* BACKDROP */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="bg-blob bg-blob-a" />
        <div className="bg-blob bg-blob-b" />
        <div className="bg-blob bg-blob-c" />
        <div className="bg-grid" />
        <div className="bg-vignette" />
        <div className="bg-noise" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6">
        {/* TOP */}
        <header className="flex items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* STITCH LOGO */}
            <div className="relative w-[96px] h-[76px] shrink-0">
              <div className="absolute -inset-3 rounded-2xl bg-sky-500/10 blur-xl" />
              <div className="absolute -inset-[1px] rounded-2xl border border-sky-300/20 shadow-[0_0_40px_rgba(0,180,255,.18)]" />
              <img
                src="/stitch.jpg"
                alt="stitch"
                className="relative w-full h-full object-contain drop-shadow-[0_0_30px_rgba(0,190,255,0.55)] animate-float select-none"
                draggable={false}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-3xl font-extrabold tracking-tight leading-none">
                  <span className="title-neon">GAMBLE</span>
                  <span className="title-neon-vs">VS</span>
                </div>
                <span className="hidden sm:inline-flex badge-chip">
                  <span className="dot" />
                  Mines VS • Realtime
                </span>
              </div>

              <div className="mt-1 text-sm text-white/70 flex items-center gap-2">
                <span className="opacity-80">Black • Blue • Stitch Theme</span>
                <span className="hidden sm:inline opacity-40">•</span>
                <span className="hidden sm:inline text-white/55">5x5 / 3 mayın</span>
              </div>

              <div className="shine-line mt-3" />
            </div>
          </div>

          <div className="flex gap-3 items-center shrink-0">
            <div className="chip glass">
              <div className="chipLabel">BAKİYE</div>
              <div className="chipValue">
                {balance} <span className="coin">💰</span>
              </div>
            </div>

            <div className={`chip glass ${connected ? "chipOk" : "chipWait"}`}>
              <div className="statusRow">
                <span className={`pulseDot ${connected ? "pulseOk" : "pulseWait"}`} />
                <div className="chipValue">{status}</div>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CREATE */}
          <section className="panel glass">
            <div className="panelTop">
              <h2 className="panelTitle">Oda Oluştur</h2>
              <div className="panelSub">
                Seçili bahis: <b className="text-sky-300">{bet}</b> <span className="coin">💰</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {presets.map((x) => {
                const active = bet === x;
                return (
                  <button
                    key={x}
                    onClick={() => setBet(x)}
                    className={`chipBtn ${active ? "chipBtnOn" : "chipBtnOff"}`}
                  >
                    <span className="chipBtnGlow" />
                    <span className="chipBtnInner">
                      {x} <span className="coin">💰</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="fieldWrap">
              <div className="fieldLabel">Özel bahis</div>
              <input
                type="number"
                value={bet}
                min={10}
                max={10000}
                onChange={(e) => setBet(clamp(Number(e.target.value || 0), 0, 10000))}
                className="field"
              />
              <div className="fieldHint">10 – 10000 arası</div>
            </div>

            {!roomCode ? (
              <button onClick={() => socket.emit("createRoom", { bet })} className="btnPrimary">
                <span className="btnSheen" />
                <span className="btnText">ODA OLUŞTUR</span>
              </button>
            ) : (
              <div className="roomBox">
                <div className="roomLabel">ODA KODU</div>
                <div className="roomCode">{roomCode}</div>
                <div className="roomHint">Kodu arkadaşına gönder, o da “Katıl”dan girsin.</div>
              </div>
            )}
          </section>

          {/* JOIN */}
          <section className="panel glass">
            <div className="panelTop">
              <h2 className="panelTitle">Odaya Katıl</h2>
              <div className="panelSub">Arkadaşının gönderdiği kodu gir</div>
            </div>

            <div className="fieldWrap">
              <div className="fieldLabel">Oda kodu</div>
              <input
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                }
                placeholder="ÖRN: AB12CD"
                className="field tracking-widest font-extrabold"
              />
              <div className="fieldHint">Sadece A–Z ve 0–9</div>
            </div>

            <button onClick={() => socket.emit("joinRoom", joinCode)} className="btnSecondary">
              <span className="btnSheen" />
              <span className="btnText">KATIL</span>
            </button>

            <div className="miniNote">
              <div className="miniDot" />
              <div className="miniText">
                Rakip bilgisi <b>gizli</b>. Oyun iki kişi bitince sonuçlanır.
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-white/40">
          GAMBLEVS • Stitch Theme • Neon Blue Edition
        </footer>
      </div>

      <style jsx global>{`
        /* ===== Animations ===== */
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
          100% { transform: translateY(0px); }
        }
        .animate-float { animation: float 3.2s ease-in-out infinite; }

        @keyframes blob {
          0% { transform: translate3d(-6%, -4%, 0) scale(1); }
          50% { transform: translate3d(6%, 4%, 0) scale(1.05); }
          100% { transform: translate3d(-6%, -4%, 0) scale(1); }
        }
        @keyframes blob2 {
          0% { transform: translate3d(7%, 2%, 0) scale(1.05); }
          50% { transform: translate3d(-6%, -4%, 0) scale(1); }
          100% { transform: translate3d(7%, 2%, 0) scale(1.05); }
        }
        @keyframes blob3 {
          0% { transform: translate3d(0%, 0%, 0) scale(1); }
          50% { transform: translate3d(3%, -6%, 0) scale(1.08); }
          100% { transform: translate3d(0%, 0%, 0) scale(1); }
        }

        @keyframes sheen {
          0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
          20% { opacity: .55; }
          60% { opacity: .55; }
          100% { transform: translateX(140%) skewX(-18deg); opacity: 0; }
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: .75; }
          50% { transform: scale(1.22); opacity: 1; }
          100% { transform: scale(1); opacity: .75; }
        }

        /* ===== Backdrop ===== */
        .bg-blob{
          position:absolute;
          width: 640px;
          height: 640px;
          border-radius: 9999px;
          filter: blur(90px);
          opacity: .26;
          mix-blend-mode: screen;
        }
        .bg-blob-a{
          left: -220px; top: -260px;
          background: radial-gradient(circle at 30% 30%, rgba(80,210,255,.85), rgba(0,0,0,0) 60%);
          animation: blob 10.5s ease-in-out infinite;
        }
        .bg-blob-b{
          right: -260px; top: -200px;
          background: radial-gradient(circle at 40% 40%, rgba(35,140,255,.75), rgba(0,0,0,0) 62%);
          animation: blob2 12.5s ease-in-out infinite;
          opacity: .22;
        }
        .bg-blob-c{
          left: 18%; bottom: -360px;
          background: radial-gradient(circle at 40% 40%, rgba(0,230,255,.55), rgba(0,0,0,0) 65%);
          animation: blob3 14s ease-in-out infinite;
          opacity: .20;
        }
        .bg-grid{
          position:absolute; inset:0;
          background:
            linear-gradient(rgba(80,190,255,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(80,190,255,.05) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(circle at 50% 30%, black 0%, transparent 70%);
          opacity: .55;
        }
        .bg-vignette{
          position:absolute; inset:-2px;
          background: radial-gradient(circle at 50% 20%, rgba(0,0,0,0) 0%, rgba(0,0,0,.55) 60%, rgba(0,0,0,.85) 100%);
        }
        .bg-noise{
          position:absolute; inset:0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='.25'/%3E%3C/svg%3E");
          opacity: .10;
          mix-blend-mode: overlay;
        }

        /* ===== Common UI ===== */
        .glass{
          background: rgba(10, 12, 18, 0.62);
          border: 1px solid rgba(120, 200, 255, 0.14);
          box-shadow:
            0 0 45px rgba(0, 170, 255, 0.10),
            inset 0 0 0 1px rgba(255,255,255,0.04);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-radius: 22px;
        }

        .badge-chip{
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(120,200,255,.18);
          background: rgba(0, 120, 255, 0.10);
          box-shadow: 0 0 20px rgba(0, 170, 255, 0.12);
          color: rgba(255,255,255,.85);
          gap: 8px;
          align-items: center;
        }
        .badge-chip .dot{
          width: 8px; height: 8px; border-radius: 999px;
          background: rgba(0, 220, 255, .9);
          box-shadow: 0 0 14px rgba(0, 220, 255, .55);
          display: inline-block;
        }

        .title-neon{
          background: linear-gradient(90deg, #ffffff 0%, #9be7ff 35%, #2ab8ff 70%, #ffffff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 18px rgba(60, 180, 255, 0.28);
          position: relative;
        }
        .title-neon-vs{
          margin-left: 4px;
          background: linear-gradient(90deg, #2ab8ff 0%, #00e5ff 60%, #9be7ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 22px rgba(0, 220, 255, 0.35);
        }

        .shine-line{
          height: 2px;
          width: min(420px, 100%);
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(0,0,0,0), rgba(0,200,255,.55), rgba(0,0,0,0));
          position: relative;
          overflow: hidden;
          opacity: .8;
        }
        .shine-line:after{
          content:"";
          position:absolute; top:-8px; left:0;
          width: 40%;
          height: 24px;
          background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.45), rgba(255,255,255,0));
          filter: blur(2px);
          animation: sheen 4.2s ease-in-out infinite;
        }

        .chip{
          padding: 10px 12px;
          min-width: 150px;
        }
        .chipLabel{
          font-size: 10px;
          letter-spacing: .12em;
          color: rgba(255,255,255,.55);
        }
        .chipValue{
          font-weight: 900;
          font-size: 14px;
          margin-top: 2px;
          color: rgba(255,255,255,.92);
          white-space: nowrap;
        }
        .coin{ filter: drop-shadow(0 0 10px rgba(0,200,255,.22)); }

        .statusRow{
          display:flex;
          align-items:center;
          gap: 10px;
        }
        .pulseDot{
          width: 10px; height: 10px;
          border-radius: 999px;
          animation: pulse 1.25s ease-in-out infinite;
        }
        .pulseOk{
          background: rgba(0, 255, 180, .9);
          box-shadow: 0 0 18px rgba(0, 255, 180, .45);
        }
        .pulseWait{
          background: rgba(0, 200, 255, .95);
          box-shadow: 0 0 18px rgba(0, 200, 255, .50);
        }
        .chipOk{ border-color: rgba(0,255,180,.16); box-shadow: 0 0 35px rgba(0,255,180,.06), inset 0 0 0 1px rgba(255,255,255,.04); }
        .chipWait{ border-color: rgba(0,200,255,.18); }

        /* ===== Panels ===== */
        .panel{
          padding: 20px;
          position: relative;
          overflow: hidden;
        }
        .panel:before{
          content:"";
          position:absolute; inset: -2px;
          background: radial-gradient(circle at 20% 20%, rgba(0,210,255,.14), rgba(0,0,0,0) 55%);
          pointer-events:none;
        }
        .panelTop{ margin-bottom: 14px; position: relative; }
        .panelTitle{
          font-size: 18px;
          font-weight: 900;
          letter-spacing: .02em;
        }
        .panelSub{
          margin-top: 6px;
          font-size: 13px;
          color: rgba(255,255,255,.65);
        }

        /* ===== Fields ===== */
        .fieldWrap{ margin-bottom: 14px; position: relative; }
        .fieldLabel{
          font-size: 12px;
          font-weight: 800;
          color: rgba(255,255,255,.70);
          margin-bottom: 8px;
        }
        .field{
          width: 100%;
          padding: 12px 12px;
          border-radius: 14px;
          background: rgba(0,0,0,.32);
          border: 1px solid rgba(120,200,255,.14);
          outline: none;
          color: white;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.03);
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .field:focus{
          border-color: rgba(0,210,255,.36);
          box-shadow: 0 0 0 4px rgba(0,200,255,.10), inset 0 0 0 1px rgba(255,255,255,.04);
        }
        .fieldHint{
          font-size: 11px;
          color: rgba(255,255,255,.45);
          margin-top: 8px;
        }

        /* ===== Preset Chips ===== */
        .chipBtn{
          position: relative;
          border-radius: 14px;
          padding: 0;
          border: 1px solid rgba(120,200,255,.14);
          background: rgba(0,0,0,.24);
          overflow: hidden;
          transition: transform .12s ease, border-color .2s ease, box-shadow .2s ease, filter .2s ease;
        }
        .chipBtnInner{
          position: relative;
          display:flex;
          align-items:center;
          gap: 6px;
          padding: 10px 12px;
          font-weight: 900;
          font-size: 13px;
          color: rgba(255,255,255,.9);
        }
        .chipBtnGlow{
          content:"";
          position:absolute; inset:-2px;
          background: radial-gradient(circle at 20% 30%, rgba(0,220,255,.18), rgba(0,0,0,0) 60%);
          opacity: .0;
          transition: opacity .2s ease;
        }
        .chipBtn:hover{
          transform: translateY(-1px);
          filter: brightness(1.04);
          box-shadow: 0 10px 30px rgba(0,170,255,.08);
        }
        .chipBtn:hover .chipBtnGlow{ opacity: .85; }

        .chipBtnOn{
          border-color: rgba(0,220,255,.55);
          background: linear-gradient(180deg, rgba(0,170,255,.32), rgba(0,0,0,.22));
          box-shadow: 0 0 0 3px rgba(0,220,255,.10), 0 0 35px rgba(0,220,255,.18);
        }
        .chipBtnOff{
          border-color: rgba(120,200,255,.14);
        }

        /* ===== Buttons ===== */
        .btnPrimary, .btnSecondary{
          width: 100%;
          border-radius: 18px;
          padding: 14px 14px;
          font-weight: 950;
          letter-spacing: .06em;
          position: relative;
          overflow: hidden;
          transition: transform .12s ease, filter .2s ease, box-shadow .2s ease;
          user-select: none;
        }
        .btnText{ position: relative; z-index: 2; }
        .btnSheen{
          position:absolute; inset:-2px;
          background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.35), rgba(255,255,255,0));
          transform: translateX(-120%) skewX(-18deg);
          opacity: 0;
          animation: sheen 3.4s ease-in-out infinite;
          filter: blur(1px);
        }
        .btnPrimary{
          background: linear-gradient(90deg, rgba(10,170,255,1), rgba(0,230,255,1));
          box-shadow: 0 16px 40px rgba(0,170,255,.18), 0 0 40px rgba(0,220,255,.18);
          border: 1px solid rgba(255,255,255,.08);
        }
        .btnPrimary:hover{
          filter: brightness(1.06);
          box-shadow: 0 18px 50px rgba(0,170,255,.22), 0 0 55px rgba(0,220,255,.25);
        }
        .btnPrimary:active{ transform: scale(.985); }

        .btnSecondary{
          background: linear-gradient(90deg, rgba(0,140,255,1), rgba(45,220,255,1));
          box-shadow: 0 16px 40px rgba(0,170,255,.14), 0 0 40px rgba(0,220,255,.14);
          border: 1px solid rgba(255,255,255,.08);
        }
        .btnSecondary:hover{
          filter: brightness(1.06);
          box-shadow: 0 18px 50px rgba(0,170,255,.18), 0 0 55px rgba(0,220,255,.20);
        }
        .btnSecondary:active{ transform: scale(.985); }

        /* ===== Room box ===== */
        .roomBox{
          margin-top: 14px;
          text-align: center;
          border-radius: 18px;
          border: 1px solid rgba(120,200,255,.18);
          background: rgba(0,0,0,.24);
          padding: 14px 12px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.03);
        }
        .roomLabel{
          font-size: 11px;
          letter-spacing: .18em;
          color: rgba(255,255,255,.55);
          font-weight: 900;
        }
        .roomCode{
          margin-top: 6px;
          font-size: 28px;
          font-weight: 950;
          letter-spacing: .24em;
          color: rgba(255,255,255,.95);
          text-shadow: 0 0 20px rgba(0,220,255,.18);
        }
        .roomHint{
          margin-top: 10px;
          font-size: 12px;
          color: rgba(255,255,255,.55);
        }

        /* ===== Mini note ===== */
        .miniNote{
          margin-top: 14px;
          display:flex;
          gap: 10px;
          align-items:flex-start;
          padding: 12px 12px;
          border-radius: 16px;
          border: 1px solid rgba(120,200,255,.14);
          background: rgba(0,0,0,.18);
        }
        .miniDot{
          width: 10px; height: 10px;
          border-radius: 999px;
          margin-top: 3px;
          background: rgba(0,220,255,.85);
          box-shadow: 0 0 18px rgba(0,220,255,.35);
          flex: 0 0 auto;
        }
        .miniText{
          font-size: 12px;
          color: rgba(255,255,255,.62);
          line-height: 1.4;
        }

        /* ===== Reduced motion ===== */
        @media (prefers-reduced-motion: reduce) {
          .animate-float, .bg-blob-a, .bg-blob-b, .bg-blob-c, .btnSheen { animation: none !important; }
          .pulseDot { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
