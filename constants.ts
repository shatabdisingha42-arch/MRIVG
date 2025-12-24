
import { VoiceOption, VoiceName } from './types';

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: VoiceName.Kore, name: 'Kore', description: 'Energetic and bright', gender: 'Female' },
  { id: VoiceName.Puck, name: 'Puck', description: 'Friendly and warm', gender: 'Male' },
  { id: VoiceName.Charon, name: 'Charon', description: 'Deep and authoritative', gender: 'Male' },
  { id: VoiceName.Fenrir, name: 'Fenrir', description: 'Calm and steady', gender: 'Male' },
  { id: VoiceName.Zephyr, name: 'Zephyr', description: 'Smooth and professional', gender: 'Female' },
];

export const SAMPLE_RATE = 24000;
