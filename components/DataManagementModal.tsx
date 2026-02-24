// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { createBackup, restoreBackup, clearAllData } from '../services/storageService';
import { usePlan } from '../contexts/PlanContext';
import { useStaff } from '../contexts/StaffContext';
import { RoomConfig, AppConfig, ShiftDef, SpecialRule, ProcedureRule, LogicConfig, CsvMappingConfig } from '../types';
import { DEFAULT_APP_CONFIG, DEFAULT_DEPARTMENTS, DEFAULT_WEIGHTS, DEFAULT_LOGIC_CONFIG, DEFAULT_TIMELINE, DEFAULT_CSV_MAPPING } from '../constants';
import { MOCK_STAFF, DEFAULT_ROOM_CONFIGS } from '../data/seedData';
import { Database, X, Settings, Clock, Sliders, BrainCircuit, Euro, FileSpreadsheet, Bot } from 'lucide-react';

// Sub-components
import { ShiftSettings } from './settings/ShiftSettings';
import { BackupSettings } from './settings/BackupSettings';
import { RoomSettings } from './settings/RoomSettings';
import { RuleSettings } from './settings/RuleSettings';
import { ProcedureSettings } from './settings/ProcedureSettings';
import { LogicSettings } from './settings/LogicSettings';
import { AgentSettings } from './settings/AgentSettings';
import { SystemSettings } from './settings/SystemSettings';

interface DataManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRestoreComplete: () => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({ isOpen, onClose, onRestoreComplete }) => {
    const { locations, updateLocations, appConfig, updateAppConfig } = usePlan();
    const { updateStaffList } = useStaff();
    const [activeTab, setActiveTab] = useState<'backup' | 'rooms' | 'shifts' | 'rules' | 'logic' | 'procedures' | 'system' | 'agent'>('backup');
    
    // Draft states for local editing
    const [localRooms, setLocalRooms] = useState<RoomConfig[]>([]);
    const [localRules, setLocalRules] = useState<AppConfig>(DEFAULT_APP_CONFIG);

    useEffect(() => {
        if (isOpen) {
            setLocalRooms([]);
            setLocalRules(appConfig ? {
                ...appConfig,
                departments: appConfig.departments?.length ? appConfig.departments : DEFAULT_DEPARTMENTS,
                shifts: appConfig.shifts || DEFAULT_APP_CONFIG.shifts,
                logic: appConfig.logic || DEFAULT_LOGIC_CONFIG,
                procedureRules: appConfig.procedureRules || [],
                csvMapping: appConfig.csvMapping || DEFAULT_CSV_MAPPING,
                timeline: appConfig.timeline || DEFAULT_TIMELINE,
                weights: { ...DEFAULT_WEIGHTS, ...appConfig.weights },
                constraints: appConfig.constraints || {},
            } : DEFAULT_APP_CONFIG);
        }
    }, [isOpen, appConfig]);

    if (!isOpen) return null;

    // --- SHARED PERSISTENCE ---
    const saveConfiguration = async () => {
        await updateAppConfig(localRules);
        alert("Konfiguration gespeichert!");
    };

    // --- SEEDING & BACKUP HANDLERS ---
    const handleSeed = async () => {
        if (!window.confirm("Standard-Daten laden? Dies überschreibt Personal und Einstellungen.")) return;
        await updateStaffList(MOCK_STAFF);
        await updateAppConfig(DEFAULT_APP_CONFIG);
        onRestoreComplete();
        onClose();
    };

    const handleDownload = async () => {
        const backup = await createBackup();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                if (window.confirm("Backup wiederherstellen? Dies überschreibt alle Daten.")) {
                    if (await restoreBackup(data)) { alert("Erfolgreich!"); onRestoreComplete(); onClose(); }
                }
            } catch (err) { alert("Fehler!"); }
        };
        reader.readAsText(file);
    };

    const handleClear = async () => {
        if (window.confirm("Wirklich alles löschen?")) { await clearAllData(); onRestoreComplete(); onClose(); }
    };

    // --- ROOM HANDLERS ---
    const handleAddDept = (name: string) => {
        const normalized = name.trim().toUpperCase();
        if (!localRules.departments.includes(normalized)) {
            setLocalRules(prev => ({ ...prev, departments: [...prev.departments, normalized] }));
        }
    };
    const handleRemoveDept = (dept: string) => {
        setLocalRules(prev => ({ ...prev, departments: prev.departments.filter(d => d !== dept) }));
    };
    const handleAddRoom = () => setLocalRooms([...localRooms, { id: `R_${Date.now()}`, name: `Neuer Saal`, primaryDepts: ['UCH'], tags: [] }]);
    const handleRemoveRoom = (idx: number) => setLocalRooms(prev => prev.filter((_, i) => i !== idx));
    const handleRoomChange = (idx: number, field: keyof RoomConfig, value: any) => {
        const next = [...localRooms];
        next[idx] = { ...next[idx], [field]: value };
        setLocalRooms(next);
    };
    const handleToggleDept = (idx: number, dept: string) => {
        const next = [...localRooms];
        const depts = next[idx].primaryDepts;
        next[idx].primaryDepts = depts.includes(dept) ? depts.filter(d => d !== dept) : [...depts, dept];
        if (next[idx].primaryDepts.length === 0) next[idx].primaryDepts = ['UCH'];
        setLocalRooms(next);
    };
    const handleToggleTag = (idx: number, tag: string) => {
        const next = [...localRooms];
        const tags = next[idx].tags || [];
        next[idx].tags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
        setLocalRooms(next);
    };

    // --- SHIFT HANDLERS ---
    const handleAddShift = (code: string) => {
        const newShift: ShiftDef = { label: code, start: '07:00', end: '15:30', color: 'bg-slate-100 text-slate-600', requiresRecovery: false, isAssignable: true };
        setLocalRules(prev => ({ ...prev, shifts: { ...prev.shifts, [code]: newShift } }));
    };
    const handleRemoveShift = (code: string) => {
        const next = { ...localRules.shifts };
        delete next[code];
        setLocalRules(prev => ({ ...prev, shifts: next }));
    };
    const handleShiftChange = (code: string, field: keyof ShiftDef, value: any) => {
        setLocalRules(prev => ({ ...prev, shifts: { ...prev.shifts, [code]: { ...prev.shifts[code], [field]: value } } }));
    };

    // --- RULES HANDLERS ---
    const handleWeightChange = (key: string, val: string) => setLocalRules(prev => ({ ...prev, weights: { ...prev.weights, [key]: parseInt(val) || 0 } }));
    const handleConstraintChange = (key: string, checked: boolean) => setLocalRules(prev => ({ ...prev, constraints: { ...prev.constraints, [key]: checked } }));

    // --- LOGIC HANDLERS ---
    // Fixed: Corrected type of 'cat' parameter to match LogicSettings expectations and LogicConfig structure
    const handleAddKeyword = (cat: 'saalleitung' | 'joker' | 'mfa' | 'exclusionKeywords', word: string) => {
        setLocalRules(prev => {
            const next = { ...prev.logic };
            if (cat === 'exclusionKeywords') {
                next.exclusionKeywords = [...(next.exclusionKeywords || []), word.toLowerCase()];
            } else {
                next.roleKeywords[cat] = [...(next.roleKeywords[cat] || []), word.toLowerCase()];
            }
            return { ...prev, logic: next };
        });
    };
    // Fixed: Corrected type of 'cat' parameter to match LogicSettings expectations and LogicConfig structure
    const handleRemoveKeyword = (cat: 'saalleitung' | 'joker' | 'mfa' | 'exclusionKeywords', word: string) => {
        setLocalRules(prev => {
            const next = { ...prev.logic };
            if (cat === 'exclusionKeywords') {
                next.exclusionKeywords = next.exclusionKeywords.filter(w => w !== word.toLowerCase());
            } else {
                next.roleKeywords[cat] = next.roleKeywords[cat].filter(w => w !== word.toLowerCase());
            }
            return { ...prev, logic: next };
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg"><Database className="text-indigo-600" size={20} /></div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-900">Daten & Konfiguration</h2>
                            <p className="text-xs text-slate-500">System-Einstellungen verwalten</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                </div>

                <div className="flex border-b border-slate-200 px-6 gap-6 bg-white shrink-0 overflow-x-auto custom-scrollbar">
                   {[
                       { id: 'backup', icon: Database, label: 'Backup' },
                       { id: 'agent', icon: Bot, label: 'Agent' },
                       { id: 'rooms', icon: Settings, label: 'Säle' },
                       { id: 'shifts', icon: Clock, label: 'Schichten' },
                       { id: 'rules', icon: Sliders, label: 'Regeln' },
                       { id: 'procedures', icon: Euro, label: 'Eingriffe' },
                       { id: 'logic', icon: BrainCircuit, label: 'Logik' },
                       { id: 'system', icon: FileSpreadsheet, label: 'System' }
                   ].map(tab => (
                       <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 uppercase tracking-wide shrink-0 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                         <tab.icon size={16} /> {tab.label}
                       </button>
                   ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                    {activeTab === 'backup' && <BackupSettings onSeed={handleSeed} onDownload={handleDownload} onUpload={handleUpload} onClear={handleClear} />}
                    {activeTab === 'shifts' && <ShiftSettings shifts={localRules.shifts} onShiftChange={handleShiftChange} onRemoveShift={handleRemoveShift} onAddShift={handleAddShift} onSave={saveConfiguration} />}
                    {activeTab === 'rooms' && <RoomSettings departments={localRules.departments} rooms={localRooms} onAddDept={handleAddDept} onRemoveDept={handleRemoveDept} onAddRoom={handleAddRoom} onRemoveRoom={handleRemoveRoom} onRoomChange={handleRoomChange} onToggleDept={handleToggleDept} onToggleTag={handleToggleTag} onSave={saveConfiguration} />}
                    {activeTab === 'rules' && <RuleSettings weights={localRules.weights} constraints={localRules.constraints} onWeightChange={handleWeightChange} onConstraintChange={handleConstraintChange} onReset={() => setLocalRules(prev => ({ ...prev, weights: DEFAULT_APP_CONFIG.weights }))} onSave={saveConfiguration} />}
                    {activeTab === 'procedures' && <ProcedureSettings rules={localRules.procedureRules} departments={localRules.departments} onAdd={r => setLocalRules(prev => ({ ...prev, procedureRules: [...prev.procedureRules, r] }))} onRemove={idx => setLocalRules(prev => ({ ...prev, procedureRules: prev.procedureRules.filter((_, i) => i !== idx) }))} onSave={saveConfiguration} />}
                    {activeTab === 'logic' && <LogicSettings logic={localRules.logic} departments={localRules.departments} onAddKeyword={handleAddKeyword} onRemoveKeyword={handleRemoveKeyword} onAddSpecialRule={() => setLocalRules(prev => ({ ...prev, logic: { ...prev.logic, specialRules: [...(prev.logic.specialRules || []), { triggerDept: 'UCH', requiredSkill: 'UCH', minLevel: 'Expert' }] } }))} onUpdateSpecialRule={(idx, f, v) => setLocalRules(prev => { const rules = [...(prev.logic.specialRules || [])]; rules[idx] = { ...rules[idx], [f]: v }; return { ...prev, logic: { ...prev.logic, specialRules: rules } }; })} onRemoveSpecialRule={idx => setLocalRules(prev => ({ ...prev, logic: { ...prev.logic, specialRules: prev.logic.specialRules.filter((_, i) => i !== idx) } }))} onSave={saveConfiguration} />}
                    {activeTab === 'agent' && <AgentSettings />}
                    {activeTab === 'system' && <SystemSettings timeline={localRules.timeline} csvMapping={localRules.csvMapping} onTimelineChange={(f, v) => setLocalRules(prev => ({ ...prev, timeline: { ...prev.timeline, [f]: parseInt(v) || 0 } }))} onAddCsvKeyword={(c, w) => setLocalRules(prev => { const map = { ...prev.csvMapping }; map[c] = [...(map[c] || []), w.toLowerCase()]; return { ...prev, csvMapping: map }; })} onRemoveCsvKeyword={(c, w) => setLocalRules(prev => { const map = { ...prev.csvMapping }; map[c] = map[c].filter(k => k !== w); return { ...prev, csvMapping: map }; })} onSave={saveConfiguration} />}
                </div>
            </div>
        </div>
    );
};


