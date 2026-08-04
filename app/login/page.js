'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/');
  };

  return (
    <main className="auth-wrap">
      <form onSubmit={handleSubmit} className="auth-card">
        <div className="mono small muted">LEDGER NO. 001</div>
        <h1 className="display" style={{ fontSize: 28, margin: '4px 0' }}>QuickTrack</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          {mode === 'signin' ? 'Sign in to your ledger.' : 'Create your ledger.'}
        </p>
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        {error && <div className="error-text">{error}</div>}
        <button disabled={loading} className="btn-primary">
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="link-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}