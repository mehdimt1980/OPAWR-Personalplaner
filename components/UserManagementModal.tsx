
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { AuthService } from '../services/authService';
import { Users, UserPlus, Trash2, Shield, ShieldAlert, X, Check, Loader2, KeyRound } from 'lucide-react';

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'editor' as UserRole });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (isOpen) fetchUsers();
    }, [isOpen]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const token = AuthService.getToken();
            const res = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Fix: Ensure ID is present by mapping _id (Mongo default) to id if missing
                const mappedUsers = data.map((u: any) => ({
                    ...u,
                    id: u.id || u._id
                }));
                setUsers(mappedUsers);
            } else {
                setError("Konnte Benutzer nicht laden.");
            }
        } catch (e) {
            setError("Verbindungsfehler.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdding(true);
        setError(null);

        try {
            const token = AuthService.getToken();
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newUser)
            });

            if (res.ok) {
                setNewUser({ username: '', password: '', name: '', role: 'editor' });
                fetchUsers(); // Refresh list
            } else {
                const errData = await res.json();
                setError(errData.error || "Fehler beim Erstellen.");
            }
        } catch (e) {
            setError("Verbindungsfehler.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!id) return;
        if (!window.confirm("Benutzer wirklich löschen?")) return;

        try {
            const token = AuthService.getToken();
            const res = await fetch(`/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchUsers();
            } else {
                const errData = await res.json();
                alert(errData.error);
            }
        } catch (e) {
            alert("Fehler beim Löschen.");
        }
    };

    const handleResetPassword = async (id: string, username: string) => {
        if (!id) return;
        if (!window.confirm(`Passwort für "${username}" zurücksetzen?\nDas temporäre Passwort wird angezeigt.`)) return;

        try {
            const token = AuthService.getToken();
            const res = await fetch(`/api/users/${id}/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Erfolg!\n\nNeues temporäres Passwort für ${username}: ${data.tempPassword}\n\nBitte notieren!`);
            } else {
                alert("Fehler beim Zurücksetzen.");
            }
        } catch (e) {
            alert("Verbindungsfehler.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Shield className="text-indigo-600" size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-900">Benutzerverwaltung</h2>
                            <p className="text-xs text-slate-500">Zugriffssteuerung & Rollen</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                    
                    {/* Add User Form */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <UserPlus size={16} /> Neuen Benutzer anlegen
                        </h3>
                        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input 
                                type="text" 
                                placeholder="Benutzername (Login)" 
                                className="border rounded px-3 py-2 text-sm"
                                value={newUser.username}
                                onChange={e => setNewUser({...newUser, username: e.target.value})}
                                required
                            />
                            <input 
                                type="text" 
                                placeholder="Anzeigename (z.B. Dr. Müller)" 
                                className="border rounded px-3 py-2 text-sm"
                                value={newUser.name}
                                onChange={e => setNewUser({...newUser, name: e.target.value})}
                                required
                            />
                            <input 
                                type="password" 
                                placeholder="Passwort" 
                                className="border rounded px-3 py-2 text-sm"
                                value={newUser.password}
                                onChange={e => setNewUser({...newUser, password: e.target.value})}
                                required
                            />
                            <select 
                                className="border rounded px-3 py-2 text-sm bg-white"
                                value={newUser.role}
                                onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                            >
                                <option value="editor">Planer (Editor)</option>
                                <option value="viewer">Nur Lesen (Viewer)</option>
                                <option value="admin">Administrator</option>
                            </select>
                            <div className="md:col-span-2 flex justify-end">
                                <button 
                                    type="submit" 
                                    disabled={isAdding}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isAdding ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                    Benutzer erstellen
                                </button>
                            </div>
                        </form>
                        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                    </div>

                    {/* User List */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Aktive Benutzer</h3>
                        
                        {loading ? (
                            <div className="text-center py-4 text-slate-400">Lade Benutzer...</div>
                        ) : (
                            users.map(user => (
                                <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                            user.role === 'admin' ? 'bg-indigo-500' : 
                                            user.role === 'editor' ? 'bg-blue-500' : 'bg-slate-400'
                                        }`}>
                                            {user.username.substring(0,1).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{user.name || user.username}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <span className="font-mono bg-slate-100 px-1 rounded">@{user.username}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                                    user.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {user.role}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleResetPassword(user.id, user.username)}
                                            className="text-slate-400 hover:text-amber-600 p-2 hover:bg-amber-50 rounded-lg transition"
                                            title="Passwort zurücksetzen"
                                        >
                                            <KeyRound size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition"
                                            title="Löschen"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
                    <ShieldAlert size={12} className="inline mr-1" />
                    Admins haben vollen Zugriff auf alle Einstellungen.
                </div>
            </div>
        </div>
    );
};
