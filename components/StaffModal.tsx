// @ts-nocheck

import React, { useRef, useState, useEffect } from 'react';
import { Staff, ShiftType } from '../types';
import { getStaffCsvTemplate, parseStaffCsv, getShiftCsvTemplate, parseShiftCsv, readCsvFile } from '../services/dataService';
import { bulkImportShifts } from '../services/storageService';
import { useStaff } from '../contexts/StaffContext';
import { usePlan } from '../contexts/PlanContext';
import { useUI } from '../contexts/UIContext';
import { WeeklyRoster } from './WeeklyRoster';
import { Users, X, Search, Plus, Trash2, Pencil, Shield, Briefcase, CalendarDays, Smartphone, Timer, UserCheck, Upload, ListOrdered, Crown, GraduationCap, Loader2, RefreshCw } from 'lucide-react';

// Sub-components
import { StaffEditForm } from './staff/StaffEditForm';
import { SpecialTimesTab } from './staff/SpecialTimesTab';
import { PairingTab } from './staff/PairingTab';
import { ImportExportTab } from './staff/ImportExportTab';

interface StaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentDate?: string;
    onShiftChange?: (date: string, staffId: string, shift: ShiftType) => void;
}

export const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose }) => {
    const { staffList, updateStaffList } = useStaff();
    const { pairings, addPairing, removePairing, appConfig } = usePlan();
    const { showToast, confirm } = useUI();
    
    const [activeTab, setActiveTab] = useState<'list' | 'roster' | 'special' | 'tandem' | 'import'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Staff>>({});
    const [isImporting, setIsImporting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const shiftInputRef = useRef<HTMLInputElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) { setSearchTerm(''); setEditingId(null); setActiveTab('list'); setIsImporting(false); }
    }, [isOpen]);

    if (!isOpen) return null;

    // --- Actions ---
    const handleDownloadTemplate = (type: 'staff' | 'shift') => {
        const template = type === 'staff' ? getStaffCsvTemplate() : getShiftCsvTemplate();
        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_vorlage.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'staff' | 'shift') => {
        const file = e.target.files?.[0];
        if (!file) return;
        readCsvFile(file).then(async (content) => {
            if (!content) return;
            if (type === 'staff') {
                const newStaff = parseStaffCsv(content, appConfig.logic, appConfig.departments);
                if (newStaff.length > 0 && await confirm({ title: 'Import', message: 'Dies ersetzt die aktuelle Liste. Fortfahren?', confirmText: 'Importieren', isDangerous: true })) {
                    updateStaffList(newStaff); showToast('Erfolg!', 'success');
                }
            } else {
                const entries = parseShiftCsv(content);
                if (entries.length > 0 && await confirm({ title: 'Dienstplan', message: 'Dienste aktualisieren?', confirmText: 'Importieren' })) {
                    setIsImporting(true);
                    try {
                        const count = await bulkImportShifts(entries, staffList);
                        showToast(`${count} Dienste importiert.`, 'success'); 
                        setTimeout(() => window.location.reload(), 1000);
                    } catch (error) {
                        showToast("Fehler beim Import", 'error');
                        setIsImporting(false);
                    }
                }
            }
        });
        e.target.value = '';
    };

    const handleSaveEdit = () => {
        if (!formData.name) { showToast("Name ist erforderlich", 'error'); return; }
        const updatedList = staffList.map(s => s.id === editingId ? { ...s, ...formData, id: formData.name } as Staff : s);
        updateStaffList(updatedList); setEditingId(null); showToast("Gespeichert", 'success');
    };

    const handleDelete = async (id: string) => {
        if (await confirm({ title: 'Löschen', message: 'Mitarbeiter dauerhaft löschen?', confirmText: 'Löschen', isDangerous: true })) {
            updateStaffList(staffList.filter(s => s.id !== id)); showToast("Gelöscht", 'info');
        }
    };

    const handleAddNew = () => {
        const newId = `Neu_${Date.now()}`;
        const newStaff: Staff = { id: newId, name: 'Neuer MA', role: 'OTA', skills: {}, isSaalleitung: false, isManagement: false, isMFA: false, isJoker: false, isSick: false, workDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'], preferredRooms: [], leadDepts: [], departmentPriority: [], recoveryDays: [], shifts: {}, vacations: [] };
        updateStaffList([newStaff, ...staffList]); setEditingId(newId); setFormData(newStaff);
        // Reset search term so the new entry is visible and scrolls to top
        setSearchTerm('');
        setTimeout(() => listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 relative">
                
                {/* IMPORT LOADING OVERLAY */}
                {isImporting && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-blue-100 rounded-full scale-150 animate-pulse opacity-50"></div>
                            <div className="bg-white p-6 rounded-3xl shadow-xl relative z-10 border border-slate-100">
                                <RefreshCw size={48} className="text-blue-600 animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Dienstplan wird verarbeitet</h2>
                        <p className="text-slate-500 max-w-md leading-relaxed">
                            Die Daten werden analysiert und in die Datenbank geschrieben. 
                            Dies kann bei großen Dateien bis zu 30 Sekunden dauern.
                        </p>
                        <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>
                            System arbeitet...
                        </div>
                    </div>
                )}

                {/* Beautiful Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="font-bold text-xl text-slate-900">Personalverwaltung</h2>
                            <p className="text-sm text-slate-500">{staffList.length} Mitarbeiter im System</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isImporting} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-0">
                        <X size={28} />
                    </button>
                </div>

                {/* Tabs with exact styling */}
                <div className="flex border-b border-slate-200 px-8 gap-12 bg-white shrink-0 overflow-x-auto scrollbar-hide">
                   {[ 
                       {id:'list', icon:Users, label:'Mitarbeiterliste'}, 
                       {id:'roster', icon:CalendarDays, label:'Dienstplan (Woche)'}, 
                       {id:'special', icon:Timer, label:'Sonderzeiten'}, 
                       {id:'tandem', icon:UserCheck, label:'Tandems & Training'}, 
                       {id:'import', icon:Upload, label:'Import / Export'} 
                   ]
                   .map(t => (
                       <button 
                           key={t.id} 
                           disabled={isImporting}
                           onClick={() => setActiveTab(t.id as any)} 
                           className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'} disabled:opacity-50`}
                       >
                           <t.icon size={18} /> {t.label}
                       </button>
                   ))}
                </div>

                <div className="flex-1 overflow-hidden bg-slate-50 p-6">
                    {activeTab === 'list' && (
                        <div className="h-full flex flex-col gap-6">
                            {/* Search & Add Bar */}
                            <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input 
                                        type="text" 
                                        placeholder="Nach Name oder Rolle suchen..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white text-slate-700 font-medium" 
                                    />
                                </div>
                                <button onClick={handleAddNew} className="bg-blue-600 text-white px-6 py-3.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95">
                                    <Plus size={20} /> 
                                    <span>Neu anlegen</span>
                                </button>
                            </div>

                            {/* Staff List Grid */}
                            <div ref={listContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-10">
                                {staffList
                                    .slice()
                                    // Sort Logic: 
                                    // 1. New items ("Neu_") go to top so user sees what they added.
                                    // 2. Everything else is alphabetical. 
                                    // 3. We NO LONGER force edited items to top, solving the jump issue.
                                    .sort((a, b) => {
                                        const aIsNew = a.id.startsWith('Neu_');
                                        const bIsNew = b.id.startsWith('Neu_');
                                        
                                        if (aIsNew && !bIsNew) return -1;
                                        if (!aIsNew && bIsNew) return 1;
                                        
                                        return a.name.localeCompare(b.name);
                                    })
                                    // Filter Logic: Include edited person even if they don't match search term to prevent the form disappearing
                                    .filter(s => 
                                        s.id === editingId || 
                                        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                        s.role.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .map(staff => {
                                        const expertSkillCount = Object.values(staff.skills).filter(lvl => lvl === 'Expert' || lvl === 'Expert+' || lvl === 'E').length;
                                        
                                        return editingId === staff.id ? (
                                            <StaffEditForm key={staff.id} formData={formData} setFormData={setFormData} activeDepartments={appConfig.departments} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} />
                                        ) : (
                                            <div key={staff.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between hover:shadow-lg transition-all group border-l-4 border-l-transparent hover:border-l-blue-500">
                                                <div className="flex items-center gap-6">
                                                    {/* Avatar / Icon Circle */}
                                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 shadow-inner ${staff.isSaalleitung ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                        {staff.isSaalleitung ? <Shield size={24} className="fill-amber-50" /> : staff.name.substring(0, 2).toUpperCase()}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <h3 className="font-bold text-slate-900 text-xl leading-none">{staff.name}</h3>
                                                        <div className="flex flex-wrap gap-2 items-center">
                                                            {/* Role Badge */}
                                                            <span className="text-[11px] font-bold bg-slate-50 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-100 flex items-center gap-1.5 uppercase">
                                                                <Briefcase size={12} /> {staff.role}
                                                            </span>

                                                            {/* Management Badge (Purple) */}
                                                            {staff.isManagement && (
                                                                <span className="text-[11px] bg-purple-50 text-purple-600 px-2.5 py-1 rounded-lg border border-purple-100 font-bold flex items-center gap-1.5 uppercase">
                                                                    <Crown size={12} /> OP-MGMT
                                                                </span>
                                                            )}

                                                            {/* Lead Specialty Badge (Amber) */}
                                                            {staff.isSaalleitung && staff.leadDepts?.length > 0 && (
                                                                <span className="text-[11px] bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200 font-bold uppercase">
                                                                    {staff.leadDepts.join(' > ')}
                                                                </span>
                                                            )}

                                                            {/* SMS Badge */}
                                                            {staff.phone && (
                                                                <span className="text-[11px] bg-green-50 text-green-600 px-2.5 py-1 rounded-lg border border-green-100 font-bold flex items-center gap-1.5 uppercase">
                                                                    <Smartphone size={12} /> SMS
                                                                </span>
                                                            )}

                                                            {/* Skill Count Badge (Blue) */}
                                                            {expertSkillCount > 0 && (
                                                                <span className="text-[11px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-100 font-bold flex items-center gap-1.5 uppercase">
                                                                    <GraduationCap size={12} /> {expertSkillCount} Experten-Skills
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-3 pr-2">
                                                    <button 
                                                        onClick={() => { setEditingId(staff.id); setFormData(staff); }} 
                                                        className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                        title="Bearbeiten"
                                                    >
                                                        <Pencil size={22} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(staff.id)} 
                                                        className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Mitarbeiter löschen"
                                                    >
                                                        <Trash2 size={22} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'roster' && (
                        <div className="h-full">
                            <WeeklyRoster staffList={staffList} onBack={() => setActiveTab('list')} isEmbedded onImport={() => shiftInputRef.current?.click()} />
                        </div>
                    )}

                    {activeTab === 'special' && (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            Sonderdienste werden im Wochenplan direkt eingetragen.
                        </div>
                    )}

                    {activeTab === 'tandem' && (
                        <PairingTab staffList={staffList} pairings={pairings} onAdd={addPairing} onRemove={removePairing} />
                    )}

                    {activeTab === 'import' && (
                        <ImportExportTab onDownloadStaffTemplate={() => handleDownloadTemplate('staff')} onDownloadShiftTemplate={() => handleDownloadTemplate('shift')} onStaffImportClick={() => fileInputRef.current?.click()} onShiftImportClick={() => shiftInputRef.current?.click()} />
                    )}
                </div>
                <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'staff')} />
                <input type="file" ref={shiftInputRef} accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'shift')} />
            </div>
        </div>
    );
};

