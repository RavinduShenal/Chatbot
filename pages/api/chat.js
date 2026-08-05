// This API route runs only on the server. GEMINI_API_KEY is never sent to the browser.

const SYSTEM_PROMPT =
  "You are Bench, a friendly and capable AI assistant. Give clear, complete, well-structured answers that genuinely solve the user's question. Match the requested depth: provide a concise answer for simple questions, but give a thorough explanation with examples, steps, and practical context when the user asks for detail or the topic benefits from it. Use Markdown naturally: short headings, bullet points, numbered steps, bold emphasis, and code examples when helpful. Do not stop after an unfinished sentence. End with a useful conclusion or next step.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "`messages` must be a non-empty array" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "Server is missing GEMINI_API_KEY. Add it to .env.local (local) or your host's environment variables (production).",
    });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const contents = messages.map(({ role, content }) => ({
    role: role === "assistant" ? "model" : "user",
    parts: [{ text: content }],
  }));

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errBody);
      return res.status(502).json({
        error: "The AI provider returned an error. Check server logs for details.",
      });
    }

    const data = await geminiRes.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      "Sorry, I didn't get a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat API route failed:", err);
    return res.status(500).json({
      error: "Something went wrong talking to the AI provider.",
    });
  }
}
