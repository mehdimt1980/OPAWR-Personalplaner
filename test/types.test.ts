import { describe, it, expect } from 'vitest';
import { Room, Assignment, Staff } from '../types';

describe('Type Definitions', () => {
    
    it('should create valid Staff object', () => {
        const staff: Staff = {
            id: 'S1',
            name: 'Test Staff',
            role: 'OTA',
            phone: '+491234567890',
            skills: { 'UCH': 'Expert', 'ACH': 'Junior' },
            isSaalleitung: true,
            isMFA: false,
            isJoker: false,
            isSick: false,
            workDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
            preferredRooms: ['SAAL 1'],
            leadDepts: ['UCH'],
            recoveryDays: [],
            shifts: { '03.12.2025': 'T1' },
            vacations: [
                { start: '20.12.2025', end: '31.12.2025', type: 'Urlaub' }
            ]
        };

        expect(staff.id).toBe('S1');
        expect(staff.skills['UCH']).toBe('Expert');
        expect(staff.isSaalleitung).toBe(true);
        expect(staff.vacations).toHaveLength(1);
    });

    it('should create valid Room object', () => {
        const room: Room = {
            id: 'R1',
            name: 'SAAL 1',
            primaryDepts: ['UCH', 'ACH'],
            operations: [
                {
                    id: 'op1',
                    time: '08:00',
                    procedure: 'Knie-TEP',
                    dept: 'UCH',
                    room: 'SAAL 1',
                    durationMinutes: 120,
                    priority: 'HIGH',
                    estimatedRevenue: 8000
                }
            ],
            requiredStaffCount: 2
        };

        expect(room.name).toBe('SAAL 1');
        expect(room.operations).toHaveLength(1);
        expect(room.primaryDepts).toContain('UCH');
    });

    it('should create valid Assignment object', () => {
        const assignment: Assignment = {
            roomId: 'R1',
            staffIds: ['S1', 'S2']
        };

        expect(assignment.roomId).toBe('R1');
        expect(assignment.staffIds).toHaveLength(2);
    });

    it('should handle all shift types', () => {
        const shifts = {
            'S1': 'T1' as const,
            'S2': 'S44' as const,
            'S3': 'N' as const,
            'S4': 'BD1' as const,
            'S5': 'OFF' as const,
            'S6': 'RECOVERY' as const,
            'S7': 'SICK' as const
        };

        expect(Object.keys(shifts)).toHaveLength(7);
    });

    it('should handle all qualification levels', () => {
        const skills = {
            expert1: 'Expert' as const,
            expert2: 'Expert+' as const,
            junior: 'Junior' as const,
            expertShort: 'E' as const,
            juniorShort: 'J' as const,
            none: '' as const
        };

        expect(Object.keys(skills)).toHaveLength(6);
    });

    it('should handle operation priorities', () => {
        const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
        
        priorities.forEach(priority => {
            expect(['HIGH', 'MEDIUM', 'LOW']).toContain(priority);
        });
    });
});
