// @ts-nocheck


import React, { useEffect, useState } from 'react';
import { Staff, AnalyticsSummary, Operation, ReschedulingOption } from '../types';
import { generateAnalytics } from '../services/analyticsService';
import { generateExecutiveReport } from '../services/geminiService';
import { loadPlan } from '../services/storageService';
import { findSmartReschedulingOptions } from '../services/reschedulingService';
import { exportReschedulingToCSV } from '../services/dataService';
import { 
    BarChart3, ArrowRight, Activity, PieChart, TrendingUp, 
    CalendarOff, Sparkles, Bot, AlertTriangle, CheckCircle2, Users, Copy, 
    AlertOctagon, DoorClosed, Ban, CalendarCheck, ArrowRightLeft, Combine, Download, X,
    Euro, Timer, Layers, Scale, Crown, UserPlus, RefreshCw, Calendar
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, PieChart as RePieChart, 
    Pie, Cell, AreaChart, Area, Legend 
} from 'recharts';
import { getDepartmentStyle } from '../utils/colors';

interface AnalyticsDashboardProps {
    currentDate: string;
    staffList: Staff[];
    onClose: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

// Helpers for Date Conversion
const toIsoDate = (dateStr: string) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const parts = dateStr.split('.');
    if (parts.length !== 3) return new Date().toISOString().split('T')[0];
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const toGermanDate = (isoDate: string) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}.${m}.${y}`;
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ currentDate, staffList, onClose }) => {
    // State for local date selection within dashboard
    const [startDateISO, setStartDateISO] = useState(toIsoDate(currentDate));
    
    const [data, setData] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [daysRange, setDaysRange] = useState(14);
    
    // AI Report State
    const [reportText, setReportText] = useState<string | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Rescheduling State
    const [reschedulingSuggestions, setReschedulingSuggestions] = useState<ReschedulingOption[]>([]);
    const [isAnalyzingReschedule, setIsAnalyzingReschedule] = useState(false);

    // Sync with prop if it changes externally (optional, but good UX if global date changes)
    useEffect(() => {
        setStartDateISO(toIsoDate(currentDate));
    }, [currentDate]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const germanDate = toGermanDate(startDateISO);
            const result = await generateAnalytics(germanDate, staffList, daysRange);
            setData(result);
            setReportText(null); // Reset report on date change
            setReschedulingSuggestions([]); // Reset suggestions
            setLoading(false);
        };
        loadData();
    }, [startDateISO, staffList, daysRange]); // Depend on local startDateISO instead of prop

    const handleGenerateReport = async () => {
        if (!data) return;
        setIsGeneratingReport(true);
        const text = await generateExecutiveReport(data);
        setReportText(text);
        setIsGeneratingReport(false);
    };

    const handleAnalyzeRescheduling = async (dateStr: string) => {
        setIsAnalyzingReschedule(true);
        setReschedulingSuggestions([]); // Clear previous
        
        // 1. Load the plan for the specific critical day to get the Ops
        const plan = await loadPlan(dateStr);
        if (plan && plan.operations && plan.operations.length > 0) {
            // 2. Identify Ops to move. 
            // In a real scenario, the user might select them. 
            // Here, we assume ALL ops from the "last" 1-2 rooms might need moving if we close rooms.
            // Simplified: Take random 30% of ops to simulate closing 2 rooms out of 8.
            const opsToMove = plan.operations.slice(0, Math.ceil(plan.operations.length * 0.30)); 
            
            const suggestions = await findSmartReschedulingOptions(opsToMove, staffList, dateStr, 7);
            setReschedulingSuggestions(suggestions);
        } else {
            alert(`Keine Operationen am ${dateStr} gefunden, die umgeplant werden könnten.`);
        }
        setIsAnalyzingReschedule(false);
    };

    // Helper to find the next valid working day for simulation
    const getNextWorkingDay = () => {
        if (!data) return toGermanDate(startDateISO);
        const validDay = data.dailyRisks.find(d => d.dayName !== 'Sa' && d.dayName !== 'So' && d.totalStaffAvailable > 0);
        return validDay ? validDay.date : toGermanDate(startDateISO);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-12 text-slate-400">
                <Activity className="animate-spin mb-4 text-blue-500" size={40} />
                <p>Generiere Charts & Analysen ab {toGermanDate(startDateISO)}...</p>
            </div>
        );
    }

    if (!data) return null;

    // --- Data Prep for Charts ---
    
    // Widget 1: Room Rotation / Distribution
    const rotationData = data.workload.slice(0, 15).map(s => {
        const row: any = { name: s.name };
        Object.entries(s.roomHistory).forEach(([room, count]) => {
            row[room] = count;
        });
        return row;
    });

    const allRooms = (Array.from(new Set(data.workload.flatMap(s => Object.keys(s.roomHistory)))) as string[]).sort();

    // Widget 2: Dept Distribution
    const deptData = Object.entries(data.deptDistribution)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value);

    // Widget 3: Trend Data (Risk/Conflicts over time)
    const trendData = data.dailyRisks.map(d => ({
        date: d.date.substring(0, 5), // DD.MM
        Konflikte: d.conflictCount,
        Verfuegbar: d.totalStaffAvailable,
        riskLevel: d.riskLevel
    }));

    // Widget 4: Absence Stacked
    const absenceData = data.dailyRisks.map(d => ({
        date: d.date.substring(0, 5),
        Anwesend: d.totalStaffAvailable,
        Krank: d.sickCount,
        Urlaub: d.vacationCount,
        Ruhezeit: d.recoveryCount,
        Frei: d.offCount
    }));

    // --- KPI Calculation ---
    const totalOps = (Object.values(data.deptDistribution) as number[]).reduce((a, b) => a + b, 0);
    const highRiskDays = data.dailyRisks.filter(d => d.riskLevel === 'HIGH' || d.riskLevel === 'CRITICAL').length;
    const burnoutCount = data.workload.filter(w => w.burnoutRisk).length;
    const avgUtilization = Math.round(data.workload.reduce((acc, curr) => acc + curr.utilizationRate, 0) / data.workload.length) || 0;

    const criticalShortages = data.dailyRisks.filter(d => {
        if (d.dayName === 'Sa' || d.dayName === 'So') return false;
        return d.totalStaffAvailable < 14; 
    }).map(d => {
        const maxRooms = Math.floor(d.totalStaffAvailable / 2);
        const deficit = 8 - maxRooms; 
        return {
            date: d.date,
            dayName: d.dayName,
            staff: d.totalStaffAvailable,
            maxRooms,
            deficit
        };
    });

    const alertIssues = data.dailyRisks.flatMap(d => 
        d.issues
            .filter(i => i.includes('ALARM') || i.includes('KEIN Personal') || i.includes('Unterbesetzung'))
            .map(i => ({
                date: d.date,
                dayName: d.dayName,
                message: i
            }))
    );

    const renderMarkdown = (text: string) => {
        return text.split('\n').map((line, idx) => {
            if (line.startsWith('###')) return <h3 key={idx} className="text-lg font-bold text-indigo-800 mt-4 mb-2">{line.replace(/###/g, '')}</h3>;
            if (line.startsWith('**')) return <strong key={idx} className="block mt-2">{line.replace(/\*\*/g, '')}</strong>;
            if (line.startsWith('-') || line.startsWith('*')) return <li key={idx} className="ml-4 list-disc text-slate-700 mb-1">{line.replace(/[-*]/g, '')}</li>;
            if (line.match(/^\d\./)) return <div key={idx} className="font-semibold mt-2 text-slate-800">{line}</div>;
            return <p key={idx} className="text-slate-600 leading-relaxed mb-1">{line}</p>;
        });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-6 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <BarChart3 className="text-indigo-600" />
                        Analytics & Risk Radar
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Zeitraum: <span className="font-semibold text-slate-700">{data.startDate} - {data.endDate}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={() => handleAnalyzeRescheduling(getNextWorkingDay())}
                        disabled={isAnalyzingReschedule}
                        className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-purple-200 transition-colors flex items-center gap-2 border border-purple-200 shadow-sm"
                        title="Simuliert eine Umplanung für den nächsten Arbeitstag"
                    >
                        {isAnalyzingReschedule ? <Activity size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Test-Simulation
                    </button>

                    <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block"></div>

                    {/* Date Picker Group */}
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 border border-slate-200 shadow-inner">
                        <div className="flex items-center gap-2 px-2 border-r border-slate-300">
                            <Calendar size={14} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-500">Start:</span>
                            <input 
                                type="date" 
                                value={startDateISO}
                                onChange={(e) => setStartDateISO(e.target.value)}
                                className="bg-transparent border-none text-sm font-bold text-slate-800 focus:ring-0 p-0 w-28 cursor-pointer outline-none"
                            />
                        </div>
                        <select 
                            value={daysRange}
                            onChange={(e) => setDaysRange(Number(e.target.value))}
                            className="bg-transparent border-none rounded px-2 py-1 text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer outline-none hover:text-indigo-600"
                        >
                            <option value={14}>+ 14 Tage</option>
                            <option value={30}>+ 30 Tage</option>
                            <option value={60}>+ 60 Tage</option>
                        </select>
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowRight size={24} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                
                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase">Prognostizierte Ops</span>
                        <div className="flex items-center gap-2 mt-1">
                            <Activity className="text-blue-500" />
                            <span className="text-2xl font-bold text-slate-800">{totalOps}</span>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase">Kritische Tage</span>
                        <div className="flex items-center gap-2 mt-1">
                            <AlertTriangle className={highRiskDays > 0 ? "text-red-500" : "text-green-500"} />
                            <span className={`text-2xl font-bold ${highRiskDays > 0 ? "text-red-600" : "text-green-600"}`}>{highRiskDays}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Hohes Ausfallrisiko</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase">Burnout Risiko</span>
                        <div className="flex items-center gap-2 mt-1">
                            <Users className="text-orange-500" />
                            <span className="text-2xl font-bold text-slate-800">{burnoutCount}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Mitarbeiter überlastet</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase">Ø Auslastung</span>
                        <div className="flex items-center gap-2 mt-1">
                            <Scale className="text-teal-500" />
                            <span className="text-2xl font-bold text-slate-800 truncate">{avgUtilization}%</span>
                        </div>
                    </div>
                </div>

                {/* ALERT: ACTUAL PLANNING CONFLICTS */}
                {alertIssues.length > 0 && (
                    <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-5 animate-in slide-in-from-top-2 duration-500">
                        <div className="flex items-start gap-3">
                            <div className="bg-orange-100 p-2 rounded-full shrink-0">
                                <Ban className="text-orange-600" size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                                    🚨 Kritische Planungs-Konflikte
                                </h3>
                                <p className="text-sm text-orange-800 mt-1 mb-3">
                                    Das System hat für folgende Tage konkrete Konflikte (Unterbesetzung oder fehlende Qualifikation) im Plan gefunden.
                                </p>
                                <div className="space-y-2">
                                    {alertIssues.map((gap, idx) => (
                                        <div key={idx} className="bg-white border border-orange-200 rounded px-3 py-2 shadow-sm flex justify-between items-center">
                                            <span className="font-bold text-slate-700 w-24">{gap.dayName}, {gap.date}</span>
                                            <span className="font-mono text-xs text-red-600 font-bold flex items-center gap-2">
                                                <AlertOctagon size={12} /> {gap.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ALERT: CRITICAL CAPACITY & RESCHEDULING TRIGGER */}
                {criticalShortages.length > 0 && (
                    <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-5 animate-in slide-in-from-top-2 duration-500">
                        <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-2 rounded-full shrink-0">
                                <DoorClosed className="text-red-600" size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                                    Genereller Personalmangel - Saal-Schließung wahrscheinlich
                                </h3>
                                <p className="text-sm text-red-700 mt-1 mb-3">
                                    An folgenden Werktagen reicht die Gesamt-Personalzahl nicht aus, um alle 8 Säle zu betreiben.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {criticalShortages.map(shortage => (
                                        <div key={shortage.date} className="bg-white border border-red-200 rounded-lg p-3 shadow-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                                        {shortage.dayName}, {shortage.date}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5">
                                                        Nur {shortage.staff} MA verfügbar
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-red-600 font-bold flex items-center gap-1 justify-end">
                                                        <DoorClosed size={16} />
                                                        {shortage.deficit} Saal zu
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleAnalyzeRescheduling(shortage.date)}
                                                disabled={isAnalyzingReschedule}
                                                className="mt-1 w-full flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs py-2 rounded transition-colors font-bold"
                                            >
                                                {isAnalyzingReschedule ? (
                                                    <Activity size={12} className="animate-spin" />
                                                ) : (
                                                    <ArrowRightLeft size={12} />
                                                )}
                                                <span>Umplanungs-Vorschläge</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* RESCHEDULING RESULTS */}
                {reschedulingSuggestions.length > 0 && (
                    <div className="mb-8 bg-green-50 border border-green-200 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <CalendarCheck size={100} className="text-green-600" />
                        </div>
                        <div className="flex justify-between items-start relative z-10 mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
                                    <Sparkles size={18} /> Smarte Umplanungs-Vorschläge
                                </h3>
                                <p className="text-sm text-green-700 max-w-2xl mt-1">
                                     Die KI hat die abgesagten OPs analysiert und folgende optimale Ersatztermine gefunden.
                                </p>
                            </div>
                            <button 
                                onClick={() => exportReschedulingToCSV(reschedulingSuggestions)}
                                className="flex items-center gap-2 bg-white/80 hover:bg-white border border-green-300 text-green-800 px-3 py-1.5 rounded-lg shadow-sm transition-all text-xs font-bold"
                            >
                                <Download size={14} />
                                Exportieren
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                            {reschedulingSuggestions.map((opt, idx) => (
                                <div key={idx} className="bg-white border border-green-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                         <div className="text-xs font-bold text-slate-400 uppercase">Verschiebe OP</div>
                                         {opt.originalOp.priority === 'HIGH' && (
                                             <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">PRIO</span>
                                         )}
                                    </div>
                                    
                                    <div className="font-bold text-slate-800 mb-1">{opt.originalOp.procedure}</div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{opt.originalOp.dept}</span>
                                        <ArrowRight size={12} />
                                        <span>Ursprünglich: {opt.originalOp.room}</span>
                                    </div>
                                    
                                    <div className="border-t border-slate-100 my-2 pt-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold text-green-700">{opt.targetDate}</span>
                                            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                {opt.targetRoom}
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-1.5 mt-2">
                                            {opt.matchType === 'PERFECT_FIT' ? (
                                                <Combine size={14} className="text-green-500 shrink-0 mt-0.5" />
                                            ) : (
                                                <CheckCircle2 size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                            )}
                                            <p className="text-xs text-slate-600 leading-tight">
                                                {opt.reasoning}
                                            </p>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="bg-slate-50 p-1.5 rounded flex items-center gap-1.5" title="Geschätzter Umsatz">
                                                <Euro size={12} className="text-slate-400" />
                                                <span className="font-bold text-slate-700">{opt.metrics.revenueProtected} €</span>
                                            </div>
                                            <div className="bg-slate-50 p-1.5 rounded flex items-center gap-1.5" title="Auslastungs-Gewinn">
                                                <Timer size={12} className="text-slate-400" />
                                                <span className="font-bold text-green-600">+{opt.metrics.utilizationImpact}%</span>
                                            </div>
                                            {opt.metrics.batchingBonus && (
                                                <div className="col-span-2 bg-blue-50 border border-blue-100 text-blue-700 p-1.5 rounded font-bold flex items-center justify-center gap-1">
                                                    <Layers size={12} /> Cluster-Bonus (Rüstzeit gespart)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 text-center">
                            <button onClick={() => setReschedulingSuggestions([])} className="text-xs text-green-700 font-medium hover:underline">
                                Vorschläge schließen
                            </button>
                        </div>
                    </div>
                )}

                {/* AI EXECUTIVE REPORT */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Bot size={120} />
                    </div>
                    
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                            <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                <Sparkles size={20} className="text-indigo-500" />
                                AI Executive Report
                            </h3>
                            <p className="text-sm text-indigo-700/70 max-w-2xl">
                                Lassen Sie Gemini 2.5 die Statistiken analysieren und eine strategische Zusammenfassung für die Geschäftsführung erstellen.
                            </p>
                        </div>
                        {!reportText && !isGeneratingReport && (
                            <button 
                                onClick={handleGenerateReport}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2 transition-all hover:scale-105 font-medium text-sm"
                            >
                                <Bot size={18} />
                                Report generieren
                            </button>
                        )}
                    </div>

                    {isGeneratingReport && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                                <Sparkles className="animate-spin text-indigo-500" />
                            </div>
                            <p className="text-indigo-800 font-medium animate-pulse">Die KI analysiert Personalstrukturen und Risiken...</p>
                        </div>
                    )}

                    {reportText && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
                            <div className="prose prose-sm max-w-none text-slate-700">
                                {renderMarkdown(reportText)}
                            </div>
                            <div className="mt-4 pt-4 border-t border-indigo-100 flex justify-end gap-4">
                                <button 
                                    onClick={() => setReportText(null)}
                                    className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 uppercase tracking-wider"
                                >
                                    <X size={12} /> Schließen
                                </button>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(reportText);
                                        alert("Report kopiert!");
                                    }}
                                    className="text-xs font-bold text-indigo-400 hover:text-indigo-600 flex items-center gap-1 uppercase tracking-wider"
                                >
                                    <Copy size={12} /> In Zwischenablage kopieren
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* CHARTS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                    
                    {/* WIDGET 1: ROOM ROTATION */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                         <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <RefreshCw size={18} className="text-blue-500" />
                                    Saal-Rotation
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Verteilung der Mitarbeiter auf verschiedene Säle</p>
                            </div>
                        </div>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={rotationData} margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={80} />
                                    <Tooltip 
                                        cursor={{fill: '#f1f5f9'}} 
                                        contentStyle={{ borderRadius: '8px' }}
                                    />
                                    {allRooms.map((room, idx) => {
                                        const style = getDepartmentStyle(room); // Not strictly Dept, but consistent coloring
                                        return (
                                            <Bar 
                                                key={room} 
                                                dataKey={room} 
                                                stackId="a" 
                                                fill={style.hex} 
                                                radius={[0, 0, 0, 0]}
                                                barSize={15} 
                                            />
                                        );
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* WIDGET 2: CONFLICT TRENDS */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <TrendingUp size={18} className="text-red-500" />
                                Konflikt-Trend
                            </h3>
                            <span className="text-xs text-slate-400 font-mono">RISK-METRIC</span>
                        </div>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorKonflikte" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="Konflikte" stroke="#ef4444" fillOpacity={1} fill="url(#colorKonflikte)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* WIDGET 3: ABSENCE & SICKNESS */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <CalendarOff size={18} className="text-amber-500" />
                                Kapazität & Abwesenheit
                            </h3>
                            <div className="flex gap-2 text-[10px] flex-wrap">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Anwesend</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Frei</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-400"></div> Ruhe</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Urlaub</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> Krank</span>
                            </div>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={absenceData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px' }} />
                                    <Bar dataKey="Anwesend" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="Frei" stackId="a" fill="#cbd5e1" />
                                    <Bar dataKey="Ruhezeit" stackId="a" fill="#818cf8" />
                                    <Bar dataKey="Urlaub" stackId="a" fill="#fbbf24" />
                                    <Bar dataKey="Krank" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* WIDGET 4: DEPARTMENT HEATMAP */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <PieChart size={18} className="text-purple-500" />
                                Abteilungs-Bedarf
                            </h3>
                        </div>
                        <div className="h-64 flex items-center justify-center">
                            {deptData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={deptData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {deptData.map((entry, index) => {
                                                const style = getDepartmentStyle(entry.name);
                                                return <Cell key={`cell-${index}`} fill={style.hex} />;
                                            })}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    </RePieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-slate-400 text-sm italic">Keine Operationsdaten</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

