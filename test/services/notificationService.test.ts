import { describe, it, expect } from 'vitest';
import { NotificationService } from '../../services/notificationService';
import { Assignment, Room, Staff } from '../../types';

describe('Notification Service', () => {
    
    const createStaff = (id: string, name: string, phone?: string): Staff => ({
        id,
        name,
        phone,
        role: 'OTA',
        skills: {},
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

    const createRoom = (id: string, name: string): Room => ({
        id,
        name,
        primaryDepts: ['UCH'],
        operations: [
            { id: 'op1', time: '08:00', procedure: 'Test', dept: 'UCH', room: name, durationMinutes: 90, priority: 'MEDIUM', estimatedRevenue: 5000 }
        ],
        requiredStaffCount: 2
    });

    describe('generatePlanMessages', () => {
        it('should generate messages for assigned staff with phone numbers', () => {
            const staffList = [
                createStaff('S1', 'Alice', '+491234567890'),
                createStaff('S2', 'Bob', '+491234567891')
            ];

            const rooms = [createRoom('R1', 'SAAL 1')];
            const assignments: Assignment[] = [
                { roomId: 'R1', staffIds: ['S1', 'S2'] }
            ];

            const messages = NotificationService.generatePlanMessages(
                '03.12.2025',
                assignments,
                rooms,
                staffList
            );

            expect(messages).toHaveLength(2);
            expect(messages[0].to).toBe('+491234567890');
            expect(messages[0].body).toContain('Alice');
            expect(messages[0].body).toContain('SAAL 1');
            expect(messages[0].body).toContain('03.12.2025');
        });

        it('should skip staff without phone numbers', () => {
            const staffList = [
                createStaff('S1', 'Alice'), // No phone
                createStaff('S2', 'Bob', '+491234567891')
            ];

            const rooms = [createRoom('R1', 'SAAL 1')];
            const assignments: Assignment[] = [
                { roomId: 'R1', staffIds: ['S1', 'S2'] }
            ];

            const messages = NotificationService.generatePlanMessages(
                '03.12.2025',
                assignments,
                rooms,
                staffList
            );

            expect(messages).toHaveLength(1);
            expect(messages[0].staffId).toBe('S2');
        });

        it('should include role information (Leitung vs Springer)', () => {
            const staffList = [
                createStaff('S1', 'Alice', '+491234567890'),
                createStaff('S2', 'Bob', '+491234567891')
            ];

            const rooms = [createRoom('R1', 'SAAL 1')];
            const assignments: Assignment[] = [
                { roomId: 'R1', staffIds: ['S1', 'S2'] }
            ];

            const messages = NotificationService.generatePlanMessages(
                '03.12.2025',
                assignments,
                rooms,
                staffList
            );

            expect(messages[0].body).toContain('Leitung'); // First person is lead
            expect(messages[1].body).toContain('Springer'); // Second is support
        });

        it('should include partner names in message', () => {
            const staffList = [
                createStaff('S1', 'Alice', '+491234567890'),
                createStaff('S2', 'Bob', '+491234567891')
            ];

            const rooms = [createRoom('R1', 'SAAL 1')];
            const assignments: Assignment[] = [
                { roomId: 'R1', staffIds: ['S1', 'S2'] }
            ];

            const messages = NotificationService.generatePlanMessages(
                '03.12.2025',
                assignments,
                rooms,
                staffList
            );

            expect(messages[0].body).toContain('Bob'); // Alice's partner
            expect(messages[1].body).toContain('Alice'); // Bob's partner
        });

        it('should include start time from first operation', () => {
            const staffList = [
                createStaff('S1', 'Alice', '+491234567890')
            ];

            const rooms = [createRoom('R1', 'SAAL 1')];
            const assignments: Assignment[] = [
                { roomId: 'R1', staffIds: ['S1'] }
            ];

            const messages = NotificationService.generatePlanMessages(
                '03.12.2025',
                assignments,
                rooms,
                staffList
            );

            expect(messages[0].body).toContain('08:00');
        });

        it('should handle empty assignments', () => {
            const staffList = [createStaff('S1', 'Alice', '+491234567890')];
            const rooms = [createRoom('R1', 'SAAL 1')];

            const messages = NotificationService.generatePlanMessages(
                '03.12.2025',
                [],
                rooms,
                staffList
            );

            expect(messages).toHaveLength(0);
        });

        it('should handle room with no operations (default time)', () => {
            const staffList = [
                createStaff('S1', 'Alice', '+491234567890')
            ];

            const room: Room = {
                id: 'R1',
                name: 'SAAL 1',
                primaryDepts: ['UCH'],
                operations: [], // No ops
                requiredStaffCount: 2
            };

            const assignments: Assignment[] = [
                { roomId: 'R1', staffIds: ['S1'] }
            ];

            const messages = NotificationService.generatePlanMessages(
                '03.12.2025',
                assignments,
                [room],
                staffList
            );

            expect(messages[0].body).toContain('07:30'); // Default time
        });
    });
});
