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

type ChatMsg = {
  id: string;
  roomCode: string;
  text: string;
  ts: number;
  from?: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

  // chat
  const [chatOpen, setChatOpen] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

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

    // presence + chat bootstrap
    socket.emit("presence:get", { scope: "site" });
    socket.emit("chat:history", { roomCode: code, limit: 50 });

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
      } else {
        setBoomIndex(null);
      }
    };

    const onFinish = (p: any) => {
      const title = String(p?.title || "Bitti");
      setFinishTitle(title);
      setFinishLine1(String(p?.line1 || ""));
      const net = Number(p?.net || 0);
      const paid = Number(p?.paid || 0);
      const sign = net > 0 ? "+" : net < 0 ? "-" : "";
      setFinishLine2(`Bu maç: ${sign}${money(Math.abs(net))} 💰  |  Ödeme: ${money(paid)} 💰`);
    };

    const onPresence = (p: any) => {
      const c = Number(p?.count || 0);
      if (Number.isFinite(c)) setActiveCount(c);
    };

    const onChatHistory = (p: any) => {
      const arr = Array.isArray(p?.messages) ? p.messages : [];
      const safe: ChatMsg[] = arr
        .map((m: any) => ({
          id: String(m?.id || uid()),
          roomCode: String(m?.roomCode || code),
          text: String(m?.text || ""),
          ts: Number(m?.ts || Date.now()),
          from: m?.from ? String(m.from) : undefined,
        }))
        .filter((m: ChatMsg) => m.text.trim().length > 0)
        .slice(-50);
      setMessages(safe);
      setTimeout(() => listRef.current?.scrollTo({ top: 999999, behavior: "auto" }), 0);
    };

    const onChatMessage = (m: any) => {
      const msg: ChatMsg = {
        id: String(m?.id || uid()),
        roomCode: String(m?.roomCode || code),
        text: String(m?.text || ""),
        ts: Number(m?.ts || Date.now()),
        from: m?.from ? String(m.from) : undefined,
      };
      if (!msg.text.trim()) return;
      if (msg.roomCode !== code) return;

      setMessages((prev) => [...prev, msg].slice(-80));

      setTimeout(() => {
        listRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
      }, 0);

      if (!chatOpen) setUnread((u) => u + 1);
    };

    const onErr = (msg: string) => {
      alert(msg);
      router.push("/");
    };

    socket.on("balance:update", onBalance);
    socket.on("mines:update", onUpdate);
    socket.on("mines:finish", onFinish);
    socket.on("presence:update", onPresence);
    socket.on("chat:history", onChatHistory);
    socket.on("chat:message", onChatMessage);
    socket.on("errorMessage", onErr);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;

      socket.off("balance:update", onBalance);
      socket.off("mines:update", onUpdate);
      socket.off("mines:finish", onFinish);
      socket.off("presence:update", onPresence);
      socket.off("chat:history", onChatHistory);
      socket.off("chat:message", onChatMessage);
      socket.off("errorMessage", onErr);
    };
  }, [router, chatOpen]);

  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

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

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    if (!roomCode) return;

    const payload = { id: uid(), roomCode, text, ts: Date.now() };
    socket.emit("chat:send", payload);

    setMessages((prev) => [...prev, payload].slice(-80));
    setChatInput("");
    setTimeout(() => listRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 0);
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
                Mines <span className="brandAccent">GambleVS</span>
              </div>
              <div className="brandSub">5x5 • {MINES} mayın</div>
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
          </div>
        </header>

        <div className="layout">
          <section className="panel">
            <div className="panelBorder" />
            <div className="panelInner">
              <div className="panelFx" />
              <div className="panelBody">
                <div className="panelTop">
                  <div className="panelNote">Sonuç oyun bitince gelir.</div>
                  <div className="panelBtns">
                    <button className="btnCash" onClick={cashout} disabled={yourBusted || yourCashed || !!finishTitle}>
                      ÇEK
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
                  Lobi
                </button>
              </div>
            )}

            <div className="sideCard">
              <div className="sideTitle">Aktif</div>
              <div className="sideText">
                <span className="activeDot" /> {activeCount} kişi
              </div>
              <div className="sideMini">Chat sağ altta.</div>
            </div>
          </aside>
        </div>
      </div>

      <button
        className={"chatFab " + (chatOpen ? "chatFabOpen" : "")}
        onClick={() => setChatOpen((v) => !v)}
        aria-label="chat"
      >
        CHAT
        {unread > 0 && <span className="chatBadge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      <div className={"chatPanel " + (chatOpen ? "chatPanelOpen" : "")}>
        <div className="chatHead">
          <div className="chatTitle">ODA CHAT</div>
          <div className="chatMeta">
            <span className="activeDot" /> {activeCount}
          </div>
          <button className="chatClose" onClick={() => setChatOpen(false)} aria-label="close">
            ✕
          </button>
        </div>

        <div className="chatList" ref={listRef}>
          {messages.length === 0 ? (
            <div className="chatEmpty">Mesaj yok.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="chatMsg">
                <div className="chatBubble">
                  <div className="chatText">{m.text}</div>
                  <div className="chatTime">
                    {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="chatInputRow">
          <input
            className="chatInput"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="yaz..."
            onKeyDown={(e) => {
              if (e.key === "Enter") sendChat();
            }}
            maxLength={200}
          />
          <button className="chatSend" onClick={sendChat}>
            GÖNDER
          </button>
        </div>
      </div>
    </main>
  );
}
