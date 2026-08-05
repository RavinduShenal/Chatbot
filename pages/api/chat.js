// This API route runs only on the server. NVIDIA_API_KEY is never sent to the browser.

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

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "Server is missing NVIDIA_API_KEY. Add it to .env.local (local) or your host's environment variables (production).",
    });
  }

  const model = process.env.NVIDIA_MODEL || "meta/llama-3.2-3b-instruct";

  try {
    // NVIDIA NIM provides an OpenAI-compatible Chat Completions endpoint.
    const nvidiaRes = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          temperature: 0.7,
          top_p: 0.7,
          max_tokens: 1024,
          stream: false,
        }),
      },
    );

    if (!nvidiaRes.ok) {
      const errBody = await nvidiaRes.text();
      console.error("NVIDIA API error:", nvidiaRes.status, errBody);
      return res.status(502).json({
        error: "The AI provider returned an error. Check server logs for details.",
      });
    }

    const data = await nvidiaRes.json();
    const reply =
      data.choices?.[0]?.message?.content ?? "Sorry, I didn't get a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat API route failed:", err);
    return res.status(500).json({
      error: "Something went wrong talking to the AI provider.",
    });
  }
}
