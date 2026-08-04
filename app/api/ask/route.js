export async function POST(req) {
  const { question, expenses, budgets } = await req.json();

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({
      answer: "AI assistant isn't configured yet. Add GEMINI_API_KEY to .env.local to enable it.",
    });
  }

  const summary = expenses
    .map(e => `${(e.created_at || '').slice(0, 10)} | ${e.category} | ${e.title} | Rs.${e.amount}`)
    .join('\n');

  const budgetSummary = budgets && Object.keys(budgets).length
    ? Object.entries(budgets).map(([cat, limit]) => `${cat}: Rs.${limit}/month`).join('\n')
    : '(no budgets set)';

  const prompt = `You are a personal finance assistant. Answer using ONLY the expense data and budget data given below. Be concise (2-4 sentences), use Rs. as currency, and say so if the data cannot answer the question. When asked about budgets, compare each category's CURRENT MONTH spend against its monthly limit below.

Monthly budgets:
${budgetSummary}

Expense data:
${summary || '(no entries yet)'}

Question: ${question}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('Gemini API error:', data);
    return Response.json({ answer: `AI error: ${data?.error?.message || 'unknown error, check server terminal logs'}` });
  }

  const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't process that.";
  return Response.json({ answer });
}