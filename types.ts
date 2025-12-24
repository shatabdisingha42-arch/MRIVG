
export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export interface VoiceOption {
  id: VoiceName;
  name: string;
  description: string;
  gender: 'Male' | 'Female' | 'Neutral';
}

export interface HistoryItem {
  id: string;
  text: string;
  voice: VoiceName;
  timestamp: number;
  audioData: string; // Base64 encoded PCM
}
