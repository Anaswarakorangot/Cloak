import React, { useEffect, useState } from 'react';
import { UploadPage } from './UploadPage';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, FileText, Settings, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react';
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
    fetch('http://localhost:8000/api/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setStats(data))
    .catch(console.error);

    fetch('http://localhost:8000/api/documents', {
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
    <div className="min-h-screen bg-[#0A0A0A] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] text-slate-200">
      <header className="bg-[#0A0A0A]/60 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">Cloak</h1>
          </div>
          <div className="flex gap-4">
            <Link to="/rules" className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors">
              <Settings size={16} /> Rules Engine
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-rose-400 transition-colors">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <motion.main variants={containerVariants} initial="hidden" animate="show" className="max-w-6xl mx-auto p-6 md:p-12 space-y-12">
        <div className="text-center md:text-left">
          <h2 className="text-4xl font-extrabold tracking-tight mb-2 text-white">Welcome to your Workspace</h2>
          <p className="text-slate-400 text-lg">Manage your documents, review redactions, and configure detection rules.</p>
        </div>

        {stats && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl shadow-xl backdrop-blur-sm flex flex-col justify-between hover:bg-white/[0.04] transition-colors">
              <h3 className="text-slate-400 text-sm font-semibold mb-3 tracking-wide uppercase">Docs Processed</h3>
              <p className="text-4xl font-black text-white">{stats.documents_processed}</p>
            </div>
            <div className="bg-gradient-to-b from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-6 rounded-2xl shadow-xl backdrop-blur-sm flex flex-col justify-between hover:from-amber-500/15 transition-colors">
              <h3 className="text-amber-400 text-sm font-semibold mb-3 tracking-wide uppercase flex items-center gap-2"><ShieldAlert size={16}/> Pending Review</h3>
              <p className="text-4xl font-black text-amber-300">{stats.pending_review}</p>
            </div>
            <div className="bg-gradient-to-b from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 p-6 rounded-2xl shadow-xl backdrop-blur-sm flex flex-col justify-between hover:from-indigo-500/15 transition-colors">
              <h3 className="text-indigo-400 text-sm font-semibold mb-3 tracking-wide uppercase">Total Redactions</h3>
              <p className="text-4xl font-black text-indigo-300">{stats.total_redactions}</p>
            </div>
            <div className="bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl shadow-xl backdrop-blur-sm flex flex-col justify-between hover:from-emerald-500/15 transition-colors">
              <h3 className="text-emerald-400 text-sm font-semibold mb-3 tracking-wide uppercase flex items-center gap-2"><CheckCircle2 size={16}/> Active Rules</h3>
              <p className="text-4xl font-black text-emerald-300">{stats.active_rules}</p>
            </div>
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="p-8 border-b border-white/10 bg-white/[0.01]">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <FileText className="text-indigo-400" />
              Upload New Document
            </h3>
          </div>
          <UploadPage onAnalysisComplete={onAnalysisComplete} />
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="p-8 border-b border-white/10 bg-white/[0.01]">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" />
              Recent Documents
            </h3>
          </div>
          <div className="p-0 overflow-x-auto">
            {history.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400 bg-white/[0.01]">
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Filename</th>
                    <th className="px-6 py-4 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Redactions</th>
                    <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-200">{doc.file_name}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-xs font-bold uppercase tracking-wide">
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-slate-300">{doc.redaction_count}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-500 whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString()} {new Date(doc.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">No recent documents found.</div>
            )}
          </div>
        </motion.div>
      </motion.main>
    </div>
  );
}
