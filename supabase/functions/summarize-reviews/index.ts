// AI summary of product reviews across taste / quality / texture / value
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const compact = reviews.slice(0, 30).map((r) => ({
      rating: r.rating,
      taste: r.taste_rating ?? r.rating,
      quality: r.quality_rating ?? r.rating,
      texture: r.texture_rating ?? r.rating,
      value: r.value_rating ?? r.rating,
      text: [r.title, r.body].filter(Boolean).join(" — "),
    }));

    const systemPrompt =
      "You are a helpful product review analyst. Given customer reviews of a snack product, write a concise, neutral summary (max 80 words) that highlights what customers say about Taste, Quality, Texture, and Value. Use plain language and second-person voice. Do not invent details. Output as a single paragraph followed by 4 short bullets, each starting with the dimension name in bold markdown (**Taste:**, **Quality:**, **Texture:**, **Value:**).";

    const userPrompt = `Product: ${productName}\n\nReviews JSON:\n${JSON.stringify(compact)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("Gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const summary: string = data?.choices?.[0]?.message?.content ?? "";
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
