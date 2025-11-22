
import React from 'react';
import { Timer, WeatherData, TodoItem } from '../types';
import { CloudSun, Clock, CheckSquare, AlertCircle, X, Activity, Moon, Sun } from 'lucide-react';

export const ContextWidget: React.FC<{ mood: string; timeOfDay: string; activity: string }> = ({ mood, timeOfDay, activity }) => {
    return (
      <div className="bg-jarvis-panel border border-jarvis-border p-3 rounded-lg backdrop-blur-md w-full mb-3 animate-fade-in">
        <div className="flex items-center gap-2 mb-2 text-jarvis-blue">
          <Activity className="w-4 h-4" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Context Awareness</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 p-2 rounded">
                <div className="text-[10px] text-gray-400 uppercase">Mood</div>
                <div className={`text-sm font-bold ${mood === 'HAPPY' ? 'text-green-400' : mood === 'SAD' ? 'text-blue-400' : 'text-white'}`}>
                    {mood}
                </div>
            </div>
            <div className="bg-black/30 p-2 rounded">
                <div className="text-[10px] text-gray-400 uppercase">Environment</div>
                <div className="text-sm font-bold text-white flex items-center gap-1">
                    {timeOfDay === 'Night' ? <Moon className="w-3 h-3 text-purple-400" /> : <Sun className="w-3 h-3 text-yellow-400" />}
                    {timeOfDay}
                </div>
            </div>
        </div>
      </div>
    );
};

export const WeatherWidget: React.FC<{ data: WeatherData | null }> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="bg-jarvis-panel border border-jarvis-border p-3 rounded-lg backdrop-blur-md w-full mb-3 animate-fade-in">
      <div className="flex items-center gap-2 mb-2 text-jarvis-blue">
        <CloudSun className="w-4 h-4" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Atmosphere</h3>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <div className="text-2xl font-mono">{data.temperature}°C</div>
          <div className="text-[10px] text-gray-400 font-mono uppercase">{data.location}</div>
        </div>
        <div className="text-sm text-cyan-100">{data.condition}</div>
      </div>
    </div>
  );
};

export const TimerWidget: React.FC<{ timers: Timer[], onCancel: (id: string) => void }> = ({ timers, onCancel }) => {
  if (timers.length === 0) return null;
  return (
    <div className="bg-jarvis-panel border border-jarvis-border p-3 rounded-lg backdrop-blur-md w-full mb-3">
      <div className="flex items-center gap-2 mb-2 text-jarvis-blue">
        <Clock className="w-4 h-4" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Chronometers</h3>
      </div>
      <div className="space-y-2">
        {timers.map(timer => (
          <div key={timer.id} className="flex justify-between items-center bg-black/40 p-2 rounded group">
            <div className="flex flex-col">
              <span className="text-xs text-gray-300">{timer.label || (timer.isAlarm ? 'Alarm' : 'Timer')}</span>
              {timer.isAlarm && <span className="text-[10px] text-gray-500">Target: {timer.originalTime}</span>}
            </div>
            <div className="flex items-center gap-2">
                <span className={`font-mono text-md ${timer.remaining < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {new Date(timer.remaining * 1000).toISOString().substr(11, 8)}
                </span>
                <button 
                    onClick={() => onCancel(timer.id)}
                    className="text-gray-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-white/5"
                    title="Cancel"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TodoWidget: React.FC<{ todos: TodoItem[] }> = ({ todos }) => {
  if (todos.length === 0) return null;
  return (
    <div className="bg-jarvis-panel border border-jarvis-border p-3 rounded-lg backdrop-blur-md w-full mb-3">
      <div className="flex items-center gap-2 mb-2 text-jarvis-blue">
        <CheckSquare className="w-4 h-4" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Tasks</h3>
      </div>
      <ul className="space-y-1">
        {todos.map(todo => (
          <li key={todo.id} className="flex items-center gap-2 text-xs">
             <div className={`w-1.5 h-1.5 rounded-full ${todo.completed ? 'bg-green-500' : 'bg-yellow-500'}`} />
             <span className={todo.completed ? 'line-through text-gray-500' : 'text-gray-200'}>{todo.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const AppStatusWidget: React.FC<{ activeApp: string | null }> = ({ activeApp }) => {
  if (!activeApp) return null;
  return (
     <div className="bg-jarvis-panel border border-jarvis-border p-3 rounded-lg backdrop-blur-md w-full mb-3">
      <div className="flex items-center gap-2 mb-2 text-jarvis-blue">
        <AlertCircle className="w-4 h-4" />
        <h3 className="text-xs font-bold uppercase tracking-wider">System</h3>
      </div>
      <div className="text-center">
        <span className="text-[10px] text-gray-400 uppercase">Process</span>
        <div className="text-lg text-white font-bold animate-pulse">{activeApp}</div>
      </div>
    </div>
  );
};
