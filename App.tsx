
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { JarvisService } from './services/jarvisService';
import { AuthService } from './services/authService';
import JarvisOrb from './components/JarvisOrb';
import VisionOverlay from './components/VisionOverlay';
import HologramMode from './components/HologramMode';
import { WeatherWidget, TimerWidget, TodoWidget, AppStatusWidget, ContextWidget } from './components/Widgets';
import { LogEntry, WeatherData, Timer, TodoItem, ToolCallData, ChatMessage, UserProfile } from './types';
import { Mic, Power, Video, VideoOff, Keyboard, Radio, Terminal, Send, MessageSquare, Zap, Lock, Mail, User, ArrowRight, ShieldCheck, RefreshCw, Bell, Globe, Smartphone, CheckCircle, Chrome, Box, MessageCircle } from 'lucide-react';

// NOTE: In a real production environment, this key should be injected via build tools.
const API_KEY = process.env.API_KEY as string;

interface AppConfig {
  native: (cmd: string) => string;
  web: (cmd: string) => string;
}

// Configuration for deep linking and web fallbacks
const APP_LIBRARY: Record<string, AppConfig> = {
  'spotify': {
    native: (cmd) => cmd ? `spotify:search:${encodeURIComponent(cmd)}` : 'spotify:',
    web: (cmd) => cmd ? `https://open.spotify.com/search/${encodeURIComponent(cmd)}` : 'https://open.spotify.com'
  },
  'youtube': {
    native: (cmd) => cmd ? `vnd.youtube://results?search_query=${encodeURIComponent(cmd)}` : 'vnd.youtube://',
    web: (cmd) => cmd ? `https://www.youtube.com/results?search_query=${encodeURIComponent(cmd)}` : 'https://www.youtube.com'
  },
  'google maps': {
    native: (cmd) => cmd ? `geo:0,0?q=${encodeURIComponent(cmd)}` : 'geo:0,0',
    web: (cmd) => cmd ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cmd)}` : 'https://maps.google.com'
  },
  'gmail': {
    native: (cmd) => 'googlegmail://',
    web: (cmd) => 'https://mail.google.com'
  },
  'calculator': {
    native: () => 'calculator:',
    web: (cmd) => `https://www.google.com/search?q=${encodeURIComponent(cmd || 'calculator')}`
  },
  'phone': {
    native: (cmd) => `tel:${cmd}`,
    web: (cmd) => `https://www.google.com/search?q=${encodeURIComponent(cmd || 'phone')}`
  },
  'messages': {
    native: (cmd) => `sms:${cmd}`,
    web: () => 'https://messages.google.com/web'
  },
  'whatsapp': {
    native: (cmd) => 'whatsapp://',
    web: () => 'https://web.whatsapp.com'
  },
  'calendar': {
    native: () => 'content://com.android.calendar/time/', 
    web: () => 'https://calendar.google.com'
  },
  'google': {
    native: (cmd) => `googlechrome://www.google.com/search?q=${encodeURIComponent(cmd)}`,
    web: (cmd) => `https://www.google.com/search?q=${encodeURIComponent(cmd)}`
  }
};

// Type definition for Web Speech API
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
  gapi: any;
  google: any;
}

// --- SIMULATED NOTIFICATION COMPONENT ---
const SimulatedNotification: React.FC<{ title: string; message: string; time: string; type?: 'mail' | 'whatsapp'; onClose: () => void; action?: () => void }> = ({ title, message, time, type = 'mail', onClose, action }) => {
    return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-slide-down cursor-pointer" onClick={() => { action?.(); onClose(); }}>
            <div className="bg-white/90 backdrop-blur-xl text-black rounded-2xl shadow-2xl p-4 border border-gray-200 relative overflow-hidden">
                {/* Progress Bar for Auto Dismiss */}
                <div className={`absolute bottom-0 left-0 h-1 ${type === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'} animate-[width_6s_linear_forwards] w-full`} />
                
                <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                        <div className={`rounded p-1 ${type === 'whatsapp' ? 'bg-green-500' : 'bg-black'}`}>
                            {type === 'whatsapp' ? <MessageCircle className="w-3 h-3 text-white" /> : <Mail className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{time}</span>
                </div>
                <div className="pl-7">
                     <div className="font-bold text-sm">New Message</div>
                     <div className="text-sm text-gray-700 truncate">{message}</div>
                     {action && <div className={`mt-2 text-[10px] font-bold uppercase tracking-wide ${type === 'whatsapp' ? 'text-green-600' : 'text-blue-600'}`}>Tap to View</div>}
                </div>
            </div>
        </div>
    );
};

// --- WELCOME ANIMATION COMPONENT ---
const WelcomeAnimation: React.FC<{ userName: string, onComplete: () => void }> = ({ userName, onComplete }) => {
    const [status, setStatus] = useState('INITIALIZING CORE SYSTEMS...');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timeline = [
            { t: 500, msg: 'ESTABLISHING SECURE CONNECTION...', p: 20 },
            { t: 1500, msg: 'VERIFYING BIOMETRICS...', p: 45 },
            { t: 2500, msg: 'LOADING USER PREFERENCES...', p: 70 },
            { t: 3500, msg: `WELCOME BACK, ${userName.toUpperCase()}.`, p: 100 },
        ];

        timeline.forEach(step => {
            setTimeout(() => {
                setStatus(step.msg);
                setProgress(step.p);
            }, step.t);
        });

        setTimeout(onComplete, 4500);
    }, [userName, onComplete]);

    return (
        <div className="fixed inset-0 z-50 bg-[#050510] flex flex-col items-center justify-center font-mono text-jarvis-blue">
            <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
                 {/* Spinning Rings */}
                 <div className="absolute inset-0 border-2 border-jarvis-blue/20 rounded-full animate-spin-slow" />
                 <div className="absolute inset-4 border border-jarvis-blue/40 rounded-full animate-[spin_3s_linear_infinite_reverse]" style={{ borderStyle: 'dashed' }} />
                 <div className="absolute inset-12 border-4 border-t-jarvis-blue border-r-transparent border-b-jarvis-blue border-l-transparent rounded-full animate-spin" />
                 
                 <div className="text-4xl font-bold animate-pulse">J.A.R.V.I.S.</div>
            </div>
            
            <div className="w-64 space-y-2">
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-jarvis-blue transition-all duration-500 ease-out shadow-[0_0_10px_#00d8ff]" 
                        style={{ width: `${progress}%` }} 
                    />
                </div>
                <div className="flex justify-between text-[10px] tracking-widest">
                    <span>{status}</span>
                    <span>{progress}%</span>
                </div>
            </div>
        </div>
    );
};

// --- AUTHENTICATION SCREEN ---
const AuthScreen: React.FC<{ onLogin: (user: UserProfile) => void }> = ({ onLogin }) => {
  const [step, setStep] = useState<'signup' | 'verify'>('signup');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{title: string, message: string} | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('US');
  const [otp, setOtp] = useState('');

  const countries = [
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
      { code: 'CA', name: 'Canada', flag: '🇨🇦' },
      { code: 'DE', name: 'Germany', flag: '🇩🇪' },
      { code: 'FR', name: 'France', flag: '🇫🇷' },
      { code: 'JP', name: 'Japan', flag: '🇯🇵' },
      { code: 'IN', name: 'India', flag: '🇮🇳' },
      { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  ];

  const triggerNotification = (code: string) => {
      setNotification({
          title: 'MAIL • NOW',
          message: `Verification Code: ${code}`
      });
      setTimeout(() => setNotification(null), 6000);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await AuthService.signUp(name, email, password, country);
      if (result.success) {
        const emailResult = await AuthService.sendVerificationEmail(email);
        if (emailResult.code) {
            triggerNotification(emailResult.code);
        }
        setStep('verify');
      } else {
        setError(result.message || 'Registration failed.');
      }
    } catch (err) {
      setError('System error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'facebook') => {
      setIsLoading(true);
      try {
          const result = await AuthService.loginWithProvider(provider);
          if (result.success && result.user) {
              onLogin(result.user);
          }
      } catch (e) {
          setError("Social authentication failed.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await AuthService.verifyOTP(email, otp);
      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.message || 'Verification failed.');
      }
    } catch (err) {
      setError('Verification error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    const emailResult = await AuthService.sendVerificationEmail(email);
    setIsLoading(false);
    if (emailResult.code) {
        triggerNotification(emailResult.code);
    }
  };

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center relative overflow-hidden p-4 font-mono">
        {notification && (
            <SimulatedNotification 
                title={notification.title} 
                message={notification.message} 
                time="now"
                onClose={() => {
                    setOtp(notification.message.split(': ')[1]);
                    setNotification(null);
                }}
            />
        )}

        <div className="absolute inset-0 pointer-events-none">
             <div className="absolute inset-0 bg-[linear-gradient(rgba(0,216,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,216,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,216,255,0.05)_0%,transparent_70%)]" />
        </div>

        <div className="w-full max-w-[420px] relative z-10">
            <div className="bg-[#0a0a12]/90 backdrop-blur-xl border border-jarvis-blue/20 p-8 rounded-2xl shadow-[0_0_50px_rgba(0,216,255,0.1)] relative overflow-hidden">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 mb-4 relative">
                         <div className="absolute inset-0 bg-jarvis-blue blur-[20px] opacity-20 rounded-full animate-pulse"></div>
                         <ShieldCheck className="w-8 h-8 text-jarvis-blue relative z-10" />
                         <div className="absolute inset-0 border border-jarvis-blue/30 rounded-full animate-spin-slow" style={{ borderStyle: 'dashed' }}></div>
                    </div>
                    <h1 className="text-3xl font-bold text-white font-['Rajdhani'] tracking-[0.15em] mb-1">J.A.R.V.I.S.</h1>
                    <p className="text-jarvis-blue/60 text-[10px] tracking-[0.3em] uppercase">Stark Industries Secure Login</p>
                </div>

                {error && (
                  <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded flex items-center gap-2 animate-fade-in">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    {error}
                  </div>
                )}

                {step === 'signup' ? (
                  <div className="animate-fade-in">
                      <form onSubmit={handleSignup} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 uppercase tracking-wider ml-1">Name</label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-500 group-focus-within:text-jarvis-blue transition-colors" />
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full bg-black/40 border border-gray-800 rounded-lg py-2.5 pl-9 pr-2 text-white text-sm focus:border-jarvis-blue focus:ring-1 focus:ring-jarvis-blue outline-none transition-all"
                                        placeholder="Tony"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 uppercase tracking-wider ml-1">Region</label>
                                <div className="relative group">
                                    <Globe className="absolute left-3 top-3 w-4 h-4 text-gray-500 group-focus-within:text-jarvis-blue transition-colors" />
                                    <select 
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        className="w-full bg-black/40 border border-gray-800 rounded-lg py-2.5 pl-9 pr-2 text-white text-sm focus:border-jarvis-blue focus:ring-1 focus:ring-jarvis-blue outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        {countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider ml-1">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500 group-focus-within:text-jarvis-blue transition-colors" />
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-black/40 border border-gray-800 rounded-lg py-2.5 pl-9 pr-4 text-white text-sm focus:border-jarvis-blue focus:ring-1 focus:ring-jarvis-blue outline-none transition-all"
                                    placeholder="tony@stark.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500 group-focus-within:text-jarvis-blue transition-colors" />
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full bg-black/40 border border-gray-800 rounded-lg py-2.5 pl-9 pr-4 text-white text-sm focus:border-jarvis-blue focus:ring-1 focus:ring-jarvis-blue outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 bg-jarvis-blue hover:bg-cyan-400 text-black font-bold py-3 rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,216,255,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span className="tracking-widest text-xs">CREATE ACCOUNT</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                      </form>
                      
                      <div className="flex items-center my-6">
                          <div className="flex-1 h-px bg-gray-800"></div>
                          <span className="px-3 text-[10px] text-gray-500 uppercase tracking-widest">Or Connect With</span>
                          <div className="flex-1 h-px bg-gray-800"></div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                          <button onClick={() => handleSocialLogin('google')} className="flex items-center justify-center py-2.5 border border-gray-700 rounded-lg hover:bg-white/5 hover:border-white/30 transition-all">
                              <Chrome className="w-4 h-4 text-white" />
                          </button>
                          <button onClick={() => handleSocialLogin('apple')} className="flex items-center justify-center py-2.5 border border-gray-700 rounded-lg hover:bg-white/5 hover:border-white/30 transition-all">
                               <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-white"><path d="M12.95 2.14c.82-.99 2.1-1.74 3.4-1.74 0 0 .12 2.69-2.12 4.55-1.24 1.01-3.39 1.4-3.39 1.4s-.21-2.78 2.11-4.21m4.72 5.58c-2.49.13-4.47-1.39-5.66-1.39-1.34 0-3.66 1.61-3.66 4.46 0 3.87 3.39 9.35 6.3 9.31 1.45-.04 2.26-1.04 3.77-1.04 1.51 0 2.12 1.04 3.7 1.04 2.12-.04 3.61-2.74 4.64-5.12-2.96-1.35-3.37-6.06-.31-7.29-.73-1.95-2.35-3.36-4.27-3.55-1.87-.17-3.14 1.26-4.51 1.26"/></svg>
                          </button>
                          <button onClick={() => handleSocialLogin('facebook')} className="flex items-center justify-center py-2.5 border border-gray-700 rounded-lg hover:bg-white/5 hover:border-white/30 transition-all">
                              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-blue-500"><path d="M9.945 22v-8.834H7V9.485h2.945V6.54c0-3.043 1.926-4.54 4.64-4.54 1.3 0 2.418.097 2.744.14v3.18h-1.883c-1.476 0-1.82.703-1.82 1.732v2.433h3.68l-.736 3.68h-2.944V22"/></svg>
                          </button>
                      </div>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    <div className="text-center mb-6">
                       <div className="bg-jarvis-blue/10 border border-jarvis-blue/30 rounded-full p-4 inline-block mb-4 animate-pulse">
                          <Mail className="w-8 h-8 text-jarvis-blue" />
                       </div>
                       <h3 className="text-white text-lg font-medium mb-1">Verify Your Email</h3>
                       <p className="text-gray-400 text-xs leading-relaxed">
                         We've sent a secure 6-digit code to <br/><span className="text-jarvis-blue">{email}</span>.
                       </p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-6">
                        <div className="space-y-2">
                          <input 
                             type="text" 
                             value={otp}
                             onChange={(e) => {
                               const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                               setOtp(val);
                             }}
                             className="w-full bg-black/40 border border-jarvis-blue/50 rounded-lg py-4 text-center text-3xl text-white font-mono tracking-[0.5em] focus:border-jarvis-blue focus:ring-1 focus:ring-jarvis-blue outline-none transition-all placeholder-gray-700"
                             placeholder="000000"
                             autoFocus
                          />
                          <div className="flex justify-center">
                              {otp.length === 6 && <CheckCircle className="w-4 h-4 text-green-500 animate-bounce" />}
                          </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading || otp.length !== 6}
                            className="w-full bg-jarvis-blue hover:bg-cyan-400 text-black font-bold py-3 rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,216,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                           {isLoading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span className="tracking-wider text-xs">VERIFYING...</span>
                              </>
                          ) : (
                              <span className="tracking-widest text-xs">COMPLETE REGISTRATION</span>
                          )}
                        </button>

                        <div className="text-center">
                            <button 
                            type="button" 
                            onClick={handleResend}
                            className="text-[10px] text-gray-500 hover:text-jarvis-blue transition-colors underline"
                            >
                            Did not receive code? Resend
                            </button>
                        </div>
                    </form>
                  </div>
                )}
            </div>
            
            <div className="text-center mt-6 text-[10px] text-gray-600 font-mono">
               SECURE CONNECTION • ENCRYPTED AES-256
            </div>
        </div>
    </div>
  );
};

// --- MAIN DASHBOARD (Formerly App) ---
const Dashboard: React.FC<{ user: UserProfile; onLogout: () => void }> = ({ user, onLogout }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [hologramMode, setHologramMode] = useState(false);
  const [hologramLibraryVisible, setHologramLibraryVisible] = useState(true);
  const [currentHologramShape, setCurrentHologramShape] = useState<string>('reactor');
  const [currentMood, setCurrentMood] = useState('NEUTRAL');
  const [contextData, setContextData] = useState({ timeOfDay: 'Day', activity: 'Idle' });
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [isStandby, setIsStandby] = useState(true);
  const [isTypeMode, setIsTypeMode] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [notification, setNotification] = useState<{title: string, message: string, time: string, type?: 'mail' | 'whatsapp', action?: () => void} | null>(null);

  const jarvisRef = useRef<JarvisService | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContextUpdate = useRef<number>(0);
  const isTypeModeRef = useRef(isTypeMode);

  useEffect(() => {
    if (!API_KEY) {
      setApiKeyMissing(true);
      addLog("CRITICAL ERROR: API_KEY not found in environment variables.", "system", "error");
    }
  }, []);

  useEffect(() => {
    isTypeModeRef.current = isTypeMode;
  }, [isTypeMode]);

  useEffect(() => {
      const checkContext = () => {
          const hour = new Date().getHours();
          let timeOfDay = 'Night';
          if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
          else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
          else if (hour >= 17 && hour < 22) timeOfDay = 'Evening';
          
          setContextData(prev => {
              if (prev.timeOfDay !== timeOfDay) {
                  return { ...prev, timeOfDay };
              }
              return prev;
          });
      };
      checkContext();
      const interval = setInterval(checkContext, 60000); 
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isThinking) {
        if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = setTimeout(() => {
            setIsThinking(false);
            addLog("Response timed out.", "system", "error");
        }, 10000); 
    } else {
        if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
    }
    return () => {
        if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
    };
  }, [isThinking]);

  const addLog = useCallback((message: string, source: LogEntry['source'], type: LogEntry['type'] = 'text') => {
    setLogs(prev => [...prev, { timestamp: new Date(), source, message, type }].slice(-50));
  }, []);

  const addChatMessage = useCallback((text: string, role: 'user' | 'model' | 'system', isStreaming: boolean = false, isSystemEvent: boolean = false) => {
    setChatHistory(prev => {
        if (role === 'model' || role === 'system') setIsThinking(false);
        const lastMsg = prev[prev.length - 1];
        if (isStreaming && role === 'model' && lastMsg && lastMsg.role === 'model') {
            return [
                ...prev.slice(0, -1),
                { ...lastMsg, text: lastMsg.text + text, timestamp: new Date() }
            ];
        }
        return [...prev, {
            id: Math.random().toString(36).substring(7),
            role,
            text,
            timestamp: new Date(),
            isSystemEvent
        }];
    });
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTypeMode, isThinking]);

  useEffect(() => {
    if (jarvisRef.current) {
      jarvisRef.current.setAudioOutputEnabled(!isTypeMode);
    }
  }, [isTypeMode, isConnected]);

  // --- ROBUST WAKE WORD LISTENER ---
  useEffect(() => {
    // If connected or missing key, stop listening for wake word
    if (isConnected || apiKeyMissing) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
      return;
    }

    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechRecognitionApi = SpeechRecognition || webkitSpeechRecognition;
    if (!SpeechRecognitionApi) return;

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim().toLowerCase();
      
      if (transcript.includes('jarvis')) {
        addLog("Wake word 'Jarvis' detected.", "system");
        toggleConnection(true);
      }
    };

    // CRITICAL: Auto-restart logic to simulate "Always On" listener
    // Browsers will stop recognition after silence or error. We must restart it.
    recognition.onend = () => {
        if (!isConnected && !apiKeyMissing) {
            // Avoid rapid restart loops if permission is denied
            setTimeout(() => {
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Wake word listener failed to restart", e);
                }
            }, 100);
        }
    };

    recognition.onerror = (event: any) => {
        console.warn("Speech recognition error", event.error);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {}

    return () => {
      if (recognitionRef.current) {
          // Remove handler to prevent restart during cleanup
          recognitionRef.current.onend = null; 
          try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [isConnected, apiKeyMissing, addLog]);

  const playAlarmSound = useCallback(() => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 1);
        osc.start();
        osc.stop(ctx.currentTime + 1);
    } catch(e) { console.error("Audio play failed", e); }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const now = Date.now();
        const updated = prev.map(t => {
          if (t.status === 'running') {
            if (t.remaining > 0) {
              return { ...t, remaining: t.remaining - 1 };
            } else {
              addLog(`${t.isAlarm ? 'Alarm' : 'Timer'} "${t.label}" finished.`, 'jarvis', 'text');
              playAlarmSound();
              setTimeout(playAlarmSound, 800);
              return { ...t, status: 'finished', finishedAt: now } as Timer & { finishedAt?: number };
            }
          }
          return t;
        });
        return updated.filter(t => {
           if (t.status === 'finished' && (t as any).finishedAt) return now - ((t as any).finishedAt || 0) < 8000;
           return true;
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [addLog, playAlarmSound]);

  const handleToolCall = async (toolCall: ToolCallData): Promise<any> => {
    const { name, args } = toolCall;
    switch (name) {
      case 'setTimer':
        setTimers(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          label: args.label || 'Timer',
          duration: args.seconds,
          remaining: args.seconds,
          status: 'running'
        }]);
        return { success: true, message: `Timer set for ${args.seconds} seconds.` };
      case 'cancelTimer':
        let removedCount = 0;
        setTimers(prev => {
            const filtered = prev.filter(t => {
                const match = args.label ? t.label.toLowerCase().includes(args.label.toLowerCase()) : false;
                if (args.label && match) { removedCount++; return false; }
                return true;
            });
            if (!args.label && prev.length > 0) { const newArr = [...prev]; newArr.pop(); removedCount++; return newArr; }
            return filtered;
        });
        if (removedCount > 0) return { success: true, message: `Stopped ${removedCount} timer(s).` };
        return { success: false, message: "No matching timers found." };
      case 'setAlarm':
         const now = new Date();
         const [hours, minutes] = args.time.replace(/[^0-9:]/g, '').split(':').map(Number);
         if (isNaN(hours)) return { error: "Could not parse time" };
         let target = new Date(now);
         target.setHours(hours, minutes || 0, 0, 0);
         if (target <= now) target.setDate(target.getDate() + 1);
         const diffSeconds = Math.floor((target.getTime() - now.getTime()) / 1000);
         setTimers(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            label: args.label || 'Alarm',
            duration: diffSeconds,
            remaining: diffSeconds,
            status: 'running',
            isAlarm: true,
            originalTime: args.time
         }]);
         return { success: true, time: args.time };
      case 'getWeather':
        const temp = Math.floor(Math.random() * 15) + 15;
        const condition = ['Clear', 'Cloudy', 'Rain', 'Drizzle'][Math.floor(Math.random() * 4)];
        setWeather({ location: args.location, temperature: temp, condition });
        return { temperature: temp, condition, location: args.location };
      case 'changeVolume':
         const newVol = args.level;
         jarvisRef.current?.setVolume(newVol / 100);
         return { volume: newVol };
      case 'toggleLights':
        addLog(`Smart Home: Turning lights ${args.state} in ${args.room || 'the house'}.`, 'system', 'tool');
        return { status: 'success', state: args.state };
      case 'launchApp':
        const appKey = args.appName.toLowerCase();
        const command = args.command || '';
        let config = APP_LIBRARY[appKey] || APP_LIBRARY[Object.keys(APP_LIBRARY).find(k => appKey.includes(k)) || 'google'];
        addLog(`Launching ${args.appName} ${command ? `with command: ${command}` : ''}`, 'system', 'tool');
        window.open(config.native(command), '_blank');
        setTimeout(() => window.open(config.web(command), '_blank'), 500);
        setActiveApp(args.appName);
        return { status: 'launched', app: args.appName, command: command };
      case 'googleSearch':
        addLog(`Accessing global information grid: "${args.query}"`, 'system', 'tool');
        return { results: [{ title: `Search Results for ${args.query}`, snippet: `Found relevant data on the web regarding ${args.query}.` }] };
      case 'changeHologramShape':
          const shape = args.shape.toLowerCase();
          setCurrentHologramShape(shape);
          setHologramLibraryVisible(false); // Auto-hide when shape is chosen
          if (!hologramMode) {
              setHologramMode(true);
              setVideoEnabled(false);
          }
          addLog(`Rendering holographic schematic: ${shape}`, 'system', 'tool');
          return { success: true, shape };
      case 'controlHologram':
          const action = args.action;
          if (action === 'open_menu') {
              setHologramLibraryVisible(true);
              if (!hologramMode) {
                  setHologramMode(true);
                  setVideoEnabled(false);
              }
          } else if (action === 'close_menu') {
              setHologramLibraryVisible(false);
          }
          addLog(`Hologram Interface: ${action.replace('_', ' ').toUpperCase()}`, 'system', 'tool');
          return { success: true, action };
      case 'sendEmail':
          const sender = user?.email || 'unknown';
          const isGmail = sender.includes('@gmail.com') || user?.authProvider === 'google';
          
          // GMAIL API SIMULATION SEQUENCE
          if (isGmail) {
              addLog(`Initializing Gmail API Client...`, 'system', 'tool');
              await new Promise(r => setTimeout(r, 600));
              
              addLog(`Authenticating OAuth2 Scope: https://www.googleapis.com/auth/gmail.send`, 'system', 'tool');
              await new Promise(r => setTimeout(r, 800));
              
              addLog(`Constructing RFC 2822 MIME Message...`, 'system', 'tool');
              await new Promise(r => setTimeout(r, 500));
          } else {
              addLog(`Connecting to SMTP Relay for ${sender.split('@')[1] || 'host'}...`, 'system', 'tool');
              await new Promise(r => setTimeout(r, 1500));
          }
          
          addLog(`DISPATCHING ENCRYPTED TRANSMISSION...`, 'jarvis', 'text');
          
          // Create trigger for opening the actual email if desired
          const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${args.recipient}&su=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(args.body)}`;
          
          setNotification({
              title: 'EMAIL SENT',
              message: `To: ${args.recipient}`,
              time: 'now',
              type: 'mail',
              action: () => window.open(gmailLink, '_blank')
          });

          addLog(`Sent via ${isGmail ? 'Google API v1' : 'SMTP'}. Recipient: ${args.recipient}`, 'system', 'text');
          return { status: 'sent', from: sender, provider: isGmail ? 'gmail_api' : 'smtp' };
      
      case 'sendWhatsApp':
          addLog(`Initializing WhatsApp Secure Bridge...`, 'system', 'tool');
          await new Promise(r => setTimeout(r, 800));
          
          const cleanNumber = args.phoneNumber.replace(/[^0-9]/g, '');
          addLog(`Resolving ID for +${cleanNumber}...`, 'system', 'tool');
          
          // Universal Link for WhatsApp
          const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(args.message)}`;
          
          setNotification({
              title: 'WHATSAPP • SENT',
              message: `To: ${args.phoneNumber}`,
              time: 'now',
              type: 'whatsapp',
              action: () => window.open(waLink, '_blank')
          });
          
          addLog(`Message dispatched via WA Gateway.`, 'system', 'text');
          return { status: 'sent', recipient: args.phoneNumber };
          
      case 'disengage':
         addLog("Disengage protocol initiated.", "system");
         setTimeout(() => toggleConnection(false), 1000);
         return { status: "disengaging" };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };

  const handleCancelTimer = (id: string) => { setTimers(prev => prev.filter(t => t.id !== id)); addLog("Timer manually cancelled.", "user"); };

  const handleMoodChange = useCallback((newMood: string) => {
      if (newMood !== currentMood) {
          setCurrentMood(newMood);
          if (isConnected && jarvisRef.current) {
              const now = Date.now();
              if (now - lastContextUpdate.current > 10000) {
                  lastContextUpdate.current = now;
                  jarvisRef.current.sendContextUpdate(`Visual Sensors Update: User appears ${newMood}. Time is ${contextData.timeOfDay}.`);
                  addLog(`Biometric update sent: ${newMood}`, "system");
              }
          }
      }
  }, [currentMood, isConnected, contextData.timeOfDay, addLog]);

  const toggleConnection = async (forceState?: boolean) => {
    const targetState = forceState !== undefined ? forceState : !isConnected;
    if (!targetState) {
      await jarvisRef.current?.disconnect();
      setIsConnected(false); setVideoEnabled(false); setIsStandby(true); setIsTypeMode(false);
      addLog("Systems powered down. Standby mode.", "system");
    } else {
      if (apiKeyMissing) return;
      setIsConnecting(true); setIsStandby(false);
      try {
          const service = new JarvisService(API_KEY);
          jarvisRef.current = service;
          await service.connect(
              (msg, src, type, isStreaming) => {
                  if (type === 'turnComplete') { setIsThinking(false); return; }
                  if (type === 'text' && src === 'jarvis') { if (isTypeModeRef.current) addChatMessage(msg, 'model', isStreaming); if (!isStreaming) addLog(msg, src, type as any); }
                  else if (type === 'tool') { if (isTypeModeRef.current) addChatMessage(msg, 'system', false, true); addLog(msg, src, type); }
                  else { addLog(msg, src, type as any); }
              },
              handleToolCall,
              (level) => setAudioLevel(level),
              user // Pass full user object for context injection
          );
          setIsConnected(true);
          addLog(`Voice interface engaged. Welcome back, ${user.name}.`, "system");
      } catch (error) { console.error(error); addLog("Connection failed. Check console.", "system", "error"); setIsStandby(true); } finally { setIsConnecting(false); }
    }
  };

  const toggleTypeMode = () => { if (!isConnected) toggleConnection(true).then(() => setIsTypeMode(true)); else setIsTypeMode(prev => !prev); };
  const toggleVisionMode = () => { if (!isConnected) toggleConnection(true).then(() => { setVideoEnabled(true); setHologramMode(false); }); else { setVideoEnabled(prev => !prev); setHologramMode(false); } };
  
  const toggleHologramMode = () => {
      if (!isConnected) {
          toggleConnection(true).then(() => {
              setHologramMode(true);
              setVideoEnabled(false);
              setHologramLibraryVisible(true);
              // Signal the model
              jarvisRef.current?.sendContextUpdate("System Event: Holographic Mode activated. Ask the user: 'Which shape or object are you searching for?'");
          });
      } else {
          setHologramMode(prev => {
              const newState = !prev;
              if (newState) {
                  setVideoEnabled(false);
                  setHologramLibraryVisible(true);
                  jarvisRef.current?.sendContextUpdate("System Event: Holographic Mode activated. Ask the user: 'Which shape or object are you searching for?'");
              }
              return newState;
          });
      }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); if (!inputText.trim()) return;
      if (!isConnected || !jarvisRef.current) { addLog("System offline. Initializing...", "system"); return; }
      addChatMessage(inputText, 'user'); setIsThinking(true);
      try { await jarvisRef.current.sendText(inputText); } catch (e) { console.error(e); setIsThinking(false); addLog("Failed to transmit command.", "system", "error"); }
      setInputText('');
  };

  return (
    <div className="min-h-screen bg-jarvis-bg text-jarvis-blue font-mono relative overflow-hidden selection:bg-jarvis-blue selection:text-jarvis-bg">
      {notification && (
          <SimulatedNotification 
              title={notification.title} 
              message={notification.message} 
              time={notification.time}
              type={notification.type}
              onClose={() => setNotification(null)}
              action={notification.action}
          />
      )}

      {videoEnabled && isConnected && ( <VisionOverlay isActive={videoEnabled} onLog={(msg) => addLog(msg, 'system')} audioLevel={audioLevel} onVideoFrame={(base64) => jarvisRef.current?.sendVideoFrame(base64)} onMoodChange={handleMoodChange} /> )}
      {hologramMode && isConnected && ( <HologramMode onClose={() => setHologramMode(false)} shape={currentHologramShape} showLibrary={hologramLibraryVisible} onSelectShape={() => setHologramLibraryVisible(false)} /> )}
      {!videoEnabled && !hologramMode && ( <div className="absolute inset-0 pointer-events-none"><div className="absolute inset-0 bg-[linear-gradient(rgba(0,216,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,216,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,16,0.8)_100%)]" /></div> )}

      <div className={`relative z-10 flex flex-col h-screen p-4 md:p-6 max-w-7xl mx-auto transition-opacity duration-500 ${videoEnabled || hologramMode ? 'bg-black/10' : ''}`}>
        <header className="flex justify-between items-center mb-4 border-b border-jarvis-border/30 pb-4 bg-black/20 backdrop-blur-sm rounded-lg p-2">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-white shadow-black drop-shadow-md" style={{ fontFamily: 'Rajdhani' }}>J.A.R.V.I.S.</h1>
            <div className="flex items-center gap-2 text-xs text-jarvis-blue/60"><span className="w-2 h-2 bg-jarvis-blue rounded-full animate-pulse" /><span className="shadow-black drop-shadow-sm">STARK INDUSTRIES // MARK VII</span></div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden md:block"><div className="text-xs text-gray-400">AUTHORIZED PERSONNEL</div><div className="text-sm font-mono text-white">{user.name.toUpperCase()}</div></div>
             <button onClick={onLogout} className="text-xs text-red-500 hover:text-red-400 border border-red-900/30 px-2 py-1 rounded hover:bg-red-500/10 transition-colors backdrop-blur-md bg-black/40">LOGOUT</button>
             <div className={`px-3 py-1 rounded border backdrop-blur-md bg-black/40 ${isConnected ? 'border-jarvis-blue text-jarvis-blue' : 'border-red-500/50 text-red-500'}`}>{isConnected ? 'ONLINE' : 'OFFLINE'}</div>
          </div>
        </header>

        <main className="flex-1 flex flex-col md:flex-row gap-6 relative overflow-hidden min-h-0">
          <div className={`w-full md:w-1/4 flex flex-col gap-4 z-20 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${videoEnabled || hologramMode ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
            <ContextWidget mood={currentMood} timeOfDay={contextData.timeOfDay} activity={contextData.activity} />
            <WeatherWidget data={weather} />
            <AppStatusWidget activeApp={activeApp} />
            <div className="bg-jarvis-panel border border-jarvis-border p-3 rounded-lg hidden md:block backdrop-blur-md"><div className="flex justify-between text-xs mb-1 text-gray-400"><span>CPU</span><span>{isConnected ? Math.floor(Math.random() * 30 + 10) : 0}%</span></div><div className="w-full bg-gray-800 h-1 rounded mb-3"><div className="bg-jarvis-blue h-1 rounded" style={{ width: isConnected ? '35%' : '0%' }} /></div><div className="flex justify-between text-xs mb-1 text-gray-400"><span>MEMORY</span><span>{isConnected ? '12.4 TB' : '0 TB'}</span></div><div className="w-full bg-gray-800 h-1 rounded"><div className="bg-purple-500 h-1 rounded" style={{ width: isConnected ? '62%' : '0%' }} /></div></div>
          </div>

          <div className="w-full md:w-1/2 flex flex-col relative min-h-[300px] h-full pointer-events-none">
             {isTypeMode ? (
                 <div className="flex flex-col h-full bg-black/40 rounded-lg border border-jarvis-border/30 backdrop-blur-md overflow-hidden animate-fade-in pointer-events-auto">
                     <div className="flex items-center gap-2 p-3 border-b border-jarvis-border/30 bg-black/50"><MessageSquare className="w-4 h-4 text-jarvis-blue" /><span className="text-xs font-bold tracking-widest text-jarvis-blue">SECURE TEXT LINK</span></div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {chatHistory.length === 0 && !isThinking && (<div className="text-center text-gray-500 text-sm mt-10">Secure text protocol initialized. Waiting for input.</div>)}
                        {chatHistory.map((msg) => (<div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${msg.isSystemEvent ? 'justify-center' : ''}`}>{msg.isSystemEvent ? (<div className="flex items-center gap-1.5 bg-jarvis-blue/10 border border-jarvis-blue/20 rounded-full px-3 py-1"><Zap className="w-3 h-3 text-yellow-400" /><span className="text-[10px] uppercase tracking-wider text-cyan-200">{msg.text.replace('Executing protocol:', '').trim()}</span></div>) : (<div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-jarvis-blue/20 text-cyan-100 border border-jarvis-blue/30 rounded-tr-none' : 'bg-gray-800/80 text-gray-200 border border-gray-700 rounded-tl-none'}`}><p className="whitespace-pre-wrap">{msg.text}</p><span className="text-[10px] opacity-50 block mt-1 text-right">{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>)}</div>))}
                        {isThinking && (<div className="flex justify-start"><div className="bg-gray-800/80 border border-gray-700 rounded-lg rounded-tl-none p-3 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-jarvis-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><div className="w-1.5 h-1.5 bg-jarvis-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-1.5 h-1.5 bg-jarvis-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div></div>)}
                        <div ref={chatEndRef} />
                     </div>
                     <div className="p-3 bg-black/60 border-t border-jarvis-border/30"><form onSubmit={handleTextSubmit} className="flex gap-2"><input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type command..." className="flex-1 bg-black/40 border border-jarvis-blue/30 text-white font-mono text-sm p-3 rounded hover:border-jarvis-blue/60 focus:outline-none focus:border-jarvis-blue focus:ring-1 focus:ring-jarvis-blue transition-all placeholder-gray-600" autoFocus /><button type="submit" disabled={!inputText.trim()} className="bg-jarvis-blue/10 text-jarvis-blue border border-jarvis-blue/30 p-3 rounded hover:bg-jarvis-blue/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Send className="w-4 h-4" /></button></form></div>
                 </div>
             ) : (
                 !videoEnabled && !hologramMode && (<div className="flex flex-col items-center justify-center h-full pointer-events-auto"><JarvisOrb isActive={isConnected} audioLevel={audioLevel} /><div className="absolute bottom-4 text-center transition-opacity duration-500">{isConnecting ? (<span className="text-jarvis-blue animate-pulse">INITIALIZING CONNECTION...</span>) : isStandby ? (<span className="text-gray-600">LISTENING FOR 'JARVIS'</span>) : (<span className="text-jarvis-blue tracking-widest text-sm animate-pulse-slow">LISTENING ON CHANNEL SECURE</span>)}</div></div>)
             )}
          </div>

          <div className={`w-full md:w-1/4 flex flex-col gap-4 z-20 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${videoEnabled || hologramMode ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
            <TimerWidget timers={timers} onCancel={handleCancelTimer} />
            <TodoWidget todos={todos} />
          </div>
        </main>

        <footer className="mt-4 flex flex-col md:flex-row gap-4 items-stretch h-48 md:h-40 flex-shrink-0 z-20">
           <div className="flex-1 bg-black/60 border border-jarvis-border/30 rounded-lg p-3 font-mono text-xs overflow-y-auto custom-scrollbar relative backdrop-blur-md">
              <div className="sticky top-0 bg-black/80 backdrop-blur w-full pb-2 mb-2 border-b border-white/10 flex items-center gap-2"><Terminal className="w-3 h-3 text-jarvis-blue" /><span className="text-gray-400">SYSTEM OPERATIONS LOG</span></div>
              <div className="space-y-1">{logs.length === 0 && <span className="text-gray-600 italic">System ready. Waiting for events.</span>}{logs.map((log, i) => (<div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' : log.source === 'user' ? 'text-white' : 'text-cyan-300'}`}><span className="text-gray-600">[{log.timestamp.toLocaleTimeString()}]</span><span className="uppercase opacity-70 w-16 text-[10px] tracking-wider">{log.source}</span><span>{log.message}</span></div>))}<div ref={logsEndRef} /></div>
           </div>

           <div className="w-full md:w-auto flex md:flex-col gap-2 justify-center min-w-[120px]">
              <button onClick={() => toggleConnection()} disabled={isConnecting || apiKeyMissing} className={`flex-1 md:flex-auto flex items-center justify-center gap-2 p-4 rounded-lg border transition-all duration-300 hover:scale-[1.02] active:scale-95 backdrop-blur-md ${isConnected ? 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-jarvis-blue/10 border-jarvis-blue text-jarvis-blue hover:bg-jarvis-blue/20 shadow-[0_0_15px_rgba(0,216,255,0.3)]'} disabled:opacity-50 disabled:cursor-not-allowed`}>{isConnecting ? (<div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />) : (isConnected ? <Power className="w-6 h-6" /> : <Mic className="w-6 h-6" />)}<span className="font-bold">{isConnected ? 'DISENGAGE' : 'INITIALIZE'}</span></button>
              <div className="flex gap-2 h-12">
                  <button onClick={toggleVisionMode} disabled={!isConnected} className={`flex-1 flex items-center justify-center rounded border transition-colors backdrop-blur-md ${videoEnabled ? 'bg-jarvis-blue text-black border-jarvis-blue shadow-[0_0_10px_rgba(0,216,255,0.4)]' : 'bg-black/40 border-gray-700 text-gray-500 hover:border-jarvis-blue hover:text-jarvis-blue'}`} title="Toggle Visual Sensors (AR)">{videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}</button>
                  <button onClick={toggleHologramMode} disabled={!isConnected} className={`flex-1 flex items-center justify-center rounded border transition-colors backdrop-blur-md ${hologramMode ? 'bg-jarvis-blue text-black border-jarvis-blue shadow-[0_0_10px_rgba(0,216,255,0.4)]' : 'bg-black/40 border-gray-700 text-gray-500 hover:border-jarvis-blue hover:text-jarvis-blue'}`} title="Holographic Interface"><Box className="w-4 h-4" /></button>
                  <button onClick={toggleTypeMode} className={`flex-1 flex items-center justify-center rounded border transition-colors backdrop-blur-md ${isTypeMode ? 'bg-jarvis-blue text-black border-jarvis-blue shadow-[0_0_10px_rgba(0,216,255,0.4)]' : 'bg-black/40 border-gray-700 text-gray-500 hover:border-white hover:text-white'}`} title={isTypeMode ? "Switch to Voice Mode" : "Switch to Type Mode"}><Keyboard className="w-4 h-4" /></button>
              </div>
           </div>
        </footer>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(AuthService.getCurrentUser());
  const [showWelcome, setShowWelcome] = useState<boolean>(!!AuthService.getCurrentUser());

  const handleLogin = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setShowWelcome(true);
  };

  const handleLogout = () => {
    AuthService.logout();
    setUser(null);
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (showWelcome) {
    return (
      <WelcomeAnimation 
        userName={user.name} 
        onComplete={() => setShowWelcome(false)} 
      />
    );
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
};

export default App;
