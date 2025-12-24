
import { GoogleGenAI } from "@google/genai";
import { VoiceName } from '../types';

export class GeminiTTSService {
  async generateSpeech(text: string, voice: VoiceName): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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
        const textError = response.candidates?.[0]?.content?.parts?.[0]?.text;
        throw new Error(textError || "No audio data received. Please check your API key and input.");
      }
      return base64Audio;
    } catch (error: any) {
      console.error("Gemini TTS Error:", error);
      throw new Error(error.message || "Failed to communicate with the Gemini API.");
    }
  }
}

export const ttsService = new GeminiTTSService();

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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
