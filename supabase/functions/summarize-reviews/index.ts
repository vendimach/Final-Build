// AI summary of product reviews across taste / quality / texture / value / delivery
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReviewIn {
  rating: number;
  title?: string | null;
  body?: string | null;
  taste_rating?: number | null;
  quality_rating?: number | null;
  texture_rating?: number | null;
  value_rating?: number | null;
  delivery_rating?: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productName, reviews } = (await req.json()) as {
      productName: string;
      reviews: ReviewIn[];
    };

    if (!reviews || reviews.length === 0) {
      return new Response(
        JSON.stringify({ summary: null, message: "Not enough reviews yet." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured in Supabase secrets");

    const compact = reviews.slice(0, 30).map((r) => ({
      rating: r.rating,
      taste: r.taste_rating ?? r.rating,
      quality: r.quality_rating ?? r.rating,
      texture: r.texture_rating ?? r.rating,
      value: r.value_rating ?? r.rating,
      delivery: r.delivery_rating ?? r.rating,
      text: [r.title, r.body].filter(Boolean).join(" — "),
    }));

    const systemPrompt =
      "You are a helpful product review analyst. Given customer reviews of a snack product, write a concise, neutral summary (max 90 words) that highlights what customers say about Taste, Quality, Texture, Value, and Delivery. Use plain language and second-person voice. Do not invent details. Output as a single paragraph followed by 5 short bullets, each starting with the dimension name in bold markdown (**Taste:**, **Quality:**, **Texture:**, **Value:**, **Delivery:**).";

    const userPrompt = `Product: ${productName}\n\nReviews JSON:\n${JSON.stringify(compact)}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("Anthropic API error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI API error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const summary: string = data?.content?.[0]?.text ?? "";
    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-reviews error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
