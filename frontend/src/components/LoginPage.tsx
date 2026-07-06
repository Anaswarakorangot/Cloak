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

          <div className="mt-8" style={{ transform: 'translateZ(30px)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/20"></div>
              <span className="text-[10px] text-white/70 font-medium">or continue with</span>
              <div className="flex-1 h-px bg-white/20"></div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <button type="button" className="flex items-center justify-center py-2 bg-white rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" className="w-5 h-5"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.411 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/><path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.806L1.24 17.35A11.997 11.997 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/><path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/><path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/></svg>
              </button>
              <button type="button" className="flex items-center justify-center py-2 bg-white rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-[#111111]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" className="w-5 h-5" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
              </button>
              <button type="button" className="flex items-center justify-center py-2 bg-white rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-[#1877F2]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" className="w-5 h-5" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </button>
            </div>
          </div>
          
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
