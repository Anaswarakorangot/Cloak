import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings, ArrowLeft, Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CustomRule {
  id: string;
  name: string;
  pattern: string;
  entity_type: string;
  is_active: string;
}

export function RulesPage() {
  const { token } = useAuth();
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [newRule, setNewRule] = useState({ name: '', pattern: '', entity_type: 'UNKNOWN' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [token]);

  const fetchRules = () => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/rules`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setRules(data))
    .catch(console.error);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/rules`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newRule)
      });
      setNewRule({ name: '', pattern: '', entity_type: 'UNKNOWN' });
      fetchRules();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (id: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/rules/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchRules();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/rules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchRules();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))] text-slate-200">
      <header className="bg-slate-950/40 backdrop-blur-md border-b border-slate-800/60 p-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-indigo-400 transition-colors p-2 -ml-2 rounded-lg hover:bg-indigo-500/10">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <Settings className="text-indigo-400" size={20} />
            <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">Rules Engine</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Plus className="text-emerald-400" size={18} /> Add Custom Rule
          </h2>
          <form onSubmit={handleCreateRule} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Rule Name</label>
              <input required type="text" value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Case Reference" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Regex Pattern</label>
              <input required type="text" value={newRule.pattern} onChange={e => setNewRule({...newRule, pattern: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:ring-1 focus:ring-indigo-500" placeholder="\bCASE-\d{4}-\w+\b" />
            </div>
            <div>
              <button disabled={loading} type="submit" className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold transition-colors">
                Add Rule
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold">Active Workspace Rules</h2>
          {rules.length === 0 ? (
            <p className="text-slate-500 text-sm italic p-4 bg-slate-900/30 rounded-lg border border-slate-800/30 text-center">No custom rules defined yet.</p>
          ) : (
            rules.map(rule => (
              <div key={rule.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${rule.is_active === 'true' ? 'bg-slate-900/50 border-slate-700 shadow-md' : 'bg-slate-950 border-slate-800/50 opacity-60'}`}>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    {rule.name} 
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Regex</span>
                  </h3>
                  <code className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded mt-2 inline-block font-mono border border-indigo-500/20">{rule.pattern}</code>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleRule(rule.id)} className={`p-2 rounded-lg border transition-colors ${rule.is_active === 'true' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700 text-slate-300'}`}>
                    {rule.is_active === 'true' ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
