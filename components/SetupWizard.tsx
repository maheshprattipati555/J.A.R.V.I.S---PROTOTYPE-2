import React, { useState } from 'react';
import { ArrowRight, Key, ShieldCheck, CheckCircle, ExternalLink } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';

interface SetupWizardProps {
  onComplete: (apiKey: string) => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!apiKey.startsWith('AIza')) {
      setError("Invalid Key. It should start with 'AIza'");
      return;
    }
    
    setIsVerifying(true);
    await Preferences.set({ key: 'jarvis_api_key', value: apiKey });
    
    setTimeout(() => {
        setIsVerifying(false);
        onComplete(apiKey);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center p-6 font-mono text-white">
      <div className="w-full max-w-md bg-gray-900/80 border border-jarvis-blue/30 p-8 rounded-2xl backdrop-blur-xl relative overflow-hidden">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 h-1 bg-gray-800 w-full">
            <div className="h-full bg-jarvis-blue transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div className="animate-fade-in space-y-6 text-center">
            <div className="w-20 h-20 bg-jarvis-blue/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <ShieldCheck className="w-10 h-10 text-jarvis-blue" />
            </div>
            <h1 className="text-2xl font-bold tracking-widest">J.A.R.V.I.S. PROTOCOL</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Welcome, Sir. To activate my neural engines, I require a connection to the <strong>Google Gemini Matrix</strong>.
            </p>
            <p className="text-xs text-gray-500 border border-gray-800 p-3 rounded">
                This app is free and private. You will use your own free API Key from Google.
            </p>
            <button onClick={() => setStep(2)} className="w-full bg-jarvis-blue text-black font-bold py-3 rounded hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2">
                INITIALIZE SETUP <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: TUTORIAL */}
        {step === 2 && (
          <div className="animate-fade-in space-y-6">
            <h2 className="text-xl font-bold text-jarvis-blue mb-4">ACQUIRE KEY</h2>
            
            <div className="space-y-4 text-sm text-gray-300">
                <div className="flex gap-3 items-start">
                    <div className="bg-gray-800 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0">1</div>
                    <p>Go to <strong>Google AI Studio</strong> (it's free).</p>
                </div>
                <div className="flex gap-3 items-start">
                    <div className="bg-gray-800 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0">2</div>
                    <p>Sign in with your Google Account.</p>
                </div>
                <div className="flex gap-3 items-start">
                    <div className="bg-gray-800 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0">3</div>
                    <p>Click the blue <strong>"Get API Key"</strong> button.</p>
                </div>
            </div>

            <button 
                onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
                className="w-full border border-jarvis-blue text-jarvis-blue py-3 rounded flex items-center justify-center gap-2 hover:bg-jarvis-blue/10 transition-colors"
            >
                OPEN GOOGLE AI STUDIO <ExternalLink className="w-4 h-4" />
            </button>

            <button onClick={() => setStep(3)} className="w-full bg-gray-800 text-white py-3 rounded hover:bg-gray-700 transition-colors">
                I HAVE THE KEY
            </button>
          </div>
        )}

        {/* STEP 3: PASTE KEY */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <h2 className="text-xl font-bold text-jarvis-blue">ESTABLISH LINK</h2>
            <p className="text-xs text-gray-400">Paste your API Key below to bring Jarvis online.</p>

            <div className="relative group">
                <Key className="absolute left-3 top-3.5 w-4 h-4 text-gray-500 group-focus-within:text-jarvis-blue transition-colors" />
                <input 
                    type="text" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-black/50 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white text-sm focus:border-jarvis-blue focus:ring-1 focus:ring-jarvis-blue outline-none transition-all font-mono"
                />
            </div>
            
            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button 
                onClick={handleSave} 
                disabled={!apiKey || isVerifying}
                className="w-full bg-jarvis-blue text-black font-bold py-3 rounded hover:bg-cyan-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isVerifying ? 'VERIFYING...' : 'CONNECT SYSTEMS'}
                {!isVerifying && <CheckCircle className="w-4 h-4" />}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SetupWizard;