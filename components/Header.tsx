
import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Wand2, MessageSquare,
    AlertTriangle, Loader2, CheckCircle2, CloudOff,
    Maximize2, Minimize2, Undo2, Redo2, Users, Trash2
} from 'lucide-react';
import { WeeklyValidationIssue } from '../services/validationService';
import { useAuth } from '../hooks/useAuth';

interface HeaderProps {
    weekLabel: string;
    validationIssues: WeeklyValidationIssue[];
    saveStatus: 'saved' | 'saving' | 'unsaved';
    canUndo?: boolean;
    canRedo?: boolean;
    onPrevWeek: () => void;
    onNextWeek: () => void;
    onAutoAssign: () => void;
    onOpenAi: () => void;
    onDeletePlan: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    weekLabel, validationIssues, saveStatus,
    canUndo, canRedo, onPrevWeek, onNextWeek,
    onAutoAssign, onOpenAi, onDeletePlan, onUndo, onRedo,
    onToggleSidebar
}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { user } = useAuth(false);
    const isViewer = user?.role === 'viewer';

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    };

    const errorCount = validationIssues.filter(i => i.type === 'ERROR').length;
    const warnCount = validationIssues.filter(i => i.type === 'WARNING').length;

    return (
        <header className="bg-white border-b border-slate-200 h-14 md:h-16 shrink-0 px-3 md:px-4 flex items-center justify-between z-20 shadow-sm print:hidden gap-2">
            {/* ── Left: branding + week nav ─────────────────────────────── */}
            <div className="flex items-center gap-2 md:gap-3 overflow-hidden min-w-0">
                {/* Title */}
                <div className="hidden xl:flex flex-col shrink-0">
                    <h1 className="text-lg font-extrabold text-slate-800 leading-tight tracking-tight">
                        OPAWR-Personalplaner
                    </h1>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Klinikum Gütersloh · Anästhesiepflege
                    </span>
                </div>
                <div className="xl:hidden hidden md:flex items-center font-extrabold text-slate-700 shrink-0 whitespace-nowrap text-sm gap-1">
                    <span className="text-indigo-600">OPAWR</span>
                </div>

                <div className="h-6 w-px bg-slate-200 hidden md:block shrink-0" />

                {/* Week navigation */}
                <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200 shrink-0">
                    <button
                        onClick={onPrevWeek}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-500 transition-all"
                        title="Vorherige Woche"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-bold text-slate-800 px-2 whitespace-nowrap min-w-[11rem] text-center">
                        {weekLabel}
                    </span>
                    <button
                        onClick={onNextWeek}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded text-slate-500 transition-all"
                        title="Nächste Woche"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* Undo / Redo */}
                {!isViewer && (
                    <div className="hidden lg:flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-lg border border-slate-200 shrink-0">
                        <button onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded hover:bg-white hover:shadow-sm disabled:opacity-30 text-slate-600 transition-all" title="Rückgängig">
                            <Undo2 size={16} />
                        </button>
                        <button onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded hover:bg-white hover:shadow-sm disabled:opacity-30 text-slate-600 transition-all" title="Wiederherstellen">
                            <Redo2 size={16} />
                        </button>
                    </div>
                )}

                {/* Validation badges */}
                {errorCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs font-bold shrink-0 animate-pulse">
                        <AlertTriangle size={14} />
                        <span className="hidden xl:inline">{errorCount} Fehler</span>
                        <span className="xl:hidden">{errorCount}</span>
                    </div>
                )}
                {warnCount > 0 && errorCount === 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700 text-xs font-bold shrink-0">
                        <AlertTriangle size={14} />
                        <span className="hidden xl:inline">{warnCount} Hinweise</span>
                        <span className="xl:hidden">{warnCount}</span>
                    </div>
                )}
            </div>

            {/* ── Right: actions ────────────────────────────────────────── */}
            <div className="flex items-center gap-2 shrink-0">
                {onToggleSidebar && (
                    <button
                        onClick={onToggleSidebar}
                        className="xl:hidden flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm transition-colors border border-slate-200 shadow-sm"
                    >
                        <Users size={18} />
                        <span className="hidden md:inline">Personal</span>
                    </button>
                )}

                <button onClick={toggleFullscreen} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors hidden sm:block">
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                {/* Save status */}
                {!isViewer && (
                    <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full border bg-slate-50 border-slate-100 shrink-0">
                        {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin text-blue-500" />}
                        {saveStatus === 'saved' && <CheckCircle2 size={14} className="text-green-500" />}
                        {saveStatus === 'unsaved' && <CloudOff size={14} className="text-amber-500" />}
                        <span className="hidden 2xl:block text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {saveStatus === 'saving' ? 'Speichert...' : saveStatus === 'saved' ? 'Gespeichert' : 'Ungespeichert'}
                        </span>
                    </div>
                )}

                <div className="h-6 w-px bg-slate-200 hidden xl:block shrink-0" />

                {/* Delete */}
                {!isViewer && (
                    <button
                        onClick={onDeletePlan}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Wochenplan löschen"
                    >
                        <Trash2 size={18} />
                    </button>
                )}

                {/* AI Assistant */}
                <button
                    onClick={onOpenAi}
                    className="flex items-center justify-center gap-2 px-2 md:px-3 py-2 text-slate-600 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition font-medium text-sm shrink-0"
                    title="KI-Assistent"
                >
                    <MessageSquare size={18} />
                    <span className="hidden 2xl:inline">KI-Assistent</span>
                </button>

                {/* Auto-assign */}
                {!isViewer && (
                    <button
                        onClick={onAutoAssign}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm hover:shadow-md font-bold text-sm shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                        title="Woche automatisch planen"
                    >
                        <Wand2 size={16} />
                        <span className="hidden xl:inline">Auto-Planung</span>
                        <span className="xl:hidden">Auto</span>
                    </button>
                )}
            </div>
        </header>
    );
};





