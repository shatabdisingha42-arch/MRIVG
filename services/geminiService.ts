import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from '../types';

export class GeminiTTSService {
  async generateSpeech(text: string, voice: VoiceName): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ 
          parts: [{ 
            text: `TTS: ${text.trim()}` 
          }] 
        }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      const base64Audio = audioPart?.inlineData?.data;
      
      if (!base64Audio) {
        // Handle Safety Blocks specifically
        const safetyBlocked = response.candidates?.[0]?.finishReason === 'SAFETY';
        if (safetyBlocked) {
          throw new Error("Generation blocked: The content triggered safety filters. Please try neutral text.");
        }
        throw new Error("Empty audio response: The model might be overloaded. Try a shorter sentence.");
      }
      
      return base64Audio;
    } catch (error: any) {
      console.error("Gemini TTS Engine Error:", error);
      
      // Detailed error breakdown for Free Tier vs Paid Tier
      if (error.message?.includes('500') || error.message?.includes('INTERNAL')) {
        throw new Error("Temporary Server Congestion (500). This is common on Free Tier keys during peak hours. Please try again in a few seconds.");
      }
      
      if (error.message?.includes('429')) {
        throw new Error("Rate limit exceeded. As a Free Tier user, please wait 60 seconds before your next generation.");
      }
      
      if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('Requested entity')) {
        throw new Error("API Key Invalid: Ensure you have selected a valid key in the Health Panel.");
      }
      
      throw new Error(error.message || "The neural engine encountered an unexpected error.");
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
    throw new Error("Failed to decode audio data.");
  }
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const byteLength = data.byteLength;
  const alignedLength = Math.floor(byteLength / 2) * 2;
  const int16Buffer = new Int16Array(data.buffer, data.byteOffset, alignedLength / 2);
  const frameCount = int16Buffer.length / numChannels;
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = int16Buffer[i * numChannels + channel] / 32768.0;
    }
  }
  return audioBuffer;
}