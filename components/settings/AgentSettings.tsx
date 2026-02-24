
import React from 'react';
import { Bot, Copy } from 'lucide-react';

export const AgentSettings: React.FC = () => {
    const mcpUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}/api/mcp/sse` : '/api/mcp/sse';

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-indigo-600 p-3 rounded-lg text-white shadow-lg shadow-indigo-600/20"><Bot size={24} /></div>
                    <div>
                        <h3 className="text-lg font-bold text-indigo-900">Model Context Protocol (MCP)</h3>
                        <p className="text-sm text-indigo-700">Verbinden Sie externe KI-Agenten mit diesem OP-Planer.</p>
                    </div>
                </div>

                <div className="bg-white border border-indigo-200 rounded-lg p-4 mb-4 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">SSE Connection URL</h4>
                    <div className="flex gap-2">
                        <input type="text" readOnly value={mcpUrl} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm font-mono text-slate-700 select-all" />
                        <button onClick={() => { navigator.clipboard.writeText(mcpUrl); alert("URL kopiert!"); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded border border-slate-200 transition-colors" title="Kopieren"><Copy size={18} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};
