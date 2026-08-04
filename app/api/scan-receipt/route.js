export async function POST(req) {
  const { imageBase64, mimeType } = await req.json();

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "AI assistant isn't configured. Add GEMINI_API_KEY to .env.local." }, { status: 400 });
  }

  const prompt = `Look at this receipt or expense photo. Extract the merchant/item name, the total amount paid, and the best matching category from this list: General, Food, Transport, Bills, Shopping, Health.
Respond with ONLY raw JSON, no markdown, no code fences, in this exact shape:
{"title": "...", "amount": 0, "category": "..."}
If you cannot read an amount, set amount to 0. If unsure of category, use "General".`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('Gemini scan error:', data);
    return Response.json({ error: data?.error?.message || 'AI scan failed' }, { status: 500 });
  }

  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  text = text.replace(/```json|```/g, '').trim();

  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  return Response.json({
    title: parsed.title || '',
    amount: parsed.amount || '',
    category: parsed.category || 'General',
  });
}