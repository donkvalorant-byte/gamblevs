"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "../src/lib/socket";

type ChatMsg = {
  id: string;
  text: string;
  ts: number;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function GlobalChat() {
  const [chatOpen, setChatOpen] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    socket.emit("presence:get");
    socket.emit("chat:history", { limit: 50 });

    const onPresence = (p: any) => {
      const c = Number(p?.count || 0);
      if (Number.isFinite(c)) setActiveCount(c);
    };

    const onHistory = (p: any) => {
      const arr = Array.isArray(p?.messages) ? p.messages : [];
      const safe: ChatMsg[] = arr
        .map((m: any) => ({
          id: String(m?.id || uid()),
          text: String(m?.text || ""),
          ts: Number(m?.ts || Date.now()),
        }))
        .filter((m: ChatMsg) => m.text.trim().length > 0)
        .slice(-80);

      setMessages(safe);
      setTimeout(() => listRef.current?.scrollTo({ top: 999999, behavior: "auto" }), 0);
    };

    const onMsg = (m: any) => {
      const msg: ChatMsg = {
        id: String(m?.id || uid()),
        text: String(m?.text || ""),
        ts: Number(m?.ts || Date.now()),
      };
      if (!msg.text.trim()) return;

      setMessages((prev) => [...prev, msg].slice(-120));
      setTimeout(() => listRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 0);

      if (!chatOpen) setUnread((u) => u + 1);
    };

    socket.on("presence:update", onPresence);
    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMsg);

    return () => {
      socket.off("presence:update", onPresence);
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMsg);
    };
  }, [chatOpen]);

  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  const send = () => {
    const text = chatInput.trim();
    if (!text) return;

    socket.emit("chat:send", { id: uid(), text, ts: Date.now() });
    setChatInput("");
    setTimeout(() => listRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 0);
  };

  return (
    <>
      <button
        className={"gchatFab " + (chatOpen ? "gchatFabOpen" : "")}
        onClick={() => setChatOpen((v) => !v)}
        aria-label="chat"
      >
        CHAT
        {unread > 0 && <span className="gchatBadge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      <div className={"gchatPanel " + (chatOpen ? "gchatPanelOpen" : "")}>
        <div className="gchatHead">
          <div className="gchatTitle">GLOBAL CHAT</div>
          <div className="gchatMeta">
            <span className="gchatDot" /> {activeCount}
          </div>
          <button className="gchatClose" onClick={() => setChatOpen(false)} aria-label="close">
            ✕
          </button>
        </div>

        <div className="gchatList" ref={listRef}>
          {messages.length === 0 ? (
            <div className="gchatEmpty">Mesaj yok.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="gchatMsg">
                <div className="gchatBubble">
                  <div className="gchatText">{m.text}</div>
                  <div className="gchatTime">
                    {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="gchatInputRow">
          <input
            className="gchatInput"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="mesaj yaz..."
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            maxLength={200}
          />
          <button className="gchatSend" onClick={send}>
            GÖNDER
          </button>
        </div>
      </div>
    </>
  );
}
