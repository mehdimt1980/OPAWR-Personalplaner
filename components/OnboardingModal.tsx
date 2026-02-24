
import React, { useState } from 'react';
import { X, Upload, Wand2, AlertTriangle, ShieldCheck, ArrowRight, MousePointer2, CheckCircle2, HelpCircle, Thermometer, MessageSquare, Users, Monitor, Bell, Search, LayoutDashboard, ArrowLeft } from 'lucide-react';

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1);
    const totalSteps = 5;

    if (!isOpen) return null;

    const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
    const prevStep = () => setStep(s => Math.max(1, s - 1));

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col overflow-hidden relative">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-3 right-3 z-30 bg-white/80 hover:bg-slate-100 p-2 rounded-full transition-colors text-slate-500 backdrop-blur-sm shadow-sm">
                    <X size={20} />
                </button>

                {/* Progress Bar */}
                <div className="h-1.5 bg-slate-100 w-full flex shrink-0">
                    <div className={`h-full bg-blue-600 transition-all duration-500 ease-out`} style={{ width: `${(step / totalSteps) * 100}%` }}></div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
                    
                    {/* Left: Illustration Area (Visuals) */}
                    {/* Mobile: Fixed height at top. Desktop: Full height left column. */}
                    <div className="h-56 md:h-auto md:w-5/12 bg-slate-50 relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-100 shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-40"></div>
                        
                        <div className="relative w-full h-full flex items-center justify-center p-6 md:p-8">
                            {/* STEP 1: IMPORT VISUAL */}
                            {step === 1 && (
                                <div className="relative animate-in slide-in-from-left duration-500 flex justify-center">
                                    <div className="w-56 md:w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 flex flex-col gap-3 relative z-10 transform -rotate-2">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <div className="h-3 md:h-4 w-20 bg-slate-200 rounded"></div>
                                            <div className="h-3 md:h-4 w-4 bg-slate-200 rounded-full"></div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="h-8 md:h-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600 gap-2 shadow-inner">
                                                <Upload size={18} /> <div className="h-1.5 md:h-2 w-24 bg-blue-200 rounded"></div>
                                            </div>
                                            <div className="h-1.5 md:h-2 w-full bg-slate-100 rounded mt-2"></div>
                                            <div className="h-1.5 md:h-2 w-5/6 bg-slate-100 rounded"></div>
                                            <div className="h-1.5 md:h-2 w-4/6 bg-slate-100 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-4 md:-bottom-6 -right-2 bg-green-100 text-green-700 p-2 md:p-3 rounded-xl shadow-lg border border-green-200 font-bold text-xs flex items-center gap-2 z-20 animate-bounce">
                                        <CheckCircle2 size={16} /> OP-Plan.csv
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: RESOURCES VISUAL */}
                            {step === 2 && (
                                <div className="relative animate-in slide-in-from-right duration-500 w-full flex flex-col items-center gap-3 md:gap-4">
                                    {/* Sidebar Mockup */}
                                    <div className="w-48 md:w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative z-10">
                                        <div className="bg-slate-100 p-2 border-b border-slate-200 flex justify-between">
                                            <div className="h-2 md:h-3 w-16 bg-slate-300 rounded"></div>
                                            <div className="h-2 md:h-3 w-6 bg-slate-300 rounded-full"></div>
                                        </div>
                                        <div className="p-2 space-y-2">
                                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                                                <div className="w-5 h-5 md:w-6 md:h-6 bg-blue-100 rounded-full"></div>
                                                <div className="h-1.5 md:h-2 w-20 bg-slate-200 rounded"></div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                                                <div className="w-5 h-5 md:w-6 md:h-6 bg-amber-100 rounded-full"></div>
                                                <div className="h-1.5 md:h-2 w-20 bg-slate-200 rounded"></div>
                                            </div>
                                            {/* Sick Staff */}
                                            <div className="flex items-center gap-2 bg-red-50 p-2 rounded border border-red-100 opacity-70">
                                                <div className="w-5 h-5 md:w-6 md:h-6 bg-red-100 text-red-500 flex items-center justify-center rounded-full"><Thermometer size={12}/></div>
                                                <div className="h-1.5 md:h-2 w-16 bg-red-200 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded-full shadow-lg">Verfügbar</span>
                                        <span className="bg-red-500 text-white text-[10px] px-2 py-1 rounded-full shadow-lg">Krank</span>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: AUTO ASSIGN & DRAG DROP VISUAL */}
                            {step === 3 && (
                                <div className="relative animate-in zoom-in duration-500 flex items-center justify-center w-full h-full">
                                    {/* Background Grid simulating Rooms */}
                                    <div className="absolute inset-0 grid grid-cols-2 gap-2 md:gap-4 p-4 md:p-8 opacity-20 scale-90">
                                        <div className="bg-slate-300 rounded-xl border-2 border-slate-400 border-dashed h-16 md:h-24"></div>
                                        <div className="bg-slate-300 rounded-xl border-2 border-slate-400 border-dashed h-16 md:h-24"></div>
                                        <div className="bg-slate-300 rounded-xl border-2 border-slate-400 border-dashed h-16 md:h-24"></div>
                                        <div className="bg-slate-300 rounded-xl border-2 border-slate-400 border-dashed h-16 md:h-24"></div>
                                    </div>
                                    
                                    {/* Auto Assign Badge */}
                                    <div className="absolute top-1/4 left-1/4 z-10 transform -translate-x-1/2 -translate-y-1/2">
                                         <div className="bg-blue-600 text-white p-3 md:p-4 rounded-full shadow-xl shadow-blue-600/30 animate-pulse">
                                            <Wand2 size={24} className="md:w-7 md:h-7" />
                                        </div>
                                    </div>

                                    {/* Drag & Drop Hand Simulation */}
                                    <div className="absolute bottom-1/3 right-1/4 z-20 animate-bounce">
                                        <div className="bg-white p-1.5 md:p-2 rounded-lg shadow-2xl border border-slate-300 transform rotate-6 w-24 md:w-28">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 md:w-6 md:h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-[8px]">MA</div>
                                                <div className="h-1.5 md:h-2 w-10 md:w-12 bg-slate-200 rounded"></div>
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-5 -right-5 md:-bottom-6 md:-right-6 text-slate-800 drop-shadow-lg">
                                            <MousePointer2 size={32} className="md:w-10 md:h-10 fill-current" />
                                        </div>
                                    </div>
                                    
                                    {/* Arrow indicating movement */}
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-400 opacity-40">
                                         <ArrowRight size={32} className="md:w-12 md:h-12" />
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: CONFLICTS VISUAL */}
                            {step === 4 && (
                                <div className="relative animate-in slide-in-from-bottom duration-500">
                                    <div className="w-56 md:w-64 bg-white rounded-xl shadow-xl border-2 border-red-400 p-3 md:p-4 relative overflow-hidden">
                                        {/* Warning Header */}
                                        <div className="bg-red-50 -mx-3 -mt-3 md:-mx-4 md:-mt-4 p-2 md:p-3 border-b border-red-100 flex items-center gap-2 text-red-700 font-bold text-[10px] md:text-xs mb-3">
                                            <AlertTriangle size={14} /> 
                                            <span>Konflikt: Qualifikation fehlt</span>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 opacity-50 grayscale">
                                                <div className="w-6 h-6 md:w-8 md:h-8 bg-slate-200 rounded-full"></div>
                                                <div className="space-y-1">
                                                    <div className="h-1.5 md:h-2 w-20 md:w-24 bg-slate-200 rounded"></div>
                                                    <div className="h-1.5 md:h-2 w-10 md:w-12 bg-slate-100 rounded"></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Magic Solution Button */}
                                        <div className="mt-4 flex justify-center">
                                            <div className="bg-indigo-600 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-[10px] md:text-xs font-bold cursor-pointer hover:scale-105 transition-transform">
                                                <Wand2 size={12} />
                                                <span>Lösungsvorschlag</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute -right-4 top-1/2 cursor-pointer">
                                        <MousePointer2 className="text-slate-700 drop-shadow-md animate-bounce" size={28} />
                                    </div>
                                </div>
                            )}

                            {/* STEP 5: COMMUNICATION VISUAL */}
                            {step === 5 && (
                                <div className="relative animate-in slide-in-from-right duration-500 w-full flex items-center justify-center gap-3 md:gap-4">
                                    {/* Phone */}
                                    <div className="w-20 h-32 md:w-24 md:h-40 bg-slate-800 rounded-xl border-4 border-slate-600 shadow-xl flex flex-col items-center p-2 relative">
                                        <div className="w-6 h-1 md:w-8 bg-slate-600 rounded-full mb-2"></div>
                                        <div className="bg-green-100 p-1.5 md:p-2 rounded-lg rounded-tl-none w-full text-[6px] text-green-900 mb-1">
                                            Hallo Rita, Saal 1 (Leitung)
                                        </div>
                                        <div className="absolute -right-2 -top-2 md:-right-3 md:-top-3 bg-green-500 text-white p-1.5 rounded-full shadow-lg">
                                            <MessageSquare size={12} className="md:w-3.5 md:h-3.5" />
                                        </div>
                                    </div>
                                    {/* TV Screen */}
                                    <div className="w-32 h-24 md:w-40 md:h-28 bg-slate-900 rounded-lg border-b-4 border-slate-700 shadow-xl flex items-center justify-center relative">
                                        <div className="w-full h-full bg-slate-800 rounded flex flex-col p-2">
                                            <div className="flex gap-1 mb-1">
                                                <div className="bg-blue-500 w-1/3 h-6 md:h-8 rounded"></div>
                                                <div className="bg-blue-500 w-1/3 h-6 md:h-8 rounded"></div>
                                                <div className="bg-blue-500 w-1/3 h-6 md:h-8 rounded"></div>
                                            </div>
                                            <div className="flex gap-1">
                                                <div className="bg-slate-600 w-1/3 h-6 md:h-8 rounded"></div>
                                                <div className="bg-slate-600 w-1/3 h-6 md:h-8 rounded"></div>
                                                <div className="bg-slate-600 w-1/3 h-6 md:h-8 rounded"></div>
                                            </div>
                                        </div>
                                        <div className="absolute -right-2 -top-2 md:-right-3 md:-top-3 bg-blue-500 text-white p-1.5 rounded-full shadow-lg">
                                            <Monitor size={12} className="md:w-3.5 md:h-3.5" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Text Content */}
                    <div className="md:w-7/12 flex flex-col bg-white h-full min-h-0">
                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded">Schritt {step} von {totalSteps}</span>
                                {step < totalSteps && (
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2 py-1">Überspringen</button>
                                )}
                            </div>
                            
                            {step === 1 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4">Start mit Import</h2>
                                    <p className="text-slate-600 text-sm md:text-lg leading-relaxed mb-6 md:mb-8">
                                        Starten Sie jeden Morgen mit einem Klick. Laden Sie den aktuellen OP-Plan direkt aus dem KIS als CSV-Datei hoch.
                                    </p>
                                    <div className="bg-slate-50 rounded-xl p-4 md:p-5 border border-slate-100 space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">1</div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm md:text-base">CSV Hochladen</h4>
                                                <p className="text-xs md:text-sm text-slate-500">Nutzen Sie den Button <Upload size={14} className="inline mx-1"/> in der linken Leiste.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">2</div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm md:text-base">Automatische Erkennung</h4>
                                                <p className="text-xs md:text-sm text-slate-500">Das System erkennt Säle, OP-Zeiten und benötigte Fachdisziplinen von selbst.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4">Das Team im Blick</h2>
                                    <p className="text-slate-600 text-sm md:text-lg leading-relaxed mb-6">
                                        Die rechte Seitenleiste ist Ihr Ressourcen-Pool. Hier sehen Sie alle Mitarbeiter, die noch nicht zugewiesen sind.
                                    </p>
                                    <ul className="space-y-4">
                                        <li className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                            <Thermometer className="text-red-500 mt-1 shrink-0" size={20} />
                                            <div>
                                                <strong className="block text-slate-800 text-sm md:text-base">Krankheit managen</strong>
                                                <span className="text-xs md:text-sm text-slate-500">Meldet sich jemand krank? Ein Klick auf das Thermometer-Icon entfernt die Person sofort aus der Planung.</span>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                            <Search className="text-blue-500 mt-1 shrink-0" size={20} />
                                            <div>
                                                <strong className="block text-slate-800 text-sm md:text-base">Schnelles Finden</strong>
                                                <span className="text-xs md:text-sm text-slate-500">Nutzen Sie die Suche, um gezielt nach Qualifikationen (z.B. "MFA") oder Namen zu filtern.</span>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4">Auto-Planung & Drag & Drop</h2>
                                    <p className="text-slate-600 text-sm md:text-lg leading-relaxed mb-6">
                                        Sparen Sie sich das manuelle Puzzeln. Der Button <span className="font-bold text-blue-600">"Auto-Zuweisung"</span> erstellt in Sekunden einen soliden Basis-Plan.
                                    </p>
                                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6 shadow-sm">
                                        <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-1 text-sm md:text-base">
                                            <MousePointer2 size={18} /> Manuelle Anpassung
                                        </h4>
                                        <p className="text-blue-800 text-xs md:text-sm leading-relaxed">
                                            Nicht perfekt? Ziehen Sie Mitarbeiter einfach per <strong>Drag & Drop</strong> von der Liste in einen Saal, oder tauschen Sie zwei Kollegen, indem Sie die Karten übereinander ziehen.
                                        </p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        <div className="bg-indigo-50 p-3 md:p-4 rounded-xl border border-indigo-100">
                                            <ShieldCheck className="text-indigo-600 mb-2" size={24} />
                                            <h4 className="font-bold text-indigo-900 text-sm">Qualifikation</h4>
                                            <p className="text-xs text-indigo-700">Experten kommen in die passenden Fach-Säle.</p>
                                        </div>
                                        <div className="bg-amber-50 p-3 md:p-4 rounded-xl border border-amber-100">
                                            <Users className="text-amber-600 mb-2" size={24} />
                                            <h4 className="font-bold text-amber-900 text-sm">Fairness</h4>
                                            <p className="text-xs text-amber-700">Vermeidet Dauerbelastung einzelner Personen.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4">Konflikte lösen</h2>
                                    <p className="text-slate-600 text-sm md:text-lg leading-relaxed mb-6">
                                        Kein Plan ist perfekt – aber Fehler werden sofort erkannt. <span className="text-red-600 font-bold">Rote Warnungen</span> zeigen Sicherheitsrisiken an.
                                    </p>
                                    
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Wand2 size={100} />
                                        </div>
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-sm md:text-base">
                                            <Wand2 className="text-purple-600" size={20} /> Der Problemlöser
                                        </h3>
                                        <p className="text-slate-600 text-xs md:text-sm mb-4">
                                            Klicken Sie auf den Zauberstab neben einer Warnung. Das System schlägt Ihnen 3 Alternativen vor, um das Problem zu beheben, ohne neue Lücken zu reißen.
                                        </p>
                                          <div className="text-[10px] md:text-xs font-mono bg-white p-2 rounded border border-slate-200 text-slate-500">
                                              "Kein UCH-Experte in Saal 1" → Vorschlag: "Tausche Rita (UCH) aus Saal 3"
                                          </div>
                                    </div>
                                </div>
                            )}

                            {step === 5 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4">Team informieren</h2>
                                    <p className="text-slate-600 text-sm md:text-lg leading-relaxed mb-6">
                                        Ein Plan ist nur gut, wenn alle Bescheid wissen. Nutzen Sie die integrierten Kommunikations-Tools.
                                    </p>
                                    
                                    <div className="space-y-4">
                                        <div className="flex gap-4 items-start">
                                            <div className="bg-green-100 p-2 rounded-lg text-green-600 shrink-0"><Bell size={20} /></div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm md:text-base">SMS Versand</h4>
                                                <p className="text-xs md:text-sm text-slate-500">Klicken Sie auf "Plan Senden", um jedem Mitarbeiter seinen persönlichen Einsatz (Saal & Zeit) aufs Handy zu schicken.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 items-start">
                                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600 shrink-0"><Monitor size={20} /></div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm md:text-base">TV Modus</h4>
                                                <p className="text-xs md:text-sm text-slate-500">Für den Flur-Monitor: Öffnen Sie die TV-Ansicht. Sie aktualisiert sich automatisch, sobald Sie Änderungen vornehmen.</p>
                                            </div>
                                        </div>
                                        
                                        <div className="p-3 md:p-4 bg-slate-50 border-l-4 border-slate-800 mt-4 rounded-r-lg">
                                            <p className="text-xs md:text-sm text-slate-700 italic">
                                                "Noch Fragen? Nutzen Sie den <strong>AI Assistenten</strong> oben rechts im Chat."
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation Footer - Sticky */}
                        <div className="p-4 md:px-12 md:py-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 z-10">
                            <button 
                                onClick={step === 1 ? onClose : prevStep}
                                className={`px-4 py-2 md:px-5 md:py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 font-bold transition-colors flex items-center gap-2 text-sm ${step === 1 ? 'invisible' : ''}`}
                            >
                                <ArrowLeft size={16} /> Zurück
                            </button>
                            <div className="flex gap-2 mx-auto">
                                {Array.from({length: totalSteps}).map((_, i) => (
                                    <div key={i} className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${i + 1 === step ? 'bg-blue-600 w-6 md:w-8' : 'bg-slate-200 w-1.5 md:w-2'}`}></div>
                                ))}
                            </div>
                            <button 
                                onClick={step === totalSteps ? onClose : nextStep}
                                className="px-6 py-2.5 md:px-8 md:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 hover:scale-105 active:scale-95 text-sm"
                            >
                                {step === totalSteps ? 'Loslegen' : 'Weiter'} <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
