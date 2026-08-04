// pages/api/chat.js
//
// This runs ONLY on the server (Node.js), never in the browser.
// The API key lives in an environment variable here, so it is never
// sent to or visible from the client's browser.

export default async function handler(req, res) {
  // This route is server-only, so GEMINI_API_KEY never enters the client bundle.
  if (req.method !== "POST") {
    // Explicitly reject unsupported methods to make the endpoint predictable.
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body;

  // Reject malformed or empty browser requests before calling the paid AI provider.
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "`messages` must be a non-empty array" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // This tells a developer how to configure the deployment without exposing any secret.
    return res.status(500).json({
      error:
        "Server is missing GEMINI_API_KEY. Add it to .env.local (local) or your host's environment variables (production).",
    });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  // Gemini's REST API doesn't use OpenAI's {role, content} shape — it wants
  // {role, parts: [{text}]}, and "assistant" is called "model" instead.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    // Gemini is called from this server function, not from pages/index.js.
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        // The provider key is read from the server environment, never the request body.
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          // Conversation history gives the model context for follow-up questions.
          contents,
          // The system instruction establishes Bench's answer quality and response style.
          systemInstruction: {
            parts: [
              {
                text: "You are Bench, a friendly and capable AI assistant. Give clear, complete, well-structured answers that genuinely solve the user's question. Match the requested depth: provide a concise answer for simple questions, but give a thorough explanation with examples, steps, and practical context when the user asks for detail or the topic benefits from it. Use Markdown naturally: short headings, bullet points, numbered steps, bold emphasis, and code examples when helpful. Do not stop after an unfinished sentence. End with a useful conclusion or next step.",
              },
            ],
          },
          generationConfig: {
            // Temperature balances consistency with natural phrasing; the token limit prevents runaway answers.
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      // Preserve provider diagnostics in server logs, but return a safe message to the browser.
      const errBody = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errBody);
      return res.status(502).json({
        error: "The AI provider returned an error. Check server logs for details.",
      });
    }

    const data = await geminiRes.json();
    // Safely read the nested Gemini response and provide a fallback for an empty candidate.
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I didn't get a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    // Network failures and unexpected provider errors are handled without crashing the route.
    console.error("Chat API route failed:", err);
    return res.status(500).json({ error: "Something went wrong talking to the AI provider." });
  }
}
