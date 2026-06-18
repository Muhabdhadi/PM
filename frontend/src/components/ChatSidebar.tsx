"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

export default function ChatSidebar({ board, onApplyBoard }: { board: any; onApplyBoard: (b: any) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userText, board }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      const aiText = data.response || (typeof data.output === "string" ? data.output : JSON.stringify(data.output));
      setMessages((m) => [...m, { role: "assistant", text: aiText }]);
      if (data.boardUpdate) {
        onApplyBoard(data.boardUpdate);
      } else if (data.board) {
        onApplyBoard(data.board);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: "(AI call failed)" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="fixed right-6 top-24 w-[360px] rounded-xl border border-[var(--stroke)] bg-white p-4 shadow-[var(--shadow)]">
      <h3 className="mb-2 text-sm font-semibold text-[var(--navy-dark)]">AI Assistant</h3>
      <div className="mb-3 max-h-64 overflow-y-auto space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right text-sm" : "text-left text-sm text-[var(--gray-text)]"}>
            <div>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2"
          placeholder="Ask the AI or request a board update"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button disabled={loading} onClick={send} className="rounded-md bg-[var(--primary-blue)] px-3 py-2 text-white">
          {loading ? "..." : "Send"}
        </button>
      </div>
    </aside>
  );
}
