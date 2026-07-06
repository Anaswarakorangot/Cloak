import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LoginPage({ initialIsLogin = true }: { initialIsLogin?: boolean }) {
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const cardRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const tiltX = (y - centerY) / 25; // max tilt ~10deg
    const tiltY = (centerX - x) / 25;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${endpoint}`, {
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans bg-[#030303]">
      
      {/* Animated 3D Background */}
      <div 
        className="absolute inset-[-5%] bg-cover bg-center bg-no-repeat transition-transform"
        style={{ 
          backgroundImage: "url('/login-bg-v2.png')",
          animation: 'cinematic-pan 20s ease-in-out infinite alternate',
        }}
      ></div>
      
      {/* Dark overlay for text readability and cinematic depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/10 via-[#0a0a0a]/30 to-[#030303]/70 backdrop-blur-[1px]"></div>

      {/* 3D Interactive Login Card */}
      <div 
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full max-w-[420px] relative z-10 mx-4"
        style={{ perspective: '1200px' }}
      >
        <div 
          className="bg-[#0a0a0a]/70 backdrop-blur-xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.8)] rounded-[2rem] border border-white/10 p-8 md:p-10 transition-transform duration-200 ease-out"
          style={{ 
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: 'preserve-3d'
          }}
        >
          
          <div className="text-center mb-8 flex flex-col items-center transition-transform duration-200" style={{ transform: 'translateZ(60px)' }}>
            <div className="w-14 h-14 flex items-center justify-center text-[#cf8047] mb-4 bg-[#cf8047]/10 rounded-2xl border border-[#cf8047]/20 shadow-[0_0_30px_rgba(207,128,71,0.2)]">
              <svg viewBox="0 0 48 48" style={{ width: '2.5rem', height: '2.5rem', fill: 'currentColor' }}>
                <path d="M24 2c2.2 13.8 7.9 19.6 22 22-14.1 2.4-19.8 8.2-22 22-2.2-13.8-7.9-19.6-22-22 14.1-2.4 19.8-8.2 22-22Z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white text-center tracking-tight">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 px-4 py-3 rounded-xl text-sm mb-6 flex items-start gap-3 backdrop-blur-sm" style={{ transform: 'translateZ(30px)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" style={{ transform: 'translateZ(40px)' }}>
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1.5 ml-1">Username</label>
              <input 
                type="text" 
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white rounded-xl px-4 py-3 text-sm text-[#111111] focus:outline-none focus:ring-4 focus:ring-white/20 transition-all shadow-inner placeholder:text-slate-400"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1.5 ml-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white rounded-xl px-4 py-3 text-sm text-[#111111] focus:outline-none focus:ring-4 focus:ring-white/20 transition-all shadow-inner placeholder:text-slate-400"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {isLogin && (
                <div className="flex justify-start mt-2 ml-1">
                  <button type="button" className="text-[11px] text-white/80 hover:text-white transition-colors">
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 bg-gradient-to-r from-[#b15f2c] to-[#cf8047] hover:from-[#cf8047] hover:to-[#e89a61] text-white rounded-xl font-bold transition-all active:scale-[0.98] mt-8 shadow-[0_10px_30px_-10px_rgba(207,128,71,0.6)] disabled:opacity-70 disabled:pointer-events-none border border-white/10"
              style={{ transform: 'translateZ(50px)' }}
            >
              {loading ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                isLogin ? 'Sign in' : 'Register'
              )}
            </button>
          </form>


          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[11px] text-white/80 hover:text-white transition-colors"
            >
              {isLogin ? (
                <>Don't have an account yet? <span className="font-bold">Register for free</span></>
              ) : (
                <>Already have an account? <span className="font-bold">Sign in here</span></>
              )}
            </button>
          </div>

        </div>
        
        {/* Back button positioned outside the card at bottom */}
        <div className="mt-6 text-center" style={{ transform: 'translateZ(20px)' }}>
          <button 
            onClick={() => navigate('/')}
            className="text-[11px] text-white/60 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Return to website
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes cinematic-pan {
          0% { transform: scale(1.05) translate(0, 0); }
          100% { transform: scale(1.1) translate(-2%, -1%); }
        }
      `}</style>
    </div>
  );
}
