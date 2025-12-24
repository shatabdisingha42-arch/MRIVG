
import React, { useState, useRef } from 'react';
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

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

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
      setError("Failed to play audio.");
      setIsPlaying(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Please enter some text.");
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
        text: text.length > 80 ? text.substring(0, 77) + '...' : text,
        voice: selectedVoice,
        timestamp: Date.now(),
        audioData: base64Audio,
      };
      
      setHistory(prev => [newItem, ...prev].slice(0, 10));
      await playAudio(base64Audio);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-[#0a0f1d]">
      <header className="w-full max-w-4xl mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500">
          MRIVG
        </h1>
        <p className="text-slate-400 text-lg font-light tracking-widest uppercase text-xs">
          Neural Voice Intelligence
        </p>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Editor Section */}
        <section className="lg:col-span-3 space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Script Editor
              </label>
              <button 
                onClick={() => setText('')} 
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors uppercase font-bold"
              >
                Clear All
              </button>
            </div>
            
            <textarea
              className="w-full h-80 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all resize-none outline-none leading-relaxed text-lg placeholder:text-slate-700"
              placeholder="Paste or type your script here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={10000}
            />
            
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
              <div className="flex flex-col gap-1">
                <div className={`text-[10px] font-mono ${text.length > 9500 ? 'text-orange-400' : 'text-slate-500'}`}>
                  {text.length.toLocaleString()} / 10,000 CHARACTERS
                </div>
                {error && <div className="text-red-400 text-xs font-bold uppercase tracking-tight">Error: {error}</div>}
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                {isPlaying && (
                  <button
                    onClick={stopAudio}
                    className="flex-1 sm:flex-none px-6 py-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold transition-all hover:bg-red-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase text-xs"
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-sm" />
                    Stop
                  </button>
                )}
                
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim()}
                  className={`flex-1 sm:flex-none px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 uppercase text-xs shadow-lg ${
                    isGenerating || !text.trim()
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600'
                      : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 border border-blue-400/30'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Generate Speech
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* History Section */}
          {history.length > 0 && (
            <div className="space-y-4 pt-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] px-2">Recently Generated</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => playAudio(item.audioData)}
                    className="flex items-center gap-4 bg-slate-800/20 border border-slate-700/40 p-4 rounded-2xl hover:bg-slate-800/40 hover:border-slate-600 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-slate-300 text-sm truncate pr-4 font-medium italic">"{item.text}"</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 font-bold uppercase">{item.voice}</span>
                        <span className="text-[9px] text-slate-600 uppercase font-mono">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Sidebar Settings */}
        <aside className="space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 shadow-2xl backdrop-blur-md sticky top-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Voice Selection
            </h3>
            
            <div className="space-y-3">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all relative overflow-hidden group ${
                    selectedVoice === voice.id
                      ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/20'
                      : 'bg-slate-900/40 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <div className={`text-sm font-bold ${selectedVoice === voice.id ? 'text-white' : 'text-slate-300'}`}>
                        {voice.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium leading-tight mt-1 max-w-[120px]">
                        {voice.description}
                      </div>
                    </div>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                      voice.gender === 'Female' ? 'bg-pink-500/10 text-pink-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {voice.gender}
                    </span>
                  </div>
                  
                  {selectedVoice === voice.id && (
                    <div className="absolute top-0 right-0 h-full w-1 bg-indigo-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-700/50 space-y-4">
              <div className="bg-slate-900/40 rounded-xl p-4">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Technical Specs</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">ENGINE</span>
                    <span className="text-slate-300">GEMINI FLASH 2.5</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">SAMPLE RATE</span>
                    <span className="text-slate-300">24KHZ</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">LATENCY</span>
                    <span className="text-emerald-400 font-bold tracking-tighter">&lt; 300MS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="mt-20 pb-8 text-center">
        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.4em]">
          &copy; {new Date().getFullYear()} MRIVG &bull; Powered by Google GenAI
        </div>
      </footer>
    </div>
  );
}
