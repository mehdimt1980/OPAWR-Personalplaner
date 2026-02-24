
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Database, 
  FileSpreadsheet, 
  LogOut, 
  Upload, 
  Download,
  Monitor,
  MoreHorizontal,
  ChevronLeft,
  Mic,
  BarChart3,
  Shield,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  viewMode: 'daily' | 'weekly' | 'analytics';
  setViewMode: (mode: 'daily' | 'weekly' | 'analytics') => void;
  onOpenStaff: () => void;
  onOpenData: () => void;
  onOpenUsers: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onDownloadTemplate?: () => void;
  onVoiceFeedback?: () => void;
  onOpenHelp: () => void;
  onLogout: () => void;
}

const getNavItemClass = (active: boolean) => `
  w-full flex flex-col items-center justify-center gap-1 py-3 px-1 transition-all duration-200 border-l-4
  ${active 
    ? 'border-blue-500 bg-slate-800 text-blue-400' 
    : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800'}
`;

export const Sidebar: React.FC<SidebarProps> = ({
  viewMode,
  setViewMode,
  onOpenStaff,
  onOpenData,
  onOpenUsers,
  onImport,
  onExport,
  onDownloadTemplate,
  onVoiceFeedback,
  onOpenHelp,
  onLogout
}) => {
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuth(false);
  const isViewer = user?.role === 'viewer';
  const isAdmin = user?.role === 'admin';
  
  const openPublicView = () => {
    window.open('/view', '_blank');
  };

  return (
    <aside className="w-16 md:w-20 bg-slate-900 flex flex-col items-center h-full py-4 shadow-xl z-40 shrink-0 print:hidden relative transition-all">
      <div className="mb-4 md:mb-6 p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/50">
        <LayoutDashboard className="text-white" size={24} />
      </div>

      {!showMore ? (
          <>
            <div className="flex flex-col w-full gap-1 md:gap-2 animate-in slide-in-from-left-4 duration-300 fade-in">
                <button
                  onClick={() => setViewMode('weekly')}
                  title="Wochenplan"
                  className={getNavItemClass(viewMode === 'weekly' || viewMode === 'daily')}
                >
                  <LayoutDashboard size={24} strokeWidth={(viewMode === 'weekly' || viewMode === 'daily') ? 2.5 : 2} />
                  <span className="text-[9px] font-medium tracking-wide hidden md:block">Wochenplan</span>
                </button>

                {!isViewer && (
                  <button
                    onClick={onOpenStaff}
                    title="Personal"
                    className={getNavItemClass(false)}
                  >
                    <Users size={24} strokeWidth={2} />
                    <span className="text-[9px] font-medium tracking-wide hidden md:block">Personal</span>
                  </button>
                )}
                
                <div className="px-2 py-1 w-full mt-1">
                   <button 
                      onClick={() => setShowMore(true)}
                      className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center group relative"
                      title="Mehr Optionen (Analyse, Admin, Export)"
                   >
                      <MoreHorizontal size={24} />
                      <span className="absolute left-full ml-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50 shadow-lg">Mehr</span>
                   </button>
                </div>
            </div>

            <div className="mt-auto flex flex-col gap-4 w-full px-2">
                {user && (
                    <div className="flex flex-col items-center text-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white mb-1 ${user.role === 'admin' ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                            {user.username.substring(0,1).toUpperCase()}
                        </div>
                    </div>
                )}

                {!isViewer && (
                  <button 
                    onClick={onVoiceFeedback}
                    className="w-full h-10 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 group relative"
                    title="Feedback geben"
                  >
                    <Mic size={20} />
                  </button>
                )}

                <button 
                  onClick={onOpenHelp}
                  className="w-full flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 transition gap-1 group relative"
                  title="Hilfe & Anleitung"
                >
                  <HelpCircle size={20} />
                  <span className="text-[9px] hidden md:block">Hilfe</span>
                </button>

                <button 
                  onClick={openPublicView}
                  className="w-full flex flex-col items-center justify-center text-slate-500 hover:text-green-400 transition gap-1 group relative"
                  title="TV Modus (Öffentliche Ansicht)"
                >
                  <Monitor size={20} />
                  <span className="text-[9px] hidden md:block">TV</span>
                </button>
            </div>
          </>
      ) : (
          <div className="flex flex-col w-full gap-2 animate-in slide-in-from-left-4 duration-300 fade-in h-full">
              <button 
                 onClick={() => setShowMore(false)}
                 className="w-full py-2 text-slate-400 hover:text-white flex flex-col items-center mb-2"
              >
                  <ChevronLeft size={24} />
                  <span className="text-[10px]">Zurück</span>
              </button>

              {/* MOVED TO "MEHR" SECTION */}
              {!isViewer && (
                  <button
                    onClick={() => setViewMode('analytics')}
                    title="Analyse"
                    className={getNavItemClass(viewMode === 'analytics')}
                  >
                    <BarChart3 size={24} strokeWidth={viewMode === 'analytics' ? 2.5 : 2} />
                    <span className="text-[9px] font-medium tracking-wide">Analyse</span>
                  </button>
              )}

              {isAdmin && (
                  <button
                      onClick={onOpenUsers}
                      title="Benutzer & Rollen"
                      className={getNavItemClass(false)}
                  >
                      <Shield size={24} strokeWidth={2} className="text-indigo-400" />
                      <span className="text-[9px] font-medium tracking-wide">Admin</span>
                  </button>
              )}

              {!isViewer && (
                <button
                    onClick={onOpenData}
                    title="Datenbank"
                    className={getNavItemClass(false)}
                  >
                    <Database size={24} strokeWidth={2} />
                    <span className="text-[9px] font-medium tracking-wide">Daten</span>
                </button>
              )}

              {!isViewer && (
                <button
                    onClick={onExport}
                    title="Export Excel"
                    className={getNavItemClass(false)}
                  >
                    <FileSpreadsheet size={24} strokeWidth={2} />
                    <span className="text-[9px] font-medium tracking-wide">Export</span>
                </button>
              )}

              {!isViewer && (
                  <button
                      onClick={onDownloadTemplate}
                      title="Vorlage"
                      className={getNavItemClass(false)}
                    >
                      <Download size={24} strokeWidth={2} />
                      <span className="text-[9px] font-medium tracking-wide">Vorlage</span>
                  </button>
              )}

              <div className="mt-auto w-full px-2">
                  <button
                    onClick={onLogout}
                    title="Abmelden"
                    className="w-full py-3 flex flex-col items-center justify-center text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <LogOut size={20} />
                    <span className="text-[10px] mt-1">Logout</span>
                  </button>
              </div>
          </div>
      )}
    </aside>
  );
};
