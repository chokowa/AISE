"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import WaveSurfer from "wavesurfer.js";
import { 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Download, 
  Search, 
  Settings2, 
  Music, 
  History,
  Activity,
  ChevronRight,
  Loader2,
  Clock,
  Mic,
  Waves,
  Zap,
  Sparkles,
  Info,
  Camera,
  Image as ImageIcon,
  XCircle
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- タイプ定義 ---
interface AudioRecord {
  id: number;
  engine_name: string;
  prompt: string;
  duration: number;
  temperature: number;
  top_k: number;
  top_p: number;
  seed: number;
  filename: string;
  created_at: string;
}

const API_BASE = "http://127.0.0.1:8000";

export default function AudioGenDashboard() {
  const [history, setHistory] = useState<AudioRecord[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [duration, setDuration] = useState(8);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AudioRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState("audiogen");

  const [params, setParams] = useState({
    temperature: 1.0,
    top_k: 250,
    top_p: 0.0,
    seed: -1
  });

  const [batchCount, setBatchCount] = useState(1);
  const stopRequestedRef = useRef(false);

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (waveformRef.current && selectedRecord && !isGenerating) {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }

      const isHighRes = selectedRecord.engine_name === "stable_audio_open";

      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: isHighRes ? "#818cf8" : "#4f46e5",
        progressColor: isHighRes ? "#a5b4fc" : "#818cf8",
        cursorColor: "#ffffff",
        barWidth: 2,
        barRadius: 3,
        height: 120,
        normalize: true,
      });

      wavesurfer.current.load(`${API_BASE}/audio/${selectedRecord.filename}`);
      
      wavesurfer.current.on("play", () => setIsPlaying(true));
      wavesurfer.current.on("pause", () => setIsPlaying(false));
      wavesurfer.current.on("finish", () => setIsPlaying(false));
    }

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
        wavesurfer.current = null;
      }
    };
  }, [selectedRecord, isGenerating]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const handleGenerate = async () => {
    if (!currentPrompt || isGenerating) return;
    setIsGenerating(true);
    stopRequestedRef.current = false;
    setSelectedRecord(null);

    let initialSeed = params.seed;

    try {
      for (let i = 0; i < batchCount; i++) {
        if (stopRequestedRef.current) break;

        // シード値の決定ロジック
        let runSeed = initialSeed;
        if (initialSeed === -1) {
          // ランダム設定の場合は毎回新しいランダム値を生成
          runSeed = Math.floor(Math.random() * 2147483647);
        } else {
          // 固定値の場合は1ずつインクリメント
          runSeed = initialSeed + i;
        }

        const res = await axios.post(`${API_BASE}/generate`, {
          engine: selectedEngine,
          prompt: currentPrompt,
          duration: duration,
          ...params,
          seed: runSeed
        });
        
        if (res.data.status === "success") {
          await fetchHistory();
          setSelectedRecord(res.data.record);
        } else if (res.data.status === "interrupted") {
          // ユーザーによる中断の場合はアラートを出さずに終了
          break;
        }

        // 最後のループでなければ少し待つ（UI更新と安定性のため）
        if (i < batchCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (err) {
      alert("Generation failed. Please make sure the backend is running.");
      console.error(err);
    } finally {
      setIsGenerating(false);
      stopRequestedRef.current = false;
    }
  };

  const handleAbort = async () => {
    try {
      await axios.post(`${API_BASE}/stop`);
      // バッチも止める
      stopRequestedRef.current = true;
    } catch (err) {
      console.error("Failed to send stop request:", err);
    }
  };

  const handleAnalyzeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data.status === "success") {
        setCurrentPrompt(res.data.prompt);
      }
    } catch (err) {
      alert("Image analysis failed.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this sound?")) return;
    try {
      await axios.delete(`${API_BASE}/history/${id}`);
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
      fetchHistory();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const filteredHistory = history.filter(item => 
    item.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#09090b] text-neutral-200 overflow-hidden font-sans">
      
      {/* 隠しインプット */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleAnalyzeImage}
      />

      {/* --- サイドバー --- */}
      <aside className="w-80 border-r border-white/5 bg-black/20 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">SoundEngine Pro</h1>
          </div>
          
          <button 
            onClick={() => {
              setSelectedRecord(null);
              setCurrentPrompt("");
            }}
            className="w-full h-11 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-all mb-6 text-sm font-semibold active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Creation
          </button>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="text" 
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121214] border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] px-2 mb-4">
            Recent Creations
          </div>
          <div className="space-y-1">
            {filteredHistory.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "p-3 rounded-xl cursor-pointer transition-all group relative border border-transparent",
                  selectedRecord?.id === item.id 
                    ? "bg-indigo-600/10 text-white border-indigo-500/30" 
                    : "hover:bg-white/5 text-neutral-400 hover:text-white"
                )}
                onClick={() => {
                  setSelectedRecord(item);
                  setParams(p => ({...p, seed: item.seed}));
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold truncate max-w-[140px]">{item.prompt}</div>
                  <span className={cn(
                    "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full",
                    item.engine_name === "stable_audio_open" ? "bg-amber-500/20 text-amber-500" : 
                    item.engine_name === "audioldm2" ? "bg-emerald-500/20 text-emerald-400" :
                    item.engine_name === "audioldm2_full" ? "bg-cyan-500/20 text-cyan-400" :
                    "bg-blue-500/20 text-blue-400"
                  )}>
                    {item.engine_name === "stable_audio_open" ? "HF" : 
                     item.engine_name === "audioldm2" ? "Comm" : 
                     item.engine_name === "audioldm2_full" ? "Indu" : "Std"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] opacity-50">
                  <Clock className="w-3 h-3" />
                  {new Date(item.created_at).toLocaleDateString()}
                  {item.duration}s
                  <span>•</span>
                  Seed: {item.seed}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      {/* --- メインコンテンツ --- */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 px-8 border-b border-white/5 flex items-center justify-between glass-dark z-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-500">
              Engine Mode:
            </div>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setSelectedEngine("audiogen")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                  selectedEngine === "audiogen" ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-500 hover:text-white"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Standard
              </button>
              <button 
                onClick={() => setSelectedEngine("stable_audio_open")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                  selectedEngine === "stable_audio_open" ? "bg-amber-600 text-white shadow-lg" : "text-neutral-500 hover:text-white"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Hi-Fi
              </button>
              <button 
                onClick={() => setSelectedEngine("audioldm2")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                  selectedEngine === "audioldm2" ? "bg-emerald-600 text-white shadow-lg" : "text-neutral-500 hover:text-white"
                )}
              >
                <Mic className="w-3.5 h-3.5" />
                Comm
              </button>
              <button 
                onClick={() => setSelectedEngine("audioldm2_full")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                  selectedEngine === "audioldm2_full" ? "bg-cyan-600 text-white shadow-lg" : "text-neutral-500 hover:text-white"
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                Industrial
              </button>
            </div>
          </div>
          
          <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            System: RTX 3060 Optimized
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-10">

            {/* 再生セクション */}
            {selectedRecord && !isGenerating ? (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 rounded-3xl glass-dark space-y-8 border border-white/5 shadow-2xl relative overflow-hidden">
                  {/* 装飾 */}
                  <div className={cn(
                    "absolute -right-16 -top-16 w-48 h-48 rounded-full blur-[80px] opacity-20",
                    selectedRecord.engine_name === "stable_audio_open" ? "bg-amber-500" : "bg-indigo-500"
                  )} />

                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">
                        {selectedRecord.engine_name === "stable_audio_open" ? <Sparkles className="w-3 h-3" /> : 
                         selectedRecord.engine_name === "audioldm2" ? <Mic className="w-3 h-3 text-emerald-500" /> :
                         selectedRecord.engine_name === "audioldm2_full" ? <Activity className="w-3 h-3 text-cyan-500" /> :
                         <Zap className="w-3 h-3" />}
                        {selectedRecord.engine_name === "stable_audio_open" ? "High Fidelity Master" : 
                         selectedRecord.engine_name === "audioldm2" ? "Apache 2.0 Open Source" :
                         selectedRecord.engine_name === "audioldm2_full" ? "Industrial Pro Grade" :
                         "Standard Model Output"}
                      </div>
                      <h2 className="text-3xl font-extra-bold text-white tracking-tight leading-tight">{selectedRecord.prompt}</h2>
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded-2xl border border-white/5">
                      <button 
                        onClick={() => handleDelete(selectedRecord.id)}
                        className="p-2.5 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 rounded-xl transition-all"
                        title="Delete session"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <a 
                        href={`${API_BASE}/audio/${selectedRecord.filename}`}
                        download
                        className="p-2.5 hover:bg-white/10 text-neutral-500 hover:text-white rounded-xl transition-all"
                        title="Export audio (WAV)"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                  </div>

                  <div className="bg-[#050505] rounded-2xl p-8 border border-white/5 shadow-inner">
                    <div ref={waveformRef} className="mb-6 opacity-80" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => wavesurfer.current?.playPause()}
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90",
                            selectedRecord.engine_name === "stable_audio_open" ? "bg-amber-500 hover:bg-amber-400" : "bg-indigo-600 hover:bg-indigo-500"
                          )}
                        >
                          {isPlaying ? <Pause className="w-7 h-7 fill-white text-white" /> : <Play className="w-7 h-7 fill-white text-white translate-x-0.5" />}
                        </button>
                        <div>
                          <div className="text-xs font-mono text-neutral-500 mb-1">Inferred Length</div>
                          <div className="text-sm font-bold text-white">{selectedRecord.duration}.0s</div>
                        </div>
                      </div>
                      <div className="flex gap-10">
                        <div className="text-right">
                          <div className="text-[10px] uppercase text-neutral-500 font-bold mb-1">Sample Rate</div>
                          <div className="text-xs font-bold">{selectedRecord.engine_name === "stable_audio_open" ? "48 kHz" : "16 kHz"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase text-neutral-500 font-bold mb-1">Seed</div>
                          <div className="text-xs font-bold text-neutral-300">{selectedRecord.seed}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : isGenerating ? (
              <section className="h-[360px] flex flex-col items-center justify-center glass rounded-3xl border border-indigo-500/20 shadow-2xl animate-pulse">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-indigo-500 blur-[30px] opacity-30 animate-pulse" />
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin relative z-10" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Neural Synthesis in Progress</h3>
                <p className="text-sm text-neutral-400 max-w-[280px] text-center">Engine is processing your prompt. Large HF models may take up to 45 seconds.</p>
              </section>
            ) : (
              <section className="h-[360px] flex flex-col items-center justify-center glass rounded-3xl border border-white/5 opacity-40 select-none">
                <div className="p-6 rounded-full bg-white/5 mb-6">
                  <Waves className="w-10 h-10 text-neutral-600" />
                </div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-600">Select a session to begin</p>
              </section>
            )}

            {/* --- 生成コントロール --- */}
            <section className="space-y-6 pt-6">
              <div className="glass-dark rounded-3xl p-8 space-y-8 border border-white/5 shadow-2xl relative">
                
                <div className="space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      <Activity className="w-4 h-4 text-indigo-500" />
                      Studio Synthesis Config
                    </div>
                    <div className="flex items-center gap-2">
                       {/* 画像解析ボタン */}
                       <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isAnalyzing}
                        className={cn(
                          "flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-white/10 transition-all",
                          isAnalyzing ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                        )}
                        title="Analyze image to generate prompt"
                      >
                        {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                        AI IMAGE ANALYSIS
                      </button>

                      {selectedEngine === "stable_audio_open" && (
                        <div className="flex items-center gap-1.5 text-[8px] font-black bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md border border-amber-500/20">
                          <Sparkles className="w-3 h-3" /> HIGH FIDELITY ENABLED
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <textarea 
                    value={currentPrompt}
                    onChange={(e) => setCurrentPrompt(e.target.value)}
                    placeholder={selectedEngine === "stable_audio_open" ? "PRO TIP: Stable Audio Open shines with descriptive environmental prompts (e.g. Cinematic forest rain, binaural, ultra realistic)" : "Enter sound description (e.g. thunderstorm, city crowd...)"}
                    className="w-full h-36 bg-[#0c0c0e] border border-white/5 rounded-2xl p-6 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all placeholder:text-neutral-700 leading-relaxed shadow-inner"
                  />
                </div>

                  <div className="flex items-end justify-between gap-12">
                    <div className="flex-1 space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                          <label>Generation Length</label>
                          <span className="text-white font-mono">{duration}s</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" max={selectedEngine === "stable_audio_open" ? 45 : 30} 
                          value={duration}
                          onChange={(e) => setDuration(parseInt(e.target.value))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/5 accent-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1">Batch Count</label>
                        <input 
                          type="number" 
                          min="1" 
                          max="50"
                          value={batchCount}
                          onChange={(e) => setBatchCount(Math.max(1, parseInt(e.target.value) || 1))}
                          disabled={isGenerating}
                          className="w-24 bg-[#0c0c0e] border border-white/5 rounded-xl h-11 px-4 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                        />
                      </div>

                      {isGenerating ? (
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={handleAbort}
                            className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 active:scale-[0.98]"
                          >
                            <XCircle className="w-4 h-4" />
                            Abort Now
                          </button>
                          <button 
                            onClick={() => stopRequestedRef.current = true}
                            className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-white/5 active:scale-[0.98]"
                          >
                            <Pause className="w-4 h-4" />
                            Stop Batch
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={handleGenerate}
                          disabled={!currentPrompt || isGenerating}
                          className={cn(
                            "h-16 px-10 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-2xl active:scale-[0.98]",
                            !currentPrompt
                              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                              : selectedEngine === "stable_audio_open"
                                ? "bg-gradient-to-tr from-amber-600 to-amber-400 text-white shadow-amber-600/20 hover:brightness-110"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
                          )}
                        >
                          <Mic className="w-5 h-5" />
                          Inference
                        </button>
                      )}
                    </div>
                  </div>

                {/* アドバンスド */}
                <div className="pt-6 border-t border-white/5">
                  <button 
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    className="flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-widest"
                  >
                    <Settings2 className="w-4 h-4" />
                    Advanced Controls
                    <ChevronRight className={cn("w-3 h-3 transition-transform", isAdvancedOpen && "rotate-90")} />
                  </button>
                  
                  {isAdvancedOpen && (
                    <div className="grid grid-cols-3 gap-10 mt-8 p-6 rounded-2xl bg-black/40 border border-white/5 animate-in slide-in-from-top-4 duration-300">
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase">Temp</label>
                          <span className="text-xs font-bold">{params.temperature}</span>
                        </div>
                        <input type="range" min="0.1" max="2.0" step="0.1" value={params.temperature} 
                          onChange={(e) => setParams({...params, temperature: parseFloat(e.target.value)})}
                          className="w-full accent-indigo-500" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase">Top-K</label>
                          <span className="text-xs font-bold">{params.top_k}</span>
                        </div>
                        <input type="range" min="0" max="500" step="10" value={params.top_k} 
                          onChange={(e) => setParams({...params, top_k: parseInt(e.target.value)})}
                          className="w-full accent-indigo-500" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase">Top-P</label>
                          <span className="text-xs font-bold">{params.top_p}</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.1" value={params.top_p} 
                          onChange={(e) => setParams({...params, top_p: parseFloat(e.target.value)})}
                          className="w-full accent-indigo-500" />
                      </div>
                      <div className="space-y-4 col-span-3">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase">Seed (-1 = Random)</label>
                          <input 
                            type="number" 
                            value={params.seed}
                            onChange={(e) => setParams({...params, seed: parseInt(e.target.value)})}
                            className="bg-black/20 border border-white/5 rounded px-2 py-0.5 text-xs font-bold w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
