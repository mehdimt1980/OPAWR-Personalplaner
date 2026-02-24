
import React, { useState, useEffect } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';

interface NetworkIndicatorProps {
    isWorking: boolean;
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({ isWorking }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSlow, setIsSlow] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isWorking) {
            // If working for more than 3 seconds, consider it slow
            timer = setTimeout(() => setIsSlow(true), 3000);
        } else {
            setIsSlow(false);
        }
        return () => clearTimeout(timer);
    }, [isWorking]);

    // Don't show anything if online and not working
    if (isOnline && !isWorking) return null;

    // Don't show "fast" loading state to avoid flickering, only show if offline or slow
    // UNLESS the user explicitly wants to see "Waiting" icon. 
    // The prompt says "need to see an icon... till everything is running well".
    // So let's show a small indicator for normal loading too, but make it unobtrusive.
    
    // OFFLINE STATE (Highest Priority)
    if (!isOnline) {
        return (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold animate-pulse mt-2">
                <WifiOff size={18} />
                Keine Internetverbindung
            </div>
        );
    }

    // SLOW CONNECTION STATE
    if (isSlow && isWorking) {
        return (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold animate-in fade-in slide-in-from-top-2 mt-2">
                <Loader2 size={18} className="animate-spin" />
                <span className="hidden sm:inline">Verbindung langsam... bitte warten</span>
                <span className="sm:hidden">Laden...</span>
            </div>
        );
    }

    // NORMAL LOADING STATE (> 500ms to avoid flicker on super fast connections)
    // We handle the debounce inside the render logic implicitly by checking isSlow, 
    // but here we just show it immediately if isWorking is true? 
    // Better to have a tiny delay before showing the "Loading" pill to avoid strobe effect.
    return (
        <DelayedLoadingIndicator />
    );
};

const DelayedLoadingIndicator: React.FC = () => {
    const [show, setShow] = useState(false);
    
    useEffect(() => {
        const timer = setTimeout(() => setShow(true), 500);
        return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold opacity-90 mt-2 animate-in fade-in zoom-in-95">
            <Loader2 size={14} className="animate-spin" />
            Laden...
        </div>
    );
};
