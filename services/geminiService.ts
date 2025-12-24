import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from '../types';

export class GeminiTTSService {
  async generateSpeech(text: string, voice: VoiceName): Promise<string> {
    // Re-instantiate to ensure we use the freshest API key available in the session
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ 
          parts: [{ 
            text: `Say: ${text}` 
          }] 
        }],
        config: {
          // Explicitly request ONLY audio to prevent the model from returning mixed modalities which causes errors
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      // Navigate candidates carefully to find inline audio data
      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      const base64Audio = audioPart?.inlineData?.data;
      
      if (!base64Audio) {
        console.warn("API returned response but no audio data was found in parts.");
        
        // Check for content filter blocks
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        const isBlocked = safetyRatings?.some(r => r.probability === 'HIGH' || r.probability === 'MEDIUM');
        
        if (isBlocked) {
          throw new Error("Safety filters blocked this generation. Please try using more neutral language.");
        }
        
        throw new Error("Neural synthesis failed to return valid audio. This can happen with complex text or server-side preview limits.");
      }
      
      return base64Audio;
    } catch (error: any) {
      console.error("Gemini TTS Engine Error:", error);
      
      // Categorize common API errors to help the user resolve issues
      if (error.message?.includes('500') || error.message?.includes('INTERNAL')) {
        throw new Error("The synthesis engine encountered a temporary server error (500). Please try again with shorter text or wait a few seconds.");
      }
      
      if (error.message?.includes('non-audio response') || error.message?.includes('not supported by the AudioOut model')) {
        throw new Error("Model synthesis conflict: The engine tried to speak but failed. Try using simpler phrasing.");
      }
      
      if (error.message?.includes('429')) {
        throw new Error("Synthesis quota reached. Please wait a moment before trying again.");
      } else if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('Requested entity was not found')) {
        throw new Error("API Authentication failure. Please re-select your valid API key via the Health panel.");
      }
      
      throw new Error(error.message || "Synthesis engine encountered an unexpected error.");
    }
  }
}

export const ttsService = new GeminiTTSService();

export function decode(base64: string) {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    throw new Error("Failed to decode synthesis data.");
  }
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // PCM data needs to be correctly aligned for Int16 conversion
  const byteLength = data.byteLength;
  const alignedLength = Math.floor(byteLength / 2) * 2;
  const int16Buffer = new Int16Array(data.buffer, data.byteOffset, alignedLength / 2);
  const frameCount = int16Buffer.length / numChannels;
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Scale 16-bit integer PCM to floating point [-1, 1]
      channelData[i] = int16Buffer[i * numChannels + channel] / 32768.0;
    }
  }
  return audioBuffer;
}