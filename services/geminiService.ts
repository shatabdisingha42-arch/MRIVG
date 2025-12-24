
import { GoogleGenAI } from "@google/genai";
import { VoiceName } from '../types';

export class GeminiTTSService {
  private getApiKey(): string {
    const key = process.env.API_KEY;
    if (!key || key === 'undefined') {
      throw new Error("API Key is missing. Please configure the API_KEY environment variable in your deployment settings.");
    }
    return key;
  }

  async generateSpeech(text: string, voice: VoiceName): Promise<string> {
    const apiKey = this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!base64Audio) {
        // Handle specific safety or blocked content responses
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        const isBlocked = safetyRatings?.some(r => r.probability === 'HIGH' || r.probability === 'MEDIUM');
        
        if (isBlocked) {
          throw new Error("Content was flagged by safety filters. Please try modifying your text.");
        }
        
        throw new Error("The model failed to generate audio. This might be due to a temporary service interruption.");
      }
      
      return base64Audio;
    } catch (error: any) {
      console.error("Gemini TTS Error:", error);
      
      // Categorize common API errors
      if (error.message?.includes('429')) {
        throw new Error("Rate limit exceeded. Please wait a moment before trying again.");
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        throw new Error("Invalid API Key. Please verify your credentials in the environment settings.");
      }
      
      throw new Error(error.message || "An unexpected error occurred during synthesis.");
    }
  }
}

export const ttsService = new GeminiTTSService();

export function decode(base64: string) {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    throw new Error("Failed to decode audio data.");
  }
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const alignedLength = Math.floor(data.byteLength / 2) * 2;
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, alignedLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
