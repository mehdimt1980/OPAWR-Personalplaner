// @ts-nocheck

import React from 'react';
import { ResolutionCandidate } from '../services/planningService';
import { ValidationIssue } from '../services/validationService';
import { Wand2, CheckCircle2, X, User, ShieldCheck, Star } from 'lucide-react';

interface ResolutionWizardProps {
    isOpen: boolean;
    onClose: () => void;
    issue: ValidationIssue | null;
    candidates: ResolutionCandidate[];
    onSelect: (candidate: ResolutionCandidate) => void;
    roomName?: string;
}

export const ResolutionWizard: React.FC<ResolutionWizardProps> = ({ 
    isOpen, 
    onClose, 
    issue, 
    candidates, 
    onSelect,
    roomName
}) => {
    if (!isOpen || !issue) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Wand2 size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1 text-violet-200 text-xs font-bold uppercase tracking-wider">
                            <Wand2 size={14} /> Smart Resolution
                        </div>
                        <h2 className="text-xl font-bold leading-tight">Konfliktlöser: {roomName}</h2>
                        <p className="text-white/80 text-sm mt-1 flex items-center gap-2">
                            {issue.message}
                        </p>
                    </div>
                    <button onClick={onClose} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 bg-slate-50 flex-1">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 pl-1">
                        Vorgeschlagene Lösungen ({candidates.length})
                    </h3>

                    {candidates.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="font-medium">Keine passenden Vorschläge gefunden.</p>
                            <p className="text-xs mt-1">Alle qualifizierten Mitarbeiter sind belegt oder nicht verfügbar.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {candidates.map((cand, idx) => (
                                <button 
                                    key={cand.staff.id}
                                    onClick={() => onSelect(cand)}
                                    className={`w-full text-left bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-violet-400 hover:shadow-md transition-all group relative overflow-hidden ${idx === 0 ? 'ring-2 ring-violet-100 border-violet-200' : ''}`}
                                >
                                    {idx === 0 && (
                                        <div className="absolute top-0 right-0 bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                            Beste Wahl
                                        </div>
                                    )}
                                    
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${cand.staff.isSaalleitung ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {cand.staff.isSaalleitung ? <ShieldCheck size={20} /> : <User size={20} />}
                                        </div>
                                        
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-800">{cand.staff.name}</h4>
                                                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{cand.staff.role}</span>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {cand.reasons.map((r, i) => (
                                                    <span key={i} className="text-[10px] font-medium bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded border border-violet-100 flex items-center gap-1">
                                                        <Star size={8} /> {r}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="ml-auto self-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-violet-600 text-white p-2 rounded-full shadow-lg">
                                                <CheckCircle2 size={20} />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-4 bg-white border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400">
                        Auswahl aktualisiert den Plan sofort. Speichern nicht vergessen.
                    </p>
                </div>
            </div>
        </div>
    );
};

