import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LoginPage({ initialIsLogin = true }: { initialIsLogin?: boolean }) {
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        let errorMsg = 'Authentication failed';
        if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          errorMsg = data.detail[0].msg;
        }
        throw new Error(errorMsg);
      }

      login(data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ffffff] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(207,128,71,0.12),rgba(255,255,255,0))] flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      
      {/* Decorative background blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#cf8047]/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Back button */}
      <div className="absolute top-8 left-8">
        <button 
          onClick={() => navigate('/')}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-[#f1f0ee] text-[#111111]/70 hover:bg-[#e3e2df] hover:text-[#111111] transition-all"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1.25rem', height: '1.25rem' }}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
      </div>

      <div className="w-full max-w-[28rem] relative z-10">
        <div className="bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.05),0_0_0_1px_rgba(230,229,226,1)] rounded-[2rem] p-8 md:p-10 overflow-hidden relative">
          
          <div className="flex flex-col items-start justify-center mb-8">
            <div className="w-12 h-12 flex items-center justify-center mb-4 text-[#cf8047]">
              <svg viewBox="0 0 48 48" style={{ width: '3.5rem', height: '3.5rem', fill: 'currentColor' }}>
                <path d="M24 2c2.2 13.8 7.9 19.6 22 22-14.1 2.4-19.8 8.2-22 22-2.2-13.8-7.9-19.6-22-22 14.1-2.4 19.8-8.2 22-22Z" />
              </svg>
            </div>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-[#111111]/60 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#b15f2c]"></div> 
              {isLogin ? 'Welcome back' : 'Start your project'}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#111111] leading-tight">
              {isLogin ? 'Sign in to your account.' : 'Create your workspace.'}
            </h1>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-[0.875rem] text-sm mb-6 flex items-start gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[0.75rem] font-semibold text-[#111111]/50 mb-1.5 uppercase tracking-wide">Username</label>
              <input 
                type="text" 
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#f1f0ee]/70 border border-[#e6e5e2] rounded-[0.875rem] px-4 py-3.5 text-sm text-[#111111] focus:outline-none focus:bg-white focus:border-[#111111]/30 transition-all font-medium placeholder:text-[#111111]/30"
                placeholder="Your username"
              />
            </div>
            <div>
              <label className="block text-[0.75rem] font-semibold text-[#111111]/50 mb-1.5 uppercase tracking-wide">Password</label>
              <input 
                type="password" 
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#f1f0ee]/70 border border-[#e6e5e2] rounded-[0.875rem] px-4 py-3.5 text-sm text-[#111111] focus:outline-none focus:bg-white focus:border-[#111111]/30 transition-all font-medium placeholder:text-[#111111]/30"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-between px-6 py-4 bg-[#0a0a0a] hover:bg-[#111111] text-white rounded-full font-medium transition-all active:scale-[0.98] mt-8 group disabled:opacity-70 disabled:pointer-events-none"
            >
              <span>{loading ? 'Authenticating...' : (isLogin ? 'Sign In' : 'Create Account')}</span>
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-[#0a0a0a] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
                {loading ? (
                  <Loader2 className="animate-spin w-4 h-4" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1rem', height: '1rem' }}><path d="M7 17 17 7M8 7h9v9"/></svg>
                )}
              </div>
            </button>
          </form>
          
        </div>
        
        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-medium text-[#111111]/50 hover:text-[#111111] transition-colors inline-flex items-center gap-1.5"
          >
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <span className="text-[#111111] border-b border-[#111111]/30 pb-0.5">{isLogin ? "Sign up" : "Sign in"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
