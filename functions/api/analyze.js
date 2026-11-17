export async function onRequestPost({ request, env }) {
  if (!env.OPENAI_API_KEY) {
    return Response.json({ error: "AI key is not configured. The app will use its built-in guideline checks." }, { status: 503 });
  }
  try {
    const { content, brand } = await request.json();
    if (!content || !brand) return Response.json({ error: "Content and brand profile are required." }, { status: 400 });
    const system = `You are a careful brand-governance reviewer. Compare submitted content ONLY against the supplied brand profile. Do not invent rules. Missing evidence means unverified, not necessarily false. Return valid JSON only with this shape: {"summary":"...","score":0,"issues":[{"phrase":"exact phrase from content","category":"Tone & personality | Terminology | Claims & evidence | Messaging | Preferred terminology","severity":"High | Medium | Low","rule":"exact relevant brand rule or approved fact","explanation":"why it may violate the rule","suggestion":"specific corrected wording"}]}. Include every meaningful issue. If no issue, return an empty issues array and score 100.`;
    const user = `BRAND PROFILE:\n${JSON.stringify(brand)}\n\nCONTENT TO REVIEW:\n${content}`;
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }]
      })
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return Response.json({ error: "AI provider request failed.", detail: detail.slice(0, 500) }, { status: 502 });
    }
    const data = await resp.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return Response.json({
      summary: parsed.summary || "Analysis complete. Review the findings.",
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, parsed.score)) : 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      mode: "AI-assisted"
    });
  } catch (e) {
    return Response.json({ error: "Could not analyze this content.", detail: String(e).slice(0, 300) }, { status: 500 });
  }
}