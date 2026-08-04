import { useEffect, useRef, useState } from "react";
import Head from "next/head";

const STORAGE_KEY = "bench-conversations-v1";
const THEME_KEY = "bench-theme-v1";
const STARTER_PROMPTS = [
  {
    label: "Understand a concept",
    prompt: "Explain closures in JavaScript with a simple real-world example.",
    icon: "{}",
  },
  {
    label: "Plan something",
    prompt: "Give me a thoughtful 3-day itinerary for Kandy, Sri Lanka.",
    icon: "+",
  },
  {
    label: "Improve my work",
    prompt: "What's a clean way to structure a Next.js API route?",
    icon: "*",
  },
];

function InlineText({ text }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function RichMessage({ content }) {
  return (
    <div className="rich-message">
      {content.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={index} />;
        if (trimmed.startsWith("### "))
          return (
            <h4 key={index}>
              <InlineText text={trimmed.slice(4)} />
            </h4>
          );
        if (trimmed.startsWith("## "))
          return (
            <h3 key={index}>
              <InlineText text={trimmed.slice(3)} />
            </h3>
          );
        if (trimmed.startsWith("# "))
          return (
            <h2 key={index}>
              <InlineText text={trimmed.slice(2)} />
            </h2>
          );
        if (/^[-*] /.test(trimmed))
          return (
            <p className="list-item" key={index}>
              <span>&bull;</span>
              <InlineText text={trimmed.slice(2)} />
            </p>
          );
        const numbered = trimmed.match(/^(\d+)\. (.*)$/);
        if (numbered)
          return (
            <p className="list-item numbered" key={index}>
              <span>{numbered[1]}.</span>
              <InlineText text={numbered[2]} />
            </p>
          );
        return (
          <p key={index}>
            <InlineText text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function newConversation() {
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    messages: [],
    updatedAt: Date.now(),
  };
}

export default function Home() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState("light");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const messages = activeConversation?.messages ?? [];
  const recentConversations = conversations
    .filter((conversation) => conversation.messages.length > 0)
    .slice(0, 5);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) || "[]",
      );
      const savedTheme = window.localStorage.getItem(THEME_KEY);
      setTheme(
        savedTheme === "dark" || savedTheme === "light"
          ? savedTheme
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light",
      );
      if (Array.isArray(saved) && saved.length) {
        const ordered = saved
          .filter((item) => Array.isArray(item.messages))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setConversations(ordered);
        setActiveConversationId(ordered[0]?.id ?? null);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (isReady)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations, isReady]);

  useEffect(() => {
    if (isReady) window.localStorage.setItem(THEME_KEY, theme);
  }, [theme, isReady]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  function updateConversation(id, update) {
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === id ? update(conversation) : conversation,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }

  function selectConversation(id) {
    if (loading) return;
    setActiveConversationId(id);
    setError(null);
  }

  function startNewConversation() {
    if (loading) return;
    const conversation = newConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  async function sendMessage(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    let conversationId = activeConversationId;
    let currentMessages = messages;
    if (!conversationId) {
      const conversation = newConversation();
      conversationId = conversation.id;
      setConversations((current) => [conversation, ...current]);
      setActiveConversationId(conversationId);
      currentMessages = [];
    }

    const nextMessages = [
      ...currentMessages,
      { id: crypto.randomUUID(), role: "user", content },
    ];
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: conversation.messages.length
        ? conversation.title
        : content.slice(0, 36),
      messages: nextMessages,
      updatedAt: Date.now(),
    }));
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: message }) => ({
            role,
            content: message,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          { id: crypto.randomUUID(), role: "assistant", content: data.reply },
        ],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      setError(err.message || "Unable to get a reply right now.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }
  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <Head>
        <title>Bench - a better place to think</title>
        <meta name="description" content="A thoughtful AI chat workspace." />
      </Head>
      <main className="app-shell" data-theme={theme}>
        <aside className="sidebar">
          <a className="brand" href="#top" aria-label="Bench home">
            <span className="brand-symbol">
              <i />
              <i />
              <i />
            </span>
            <span>bench</span>
          </a>
          <button
            className="new-chat"
            type="button"
            onClick={startNewConversation}
            disabled={loading}
          >
            <span>+</span> New conversation
          </button>
          {recentConversations.length > 0 && (
            <nav className="recent-chats" aria-label="Recent conversations">
              <p>RECENT CHATS</p>
              {recentConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={
                    conversation.id === activeConversationId ? "active" : ""
                  }
                  onClick={() => selectConversation(conversation.id)}
                  title={conversation.title}
                >
                  <span>&#9670;</span>
                  {conversation.title}
                </button>
              ))}
            </nav>
          )}
          <div className="sidebar-footer">
            <div className="privacy-card">
              <span className="shield">&#9670;</span>
              <p>
                <strong>Designed for you</strong>Better future ahead!
              </p>
            </div>
            <p className="sidebar-note">Chats are saved in this browser</p>
          </div>
        </aside>
        <section className="workspace" id="top">
          <header className="topbar">
            <div>
              <p className="kicker">YOUR AI THINKING PARTNER</p>
              <h1>What are we working through?</h1>
            </div>
            <button
              className="theme-toggle"
              type="button"
              onClick={() =>
                setTheme((current) => (current === "light" ? "dark" : "light"))
              }
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              aria-pressed={theme === "dark"}
            >
              <span className="theme-track" aria-hidden="true">
                <span className="theme-spark spark-one" />
                <span className="theme-spark spark-two" />
                <span className="theme-orb">
                  {theme === "light" ? "\u2600" : "\u263E"}
                </span>
              </span>
            </button>
          </header>
          <div
            className={`conversation ${messages.length ? "has-messages" : ""}`}
            ref={scrollRef}
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <section className="welcome">
                <div className="welcome-orb">
                  <span>+</span>
                </div>
                <p className="welcome-label">A QUIET PLACE FOR BIG QUESTIONS</p>
                <h2>
                  Bring a question.
                  <br />
                  Leave with momentum.
                </h2>
                <p className="welcome-copy">
                  Use Bench to clarify an idea, shape a plan, or find a useful
                  next step.
                </p>
                <div className="prompt-grid">
                  {STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="prompt-card"
                      onClick={() => sendMessage(item.prompt)}
                    >
                      <span className="prompt-icon">{item.icon}</span>
                      <span>{item.label}</span>
                      <b>{"->"}</b>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <div className="message-list">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`message ${message.role}`}
                  >
                    {message.role === "assistant" && (
                      <div className="assistant-mark">
                        <i />
                        <i />
                        <i />
                      </div>
                    )}
                    <div>
                      <p className="message-name">
                        {message.role === "user" ? "You" : "Bench"}
                      </p>
                      <div className="bubble">
                        <RichMessage content={message.content} />
                      </div>
                    </div>
                  </article>
                ))}
                {loading && (
                  <article className="message assistant">
                    <div className="assistant-mark">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div>
                      <p className="message-name">Bench</p>
                      <p className="bubble thinking">
                        <span />
                        <span />
                        <span />
                      </p>
                    </div>
                  </article>
                )}
              </div>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              <span>!</span>
              <div>
                <strong>Something interrupted the conversation.</strong>
                <p>{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                x
              </button>
            </div>
          )}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a question, idea, or problem..."
              aria-label="Your message"
              rows={1}
              disabled={loading}
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <span>&uarr;</span>
            </button>
          </form>
          <p className="composer-hint">
            <kbd>Enter</kbd> to send <span>&middot;</span>{" "}
            <kbd>Shift + Enter</kbd> for a new line
          </p>
        </section>
      </main>
    </>
  );
}
