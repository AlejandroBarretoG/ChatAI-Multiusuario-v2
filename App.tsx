import React, { useState, useRef, useEffect } from 'react';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { sendChatMessage } from './services/gemini';
import { initFirebase, subscribeToMessages, sendMessageToDB } from './services/firebase';
import { Send, Settings, User, Bot, Sparkles, MoreVertical, Users, X } from 'lucide-react';
import { Content } from '@google/genai';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  userName: string;
  text: string;
  timestamp: Date;
}

const App: React.FC = () => {
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState("Usuario 1");
  const [showUserList, setShowUserList] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Firebase on load to ensure DB connection exists
  useEffect(() => {
    initFirebase();
  }, []);

  // Subscribe to Real-time Database updates
  useEffect(() => {
    const unsubscribe = subscribeToMessages((newMessages) => {
        setMessages(newMessages);
    });
    return () => unsubscribe();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Derive active users from message history + current user + AI
  const getActiveUsers = () => {
    const users = new Set<string>();
    users.add('Gemini AI');
    users.add(currentUser);
    
    // Look back at last 50 messages for active users
    messages.slice(-50).forEach(m => {
        if(m.sender === 'user') users.add(m.userName);
    });
    return Array.from(users);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const textToSend = inputValue;
    const userSending = currentUser;
    
    setInputValue('');
    
    try {
      // 1. Send user message to Cloud Firestore
      // This will automatically update the UI via the subscription above
      await sendMessageToDB(textToSend, userSending, 'user');
      
      setIsLoading(true);

      // 2. Prepare context for Gemini
      const history: Content[] = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.sender === 'user' ? `[Usuario: ${msg.userName}] ${msg.text}` : msg.text }]
      }));

      const prompt = `[Usuario: ${userSending}] ${textToSend}`;

      // 3. Get AI Response
      const responseText = await sendChatMessage(prompt, history);

      // 4. Send AI message to Cloud Firestore
      // Everyone connected will see this appear
      if (responseText) {
          await sendMessageToDB(responseText, 'Gemini AI', 'ai');
      }

    } catch (error) {
      console.error("Error sending message:", error);
      // Fallback for error locally
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'ai',
        userName: 'System',
        text: "Error procesando mensaje. Verifica tu conexión.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans overflow-hidden">
      
      {/* Sidebar / Navigation */}
      <aside className="bg-slate-900 text-white w-full md:w-64 flex-shrink-0 flex flex-col border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
             <Sparkles size={16} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Multi-User Chat</h1>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-6">
             <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tu Identidad</h3>
             <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <label className="text-xs text-slate-400 block mb-1">Nombre de usuario actual</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={currentUser}
                        onChange={(e) => setCurrentUser(e.target.value)}
                        className="bg-slate-900 text-white text-sm rounded px-2 py-1 w-full border border-slate-700 focus:border-blue-500 outline-none"
                    />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                    Este nombre aparecerá en los mensajes que envíes a la base de datos.
                </p>
             </div>
          </div>

          <nav className="space-y-1">
             <button 
               onClick={() => setView('chat')}
               className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${view === 'chat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
             >
                <Users size={18} />
                Chat Grupal (Sync)
             </button>
             <button 
               onClick={() => setView('settings')}
               className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${view === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
             >
                <Settings size={18} />
                Diagnóstico & Config
             </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
            v3.0.0 Firestore Sync Active
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex h-[100vh] relative bg-white overflow-hidden">
        
        {view === 'settings' ? (
            <div className="flex-1 overflow-y-auto p-6 w-full">
                <div className="max-w-4xl mx-auto">
                    <DiagnosticsPanel onClose={() => setView('chat')} />
                </div>
            </div>
        ) : (
            <>
                {/* Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Chat Header */}
                    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-10 shadow-sm">
                        <div className="flex items-center gap-3">
                             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                             <div>
                                 <h2 className="font-semibold text-slate-800">Sala General</h2>
                                 <p className="text-xs text-slate-500">Sincronizado en tiempo real</p>
                             </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowUserList(!showUserList)}
                                className={`p-2 rounded-full transition-colors ${showUserList ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-400'}`}
                                title="Ver participantes"
                            >
                                <Users size={20} />
                            </button>
                            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                <MoreVertical size={20} />
                            </button>
                        </div>
                    </header>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Sparkles size={48} className="mb-4 opacity-50" />
                                <p>La sala está vacía. ¡Envía el primer mensaje!</p>
                            </div>
                        )}
                        
                        {messages.map((msg) => {
                            const isMe = msg.userName === currentUser;
                            const isAI = msg.sender === 'ai';
                            
                            return (
                                <div key={msg.id} className={`flex gap-4 ${isMe && !isAI ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                                        isAI ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 
                                        'bg-slate-200'
                                    }`}>
                                        {isAI ? <Bot size={16} className="text-white" /> : <User size={16} className="text-slate-500" />}
                                    </div>
                                    
                                    <div className={`flex flex-col max-w-[80%] ${isMe && !isAI ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1 px-1">
                                            <span className="text-xs font-medium text-slate-600">{msg.userName}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                                            isAI 
                                                ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-none' 
                                                : isMe 
                                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                                        }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {isLoading && (
                             <div className="flex gap-4 animate-pulse">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <Bot size={16} className="text-white" />
                                </div>
                                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                                    <span className="text-slate-400 text-sm">Escribiendo...</span>
                                </div>
                             </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={`Escribe un mensaje como ${currentUser}...`}
                                className="flex-1 bg-slate-100 text-slate-900 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                disabled={isLoading}
                            />
                            <button 
                                type="submit"
                                disabled={!inputValue.trim() || isLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                <Send size={20} />
                            </button>
                        </form>
                    </div>
                </div>

                {/* Collapsible User List Sidebar */}
                <div className={`${showUserList ? 'w-72 opacity-100' : 'w-0 opacity-0'} transition-all duration-300 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden`}>
                    <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 flex-shrink-0">
                        <h3 className="font-semibold text-slate-700">Participantes</h3>
                        <button onClick={() => setShowUserList(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={18} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Detectados Recientemente</h4>
                        <div className="space-y-3">
                            {getActiveUsers().map((user, idx) => {
                                const isAI = user === 'Gemini AI';
                                const isMe = user === currentUser;
                                return (
                                    <div key={idx} className="flex items-center gap-3 animate-in slide-in-from-right duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                        <div className="relative">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                isAI ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {isAI ? <Bot size={16} /> : <User size={16} />}
                                            </div>
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${isMe || isAI ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">
                                                {user}
                                            </p>
                                            <p className="text-[10px] text-slate-500 truncate">
                                                {isAI ? 'AI Assistant' : isMe ? 'Tú (Este dispositivo)' : 'Remoto'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
};

export default App;