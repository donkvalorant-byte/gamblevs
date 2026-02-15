"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { socket } from "../../src/lib/socket";
import "./mines.css";

const SIZE = 25; // 5x5
const MINES = 3;

function money(n: number) {
  const x = Math.floor(Number(n) || 0);
  return x.toString();
}

export default function MinesPage() {
  const router = useRouter();

  const [roomCode, setRoomCode] = useState("");
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(0);

  const [yourRevealed, setYourRevealed] = useState<number[]>([]);
  const [yourMultiplier, setYourMultiplier] = useState(1);
  const [yourBusted, setYourBusted] = useState(false);
  const [yourCashed, setYourCashed] = useState(false);

  const [finishTitle, setFinishTitle] = useState("");
  const [finishLine1, setFinishLine1] = useState("");
  const [finishLine2, setFinishLine2] = useState("");

  const [showMines, setShowMines] = useState<number[] | null>(null);
  const [boomIndex, setBoomIndex] = useState<number | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<number | null>(null);

  const grid = useMemo(() => Array.from({ length: SIZE }, (_, i) => i), []);

  useEffect(() => {
    let code = "";
    let b = 0;
    let startedAt = 0;
    let durationSec = 0;

    try {
      code = localStorage.getItem("gamblevs_room") || "";
      b = Number(localStorage.getItem("gamblevs_bet") || 0);
      startedAt = Number(localStorage.getItem("gamblevs_startedAt") || 0);
      durationSec = Number(localStorage.getItem("gamblevs_durationSec") || 0);
    } catch {}

    if (!code) {
      router.push("/");
      return;
    }

    setRoomCode(code);
    setBet(b);

    const calcLeft = () => {
      if (!startedAt || !durationSec) return 0;
      const end = startedAt + durationSec * 1000;
      return Math.ceil(Math.max(0, end - Date.now()) / 1000);
    };

    setSecondsLeft(calcLeft());

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setSecondsLeft(calcLeft()), 250);

    socket.emit("balance:get");

    const onBalance = (p: { balance: number }) => setBalance(Number(p?.balance || 0));

    const onUpdate = (payload: any) => {
      if (!payload?.your) return;

      setYourRevealed(payload.your.revealed || []);
      setYourBusted(!!payload.your.busted);
      setYourCashed(!!payload.your.cashedOut);
      setYourMultiplier(Number(payload.your.multiplier || 1));

      if (payload.your.mines) setShowMines(payload.your.mines);

      if (payload.your.busted) {
        const last = (payload.your.revealed || []).slice(-1)[0];
        setBoomIndex(typeof last === "number" ? last : null);
        setTimeout(() => setBoomIndex(null), 650);
      }
    };

    const onFinish = (r: any) => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;

      const you = r?.you; // win/lose/draw
      const yourM = Number(r?.yourFinalMult || 1);
      const oppM = Number(r?.oppFinalMult || 1);
      const totalM = Number(r?.totalMult || (yourM + oppM - 1));
      const paid = Number(r?.paid || 0);
      const bb = Number(r?.yourBalance || 0);
      setBalance(bb);

      if (you === "win") setFinishTitle("🏆 KAZANDIN!");
      else if (you === "lose") setFinishTitle("💀 KAYBETTİN!");
      else setFinishTitle("🤝 BERABERE!");

      setFinishLine1(`Sen x${yourM.toFixed(2)} • Rakip x${oppM.toFixed(2)} → Toplam x${totalM.toFixed(2)}`);

      const net = paid - b;
      const sign = net > 0 ? "+" : net < 0 ? "-" : "";
      setFinishLine2(`Bu maç: ${sign}${money(Math.abs(net))} 💰  |  Ödeme: ${money(paid)} 💰`);
    };

    const onErr = (msg: string) => {
      alert(msg);
      router.push("/");
    };

    socket.on("balance:update", onBalance);
    socket.on("mines:update", onUpdate);
    socket.on("mines:finish", onFinish);
    socket.on("errorMessage", onErr);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;

      socket.off("balance:update", onBalance);
      socket.off("mines:update", onUpdate);
      socket.off("mines:finish", onFinish);
      socket.off("errorMessage", onErr);
    };
  }, [router]);

  const disableGrid = yourBusted || yourCashed || !!finishTitle || secondsLeft <= 0;

  const reveal = (i: number) => {
    if (!roomCode) return;
    if (disableGrid) return;
    socket.emit("mines:reveal", { roomCode, index: i });
  };

  const cashout = () => {
    if (!roomCode) return;
    if (yourBusted || yourCashed || !!finishTitle) return;
    socket.emit("mines:cashout", { roomCode });
  };

  const backHome = () => {
    try {
      localStorage.removeItem("gamblevs_room");
      localStorage.removeItem("gamblevs_bet");
      localStorage.removeItem("gamblevs_startedAt");
      localStorage.removeItem("gamblevs_durationSec");
    } catch {}
    router.push("/");
  };

  return (
    <main className="minesRoot">
      <div className="minesBg">
        <div className="bgGlow" />
        <div className="bgStars" />
        <div className="bgNoise" />
      </div>

      <div className="shell">
        <header className="topHud">
          <div className="brand">
            <div className="stLogo">
              <img src="/stitch.jpg" alt="stitch" className="stImg" />
            </div>
            <div>
              <div className="brandTitle">
                Mines VS <span className="brandAccent">GambleVS</span>
              </div>
              <div className="brandSub">5x5 • {MINES} mayın • Rakip: gizli</div>
            </div>
          </div>

          <div className="hudRow">
            <div className="chip">
              <div className="chipLabel">ODA</div>
              <div className="chipValue chipCode">{roomCode || "-"}</div>
            </div>
            <div className="chip">
              <div className="chipLabel">BAHİS</div>
              <div className="chipValue">{bet} 💰</div>
            </div>
            <div className="chip">
              <div className="chipLabel">BAKİYE</div>
              <div className="chipValue">{balance} 💰</div>
            </div>
            <div className="chip chipBlue">
              <div className="chipLabel">SÜRE</div>
              <div className="chipValue">{secondsLeft}s</div>
            </div>
            <div className="chip chipCyan">
              <div className="chipLabel">ÇARPAN</div>
              <div className="chipValue">x{yourMultiplier.toFixed(2)}</div>
            </div>
            <div className="chip">
              <div className="chipLabel">RAKİP</div>
              <div className="chipValue chipMuted">Gizli</div>
            </div>
          </div>
        </header>

        <div className="layout">
          <section className="panel">
            <div className="panelBorder" />
            <div className="panelInner">
              <div className="panelFx" />
              <div className="panelBody">
                <div className="panelTop">
                  <div className="panelNote">
                    Rakip hamleleri <b>görmez</b>. Sonuç oyun bitince gelir.
                  </div>
                  <div className="panelBtns">
                    <button className="btnCash" onClick={cashout} disabled={yourBusted || yourCashed || !!finishTitle}>
                      ÇEK (Cashout)
                    </button>
                    <button className="btnExit" onClick={backHome}>
                      Çık
                    </button>
                  </div>
                </div>

                {secondsLeft <= 0 && !finishTitle && (
                  <div className="timeoutLine">⏳ Süre bitti! Sistem otomatik çekiyor...</div>
                )}

                <div className={"cableWrap " + (disableGrid ? "cableDim" : "")}>
                  <div className="cableBorder" />
                  <div className="cableInner">
                    <div className="grid5">
                      {grid.map((i) => {
                        const opened = yourRevealed.includes(i);
                        const mineShown = showMines?.includes(i);
                        const isBoom = boomIndex === i;

                        const state = mineShown ? "mine" : opened ? "open" : "closed";

                        return (
                          <button
                            key={i}
                            onClick={() => reveal(i)}
                            disabled={opened || disableGrid}
                            className={"tile tile-" + state + (isBoom ? " tile-boom" : "")}
                          >
                            {mineShown ? (
                              <div className="mineWrap">
                                <div className="mineCable" />
                                <img src="/stitch.jpg" alt="mine" className="mineImg" />
                              </div>
                            ) : opened ? (
                              <div className="crystal" />
                            ) : (
                              <>
                                <div className="tileFace" />
                                <div className="tileStitchMark" />
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="panelFoot">✅ Rakip hakkında oyun sırasında <b>hiçbir bilgi yok</b>.</div>
              </div>
            </div>
          </section>

          <aside className="side">
            {!!finishTitle && (
              <div className="finishCard">
                <div className="finishTitle">{finishTitle}</div>
                <div className="finishLine">{finishLine1}</div>
                <div className="finishLine2">{finishLine2}</div>
                <button className="btnBack" onClick={backHome}>
                  Lobiye dön
                </button>
              </div>
            )}

            <div className="sideCard">
              <div className="sideTitle">Stitch VS</div>
              <div className="sideText">
                • Kapalı kutu: <b>Stitch kumaş</b>
                <br />• Güvenli kutu: <b>mavi kristal</b>
                <br />• Mayın: <b>Stitch</b> + <b>RGB kablo</b>
              </div>
              <div className="sideMini">Bu sürümde CSS ayrı dosyada, garanti yüklenir.</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
