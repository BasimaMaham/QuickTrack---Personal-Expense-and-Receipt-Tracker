'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const CATEGORIES = ['General', 'Food', 'Transport', 'Bills', 'Shopping', 'Health'];
const CATEGORY_HINTS = {
  Food: ['food', 'restaurant', 'lunch', 'dinner', 'coffee', 'cafe', 'pizza', 'burger', 'grocery', 'groceries', 'tea'],
  Transport: ['uber', 'careem', 'taxi', 'fuel', 'petrol', 'bus', 'fare', 'ride', 'rickshaw'],
  Bills: ['bill', 'electricity', 'internet', 'wifi', 'phone', 'rent', 'utility'],
  Shopping: ['clothes', 'shoes', 'amazon', 'shopping', 'mall', 'store'],
  Health: ['pharmacy', 'medicine', 'doctor', 'hospital', 'clinic'],
};
function suggestCategory(title) {
  const t = title.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_HINTS)) {
    if (words.some(w => t.includes(w))) return cat;
  }
  return null;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [suggested, setSuggested] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState('');
  const [theme, setTheme] = useState('dark');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', amount: '', category: 'General' });
  const [budgets, setBudgets] = useState({});
  const [budgetDraft, setBudgetDraft] = useState({});
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      setUser(data.session.user);
      fetchExpenses();
      fetchBudgets();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/login'); else setUser(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchExpenses = async () => {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    setExpenses(data || []);
  };

  const fetchBudgets = async () => {
    const { data } = await supabase.from('budgets').select('*');
    const map = {};
    (data || []).forEach(b => { map[b.category] = b.monthly_limit; });
    setBudgets(map);
    setBudgetDraft(map);
  };

  const handleSaveBudgets = async () => {
    const { data: { user: authedUser } } = await supabase.auth.getUser();
    const toUpsert = CATEGORIES
      .filter(c => budgetDraft[c] !== undefined && budgetDraft[c] !== '')
      .map(c => ({ user_id: authedUser.id, category: c, monthly_limit: Number(budgetDraft[c]) }));
    const toDelete = CATEGORIES.filter(
      c => (budgetDraft[c] === undefined || budgetDraft[c] === '') && budgets[c] !== undefined
    );

    if (toUpsert.length) {
      await supabase.from('budgets').upsert(toUpsert, { onConflict: 'user_id,category' });
    }
    if (toDelete.length) {
      await supabase.from('budgets').delete().eq('user_id', authedUser.id).in('category', toDelete);
    }
    fetchBudgets();
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setTheme(next);
  };

  const handleTitleChange = (val) => {
    setTitle(val);
    const s = suggestCategory(val);
    setSuggested(s);
  };

  const applySuggestion = () => { if (suggested) { setCategory(suggested); setSuggested(null); } };

  const handleScanReceipt = async () => {
    if (!file) return;
    setScanning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        const res = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const data = await res.json();
        if (data.title) setTitle(data.title);
        if (data.amount) setAmount(String(data.amount));
        if (data.category) setCategory(data.category);
        setSuggested(null);
      } catch {
        setFlash('AI scan failed — fill in manually');
        setTimeout(() => setFlash(''), 2500);
      }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !amount) return;
    setLoading(true);

    let receipt_url = null;
    if (file) {
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (!uploadError) {
        const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
        receipt_url = data.publicUrl;
      }
    }

    await supabase.from('expenses').insert({ title, amount, category, receipt_url });
    setTitle(''); setAmount(''); setCategory('General'); setFile(null); setSuggested(null);
    setLoading(false);
    setFlash(`Logged: ${title}`);
    setTimeout(() => setFlash(''), 2000);
    fetchExpenses();
  };

  const handleDelete = async (id) => {
    await supabase.from('expenses').delete().eq('id', id);
    fetchExpenses();
  };

  const startEdit = (exp) => {
    setEditingId(exp.id);
    setEditDraft({ title: exp.title, amount: exp.amount, category: exp.category });
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id) => {
    await supabase.from('expenses')
      .update({ title: editDraft.title, amount: editDraft.amount, category: editDraft.category })
      .eq('id', id);
    setEditingId(null);
    fetchExpenses();
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true); setAnswer('');
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, expenses, budgets }),
    });
    const data = await res.json();
    setAnswer(data.answer);
    setAsking(false);
  };

  const total = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const todayTotal = useMemo(() => {
    const today = new Date().toDateString();
    return expenses.filter(e => new Date(e.created_at).toDateString() === today).reduce((s, e) => s + Number(e.amount), 0);
  }, [expenses]);
  const weekTotal = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return expenses.filter(e => new Date(e.created_at).getTime() >= weekAgo).reduce((s, e) => s + Number(e.amount), 0);
  }, [expenses]);
  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const monthlyByCategory = useMemo(() => {
    const now = new Date();
    const map = {};
    expenses.forEach(e => {
      const d = new Date(e.created_at);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        map[e.category] = (map[e.category] || 0) + Number(e.amount);
      }
    });
    return map;
  }, [expenses]);
  const topCategory = byCategory[0];
  const biggest = useMemo(() => expenses.reduce((max, e) => Number(e.amount) > Number(max?.amount || 0) ? e : max, null), [expenses]);

  if (!user) return null;

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <div className="mono small muted">LEDGER NO. 001 — {user.email}</div>
          <h1 className="display" style={{ fontSize: 36 }}>QuickTrack</h1>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
          <button className="icon-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="mono small muted">TODAY</div><div className="stat-value mono">Rs. {todayTotal.toFixed(0)}</div></div>
        <div className="stat-card"><div className="mono small muted">LAST 7 DAYS</div><div className="stat-value mono">Rs. {weekTotal.toFixed(0)}</div></div>
        <div className="stat-card"><div className="mono small muted">ALL TIME</div><div className="stat-value mono">Rs. {total.toFixed(0)}</div></div>
      </div>

      {topCategory && biggest && (
        <div className="insight-card">
          <div className="mono small">INSIGHT</div>
          <div style={{ marginTop: 4 }}>
            You spend most on <strong>{topCategory[0]}</strong> (Rs. {topCategory[1].toFixed(0)} total).
            Your biggest single expense was <strong>{biggest.title}</strong> at Rs. {Number(biggest.amount).toFixed(0)}.
          </div>
        </div>
      )}

      <div className="layout">
        <div>
          <form onSubmit={handleSubmit} className="card">
            <div className="mono small muted" style={{ marginBottom: 10 }}>NEW ENTRY</div>
            <input placeholder="What did you buy?" value={title} onChange={e => handleTitleChange(e.target.value)} />
            {suggested && suggested !== category && (
              <div className="suggest-chip" onClick={applySuggestion}>✨ Suggested: {suggested} — tap to apply</div>
            )}
            <input placeholder="Amount (Rs.)" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
            {file && (
              <button type="button" className="icon-btn" onClick={handleScanReceipt} disabled={scanning} style={{ marginBottom: 10 }}>
                {scanning ? 'Scanning…' : '✨ Scan with AI'}
              </button>
            )}
            <button disabled={loading} className="btn-primary">{loading ? 'Logging…' : 'Log expense'}</button>
            {flash && <div className="flash">✓ {flash}</div>}
          </form>

          {byCategory.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="mono small muted" style={{ marginBottom: 10 }}>BY CATEGORY</div>
              {byCategory.map(([cat, amt]) => {
                const budget = budgets[cat];
                const monthlySpent = monthlyByCategory[cat] || 0;
                const pct = budget ? Math.min((monthlySpent / budget) * 100, 100) : (amt / total) * 100;
                const over = budget && monthlySpent > budget;
                const near = budget && !over && monthlySpent / budget >= 0.8;
                const barColor = over ? 'var(--rust)' : near ? '#C99A2E' : 'var(--green-bright)';
                return (
                  <div key={cat} className="cat-row">
                    <div className="cat-row-top">
                      <span>{cat}</span>
                      <span className="mono">
                        {budget ? `Rs. ${monthlySpent.toFixed(0)} / ${budget}` : `Rs. ${amt.toFixed(0)}`}
                        {over ? ' ⚠️' : ''}
                      </span>
                    </div>
                    <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${pct}%`, background: barColor }} /></div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="assistant-card">
            <div className="mono small muted" style={{ marginBottom: 8 }}>MONTHLY BUDGETS</div>
            {CATEGORIES.map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 90, fontSize: 13 }}>{c}</span>
                <input type="number" placeholder="No limit" value={budgetDraft[c] ?? ''}
                  onChange={e => setBudgetDraft({ ...budgetDraft, [c]: e.target.value })}
                  style={{ marginBottom: 0 }} />
              </div>
            ))}
            <button className="icon-btn" onClick={handleSaveBudgets}>Save budgets</button>
          </div>

          <div className="assistant-card">
            <div className="mono small muted" style={{ marginBottom: 8 }}>ASK YOUR LEDGER</div>
            <input placeholder="e.g. how much did I spend on food this week?" value={question}
              onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAsk()} />
            <button className="icon-btn" onClick={handleAsk} disabled={asking}>{asking ? 'Thinking…' : 'Ask'}</button>
            {answer && <div className="assistant-answer">{answer}</div>}
          </div>
        </div>

        <div className="receipt-wrap">
          <div className="torn-top" />
          <div className="receipt">
            <div className="mono small muted">RECEIPT</div>
            <div className="mono muted" style={{ fontSize: 11, marginBottom: 14 }}>
              {expenses.length} {expenses.length === 1 ? 'ENTRY' : 'ENTRIES'}
            </div>
            {expenses.length === 0 && <div className="muted" style={{ padding: '24px 0', fontSize: 14 }}>Nothing logged yet. Add your first expense.</div>}
            {expenses.map(exp => (
              <div key={exp.id} className="line-item">
                {editingId === exp.id ? (
                  <div style={{ width: '100%' }}>
                    <input value={editDraft.title} onChange={e => setEditDraft({ ...editDraft, title: e.target.value })} />
                    <input type="number" value={editDraft.amount} onChange={e => setEditDraft({ ...editDraft, amount: e.target.value })} />
                    <select value={editDraft.category} onChange={e => setEditDraft({ ...editDraft, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button className="icon-btn" onClick={() => saveEdit(exp.id)}>Save</button>
                      <button className="icon-btn" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="line-title">{exp.title}</div>
                      <div className="line-cat mono">{exp.category}</div>
                      {exp.receipt_url && <a href={exp.receipt_url} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11, color: 'var(--green)' }}>view receipt →</a>}
                    </div>
                    <div className="line-amount mono">
                      <div>Rs. {Number(exp.amount).toFixed(2)}</div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button onClick={() => startEdit(exp)} className="void-btn" style={{ color: 'var(--green)' }}>edit</button>
                        <button onClick={() => handleDelete(exp.id)} className="void-btn">void</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div className="receipt-total mono"><span>TOTAL</span><span>Rs. {total.toFixed(2)}</span></div>
          </div>
          <div className="torn-bottom" />
        </div>
      </div>
    </main>
  );
}