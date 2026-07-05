import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DocumentViewer } from './components/DocumentViewer';
import { Dashboard } from './components/Dashboard';
import { LoginPage } from './components/LoginPage';
import { RulesPage } from './components/RulesPage';
import { useDocumentState } from './hooks/useDocumentState';
import { DocumentAnalysisResult } from '@shared/types';
import { useAuth, AuthProvider } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

function MainApp() {
  const state = useDocumentState();
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    const isLanding = location.pathname === '/' && !isAuthenticated;
    
    const landingElements = [
      document.getElementById('header'),
      document.getElementById('main'),
      document.querySelector('footer'),
      document.getElementById('nav-menu')
    ];
    
    landingElements.forEach(el => {
      if (el) el.style.display = isLanding ? '' : 'none';
    });

    const isApp = location.pathname === '/' && isAuthenticated;

    if (isApp) {
      document.body.style.background = '#0a0a0a';
      document.body.style.color = '#ffffff';
    } else {
      document.body.style.background = '#ffffff';
      document.body.style.color = '#111111';
    }
  }, [location.pathname, isAuthenticated]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('test_scenario') === 'zero_pii') {
      state.setDocument({
        text: 'This is a completely safe document with absolutely no PII whatsoever.',
        spans: []
      }, 'mock', 'safe-document.txt');
    }
  }, []);

  const handleAnalysisComplete = (
    result: DocumentAnalysisResult,
    mode: 'gemini' | 'mock',
    fileName: string
  ) => {
    state.setDocument(result, mode, fileName);
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<LoginPage initialIsLogin={false} />} />
      <Route path="/" element={
        isAuthenticated ? (
          !state.document ? (
            <Dashboard onAnalysisComplete={handleAnalysisComplete} />
          ) : (
            <div className="min-h-screen bg-[#0A0A0A] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))] flex items-center justify-center p-4 md:p-8">
              <div className="max-w-6xl w-full bg-slate-950/40 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 rounded-2xl border border-slate-800/60 overflow-hidden ring-1 ring-white/10">
                <header className="bg-gradient-to-r from-slate-900/80 to-slate-950/80 border-b border-slate-800/60 p-5 flex items-center justify-between px-6 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <span className="text-white font-bold tracking-tighter text-sm">C</span>
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">Cloak</h1>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-500 max-w-[200px] truncate">
                      {state.fileName}
                    </div>
                    <div className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      state.detectionMode === 'gemini'
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                        : 'bg-slate-700/50 text-slate-400 border-slate-600/30'
                    }`}>
                      {state.detectionMode === 'gemini' ? '✦ Gemini AI' : 'Mock Mode'}
                    </div>
                    <button
                      onClick={() => state.setDocument(null as any, 'mock', '')}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      ← Back to Dashboard
                    </button>
                  </div>
                </header>
                <main className="p-0">
                  <DocumentViewer documentState={state} />
                </main>
              </div>
            </div>
          )
        ) : (
          <></>
        )
      } />
      <Route path="/rules" element={
        <ProtectedRoute>
          <RulesPage />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
