
import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Sparkles, ArrowRight, Lightbulb, Trash2, Mic, StopCircle, Minus, Maximize2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { getAiAdvice } from '../services/geminiService';
import { db } from '../db';
import { usePlan } from '../contexts/PlanContext';
import { useStaff } from '../contexts/StaffContext';
import { AuthService } from '../services/authService';

interface AiAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ 
    isOpen, 
    onClose 
}) => {
    const { currentWeekPlan, appConfig, weekLabel, handleAutoAssign } = usePlan();
    const { staffList } = useStaff();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentQuery, setCurrentQuery] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    
    // Voice Recorder Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    
    const chatEndRef = useRef<HTMLDivElement>(null);

    const defaultQuestions = [
        'Analysiere den Wochenplan.',
        'Wer kann AWR übernehmen?',
        'AWR-Besetzung heute ok?',
        'Übergabe-Bericht.'
    ];

    // Load history on mount
    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, [isOpen]);

    // Scroll to bottom when messages update, but only if not minimized
    useEffect(() => {
        if (!isMinimized && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isAiLoading, isMinimized]);

    const loadHistory = async () => {
        try {
            const history = await db.chatHistory.orderBy('timestamp').toArray();
            setMessages(history);
        } catch (e) {
            console.error("Failed to load chat history", e);
        }
    };

    const handleNewChat = async () => {
        try {
            await db.chatHistory.clear();
            setMessages([]);
            setCurrentQuery('');
        } catch (e) {
            console.error("Failed to clear chat", e);
        }
    };

    const processAction = async (aiResponse: { text: string, shouldRefresh: boolean, clientAction?: string }) => {
        // shouldRefresh: no-op in weekly plan model (data stays in context)
        if (aiResponse.clientAction === 'AUTO_ASSIGN') {
            setMessages(prev => [...prev, { role: 'assistant', text: "🔄 <i>Starte automatische Zuweisung...</i>", timestamp: Date.now() }]);
            await handleAutoAssign();
        }

        const aiMsg: ChatMessage = {
            role: 'assistant',
            text: aiResponse.text,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, aiMsg]);
        await db.chatHistory.add(aiMsg);
    };

    const handleAiSubmit = async (text?: string) => {
        const query = text || currentQuery;
        if (!query.trim()) return;
        
        setIsAiLoading(true);
        setCurrentQuery('');

        const userMsg: ChatMessage = { role: 'user', text: query, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        await db.chatHistory.add(userMsg);

        // Pass weekly plan context to AI
        const aiResponse = await getAiAdvice([], staffList, [], query, messages, weekLabel, appConfig);
        await processAction(aiResponse);
        
        setIsAiLoading(false);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());

                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size > 0) {
                    await sendAudio(audioBlob);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Microphone access denied", err);
            alert("Mikrofonzugriff verweigert.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const sendAudio = async (blob: Blob) => {
        setIsAiLoading(true);
        const userMsg: ChatMessage = { role: 'user', text: "🎤 (Audio...)", timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);

        try {
            const formData = new FormData();
            formData.append('audio', blob);
            formData.append('date', weekLabel);

            const token = AuthService.getToken();
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/api/ask-voice', {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (!response.ok) throw new Error("Voice API failed");

            const data = await response.json();
            setMessages(prev => prev.filter(m => m !== userMsg));
            
            const voiceConfirmMsg: ChatMessage = { role: 'user', text: "🎤 Sprachbefehl", timestamp: Date.now() };
            setMessages(prev => [...prev, voiceConfirmMsg]);
            await db.chatHistory.add(voiceConfirmMsg);

            await processAction({
                text: data.text,
                shouldRefresh: data.toolExecuted,
                clientAction: data.clientAction
            });

        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', text: "Fehler bei der Sprachverarbeitung.", timestamp: Date.now() }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    const renderFormattedResponse = (text: string) => {
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>');
        return <div dangerouslySetInnerHTML={{ __html: html }} className="text-slate-700 leading-relaxed" />;
    };

    if (!isOpen) return null;

    // MINIMIZED STATE (FAB)
    if (isMinimized) {
        return (
            <button 
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 z-[60] w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 animate-in zoom-in duration-300 ring-4 ring-indigo-100"
                title="AI Assistent öffnen"
            >
                <Sparkles size={24} />
                {isAiLoading && (
                    <span className="absolute top-0 right-0 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                )}
            </button>
        );
    }

    // EXPANDED WIDGET STATE
    return (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] w-full max-w-[380px] md:max-w-[420px] flex flex-col pointer-events-none">
            {/* The actual widget container is clickable */}
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto flex flex-col h-[600px] max-h-[85vh] animate-in slide-in-from-bottom-10 duration-300">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex justify-between items-center shrink-0 cursor-default">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center text-white shadow-inner">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-base leading-tight">AI Co-Pilot</h2>
                            <p className="text-[10px] text-indigo-100 font-medium opacity-80">Orchestrierung aktiv</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handleNewChat}
                            className="text-indigo-100 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all"
                            title="Chat leeren"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button 
                            onClick={() => setIsMinimized(true)}
                            className="text-indigo-100 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all"
                            title="Minimieren"
                        >
                            <Minus size={18} />
                        </button>
                        <button 
                            onClick={onClose} 
                            className="text-indigo-100 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all"
                            title="Schließen"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar relative">
                    {messages.length === 0 && (
                        <div className="text-center py-8 px-4 opacity-70">
                            <div className="w-16 h-16 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles size={32} />
                            </div>
                            <p className="text-sm font-medium text-slate-600 mb-2">Wie kann ich helfen?</p>
                            <p className="text-xs text-slate-400">Ich kann Umplanungen vorschlagen, Personal finden oder den Status prüfen.</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={msg.id || idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''} animate-in slide-in-from-bottom-2 duration-300`}>
                            {msg.role === 'assistant' && (
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-sm border border-indigo-200">
                                    <Bot size={14} />
                                </div>
                            )}
                            
                            <div className={`max-w-[85%] p-3 text-xs md:text-sm leading-relaxed shadow-sm ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none' 
                                : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-none'
                            }`}>
                                {msg.role === 'user' ? msg.text : renderFormattedResponse(msg.text)}
                            </div>
                        </div>
                    ))}

                    {isAiLoading && (
                        <div className="flex gap-2 animate-in fade-in">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <Bot size={14} className="text-indigo-600" />
                            </div>
                            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl rounded-tl-none px-3 py-2 flex items-center gap-2">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {(messages.length === 0 && !isAiLoading) && (
                        <div className="grid grid-cols-1 gap-2 mt-4">
                            {defaultQuestions.map((q, idx) => (
                                <button key={idx} onClick={() => handleAiSubmit(q)} className="text-left px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors text-xs font-medium flex items-center gap-2 text-slate-600">
                                    <Lightbulb size={12} className="text-amber-400 shrink-0" /> {q}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-slate-100 shrink-0">
                    <div className={`relative flex items-center shadow-sm rounded-xl bg-slate-50 border transition-all ${isRecording ? 'border-red-400 ring-2 ring-red-50' : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-50'}`}>
                        <div className="pl-3 text-slate-400">
                            {isRecording ? <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> : <Sparkles size={16} />}
                        </div>
                        <input 
                            value={currentQuery} 
                            onChange={e => setCurrentQuery(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleAiSubmit()} 
                            className="w-full bg-transparent border-0 px-3 py-3 text-slate-700 placeholder-slate-400 focus:ring-0 text-sm font-medium" 
                            placeholder={isRecording ? "Sprechen..." : "Nachricht..."} 
                            autoFocus
                            disabled={isRecording}
                        />
                        <div className="pr-1.5 flex gap-1">
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={isAiLoading}
                                className={`p-2 rounded-lg transition-all ${isRecording ? 'bg-red-50 text-red-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
                                title={isRecording ? "Stop" : "Sprache"}
                            >
                                {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
                            </button>
                            
                            <button 
                                onClick={() => handleAiSubmit()} 
                                disabled={!currentQuery.trim() || isAiLoading || isRecording}
                                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
