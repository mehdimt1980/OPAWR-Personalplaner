
import React, { useState } from 'react';
import { RoomConfig } from '../../types';
import { Tag, X, Plus, Trash2, Save } from 'lucide-react';

interface RoomSettingsProps {
    departments: string[];
    rooms: RoomConfig[];
    onAddDept: (name: string) => void;
    onRemoveDept: (name: string) => void;
    onAddRoom: () => void;
    onRemoveRoom: (idx: number) => void;
    onRoomChange: (idx: number, field: keyof RoomConfig, value: any) => void;
    onToggleDept: (idx: number, dept: string) => void;
    onToggleTag: (idx: number, tag: string) => void;
    onSave: () => void;
}

export const RoomSettings: React.FC<RoomSettingsProps> = ({ 
    departments, rooms, onAddDept, onRemoveDept, onAddRoom, onRemoveRoom, 
    onRoomChange, onToggleDept, onToggleTag, onSave 
}) => {
    const [newDept, setNewDept] = useState('');

    const handleAddDept = () => {
        if (!newDept.trim()) return;
        onAddDept(newDept);
        setNewDept('');
    };

    return (
        <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                    <Tag size={16} /> Fachabteilungen (Skills)
                </h4>
                <div className="flex flex-wrap gap-2 mb-4">
                    {departments.map(dept => (
                        <div key={dept} className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                            {dept}
                            <button onClick={() => onRemoveDept(dept)} className="text-slate-400 hover:text-red-500 ml-1"><X size={12} /></button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={newDept} 
                        onChange={e => setNewDept(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddDept()}
                        placeholder="NEURO, DERMA..."
                        className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm uppercase font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button onClick={handleAddDept} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-slate-700"><Plus size={16} /></button>
                </div>
            </div>
            
            <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-800 mt-2">Saal-Konfiguration</h4>
                {rooms.map((room, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <input 
                                type="text" 
                                value={room.name}
                                onChange={(e) => onRoomChange(idx, 'name', e.target.value)}
                                className="font-bold text-slate-800 border-b border-slate-300 focus:border-blue-500 outline-none px-1 py-0.5 w-32"
                            />
                            <div className="flex-1"></div>
                            <button onClick={() => onRemoveRoom(idx)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><Trash2 size={16} /></button>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zuweisbare Abteilungen</span>
                                <div className="flex flex-wrap gap-1">
                                    {departments.map(dept => (
                                        <button key={dept} onClick={() => onToggleDept(idx, dept)} className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${room.primaryDepts.includes(dept) ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>
                                            {dept}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Eigenschaften</span>
                                <div className="flex flex-wrap gap-1">
                                    {['PRIORITY'].map(tag => (
                                        <button key={tag} onClick={() => onToggleTag(idx, tag)} className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${room.tags?.includes(tag) ? 'bg-amber-100 text-amber-700 border-amber-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={onAddRoom} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> Saal hinzufügen
            </button>
            
            <div className="pt-4 border-t flex justify-end">
                <button onClick={onSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"><Save size={18} /> Speichern</button>
            </div>
        </div>
    );
};
