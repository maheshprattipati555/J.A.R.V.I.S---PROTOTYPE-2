
export interface ToolCallData {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface LogEntry {
  timestamp: Date;
  source: 'user' | 'jarvis' | 'system';
  message: string;
  type: 'text' | 'tool' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  isSystemEvent?: boolean;
}

export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
}

export interface Timer {
  id: string;
  label: string;
  duration: number; // in seconds
  remaining: number;
  status: 'running' | 'paused' | 'finished';
  isAlarm?: boolean;
  originalTime?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface JarvisState {
  isConnected: boolean;
  isListening: boolean;
  volumeLevel: number; // Audio visualizer level
  systemVolume: number; // Actual output gain 0-100
  logs: LogEntry[];
  weather: WeatherData | null;
  timers: Timer[];
  todos: TodoItem[];
  activeApp: string | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  country: string;
  authProvider: 'email' | 'google' | 'apple' | 'facebook';
  verified: boolean;
  createdAt: string; // ISO Date string
}

export type VisionGesture = 'BLINK' | 'NOD' | 'ATTENTION' | 'NONE';

export enum AppMode {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  SPEAKING = 'SPEAKING',
  PROCESSING = 'PROCESSING'
}