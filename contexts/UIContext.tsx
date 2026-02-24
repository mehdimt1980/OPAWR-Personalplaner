import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ConfirmDialogOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
}

interface UIContextType {
    showToast: (message: string, type?: ToastType) => void;
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [dialogConfig, setDialogConfig] = useState<{
        isOpen: boolean;
        options: ConfirmDialogOptions;
        resolve: (value: boolean) => void;
    } | null>(null);

    // Toast Logic
    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Dialog Logic
    const confirm = useCallback((options: ConfirmDialogOptions) => {
        return new Promise<boolean>((resolve) => {
            setDialogConfig({
                isOpen: true,
                options,
                resolve
            });
        });
    }, []);

    const handleDialogClose = (result: boolean) => {
        if (dialogConfig) {
            dialogConfig.resolve(result);
            setDialogConfig(null);
        }
    };

    return (
        <UIContext.Provider value={{ showToast, confirm }}>
            {children}
            
            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div 
                        key={toast.id} 
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300 max-w-sm ${
                            toast.type === 'success' ? 'bg-white border-green-200 text-green-800' :
                            toast.type === 'error' ? 'bg-white border-red-200 text-red-800' :
                            toast.type === 'warning' ? 'bg-white border-amber-200 text-amber-800' :
                            'bg-white border-blue-200 text-blue-800'
                        }`}
                    >
                        {toast.type === 'success' && <CheckCircle size={18} className="text-green-500" />}
                        {toast.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
                        {toast.type === 'warning' && <AlertTriangle size={18} className="text-amber-500" />}
                        {toast.type === 'info' && <Info size={18} className="text-blue-500" />}
                        <p className="text-sm font-medium">{toast.message}</p>
                        <button 
                            onClick={() => removeToast(toast.id)}
                            className="ml-auto text-slate-400 hover:text-slate-600 p-1"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirmation Dialog Overlay */}
            {dialogConfig && (
                <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                {dialogConfig.options.isDangerous && <AlertTriangle className="text-red-500" size={24} />}
                                {dialogConfig.options.title}
                            </h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                {dialogConfig.options.message}
                            </p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                            <button 
                                onClick={() => handleDialogClose(false)}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors text-sm"
                            >
                                {dialogConfig.options.cancelText || 'Abbrechen'}
                            </button>
                            <button 
                                onClick={() => handleDialogClose(true)}
                                className={`px-4 py-2 text-white font-bold rounded-lg shadow-sm transition-colors text-sm ${
                                    dialogConfig.options.isDangerous 
                                    ? 'bg-red-600 hover:bg-red-700' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {dialogConfig.options.confirmText || 'Bestätigen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error("useUI must be used within a UIProvider");
    return context;
};
