export default async function handler(req) {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { productName, reviews } = body;
  if (!productName || !Array.isArray(reviews) || reviews.length === 0) {
    return Response.json({ error: "Missing productName or reviews" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI summary not configured" }, { status: 503 });
  }

  const reviewText = reviews
    .slice(0, 30)
    .map((r, i) => {
      const parts = [`Review ${i + 1}: ${r.rating}/5 stars`];
      if (r.title) parts.push(`Title: ${r.title}`);
      if (r.body) parts.push(`Comment: ${r.body}`);
      const subs = [];
      if (r.taste_rating) subs.push(`Taste: ${r.taste_rating}/5`);
      if (r.quality_rating) subs.push(`Quality: ${r.quality_rating}/5`);
      if (r.texture_rating) subs.push(`Texture: ${r.texture_rating}/5`);
      if (r.value_rating) subs.push(`Value: ${r.value_rating}/5`);
      if (subs.length) parts.push(subs.join(", "));
      return parts.join(". ");
    })
    .join("\n");

  const prompt = `You are summarizing customer reviews for "${productName}", a premium beef jerky product.

Reviews:
${reviewText}

Write a 2-3 sentence summary covering:
1. What customers love most (Pros)
2. Any common criticisms or suggestions (Cons)

Keep it factual, concise, and based only on the reviews above. Do not invent feedback. Format as plain text, no bullet points or headers.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return Response.json({ error: "AI service error" }, { status: 502 });
    }

    const result = await response.json();
    const summary = result.content?.[0]?.text?.trim() ?? "No summary available.";
    return Response.json({ summary });
  } catch (err) {
    console.error("summarize-reviews error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
