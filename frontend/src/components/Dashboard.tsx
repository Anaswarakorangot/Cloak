import React, { useEffect, useState } from 'react';
import { UploadPage } from './UploadPage';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, FileText, Settings, LogOut, CheckCircle2, ShieldAlert, Sparkles, Clock, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Stats {
  documents_processed: number;
  pending_review: number;
  active_rules: number;
  total_redactions: number;
  unreviewed_redactions: number;
}

export function Dashboard({ onAnalysisComplete }: { onAnalysisComplete: any }) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch(${import.meta.env.VITE_API_URL || '${import.meta.env.VITE_API_URL || 'http://localhost:8000'}'}/api/stats, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setStats(data))
    .catch(console.error);

    fetch(${import.meta.env.VITE_API_URL || '${import.meta.env.VITE_API_URL || 'http://localhost:8000'}'}/api/documents, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setHistory(data))
    .catch(console.error);
  }, [token]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#030303] text-slate-200 font-sans selection:bg-orange-500/30 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-20 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/20 via-amber-500/5 to-transparent blur-3xl rounded-full mix-blend-screen transform scale-x-150"></div>
      </div>

      <header className="bg-[#030303]/80 backdrop-blur-2xl border-b border-white/[0.08] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center text-[#cf8047]">
              <svg viewBox="0 0 48 48" style={{ width: '2rem', height: '2rem', fill: 'currentColor' }}>
                <path d="M24 2c2.2 13.8 7.9 19.6 22 22-14.1 2.4-19.8 8.2-22 22-2.2-13.8-7.9-19.6-22-22 14.1-2.4 19.8-8.2 22-22Z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Cloak</h1>
            <div className="h-4 w-px bg-white/10 mx-2"></div>
            <span className="text-sm font-medium text-slate-400">Workspace</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/rules" className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
              <Settings size={15} /> Rules Engine
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-rose-400 transition-colors">
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <motion.main variants={containerVariants} initial="hidden" animate="show" className="max-w-6xl mx-auto px-6 py-12 md:py-16 space-y-12 relative z-10">
        
        <div className="text-center md:text-left">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles size={12} /> Cloak Engine Active
          </motion.div>
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 text-white">
            Welcome back.
          </motion.h2>
          <motion.p variants={itemVariants} className="text-slate-400 text-lg max-w-xl">
            Protect your sensitive data instantly. Upload documents to automatically detect and redact PII.
          </motion.p>
        </div>

        {stats && (
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white/[0.02] border border-white/[0.08] p-6 rounded-2xl flex flex-col justify-between hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
              <h3 className="text-slate-400 text-xs font-semibold mb-4 tracking-wide uppercase">Docs Processed</h3>
              <p className="text-4xl font-medium text-white">{stats.documents_processed}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.08] p-6 rounded-2xl flex flex-col justify-between hover:bg-amber-500/5 hover:border-amber-500/20 transition-colors relative overflow-hidden group">
              <h3 className="text-slate-400 text-xs font-semibold mb-4 tracking-wide uppercase flex items-center gap-1.5"><ShieldAlert size={14} className="text-amber-400"/> Pending Review</h3>
              <p className="text-4xl font-medium text-amber-400">{stats.pending_review}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.08] p-6 rounded-2xl flex flex-col justify-between hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
              <h3 className="text-slate-400 text-xs font-semibold mb-4 tracking-wide uppercase">Total Redactions</h3>
              <p className="text-4xl font-medium text-white">{stats.total_redactions}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.08] p-6 rounded-2xl flex flex-col justify-between hover:bg-emerald-500/5 hover:border-emerald-500/20 transition-colors relative overflow-hidden group">
              <h3 className="text-slate-400 text-xs font-semibold mb-4 tracking-wide uppercase flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400"/> Active Rules</h3>
              <p className="text-4xl font-medium text-white">{stats.active_rules}</p>
            </div>
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="bg-[#0a0a0a] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
          <div className="p-8 border-b border-white/[0.06] flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Process Document</h3>
              <p className="text-sm text-slate-400">Upload a file or paste text to begin PII redaction</p>
            </div>
          </div>
          <div className="relative z-10">
            <UploadPage onAnalysisComplete={onAnalysisComplete} />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-[#0a0a0a] border border-white/[0.08] rounded-3xl overflow-hidden relative shadow-2xl">
          <div className="p-8 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center border border-white/[0.05] text-slate-300">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
                <p className="text-sm text-slate-400">Your previously processed documents</p>
              </div>
            </div>
          </div>
          <div className="p-0 overflow-x-auto">
            {history.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500 bg-white/[0.01]">
                    <th className="px-8 py-5 font-semibold whitespace-nowrap">Filename</th>
                    <th className="px-8 py-5 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-8 py-5 font-semibold text-right whitespace-nowrap">Redactions</th>
                    <th className="px-8 py-5 font-semibold text-right whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {history.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
                      <td className="px-8 py-5 text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{doc.file_name}</td>
                      <td className="px-8 py-5 text-sm">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
                          doc.status === 'clean' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm text-right font-medium text-slate-300">{doc.redaction_count}</td>
                      <td className="px-8 py-5 text-sm text-right text-slate-500 whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString()} {new Date(doc.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500 text-sm">No recent documents found.</div>
            )}
          </div>
        </motion.div>

      </motion.main>
    </div>
  );
}
