
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, X, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface VoiceFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const VoiceFeedbackModal: React.FC<VoiceFeedbackModalProps> = ({ isOpen, onClose }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [transcript, setTranscript] = useState('');
    const [recordingDuration, setRecordingDuration] = useState(0);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    // --- Helper Functions defined BEFORE early return to avoid TDZ ReferenceErrors ---

    const sendFeedback = async (audioBlob: Blob) => {
        setIsProcessing(true);
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'feedback.webm');

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = await response.json();
            setTranscript(data.transcript || "Audio gespeichert.");
            setStatus('success');
        } catch (error) {
            console.error(error);
            setStatus('error');
        } finally {
            setIsProcessing(false);
        }
    };

    const stopAndCleanup = () => {
        // Stop Timer
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Stop Recorder if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                // ignore error on stop
            }
        }

        // Stop all tracks to release microphone
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        setIsRecording(false);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Prefer webm, fallback to default
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
            const options = mimeType ? { mimeType } : undefined;
            
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const finalMimeType = mimeType || 'audio/webm';
                const audioBlob = new Blob(chunksRef.current, { type: finalMimeType });
                
                // Stop tracks immediately after recording stops
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
                
                // Only upload if we actually have data
                if (audioBlob.size > 0) {
                    await sendFeedback(audioBlob);
                }
            };

            // Start with 200ms timeslice to ensure data is emitted frequently
            mediaRecorder.start(200);
            setIsRecording(true);
            setStatus('idle');
            setTranscript('');
            
            // Start Timer
            setRecordingDuration(0);
            timerRef.current = window.setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Microphone Error:", err);
            alert("Mikrofonzugriff verweigert oder nicht verfügbar. Bitte prüfen Sie Ihre Browser-Einstellungen.");
        }
    };

    const stopRecording = () => {
        // Force UI update immediately
        setIsRecording(false);
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Trigger stop logic which fires onstop event for upload
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                console.error("Error stopping recorder:", e);
                stopAndCleanup(); // Fallback cleanup
            }
        } else {
            stopAndCleanup();
        }
    };

    const handleClose = () => {
        stopAndCleanup();
        onClose();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // --- Effects ---

    // Cleanup on unmount or close
    useEffect(() => {
        if (!isOpen) {
            stopAndCleanup();
        }
        return () => {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.onstop = null;
            }
            stopAndCleanup();
        };
    }, [isOpen]);

    // Early return MUST be after all hook definitions and helper functions (that are used in hooks)
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <Mic size={20} />
                        <h2 className="font-bold">Feedback aufnehmen</h2>
                    </div>
                    <button onClick={handleClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 flex flex-col items-center text-center space-y-6">
                    
                    {status === 'idle' && !isProcessing && (
                        <>
                            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-rose-50' : 'bg-slate-50'}`}>
                                {isRecording && (
                                    <>
                                        <div className="absolute inset-0 rounded-full border-4 border-rose-500 animate-ping opacity-20"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-rose-400 animate-pulse opacity-30 delay-75"></div>
                                    </>
                                )}
                                <button 
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 z-10 ${isRecording ? 'bg-rose-600 hover:bg-rose-700 ring-4 ring-rose-100' : 'bg-rose-500 hover:bg-rose-600'}`}
                                    title={isRecording ? "Aufnahme stoppen" : "Aufnahme starten"}
                                >
                                    {isRecording ? <Square size={24} className="text-white fill-current" /> : <Mic size={32} className="text-white" />}
                                </button>
                            </div>

                            <div>
                                <p className={`text-3xl font-mono font-bold mb-2 ${isRecording ? 'text-rose-600' : 'text-slate-700'}`}>
                                    {formatTime(recordingDuration)}
                                </p>
                                <p className="text-sm text-slate-500 max-w-[250px] mx-auto">
                                    {isRecording ? "Aufnahme läuft... Sprechen Sie jetzt." : "Tippen Sie auf das Mikrofon, um Fehler oder Wünsche zu melden."}
                                </p>
                            </div>
                        </>
                    )}

                    {isProcessing && (
                        <div className="py-8 flex flex-col items-center">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 rounded-full bg-rose-100 animate-ping"></div>
                                <Loader2 size={48} className="relative z-10 animate-spin text-rose-500" />
                            </div>
                            <p className="font-bold text-slate-700 text-lg">Verarbeite...</p>
                            <p className="text-xs text-slate-400 mt-1">Upload zu Vercel Blob & KI-Transkription</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="w-full animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Vielen Dank!</h3>
                            <p className="text-sm text-slate-500 mb-6">Ihr Feedback wurde erfolgreich gespeichert.</p>
                            
                            {transcript && (
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left mb-6 shadow-inner max-h-40 overflow-y-auto custom-scrollbar">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 flex items-center gap-1">
                                        <RefreshCw size={10} /> KI Transkript
                                    </span>
                                    <p className="text-sm text-slate-700 italic leading-relaxed">"{transcript}"</p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => { setStatus('idle'); setTranscript(''); }} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                                    Neues Feedback
                                </button>
                                <button onClick={handleClose} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
                                    Schließen
                                </button>
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="w-full">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Fehler</h3>
                            <p className="text-sm text-slate-500 mb-6">Das Feedback konnte nicht gesendet werden. Bitte prüfen Sie Ihre Internetverbindung.</p>
                            <div className="flex gap-3">
                                <button onClick={handleClose} className="flex-1 py-3 text-slate-500 hover:text-slate-700 font-medium">
                                    Abbrechen
                                </button>
                                <button onClick={() => setStatus('idle')} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors">
                                    Erneut versuchen
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
