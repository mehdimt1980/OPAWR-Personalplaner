// @ts-nocheck

import React from 'react';
import { Staff, QualificationLevel } from '../../types';
import { Save, Smartphone, Briefcase, Crown, Target, ListOrdered, ArrowUp, ArrowDown, X, Trash2, CalendarOff, GraduationCap, Plus } from 'lucide-react';

const SKILL_LEVELS: { value: QualificationLevel, label: string, color: string }[] = [
    { value: '', label: '-', color: 'bg-slate-50 text-slate-400' },
    { value: 'Junior', label: 'J', color: 'bg-blue-50 text-blue-600 font-bold' },
    { value: 'Expert', label: 'E', color: 'bg-indigo-100 text-indigo-700 font-bold border-indigo-200' },
];

interface StaffEditFormProps {
    formData: Partial<Staff>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<Staff>>>;
    activeDepartments: string[];
    onSave: () => void;
    onCancel: () => void;
}

export const StaffEditForm: React.FC<StaffEditFormProps> = ({ 
    formData, setFormData, activeDepartments, onSave, onCancel 
}) => {
    const [selectedPriorityDept, setSelectedPriorityDept] = React.useState('');

    const toggleWorkDay = (day: string) => {
        const currentDays = formData.workDays || [];
        const weekOrder = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        let newDays = currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day];
        newDays.sort((a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b));
        setFormData(prev => ({ ...prev, workDays: newDays }));
    };

    const toggleSkill = (dept: string) => {
        const current = formData.skills?.[dept] || '';
        let next: QualificationLevel = current === '' ? 'Junior' : current === 'Junior' ? 'Expert' : '';
        setFormData(prev => ({ ...prev, skills: { ...prev.skills, [dept]: next } }));
    };

    const toggleLeadDept = (dept: string) => {
        const current = formData.leadDepts || [];
        const next = current.includes(dept) ? current.filter(d => d !== dept) : [...current, dept];
        setFormData(prev => ({ ...prev, leadDepts: next }));
    };

    const addPriority = () => {
        if (!selectedPriorityDept || formData.departmentPriority?.includes(selectedPriorityDept)) return;
        setFormData(prev => ({ ...prev, departmentPriority: [...(prev.departmentPriority || []), selectedPriorityDept] }));
        setSelectedPriorityDept('');
    };

    const movePriority = (index: number, direction: 'up' | 'down') => {
        const current = [...(formData.departmentPriority || [])];
        if (direction === 'up' && index > 0) [current[index], current[index - 1]] = [current[index - 1], current[index]];
        else if (direction === 'down' && index < current.length - 1) [current[index], current[index + 1]] = [current[index + 1], current[index]];
        setFormData(prev => ({ ...prev, departmentPriority: current }));
    };

    return (
        <div className="bg-white rounded-xl border border-blue-300 shadow-lg p-5 animate-in fade-in zoom-in-95 duration-200 ring-4 ring-blue-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                        <input type="text" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 font-semibold" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rolle / Titel</label>
                        <input type="text" value={formData.role || ''} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Handynummer (SMS)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Smartphone className="h-4 w-4 text-slate-400" /></div>
                            <input type="text" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full pl-9 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm" placeholder="+49 170 12345678" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Verfügbare Arbeitstage</label>
                        <div className="flex flex-wrap gap-2">
                            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                                <button key={day} onClick={() => toggleWorkDay(day)} className={`w-8 h-8 rounded-full text-xs font-bold transition-all border ${formData.workDays?.includes(day) ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-blue-300 hover:text-blue-500'}`}>{day}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded border border-slate-200">
                            <input type="checkbox" checked={formData.isSaalleitung || false} onChange={(e) => setFormData({...formData, isSaalleitung: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium text-slate-700">Saalleitung</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded border border-slate-200">
                            <input type="checkbox" checked={formData.isJoker || false} onChange={(e) => setFormData({...formData, isJoker: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium text-slate-700">Joker / Student</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-purple-50 p-2 rounded border border-purple-200">
                            <input type="checkbox" checked={formData.isManagement || false} onChange={(e) => setFormData({...formData, isManagement: e.target.checked})} className="w-4 h-4 text-purple-600 rounded" />
                            <span className="text-sm font-bold text-purple-900 flex items-center gap-1"><Crown size={12} /> OP-Leitung / Stellv.</span>
                        </label>
                    </div>
                    {formData.isSaalleitung && (
                        <div className="mt-2 bg-amber-50 p-2 rounded border border-amber-100">
                            <label className="block text-[10px] font-bold text-amber-800 uppercase mb-2 flex items-center gap-1"><Target size={12} /> Leitung für welche Abteilung?</label>
                            <div className="flex flex-wrap gap-1.5">
                                {activeDepartments.map(dept => (
                                    <button key={dept} onClick={() => toggleLeadDept(dept)} className={`text-[10px] px-2 py-1 rounded border transition-colors ${formData.leadDepts?.includes(dept) ? 'bg-amber-500 text-white border-amber-600 font-bold' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>{dept}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Qualifikationen</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {activeDepartments.map(dept => {
                                const level = formData.skills?.[dept] || '';
                                const style = SKILL_LEVELS.find(s => s.value === level) || SKILL_LEVELS[0];
                                return (
                                    <button key={dept} onClick={() => toggleSkill(dept)} className={`flex flex-col items-center justify-center p-2 rounded border transition-all ${style.color} ${level ? 'border-current shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}>
                                        <span className="text-[10px] font-bold uppercase mb-0.5 text-slate-500">{dept}</span>
                                        <span className="text-xs">{style.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1"><ListOrdered size={12} /> Abteilungs-Priorität</label>
                        <div className="flex gap-2 mb-2">
                            <select value={selectedPriorityDept} onChange={(e) => setSelectedPriorityDept(e.target.value)} className="flex-1 p-1 text-xs border border-slate-300 rounded bg-white">
                                <option value="">Abteilung wählen...</option>
                                {activeDepartments.map(d => <option key={d} value={d} disabled={formData.departmentPriority?.includes(d)}>{d}</option>)}
                            </select>
                            <button onClick={addPriority} className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50" disabled={!selectedPriorityDept}><Plus size={14} /></button>
                        </div>
                        <div className="space-y-1">
                            {formData.departmentPriority?.map((dept, idx) => (
                                <div key={dept} className="flex items-center justify-between bg-white border border-slate-200 p-1.5 rounded">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-slate-200 text-slate-600 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold">{idx + 1}</span>
                                        <span className="text-xs font-bold text-slate-700">{dept}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => movePriority(idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30"><ArrowUp size={12} /></button>
                                        <button onClick={() => movePriority(idx, 'down')} disabled={idx === (formData.departmentPriority?.length || 0) - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30"><ArrowDown size={12} /></button>
                                        <button onClick={() => setFormData(prev => ({ ...prev, departmentPriority: prev.departmentPriority?.filter(d => d !== dept) }))} className="text-slate-400 hover:text-red-500 ml-1"><X size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                        <label className="block text-xs font-bold text-amber-800 uppercase mb-2 flex items-center gap-1"><CalendarOff size={12} /> Abwesenheiten</label>
                        {formData.vacations && formData.vacations.length > 0 ? (
                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                {formData.vacations.map((v, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-amber-200 text-xs">
                                        <div><span className="font-bold text-slate-700">{v.start} - {v.end}</span><span className="text-slate-400 ml-2">({v.type})</span></div>
                                        <button onClick={() => setFormData(prev => ({ ...prev, vacations: prev.vacations?.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-[10px] text-slate-400 italic text-center py-2">Keine Einträge.</p>}
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Abbrechen</button>
                <button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"><Save size={18} /> Speichern</button>
            </div>
        </div>
    );
};

