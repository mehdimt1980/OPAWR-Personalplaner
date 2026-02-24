
import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/authService';
import { SECURITY_CONFIG } from '../config';
import { ShieldCheck, Lock, AlertOctagon, Loader2, Building2, KeyRound, Info, User, ArrowRight, HelpCircle, Phone, X } from 'lucide-react';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lockoutTimer, setLockoutTimer] = useState<number>(0);
    
    // UI States
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [showForgotHelp, setShowForgotHelp] = useState(false);

    useEffect(() => {
        const remaining = AuthService.getLockoutStatus();
        if (remaining > 0) {
            setLockoutTimer(remaining);
        }
    }, []);

    useEffect(() => {
        if (lockoutTimer <= 0) return;
        const timer = setInterval(() => {
            setLockoutTimer(prev => {
                if (prev <= 1) return 0;
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [lockoutTimer]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (lockoutTimer > 0) return;
        
        setIsLoading(true);
        setError(null);

        const result = await AuthService.login(username, password);

        if (result.success) {
            onLoginSuccess();
        } else {
            if (result.error === 'MUST_CHANGE_PASSWORD') {
                setMustChangePassword(true);
                setError(null);
            } else if (result.error === 'LOCKED_OUT' && result.lockoutRemainingSeconds) {
                setLockoutTimer(result.lockoutRemainingSeconds);
                setError(`Zugriff gesperrt. Zu viele Fehlversuche.`);
            } else if (result.error === 'ERROR') {
                setError("Verbindungsfehler zum Server.");
            } else {
                setError("Benutzername oder Passwort falsch.");
                setPassword('');
            }
        }
        setIsLoading(false);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 8) {
            setError("Passwort muss mindestens 8 Zeichen haben.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwörter stimmen nicht überein.");
            return;
        }

        setIsLoading(true);
        const success = await AuthService.changePassword(newPassword);
        if (success) {
            onLoginSuccess();
        } else {
            setError("Fehler beim Ändern des Passworts.");
        }
        setIsLoading(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-200/20 blur-3xl"></div>
                <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] rounded-full bg-indigo-200/20 blur-3xl"></div>
            </div>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent scale-150"></div>
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 mb-4">
                            <ShieldCheck size={32} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{SECURITY_CONFIG.APP_NAME}</h1>
                        <div className="flex items-center gap-1.5 mt-2 text-blue-200 text-sm font-medium">
                            <Building2 size={14} />
                            <span>{SECURITY_CONFIG.ORG_NAME}</span>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {lockoutTimer > 0 ? (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center animate-pulse">
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Lock size={24} />
                            </div>
                            <h3 className="text-red-800 font-bold text-lg mb-1">Sicherheits-Sperre</h3>
                            <p className="text-red-600 text-sm mb-4">
                                Zu viele Fehlversuche. Bitte warten Sie.
                            </p>
                            <div className="text-3xl font-mono font-bold text-red-900">
                                {formatTime(lockoutTimer)}
                            </div>
                        </div>
                    ) : mustChangePassword ? (
                        // --- FORCE PASSWORD CHANGE UI ---
                        <form onSubmit={handleChangePassword} className="space-y-5 animate-in slide-in-from-right">
                            <div className="text-center mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Neues Passwort erforderlich</h3>
                                <p className="text-sm text-slate-500">Aus Sicherheitsgründen müssen Sie Ihr Passwort ändern.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Neues Passwort
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="block w-full px-3 py-3 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    placeholder="Mindestens 8 Zeichen"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Bestätigen
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="block w-full px-3 py-3 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                    placeholder="Wiederholen"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
                                    <AlertOctagon size={14} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || !newPassword || !confirmPassword}
                                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>Passwort speichern <ArrowRight size={16} /></>}
                            </button>
                        </form>
                    ) : (
                        // --- STANDARD LOGIN UI ---
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Benutzername
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="admin"
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Passwort
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyRound className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`block w-full pl-10 pr-3 py-3 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${error ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-slate-200 focus:ring-blue-600 focus:border-transparent'}`}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                {error && (
                                    <div className="flex items-center gap-2 mt-2 text-red-600 text-sm font-medium animate-in slide-in-from-top-1">
                                        <AlertOctagon size={14} />
                                        {error}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center">
                                <button 
                                    type="button" 
                                    onClick={() => setShowForgotHelp(true)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                >
                                    Passwort vergessen?
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !username || !password}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Anmelden"}
                            </button>
                        </form>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
                            <Info size={12} className="text-slate-400" />
                            <span className="text-[10px] font-medium text-slate-500">
                                Gesichert mit bcrypt & JWT
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* FORGOT PASSWORD MODAL */}
            {showForgotHelp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
                        <button onClick={() => setShowForgotHelp(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                                <HelpCircle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Passwort vergessen?</h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Aus Sicherheitsgründen können Passwörter nicht automatisch zurückgesetzt werden.
                            </p>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 w-full text-left">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Vorgehensweise:</p>
                                <ol className="text-sm text-slate-700 space-y-2 list-decimal ml-4">
                                    <li>Kontaktieren Sie Ihre <strong>OP-Leitung</strong> oder den <strong>System-Administrator</strong>.</li>
                                    <li>Diese können Ihr Passwort zurücksetzen.</li>
                                    <li>Sie erhalten ein temporäres Passwort für den Login.</li>
                                </ol>
                            </div>
                            <button 
                                onClick={() => setShowForgotHelp(false)}
                                className="mt-6 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                            >
                                Verstanden
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
