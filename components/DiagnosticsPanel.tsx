import React, { useState, useEffect } from 'react';
import { initFirebase, getConfigDisplay, FirebaseApp } from '../services/firebase';
import { diagnoseGeminiConnection } from '../services/gemini';
import { StatusCard } from './StatusCard';
import { ShieldCheck, Server, Database, Code2, ChevronDown, ChevronUp, Sparkles, Github, XCircle, Settings } from 'lucide-react';

interface TestStep {
  id: string;
  title: string;
  description: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  details?: string;
}

const DEFAULT_CONFIG = {
  apiKey: "AIzaSyCjk5g2nAAClXrTY4LOSxAzS0YNE8lsSgw",
  authDomain: "studio-5674530481-7e956.firebaseapp.com",
  projectId: "studio-5674530481-7e956",
  storageBucket: "studio-5674530481-7e956.firebasestorage.app",
  messagingSenderId: "651553916706",
  appId: "1:651553916706:web:79ce4d5791126f3288877b"
};

interface DiagnosticsPanelProps {
  onClose: () => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ onClose }) => {
  const [appInstance, setAppInstance] = useState<FirebaseApp | null>(null);
  const [configInput, setConfigInput] = useState<string>(JSON.stringify(DEFAULT_CONFIG, null, 2));
  const [showConfig, setShowConfig] = useState(true);
  
  const [steps, setSteps] = useState<TestStep[]>([
    {
      id: 'config',
      title: 'Validación de Configuración',
      description: 'Analizando el JSON proporcionado.',
      status: 'idle'
    },
    {
      id: 'init',
      title: 'Inicialización del SDK Firebase',
      description: 'Ejecutando initializeApp() con la configuración.',
      status: 'idle'
    },
    {
      id: 'auth_module',
      title: 'Servicio de Autenticación',
      description: 'Verificando la instanciación del módulo Auth.',
      status: 'idle'
    },
    {
      id: 'gemini_api',
      title: 'Gemini API Diagnostics',
      description: 'Verificando conexión con Google GenAI (v2).',
      status: 'idle'
    }
  ]);

  const updateStep = (id: string, updates: Partial<TestStep>) => {
    setSteps(prev => prev.map(step => step.id === id ? { ...step, ...updates } : step));
  };

  const runTests = async () => {
    // Reset states
    setSteps(prev => prev.map(s => ({ ...s, status: 'idle', details: undefined })));
    setAppInstance(null);
    
    // 1. Check Config Input
    updateStep('config', { status: 'loading' });
    await new Promise(resolve => setTimeout(resolve, 400)); 
    
    let parsedConfig: any;
    try {
      parsedConfig = JSON.parse(configInput);
      
      if (!parsedConfig.apiKey || !parsedConfig.projectId) {
        throw new Error("El JSON debe contener al menos 'apiKey' y 'projectId'.");
      }

      const configDisplay = getConfigDisplay(parsedConfig);
      updateStep('config', { 
        status: 'success', 
        details: JSON.stringify(configDisplay, null, 2) 
      });
    } catch (e: any) {
      updateStep('config', { status: 'error', details: `JSON Inválido: ${e.message}` });
      return; // Stop here
    }

    // 2. Initialize App
    updateStep('init', { status: 'loading' });
    await new Promise(resolve => setTimeout(resolve, 600));

    // Note: initFirebase is async now because it might delete previous app
    const result = await initFirebase(parsedConfig);
    
    if (result.success && result.app) {
      setAppInstance(result.app);
      updateStep('init', { 
        status: 'success', 
        details: `App Name: "${result.app.name}"\nAutomatic Data Collection: ${result.app.automaticDataCollectionEnabled}`
      });
    } else {
      updateStep('init', { status: 'error', details: result.error?.message || result.message });
      return;
    }

    // 3. Check Auth Service
    updateStep('auth_module', { status: 'loading' });
    await new Promise(resolve => setTimeout(resolve, 600));
    
    if (result.auth) {
       updateStep('auth_module', { 
        status: 'success', 
        details: `Auth SDK cargado correctamente.\nCurrent User: ${result.auth.currentUser ? result.auth.currentUser.uid : 'null (No hay usuario logueado)'}`
      });
    } else {
       updateStep('auth_module', { status: 'error', details: 'No se pudo obtener la instancia de Auth.' });
    }

    // 4. Check Gemini API
    updateStep('gemini_api', { status: 'loading' });
    const geminiResult = await diagnoseGeminiConnection();
    
    if (geminiResult.success) {
      updateStep('gemini_api', {
        status: 'success',
        details: geminiResult.details
      });
    } else {
      updateStep('gemini_api', {
        status: 'error',
        details: geminiResult.message + (geminiResult.details ? `\n\n${geminiResult.details}` : '')
      });
    }
  };

  useEffect(() => {
    runTests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSuccess = steps.every(s => s.status === 'success');
  const hasError = steps.some(s => s.status === 'error');
  const isLoading = steps.some(s => s.status === 'loading');

  return (
    <div className="bg-slate-50 p-6 rounded-lg animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-6">
         <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-slate-600" />
                System Diagnostics
            </h2>
            <p className="text-slate-500 text-sm">Configuración y Pruebas de Conexión</p>
         </div>
         <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
             <span className="text-sm underline">Volver al Chat</span>
         </button>
      </div>

      {/* Configuration Section */}
      <div className="mb-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-slate-800 font-medium border-b border-slate-100"
        >
          <div className="flex items-center gap-2">
            <Code2 size={20} className="text-slate-500" />
            Configuración de Firebase (JSON)
          </div>
          {showConfig ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        
        {showConfig && (
          <div className="p-4">
            <p className="text-sm text-slate-500 mb-2">
              Pega aquí tu objeto <code>firebaseConfig</code>.
            </p>
            <textarea
              value={configInput}
              onChange={(e) => setConfigInput(e.target.value)}
              className="w-full h-32 p-4 font-mono text-xs md:text-sm bg-slate-900 text-green-400 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
              spellCheck={false}
            />
            <div className="mt-2 text-right">
               <button 
                 onClick={() => setConfigInput(JSON.stringify(DEFAULT_CONFIG, null, 2))}
                 className="text-xs text-slate-400 hover:text-slate-600 underline"
               >
                 Restaurar defecto
               </button>
            </div>
          </div>
        )}
      </div>

      {/* Overall Status Banner */}
      <div className={`mb-8 p-4 rounded-xl border shadow-sm flex items-center gap-4 ${
        hasError 
          ? 'bg-red-50 border-red-100 text-red-800' 
          : allSuccess 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
            : 'bg-white border-slate-200 text-slate-600'
      }`}>
        {hasError ? (
          <div className="bg-red-100 p-2 rounded-full"><XCircle size={24} /></div>
        ) : allSuccess ? (
          <div className="bg-emerald-100 p-2 rounded-full"><ShieldCheck size={24} /></div>
        ) : (
           <div className="bg-slate-100 p-2 rounded-full"><Settings size={24} className="animate-spin-slow" /></div>
        )}
        
        <div>
          <h2 className="font-bold text-lg">
            {hasError ? 'Error de Diagnóstico' : allSuccess ? 'Sistemas Operativos' : 'Ejecutando Diagnóstico...'}
          </h2>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-4">
        {steps.map((step) => (
          <StatusCard
            key={step.id}
            title={step.title}
            description={step.description}
            status={step.status}
            details={step.details}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={runTests}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-lg"
        >
          <Server size={18} />
          {isLoading ? 'Ejecutando...' : 'Ejecutar Diagnóstico Completo'}
        </button>
      </div>
      
       {/* Footer Info */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col items-center gap-2 text-xs text-slate-400">
          <a 
            href="https://github.com/AlejandroBarretoG/Gemini_API_Diagnostics_v2" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-slate-600 transition-colors"
          >
            <Github size={14} />
            Gemini API Diagnostics v2 Module
          </a>
        </div>
    </div>
  );
};