import React, { useState, useRef, useEffect } from 'react';
import { VoiceName, HistoryItem } from './types';
import { VOICE_OPTIONS, SAMPLE_RATE } from './constants';
import { ttsService, decode, decodeAudioData } from './services/geminiService';

export default function App() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [apiReady, setApiReady] = useState<boolean | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setApiReady(hasKey || !!process.env.API_KEY);
      } catch (e) {
        setApiReady(!!process.env.API_KEY);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    try {
      await (window as any).aistudio.openSelectKey();
      setApiReady(true);
      setError(null);
    } catch (e) {
      console.error("Key selection failed", e);
    }
  };

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
    }
    return audioContextRef.current;
  };

  const stopAudio = () => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {}
      currentSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const playAudio = async (base64Data: string) => {
    try {
      stopAudio();
      const ctx = getAudioContext();
      
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      const audioBytes = decode(base64Data);
      const audioBuffer = await decodeAudioData(audioBytes, ctx, SAMPLE_RATE, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (currentSourceRef.current === source) {
          setIsPlaying(false);
        }
      };
      
      currentSourceRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (err) {
      console.error("Playback error:", err);
      setError("Audio device error. Please check your browser permissions.");
      setIsPlaying(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Script canvas is empty. Please provide content.");
      return;
    }

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    setIsGenerating(true);
    setError(null);

    try {
      const base64Audio = await ttsService.generateSpeech(text, selectedVoice);
      
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        text: text.length > 50 ? text.substring(0, 47) + '...' : text,
        voice: selectedVoice,
        timestamp: Date.now(),
        audioData: base64Audio,
      };
      
      setHistory(prev => [newItem, ...prev].slice(0, 10));
      await playAudio(base64Audio);
    } catch (err: any) {
      setError(err.message || "Synthesis failed.");
      if (err.message?.includes('API Key') || err.message?.includes('Requested entity')) {
        setApiReady(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-[#0a0f1d] text-slate-100">
      <header className="w-full max-w-4xl mb-12 text-center pt-8">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-blue-300 via-indigo-400 to-purple-600">
          MRIVG
        </h1>
        <div className="flex justify-center items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-blue-400 font-bold tracking-widest uppercase text-[9px]">Neural TTS</span>
          </div>
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">v2.5 Production</span>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-8">
        <section className="lg:col-span-3 space-y-6">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-[2.5rem] p-6 md:p-10 shadow-3xl backdrop-blur-xl relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-[2.5rem] pointer-events-none" />
            
            <div className="flex justify-between items-center mb-6 relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500/50" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                Script Editor
              </label>
              <button 
                onClick={() => { setText(''); setError(null); }} 
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors uppercase font-bold tracking-wider"
              >
                Reset
              </button>
            </div>
            
            <textarea
              className="w-full h-80 bg-slate-900/40 border border-slate-700/30 rounded-3xl p-8 text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all resize-none outline-none leading-relaxed text-xl placeholder:text-slate-800 font-medium"
              placeholder="Paste your script here for neural synthesis..."
              value={text}
              onChange={(e) => { setText(e.target.value); if(error) setError(null); }}
              maxLength={1500}
            />
            
            <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-6 relative">
              <div className="flex flex-col gap-2 w-full sm:w-1/2">
                <div className="flex items-center gap-3">
                  <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${text.length > 1400 ? 'border-orange-500/30 text-orange-400 bg-orange-500/5' : 'border-slate-700 text-slate-500 bg-slate-900/50'}`}>
                    {text.length.toLocaleString()} / 1,500
                  </div>
                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Capacity</span>
                </div>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="text-red-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                      Alert
                    </div>
                    <div className="text-red-300/80 text-xs leading-relaxed font-medium">{error}</div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 w-full sm:w-auto">
                {isPlaying && (
                  <button
                    onClick={stopAudio}
                    className="flex-1 sm:flex-none px-8 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold transition-all hover:bg-red-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest"
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-sm" />
                    Stop
                  </button>
                )}
                
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim()}
                  className={`flex-1 sm:flex-none px-12 py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 uppercase text-[11px] tracking-[0.2em] shadow-2xl ${
                    isGenerating || !text.trim()
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                      : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 hover:shadow-blue-500/20 border border-blue-400/30'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Synthesizing
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                      Generate Voice
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {history.length > 0 && (
            <div className="space-y-4 pt-6">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] px-4">Recent Sessions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => playAudio(item.audioData)}
                    className="flex items-center gap-5 bg-slate-800/20 border border-slate-700/30 p-5 rounded-[1.5rem] hover:bg-slate-800/40 hover:border-slate-500/50 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform border border-blue-500/20">
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-slate-200 text-sm truncate font-bold leading-tight">"{item.text}"</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] px-2 py-0.5 rounded-lg bg-slate-900 text-slate-400 font-black uppercase border border-slate-700">{item.voice}</span>
                        <span className="text-[9px] text-slate-600 font-mono">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-3xl backdrop-blur-xl sticky top-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
              <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
              Neural Selection
            </h3>
            
            <div className="space-y-4">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`w-full text-left p-5 rounded-[1.5rem] border transition-all relative overflow-hidden group ${
                    selectedVoice === voice.id
                      ? 'bg-indigo-600/10 border-indigo-500/50 ring-2 ring-indigo-500/10'
                      : 'bg-slate-900/40 border-slate-700 hover:border-slate-500/50'
                  }`}
                >
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <div className={`text-sm font-bold tracking-tight ${selectedVoice === voice.id ? 'text-white' : 'text-slate-300'}`}>
                        {voice.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium leading-tight mt-1 max-w-[120px]">
                        {voice.description}
                      </div>
                    </div>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                      voice.gender === 'Female' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {voice.gender[0]}
                    </span>
                  </div>
                  {selectedVoice === voice.id && (
                    <div className="absolute top-0 right-0 h-full w-1.5 bg-indigo-500 rounded-l-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-slate-700/50 space-y-6">
              <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-700/30">
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Diagnostics</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-600 tracking-wider">NETWORK</span>
                    <button 
                      onClick={handleOpenKeySelector}
                      className={`tracking-tighter flex items-center gap-2 px-2 py-1 rounded-lg ${apiReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400 animate-pulse'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${apiReady ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                      {apiReady ? 'SECURE' : 'ACTION REQUIRED'}
                    </button>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-600 tracking-wider">USAGE TIER</span>
                    <span className="text-slate-400">FREE TIER</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-600 tracking-wider">FIDELITY</span>
                    <span className="text-slate-300">24.0 KHZ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="mt-24 pb-12 text-center opacity-30 group cursor-default">
        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.8em] group-hover:text-blue-500 transition-colors">
          MRIVG NEURAL CORE &bull; PRODUCTION READY
        </div>
      </footer>
    </div>
  );
}