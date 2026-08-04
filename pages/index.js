import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const STARTER_PROMPTS = [
  "Explain closures in JavaScript like I'm new to it",
  "Give me a 3-day itinerary for Kandy, Sri Lanka",
  "What's a clean way to structure a Next.js API route?",
];

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text) {
    const content = text ?? input;
    if (!content.trim() || loading) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage();
  }

  return (
    <>
      <Head>
        <title>Bench - a small AI chat</title>
        <meta name="description" content="A small, functional AI chatbot demo." />
      </Head>

      <div className="page">
        <header className="masthead">
          <div className="masthead-mark">§</div>
          <div>
            <h1>Bench</h1>
            <p className="subtitle">a working desk for a quick question</p>
          </div>
        </header>

        <main className="board">
          <div className="log" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="empty">
                <p className="empty-lede">Nothing on the bench yet.</p>
                <p className="empty-sub">Try one of these, or write your own below.</p>
                <div className="starters">
                  {STARTER_PROMPTS.map((p) => (
                    <button key={p} className="starter" onClick={() => sendMessage(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`row ${m.role}`}>
                <span className="tag">{m.role === "user" ? "you" : "bench"}</span>
                <div className="bubble">{m.content}</div>
              </div>
            ))}

            {loading && (
              <div className="row assistant">
                <span className="tag">bench</span>
                <div className="bubble thinking">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>

          {error && <div className="error">Couldn't get a reply — {error}</div>}

          <form className="composer" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something…"
              aria-label="Message"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </main>

        <footer className="foot">built for the Career141 assessment</footer>
      </div>
    </>
  );
}
