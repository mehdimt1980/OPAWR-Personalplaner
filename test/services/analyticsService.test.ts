import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAnalytics } from '../../services/analyticsService';
import { Staff } from '../../types';

// Mock storage service
vi.mock('./storageService', () => ({
    loadPlansByDates: vi.fn(async (dates) => {
        return dates.map((date: string) => ({
            date,
            assignments: [
                { roomId: 'SAAL_1', staffIds: ['staff1', 'staff2'] },
                { roomId: 'SAAL_2', staffIds: ['staff3'] }
            ],
            operations: [
                { id: 'op1', dept: 'UCH', procedure: 'Test', estimatedRevenue: 5000 },
                { id: 'op2', dept: 'ACH', procedure: 'Test', estimatedRevenue: 3000 }
            ],
            staffShifts: {
                'staff1': 'T1',
                'staff2': 'T1',
                'staff3': 'T1'
            }
        }));
    })
}));

describe('Analytics Service', () => {
    const createStaff = (id: string, name: string, skills: any = {}): Staff => ({
        id,
        name,
        role: 'OTA',
        skills,
        isSaalleitung: id === 'staff1',
        isMFA: false,
        isJoker: false,
        isSick: false,
        workDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
        preferredRooms: [],
        leadDepts: id === 'staff1' ? ['UCH'] : [],
        recoveryDays: [],
        shifts: {},
        vacations: []
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate analytics summary', async () => {
        const staffList = [
            createStaff('staff1', 'Alice', { 'UCH': 'Expert' }),
            createStaff('staff2', 'Bob', { 'ACH': 'Expert' }),
            createStaff('staff3', 'Charlie', { 'UCH': 'Junior' })
        ];

        const analytics = await generateAnalytics('01.12.2025', staffList, 7);

        expect(analytics).toBeDefined();
        expect(analytics.dailyRisks).toBeDefined();
        expect(analytics.workload).toBeDefined();
        expect(analytics.deptDistribution).toBeDefined();
        expect(analytics.dailyRisks.length).toBeGreaterThan(0);
    });

    it('should track staff workload', async () => {
        const staffList = [
            createStaff('staff1', 'Alice', { 'UCH': 'Expert' }),
            createStaff('staff2', 'Bob', { 'ACH': 'Expert' }),
            createStaff('staff3', 'Charlie', { 'UCH': 'Junior' })
        ];

        const analytics = await generateAnalytics('01.12.2025', staffList, 5);

        expect(analytics.workload).toBeDefined();
        expect(Array.isArray(analytics.workload)).toBe(true);
    });

    it('should calculate department demand', async () => {
        const staffList = [
            createStaff('staff1', 'Alice', { 'UCH': 'Expert' })
        ];

        const analytics = await generateAnalytics('01.12.2025', staffList, 3);

        expect(analytics.deptDistribution).toBeDefined();
        expect(typeof analytics.deptDistribution).toBe('object');
    });

    it('should identify risk levels', async () => {
        const staffList = [
            createStaff('staff1', 'Alice', { 'UCH': 'Expert' })
        ];

        const analytics = await generateAnalytics('01.12.2025', staffList, 7);

        expect(analytics.dailyRisks).toBeDefined();
        analytics.dailyRisks.forEach(risk => {
            expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(risk.riskLevel);
        });
    });

    it('should handle empty staff list gracefully', async () => {
        const analytics = await generateAnalytics('01.12.2025', [], 3);

        expect(analytics).toBeDefined();
        expect(Array.isArray(analytics.workload)).toBe(true);
    });

    it('should calculate revenue at risk', async () => {
        const staffList = [
            createStaff('staff1', 'Alice', { 'UCH': 'Expert' })
        ];

        const analytics = await generateAnalytics('01.12.2025', staffList, 3);

        expect(analytics.revenueAtRisk).toBeDefined();
        expect(typeof analytics.revenueAtRisk).toBe('number');
    });
});
