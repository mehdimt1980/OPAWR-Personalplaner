import { describe, it, expect } from 'vitest';
import { 
    parseDate, 
    formatDate, 
    addDays, 
    getMonday, 
    getWeekDates,
    getDayOfWeek,
    isStaffOnVacation,
    isStaffScheduled,
    timeToMinutes,
    getResolutionSuggestions
} from '../../services/planningService';
import { Staff, Room, Assignment } from '../../types';

describe('Planning Service', () => {
    
    describe('Date Utilities', () => {
        it('should parse DD.MM.YYYY to Date object', () => {
            const date = parseDate('15.11.2025');
            expect(date.getFullYear()).toBe(2025);
            expect(date.getMonth()).toBe(10); // November = 10
            expect(date.getDate()).toBe(15);
        });

        it('should format Date to DD.MM.YYYY', () => {
            const date = new Date(2025, 10, 15); // Nov 15, 2025
            const formatted = formatDate(date);
            expect(formatted).toBe('15.11.2025');
        });

        it('should add days correctly', () => {
            const date = new Date(2025, 10, 15);
            const future = addDays(date, 5);
            expect(future.getDate()).toBe(20);
        });

        it('should get Monday of week', () => {
            const thursday = new Date(2025, 10, 20); // Nov 20 is Thursday
            const monday = getMonday(thursday);
            expect(monday.getDay()).toBe(1); // Monday
            expect(monday.getDate()).toBe(17);
        });

        it('should get week dates array', () => {
            const week = getWeekDates('20.11.2025'); // Thursday
            expect(week).toHaveLength(7);
            expect(week[0]).toBe('17.11.2025'); // Monday
            expect(week[6]).toBe('23.11.2025'); // Sunday
        });

        it('should get day of week abbreviation', () => {
            expect(getDayOfWeek('17.11.2025')).toBe('Mo'); // Monday
            expect(getDayOfWeek('20.11.2025')).toBe('Do'); // Thursday
            expect(getDayOfWeek('23.11.2025')).toBe('So'); // Sunday
        });
    });

    describe('Time Utilities', () => {
        it('should convert time string to minutes', () => {
            expect(timeToMinutes('07:30')).toBe(450);
            expect(timeToMinutes('12:00')).toBe(720);
            expect(timeToMinutes('23:59')).toBe(1439);
        });
    });

    describe('Staff Vacation Logic', () => {
        const createStaff = (vacations: any[] = []): Staff => ({
            id: 'test-1',
            name: 'Test',
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
            vacations
        });

        it('should return false if no vacations', () => {
            const staff = createStaff();
            expect(isStaffOnVacation(staff, '15.11.2025')).toBe(false);
        });

        it('should return true if date is within vacation range', () => {
            const staff = createStaff([
                { start: '10.11.2025', end: '20.11.2025', type: 'Urlaub' }
            ]);
            expect(isStaffOnVacation(staff, '15.11.2025')).toBe(true);
            expect(isStaffOnVacation(staff, '10.11.2025')).toBe(true); // Start
            expect(isStaffOnVacation(staff, '20.11.2025')).toBe(true); // End
        });

        it('should return false if date is outside vacation range', () => {
            const staff = createStaff([
                { start: '10.11.2025', end: '20.11.2025', type: 'Urlaub' }
            ]);
            expect(isStaffOnVacation(staff, '09.11.2025')).toBe(false);
            expect(isStaffOnVacation(staff, '21.11.2025')).toBe(false);
        });

        it('should handle multiple vacation periods', () => {
            const staff = createStaff([
                { start: '01.11.2025', end: '05.11.2025', type: 'Urlaub' },
                { start: '20.11.2025', end: '25.11.2025', type: 'Urlaub' }
            ]);
            expect(isStaffOnVacation(staff, '03.11.2025')).toBe(true);
            expect(isStaffOnVacation(staff, '22.11.2025')).toBe(true);
            expect(isStaffOnVacation(staff, '10.11.2025')).toBe(false);
        });
    });

    describe('Staff Scheduling Logic', () => {
        const createStaff = (id: string, shift: string = 'T1'): Staff => ({
            id,
            name: id,
            role: 'OTA',
            skills: { 'UCH': 'Expert' },
            isSaalleitung: false,
            isMFA: false,
            isJoker: false,
            isSick: false,
            workDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
            preferredRooms: [],
            leadDepts: [],
            recoveryDays: [],
            shifts: {},
            currentShift: shift as any,
            vacations: []
        });

        it('should detect if staff is scheduled for date', () => {
            const staff = createStaff('S1');
            expect(isStaffScheduled(staff, '03.12.2025')).toBe(true);
        });

        it('should return false if staff has OFF shift', () => {
            const staff = createStaff('S1', 'OFF');
            expect(isStaffScheduled(staff, '03.12.2025')).toBe(false);
        });
    });

    describe('Resolution Suggestions', () => {
        it('should test resolution logic exists', () => {
            // Resolution suggestions require full context with assignments
            // This is tested in integration tests
            expect(typeof getResolutionSuggestions).toBe('function');
        });
    });
});
