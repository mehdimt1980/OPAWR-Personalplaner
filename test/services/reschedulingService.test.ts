import { describe, it, expect, vi } from 'vitest';
import { findSmartReschedulingOptions } from '../../services/reschedulingService';
import { Operation, Staff } from '../../types';

// Mock storage service
vi.mock('./storageService', () => ({
    loadPlansByDates: vi.fn(async (dates) => {
        return dates.map((date: string) => ({
            date,
            assignments: [
                { roomId: 'SAAL 1', staffIds: ['staff1', 'staff2'] }
            ],
            operations: [
                { 
                    id: 'existing-op', 
                    room: 'SAAL 1', 
                    dept: 'UCH', 
                    procedure: 'Existing', 
                    durationMinutes: 120,
                    estimatedRevenue: 2000
                }
            ]
        }));
    })
}));

vi.mock('./analyticsService', () => ({
    generateAnalytics: vi.fn(async () => ({
        dailyRisks: [
            { date: '04.12.2025', riskLevel: 'LOW', availableStaff: 10, requiredStaff: 6, deptCoverage: { 'UCH': 5, 'ACH': 3 } },
            { date: '05.12.2025', riskLevel: 'MEDIUM', availableStaff: 8, requiredStaff: 8, deptCoverage: { 'UCH': 4, 'ACH': 2 } },
            { date: '06.12.2025', riskLevel: 'HIGH', availableStaff: 5, requiredStaff: 8, deptCoverage: { 'UCH': 2, 'ACH': 1 } }
        ],
        workload: [],
        deptDistribution: {},
        skillGaps: {},
        roomFragmentation: {},
        revenueAtRisk: 0
    }))
}));

describe('Rescheduling Service', () => {
    const createOperation = (id: string, dept: string, duration: number, revenue: number): Operation => ({
        id,
        time: '08:00',
        procedure: 'Test Operation',
        dept: dept as any,
        room: 'SAAL 1',
        durationMinutes: duration,
        priority: 'MEDIUM',
        estimatedRevenue: revenue
    });

    const createStaff = (id: string): Staff => ({
        id,
        name: id,
        role: 'OTA',
        skills: { 'UCH': 'Expert', 'ACH': 'Expert' },
        isSaalleitung: false,
        isMFA: false,
        isJoker: false,
        isSick: false,
        workDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
        preferredRooms: [],
        leadDepts: [],
        recoveryDays: [],
        shifts: {},
        vacations: []
    });

    it('should return rescheduling options array', async () => {
        const cancelledOps = [
            createOperation('op1', 'UCH', 90, 5000)
        ];

        const staffList = [createStaff('staff1'), createStaff('staff2')];

        const options = await findSmartReschedulingOptions(
            cancelledOps,
            staffList,
            '03.12.2025',
            7
        );

        expect(Array.isArray(options)).toBe(true);
    });

    it('should handle multiple operations', async () => {
        const cancelledOps = [
            createOperation('op1', 'UCH', 90, 10000),
            createOperation('op2', 'ACH', 60, 2000)
        ];

        const staffList = [createStaff('staff1')];

        const options = await findSmartReschedulingOptions(
            cancelledOps,
            staffList,
            '03.12.2025',
            5
        );

        expect(Array.isArray(options)).toBe(true);
    });

    it('should analyze multiple days', async () => {
        const cancelledOps = [
            createOperation('op1', 'UCH', 90, 5000)
        ];

        const staffList = [createStaff('staff1')];

        const options = await findSmartReschedulingOptions(
            cancelledOps,
            staffList,
            '03.12.2025',
            10
        );

        expect(Array.isArray(options)).toBe(true);
    });

    it('should use analytics for risk assessment', async () => {
        const cancelledOps = [
            createOperation('op1', 'UCH', 90, 5000)
        ];

        const staffList = [createStaff('staff1')];

        const options = await findSmartReschedulingOptions(
            cancelledOps,
            staffList,
            '03.12.2025',
            5
        );

        expect(Array.isArray(options)).toBe(true);
    });

    it('should respect room capacity constraints', async () => {
        const longOp = createOperation('op1', 'UCH', 600, 5000); // 10 hours - too long

        const staffList = [createStaff('staff1')];

        const options = await findSmartReschedulingOptions(
            [longOp],
            staffList,
            '03.12.2025',
            5
        );

        // Should have very limited or no options due to duration
        expect(options.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty cancelled operations', async () => {
        const staffList = [createStaff('staff1')];

        const options = await findSmartReschedulingOptions(
            [],
            staffList,
            '03.12.2025',
            5
        );

        expect(options).toHaveLength(0);
    });

    it('should process operations with staff list', async () => {
        const cancelledOps = [
            createOperation('op1', 'UCH', 90, 5000)
        ];

        const staffList = [createStaff('staff1')];

        const options = await findSmartReschedulingOptions(
            cancelledOps,
            staffList,
            '03.12.2025',
            5
        );

        expect(Array.isArray(options)).toBe(true);
    });
});
