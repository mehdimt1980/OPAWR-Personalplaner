
import React, { useState } from 'react';
import { StaffProvider } from './contexts/StaffContext';
import { PlanProvider, usePlan } from './contexts/PlanContext';
import { UIProvider } from './contexts/UIContext';
import { useAuth } from './hooks/useAuth';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { WeeklyPlanGrid } from './components/WeeklyPlanGrid';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { StaffModal } from './components/StaffModal';
import { DataManagementModal } from './components/DataManagementModal';
import { UserManagementModal } from './components/UserManagementModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { OnboardingModal } from './components/OnboardingModal';
import { LoginScreen } from './components/LoginScreen';
import { PublicView } from './components/PublicView';
import { NetworkIndicator } from './components/NetworkIndicator';
import { useStaff } from './contexts/StaffContext';

// ── Inner app content (requires contexts) ────────────────────────────────────

const AppContent: React.FC<{ logout: () => void; userRole: string }> = ({ logout, userRole }) => {
    const {
        weekLabel, validationIssues, saveStatus, canUndo, canRedo,
        goNextWeek, goPrevWeek, handleAutoAssign, deleteCurrentPlan, undo, redo,
        isLoadingPlan
    } = usePlan();

    const { staffList } = useStaff();

    const [viewMode, setViewMode] = useState<'weekly' | 'analytics'>('weekly');
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showDataModal, setShowDataModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const isReadOnly = userRole === 'viewer';

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans flex flex-col">
            <NetworkIndicator isWorking={isLoadingPlan || saveStatus === 'saving'} />

            {/* ── Modals ──────────────────────────────────────────────────── */}
            <StaffModal isOpen={showStaffModal} onClose={() => setShowStaffModal(false)} />
            <DataManagementModal isOpen={showDataModal} onClose={() => setShowDataModal(false)} onRestoreComplete={() => window.location.reload()} />
            <UserManagementModal isOpen={showUserModal} onClose={() => setShowUserModal(false)} />
            <AiAssistantModal isOpen={showAiModal} onClose={() => setShowAiModal(false)} />
            <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

            {/* ── Header ──────────────────────────────────────────────────── */}
            <Header
                weekLabel={weekLabel}
                validationIssues={validationIssues}
                saveStatus={saveStatus}
                canUndo={canUndo}
                canRedo={canRedo}
                onPrevWeek={goPrevWeek}
                onNextWeek={goNextWeek}
                onAutoAssign={handleAutoAssign}
                onOpenAi={() => setShowAiModal(true)}
                onDeletePlan={deleteCurrentPlan}
                onUndo={undo}
                onRedo={redo}
                onToggleSidebar={() => setIsSidebarOpen(v => !v)}
            />

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Left sidebar (nav) */}
                <Sidebar
                    viewMode={viewMode}
                    setViewMode={setViewMode as any}
                    onOpenStaff={() => setShowStaffModal(true)}
                    onOpenData={() => setShowDataModal(true)}
                    onOpenUsers={() => setShowUserModal(true)}
                    onOpenHelp={() => setShowOnboarding(true)}
                    onLogout={logout}
                />

                {/* Main content */}
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100 relative">
                    {viewMode === 'weekly' && (
                        <div className="flex-1 overflow-auto p-2 md:p-4">
                            <WeeklyPlanGrid isReadOnly={isReadOnly} />
                        </div>
                    )}
                    {viewMode === 'analytics' && (
                        <div className="flex-1 overflow-hidden">
                            <AnalyticsDashboard
                                currentDate={new Date().toLocaleDateString('de-DE')}
                                staffList={staffList}
                                onClose={() => setViewMode('weekly')}
                            />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

// ── Root app with auth ────────────────────────────────────────────────────────

export const App: React.FC = () => {
    const isPublicView = window.location.pathname === '/view' || window.location.pathname === '/public';
    const { isAuthenticated, isAuthChecking, user, login, logout } = useAuth(isPublicView);

    if (isPublicView) return <PublicView />;
    if (isAuthChecking) return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-100">
            <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">OPAWR-Personalplaner wird geladen…</p>
            </div>
        </div>
    );
    if (!isAuthenticated) return <LoginScreen onLoginSuccess={login} />;

    return (
        <UIProvider>
            <StaffProvider>
                <PlanProvider isAuthenticated={isAuthenticated} isPublicView={isPublicView}>
                    <AppContent logout={logout} userRole={user?.role || 'viewer'} />
                </PlanProvider>
            </StaffProvider>
        </UIProvider>
    );
};

export default App;
