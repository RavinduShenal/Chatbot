// This API route runs only on the server. OPENROUTER_API_KEY is never sent to the browser.

const SYSTEM_PROMPT =
  "You are Bench, a friendly and capable AI assistant. Give clear, complete, well-structured answers that genuinely solve the user's question. Match the requested depth: provide a concise answer for simple questions, but give a thorough explanation with examples, steps, and practical context when the user asks for detail or the topic benefits from it. Use Markdown naturally: short headings, bullet points, numbered steps, bold emphasis, and code examples when helpful. Do not stop after an unfinished sentence. End with a useful conclusion or next step.";
const PROVIDER_TIMEOUT_MS = 30_000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "`messages` must be a non-empty array" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "Server is missing OPENROUTER_API_KEY. Add it to .env.local (local) or your host's environment variables (production).",
    });
  }

  // This router automatically selects an available no-cost model.
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const openRouterRes = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-OpenRouter-Title": "Bench",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      },
    );

    if (!openRouterRes.ok) {
      const errBody = await openRouterRes.text();
      console.error("OpenRouter API error:", openRouterRes.status, errBody);
      return res.status(502).json({
        error: "The AI provider returned an error. Check server logs for details.",
      });
    }

    const data = await openRouterRes.json();
    const reply =
      data.choices?.[0]?.message?.content ?? "Sorry, I didn't get a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    if (err.name === "AbortError") {
      console.error(`OpenRouter API timed out after ${PROVIDER_TIMEOUT_MS}ms`);
      return res.status(504).json({
        error: "The AI provider is taking too long to respond. Please try again shortly.",
      });
    }
    console.error("Chat API route failed:", err);
    return res.status(500).json({
      error: "Something went wrong talking to the AI provider.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
