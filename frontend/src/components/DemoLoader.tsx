import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function DemoLoader({ onAnalysisComplete }: { onAnalysisComplete: (result: any, mode: any, filename: string) => void }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadDemo = async () => {
      try {
        const loginRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'password123' })
        });
        
        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.statusText}`);
        
        const res = await loginRes.json();
        
        if (mounted) {
          login(res.token);
          
          const analysisRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analyze`, {
            headers: { 'Authorization': `Bearer ${res.token}` }
          });
          
          if (!analysisRes.ok) throw new Error(`Analyze failed: ${analysisRes.statusText}`);
          
          const data = await analysisRes.json();
          if (mounted) {
            onAnalysisComplete(data, 'mock', 'Demo Document');
            navigate('/', { replace: true });
          }
        }
      } catch (e: any) {
        console.error("Failed to load demo:", e);
        if (mounted) {
          setError(e.message || "Failed to connect to the server.");
        }
      }
    };
    
    loadDemo();
    
    return () => { mounted = false; };
  }, [login, navigate, onAnalysisComplete]);

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0a0a0a] gap-4">
        <div className="text-red-500 font-mono tracking-widest text-sm uppercase">Demo Error</div>
        <div className="text-red-400 text-sm max-w-md text-center">{error}</div>
        <div className="text-slate-500 text-xs mt-4">Make sure your backend server is running.</div>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 border border-slate-700 text-slate-300 rounded hover:bg-slate-800">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
        <div className="text-orange-400 font-mono tracking-widest text-sm uppercase">Loading Live Demo...</div>
      </div>
    </div>
  );
}
