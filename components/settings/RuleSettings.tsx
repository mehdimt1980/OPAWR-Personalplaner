// @ts-nocheck

import React from 'react';
import { WeightConfig, ConstraintConfig } from '../../types';
import { Check, RotateCcw, Save } from 'lucide-react';

interface RuleSettingsProps {
    weights: WeightConfig;
    constraints: ConstraintConfig;
    onWeightChange: (key: string, value: string) => void;
    onConstraintChange: (key: string, checked: boolean) => void;
    onReset: () => void;
    onSave: () => void;
}

const WEIGHT_GROUPS = {
    competence: {
        title: "Kompetenz & Sicherheit",
        keys: ['EXPERT_MATCH_BONUS', 'JUNIOR_MATCH_BONUS', 'SECONDARY_SKILL_BONUS', 'UNQUALIFIED_PENALTY']
    },
    leadership: {
        title: "Führung & Hierarchie",
        keys: ['OP_MATCH_BONUS', 'ROOM_OWNER_BONUS', 'LEAD_ROLE_BONUS', 'WRONG_LEAD_PENALTY', 'DOUBLE_LEAD_PENALTY', 'DOUBLE_LEAD_SPRINGER_PENALTY']
    },
    social: {
        title: "Soziales & Präferenzen",
        keys: ['PAIRING_BONUS', 'PREFERRED_ROOM_BONUS', 'DEPT_PRIORITY_BONUS', 'DEPT_PRIORITY_MISMATCH_PENALTY']
    },
    misc: {
        title: "Springer & Sonstiges",
        keys: ['SPRINGER_EXPERT_BONUS', 'SPRINGER_JUNIOR_BONUS', 'JOKER_PENALTY']
    }
};

export const RuleSettings: React.FC<RuleSettingsProps> = ({ 
    weights, constraints, onWeightChange, onConstraintChange, onReset, onSave 
}) => {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wider border-b pb-1">Harte Regeln (Constraints)</h3>
                <div className="space-y-2">
                    {Object.entries(constraints).map(([key, val]) => (
                        <label key={key} className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                            <span className="text-sm font-medium text-slate-700">{key.replace(/_/g, ' ')}</span>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${val ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                                {val && <Check size={14} />}
                            </div>
                            <input type="checkbox" checked={val} onChange={(e) => onConstraintChange(key, e.target.checked)} className="hidden" />
                        </label>
                    ))}
                </div>
            </div>

            {Object.entries(WEIGHT_GROUPS).map(([groupKey, group]) => (
                <div key={groupKey} className="space-y-3">
                    <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wider border-b pb-1">{group.title}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {group.keys.map(key => {
                            const val = (weights as any)[key] ?? 0;
                            const isPenalty = key.includes('PENALTY');
                            const isLargeValue = Math.abs(val) > 5000;

                            return (
                                <div key={key} className={`bg-white p-3 rounded border ${isPenalty ? 'border-red-100 bg-red-50/20' : 'border-slate-200'}`}>
                                    <label className="block text-xs font-bold text-slate-500 mb-1" title={key}>{key.replace(/_/g, ' ')}</label>
                                    {isLargeValue ? (
                                        <input 
                                            type="number" 
                                            value={val} 
                                            onChange={(e) => onWeightChange(key, e.target.value)} 
                                            className="w-full border rounded px-2 py-1 text-sm font-mono text-right"
                                        />
                                    ) : (
                                        <>
                                            <input 
                                                type="range" min="-5000" max="5000" step="100" value={val} 
                                                onChange={(e) => onWeightChange(key, e.target.value)} 
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                                            />
                                            <div className="flex justify-between text-xs mt-1 font-mono">
                                                <span className="text-slate-400">-5000</span>
                                                <span className={`font-bold ${val < 0 ? 'text-red-600' : 'text-blue-700'}`}>{val}</span>
                                                <span className="text-slate-400">5000</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div className="pt-4 border-t flex justify-between items-center">
                <button onClick={onReset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium">
                    <RotateCcw size={12} /> Reset auf Standardwerte
                </button>
                <button onClick={onSave} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"><Save size={18} /> Regeln Speichern</button>
            </div>
        </div>
    );
};


