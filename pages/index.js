import { useEffect, useRef, useState } from "react";
import Head from "next/head";

// Keys used to keep each browser's chats and appearance preference separate.
const STORAGE_KEY = "bench-conversations-v1";
const THEME_KEY = "bench-theme-v1";

// Suggested prompts shown before a conversation begins.
const STARTER_PROMPTS = [
  {
    label: "Explore opportunities",
    prompt: "Help me identify the right next step in my career search.",
    icon: "↗",
  },
  {
    label: "Prepare for an interview",
    prompt: "Help me prepare for a senior-level job interview.",
    icon: "?",
  },
  {
    label: "Find the right talent",
    prompt: "What should I consider when hiring a senior executive?",
    icon: "✓",
  },
];

function InlineText({ text }) {
  // Render the small Markdown subset returned by Gemini without adding a library.
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function RichMessage({ content }) {
  // Turn headings, lists, bold text, and inline code into readable chat content.
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
              <span className="list-content">
                <InlineText text={trimmed.slice(2)} />
              </span>
            </p>
          );
        const numbered = trimmed.match(/^(\d+)\. (.*)$/);
        if (numbered)
          return (
            <p className="list-item numbered" key={index}>
              <span>{numbered[1]}.</span>
              <span className="list-content">
                <InlineText text={numbered[2]} />
              </span>
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
  // Conversations are intentionally browser-local; no database or account is required.
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    messages: [],
    updatedAt: Date.now(),
  };
}

export default function Home() {
  // Conversation history and the selected chat are persisted in localStorage.
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState("light");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Refs provide access to the scroll area and message field without re-rendering.
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // Derived values keep the JSX below simple and avoid duplicated state.
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const messages = activeConversation?.messages ?? [];
  const recentConversations = conversations
    .filter((conversation) => conversation.messages.length > 0)
    .slice(0, 5);

  useEffect(() => {
    // Restore previously saved chats and use a saved (or system) color preference.
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
    // Save every chat update after the initial browser-only hydration is complete.
    if (isReady)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations, isReady]);

  useEffect(() => {
    // Remember the user's manual light/dark choice for their next visit.
    if (isReady) window.localStorage.setItem(THEME_KEY, theme);
  }, [theme, isReady]);

  useEffect(() => {
    // Keep the latest message in view; the sidebar and composer stay fixed.
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  function updateConversation(id, update) {
    // Updating a chat also moves it to the top of the recent-chat list.
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === id ? update(conversation) : conversation,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }

  function selectConversation(id) {
    // Avoid changing chats while an answer is being generated for the current one.
    if (loading) return;
    setActiveConversationId(id);
    setError(null);
  }

  function startNewConversation() {
    // A new empty conversation is kept separately so older chats are never overwritten.
    if (loading) return;
    const conversation = newConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  function deleteConversation(id) {
    // Keep deletion deliberate because chats are stored only in this browser.
    if (loading || !window.confirm("Delete this conversation? This cannot be undone."))
      return;

    const remaining = conversations.filter((conversation) => conversation.id !== id);
    setConversations(remaining);
    if (id === activeConversationId) {
      setActiveConversationId(remaining[0]?.id ?? null);
      setError(null);
    }
  }

  async function sendMessage(text) {
    // This function is used by both the form and the suggested prompt buttons.
    const content = (text ?? input).trim();
    if (!content || loading) return;

    let conversationId = activeConversationId;
    let currentMessages = messages;
    if (!conversationId) {
      // The first message automatically creates a conversation if one is not selected.
      const conversation = newConversation();
      conversationId = conversation.id;
      setConversations((current) => [conversation, ...current]);
      setActiveConversationId(conversationId);
      currentMessages = [];
    }

    // Update the UI immediately, then send the conversation to the server route.
    const nextMessages = [
      ...currentMessages,
      { id: crypto.randomUUID(), role: "user", content },
    ];
    updateConversation(conversationId, (conversation) => ({
      // The first question becomes a short title in the recent-chat sidebar.
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
      // The browser talks only to our server route; Gemini credentials never reach it.
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
      // Add the server's reply to the same conversation that sent the request.
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          { id: crypto.randomUUID(), role: "assistant", content: data.reply },
        ],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      // Keep the user's message visible and show a recoverable error below the chat.
      setError(err.message || "Unable to get a reply right now.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event) {
    // Prevent the browser's default page reload when the form is submitted.
    event.preventDefault();
    sendMessage();
  }
  function handleKeyDown(event) {
    // Enter sends; Shift + Enter remains available for multi-line messages.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <Head>
        <title>Career141 Talent Assistant</title>
        <meta
          name="description"
          content="Career guidance and talent insights from Career141."
        />
      </Head>
      <main className="app-shell" data-theme={theme}>
        {/* Fixed sidebar: branding, new-chat control, saved conversations, and privacy note. */}
        <aside className="sidebar">
          <a className="brand" href="#top" aria-label="Career141 home">
            <span className="brand-symbol">
              <i />
              <i />
              <i />
            </span>
            <span>career<span className="brand-number">141</span></span>
          </a>
          <button
            className="new-chat"
            type="button"
            onClick={startNewConversation}
            disabled={loading}
          >
            <span>+</span> New chat
          </button>
          {recentConversations.length > 0 && (
            /* Browser-local chats can be selected again from this compact history list. */
            <nav className="recent-chats" aria-label="Recent conversations">
              <p>RECENT CHATS</p>
              {recentConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`recent-chat ${
                    conversation.id === activeConversationId ? "active" : ""
                  }`}
                >
                <button
                  type="button"
                  className="delete-chat"
                  onClick={() => deleteConversation(conversation.id)}
                  disabled={loading}
                  aria-label={`Delete ${conversation.title}`}
                  title="Delete conversation"
                >
                  &times;
                </button>
                <button
                  type="button"
                  className="chat-title"
                  onClick={() => selectConversation(conversation.id)}
                  title={conversation.title}
                >
                  <span>&#9670;</span>
                  {conversation.title}
                </button>
                </div>
              ))}
            </nav>
          )}
          <div className="sidebar-footer">
            <div className="privacy-card">
              <span className="shield">&#9670;</span>
              <p>
                <strong>Career141 Talent Assistant</strong>Guidance for candidates and hiring teams.
              </p>
            </div>
            <p className="sidebar-note">Chats are saved in this browser</p>
          </div>
        </aside>
        {/* Main workspace: header, scrollable messages, feedback state, and composer. */}
        <section className="workspace" id="top">
          <header className="topbar">
            <div>
              <p className="kicker">CAREER141 TALENT ASSISTANT</p>
              <h1>Where opportunity meets the right talent.</h1>
            </div>
            {/* Animated sun/moon switch; the selection is saved in localStorage. */}
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
            {/* Show helpful prompt ideas before the first message, otherwise show the active chat. */}
            {messages.length === 0 ? (
              <section className="welcome">
                <div className="welcome-orb">
                  <span>+</span>
                </div>
                <p className="welcome-label">EXECUTIVE SEARCH &amp; RECRUITMENT</p>
                <h2>
                  Make your next move.
                  <br />
                  Build with confidence.
                </h2>
                <p className="welcome-copy">
                  Explore career opportunities, prepare for interviews, or get
                  practical guidance on finding exceptional talent.
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
                {/* Each saved message is rendered with a different alignment for its sender. */}
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
                        {message.role === "user" ? "You" : "Career141"}
                      </p>
                      <div className="bubble">
                        <RichMessage content={message.content} />
                      </div>
                    </div>
                  </article>
                ))}
                {loading && (
                  /* Visual feedback while the API route is waiting for Gemini. */
                  <article className="message assistant">
                    <div className="assistant-mark">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div>
                      <p className="message-name">Career141</p>
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
            /* API or network failures do not erase the conversation; they show here instead. */
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
            {/* The form supports click-to-send and keyboard-to-send. */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about careers, hiring, or opportunities..."
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
