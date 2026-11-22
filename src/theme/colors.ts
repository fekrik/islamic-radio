import type { CategoryId } from '../types/radio';

export const COLORS = {
  bg: '#06120F',
  surface: '#0D1F1B',
  surfaceElevated: '#132B25',
  border: '#1E3B34',
  gold: '#E2B354',
  goldSoft: 'rgba(226, 179, 84, 0.14)',
  goldText: '#F5D283',
  live: '#EF4444',
  liveSoft: 'rgba(239, 68, 68, 0.16)',
  textPrimary: '#F8FAFC',
  textSecondary: '#9FB5AE',
  textMuted: '#62807A',
  white: '#FFFFFF',
  overlay: 'rgba(3, 10, 8, 0.72)',
} as const;

export const CATEGORY_GRADIENTS: Record<CategoryId, [string, string]> = {
  quran: ['#0F766E', '#042F2E'],
  reciters: ['#9A6B1C', '#4A2F08'],
  lectures: ['#1D4ED8', '#172554'],
  nasheed: ['#7E22CE', '#2E1065'],
  world: ['#0369A1', '#082F49'],
};

export const CATEGORY_ACCENTS: Record<CategoryId, string> = {
  quran: '#34D399',
  reciters: '#E2B354',
  lectures: '#60A5FA',
  nasheed: '#C084FC',
  world: '#38BDF8',
};
