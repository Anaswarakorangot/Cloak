import React, { useState, useCallback } from 'react';
import { DocumentAnalysisResult } from '@shared/types';
import { Upload, FileText, Sparkles, Cpu, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onAnalysisComplete: (result: DocumentAnalysisResult, mode: 'gemini' | 'mock', fileName: string) => void;
}

type DetectionMode = 'gemini' | 'mock';
type InputMode = 'upload' | 'paste';

export function UploadPage({ onAnalysisComplete }: Props) {
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('gemini');
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const analyzeText = async (text: string, fileName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(${import.meta.env.VITE_API_URL || '${import.meta.env.VITE_API_URL || 'http://localhost:8000'}'}/api/analyze-text, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text, mode: detectionMode }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Analysis failed.');
      }
      const result: DocumentAnalysisResult = await response.json();
      onAnalysisComplete(result, detectionMode, fileName);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', detectionMode);
    try {
      const response = await fetch(${import.meta.env.VITE_API_URL || '${import.meta.env.VITE_API_URL || 'http://localhost:8000'}'}/api/analyze-upload, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Upload failed.');
      }
      const result: DocumentAnalysisResult = await response.json();
      onAnalysisComplete(result, detectionMode, file.name);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) analyzeFile(file);
  }, [detectionMode]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyzeFile(file);
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    analyzeText(pastedText, 'Pasted Document');
  };

  const handleUseDemoDoc = () => {
    fetch(${import.meta.env.VITE_API_URL || '${import.meta.env.VITE_API_URL || 'http://localhost:8000'}'}/api/analyze, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => onAnalysisComplete(data, 'mock', 'Demo Document'))
      .catch(() => setError('Could not load demo document.'));
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 lg:p-8">

      <div className="w-full max-w-2xl space-y-6">
        
        {/* Detection Mode Toggle */}
        <div className="flex items-center gap-2 p-1 bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/5">
          <button
            onClick={() => setDetectionMode('gemini')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
              detectionMode === 'gemini'
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-500/20'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Sparkles size={16} />
            Gemini AI Detection
          </button>
          <button
            onClick={() => setDetectionMode('mock')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
              detectionMode === 'mock'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Cpu size={16} />
            Quick Demo (Mock)
          </button>
        </div>

        {detectionMode === 'gemini' && (
          <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2">
            <Sparkles size={12} />
            <span>Gemini 2.5 Flash will analyze your document for PII with explanations for every decision.</span>
          </div>
        )}

        {/* Input Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setInputMode('upload')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
              inputMode === 'upload'
                ? 'bg-white/10 border-white/20 text-white shadow-lg'
                : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setInputMode('paste')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
              inputMode === 'paste'
                ? 'bg-white/10 border-white/20 text-white shadow-lg'
                : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Paste Text
          </button>
        </div>

        {/* Upload Zone */}
        <AnimatePresence mode="wait">
        {inputMode === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative group border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
              isDragging
                ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_40px_rgba(99,102,241,0.2)]'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] shadow-2xl'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".txt,.pdf,image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleFileInput}
            />
            <div className="flex flex-col items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isDragging ? 'bg-orange-500/20' : 'bg-white/5 shadow-inner'
              }`}>
                {isLoading
                  ? <Loader2 size={28} className="text-orange-400 animate-spin" />
                  : <Upload size={28} className={isDragging ? 'text-orange-400' : 'text-slate-400'} />
                }
              </div>
              <div>
                {isLoading ? (
                  <p className="text-slate-300 font-semibold text-lg">
                    {detectionMode === 'gemini' ? 'Gemini is analyzing...' : 'Analyzing document...'}
                  </p>
                ) : (
                  <>
                    <p className="text-slate-200 font-semibold text-lg">
                      Drop your file here, or <span className="text-orange-400">browse</span>
                    </p>
                    <p className="text-slate-500 text-sm mt-1">Supports .txt, .pdf, and images (.png, .jpg)</p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Paste Zone */}
        {inputMode === 'paste' && (
          <motion.div
            key="paste"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your document text here..."
              rows={10}
              className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-4 text-slate-300 placeholder-slate-600 text-sm font-mono resize-none focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
            <button
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim() || isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading
                ? <><Loader2 size={18} className="animate-spin" /> Analyzing...</>
                : <><ChevronRight size={18} /> Analyze Document</>
              }
            </button>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Demo shortcut */}
        <div className="text-center pt-2">
          <button
            onClick={handleUseDemoDoc}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
          >
            Or load the built-in demo document →
          </button>
        </div>
      </div>
    </div>
  );
}
