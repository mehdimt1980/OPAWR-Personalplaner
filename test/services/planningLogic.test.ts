
import { describe, it, expect } from 'vitest';
import { isQualifiedForRoom, calculateScore, getDominantDepartment } from '../../services/planningLogic';
import { Staff, Room, Dept } from '../../types';
import { DEFAULT_APP_CONFIG } from '../../constants';

// Mocks
const mockStaff = (id: string, skills: Partial<Record<string, string>>, isSaalleitung = false, leadDepts: string[] = []): Staff => ({
    id,
    name: id,
    role: 'OTA',
    skills: skills as any,
    isSaalleitung,
    isMFA: false,
    isJoker: false,
    isSick: false,
    workDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
    preferredRooms: [],
    leadDepts,
    recoveryDays: [],
    shifts: {},
    vacations: []
});

const mockRoom = (id: string, primaryDepts: Dept[], operations: any[] = []): Room => ({
    id,
    name: id,
    primaryDepts,
    operations,
    requiredStaffCount: 2
});

describe('Planning Logic Core', () => {
    
    describe('isQualifiedForRoom', () => {
        it('should return true if staff is Expert in primary dept', () => {
            const staff = mockStaff('Nurse1', { 'UCH': 'Expert' });
            const room = mockRoom('SAAL 1', ['UCH']);
            expect(isQualifiedForRoom(staff, room)).toBe(true);
        });

        it('should return true if staff is Junior in primary dept', () => {
            const staff = mockStaff('Junior1', { 'UCH': 'Junior' });
            const room = mockRoom('SAAL 1', ['UCH']);
            expect(isQualifiedForRoom(staff, room)).toBe(true);
        });

        it('should return false if staff has no matching skill', () => {
            const staff = mockStaff('Nurse2', { 'GCH': 'Expert' });
            const room = mockRoom('SAAL 1', ['UCH']);
            expect(isQualifiedForRoom(staff, room)).toBe(false);
        });

        it('should check for Robotics skill if room is SAAL 5', () => {
            const staffNoRobo = mockStaff('NoRobo', { 'URO': 'Expert' });
            const staffRobo = mockStaff('RoboExpert', { 'URO': 'Expert', 'DA_VINCI': 'Expert' });
            const room = mockRoom('SAAL 5', ['URO']); // SAAL 5 Implies Robotics

            expect(isQualifiedForRoom(staffNoRobo, room)).toBe(false);
            expect(isQualifiedForRoom(staffRobo, room)).toBe(true);
        });
        
        it('should validate based on Operation dept if room is shared', () => {
            // Room is UCH, but doing ACH op
            const staff = mockStaff('AchExpert', { 'ACH': 'Expert' });
            const room = mockRoom('SAAL 1', ['UCH'], [{ dept: 'ACH' }]);
            
            expect(isQualifiedForRoom(staff, room)).toBe(true);
        });
    });

    describe('calculateScore', () => {
        const weights = DEFAULT_APP_CONFIG.weights;

        it('should score Lead highest for Slot 0 if they lead that dept', () => {
            const lead = mockStaff('Rita', { 'UCH': 'Expert' }, true, ['UCH']);
            const room = mockRoom('SAAL 1', ['UCH']);
            
            const score = calculateScore(lead, room, 0, 'UCH', [], weights);
            expect(score).toBeGreaterThan(4000);
        });

        it('should penalize placing a second Lead in Slot 1', () => {
            const lead1 = mockStaff('Rita', { 'UCH': 'Expert' }, true);
            const lead2 = mockStaff('Marisa', { 'UCH': 'Expert' }, true);
            const room = mockRoom('SAAL 1', ['UCH']);
            
            // Slot 1 (Springer), team already has a lead
            const score = calculateScore(lead2, room, 1, 'UCH', [lead1], weights);
            expect(score).toBeLessThan(0); // Should be negative heavily
        });

        it('should prioritize preferences', () => {
            const staffPref = mockStaff('Fan', { 'UCH': 'Expert' });
            staffPref.preferredRooms = ['SAAL 1'];
            
            const staffNoPref = mockStaff('Neutral', { 'UCH': 'Expert' });
            
            const room = mockRoom('SAAL 1', ['UCH']);
            
            const scorePref = calculateScore(staffPref, room, 1, 'UCH', [], weights);
            const scoreNoPref = calculateScore(staffNoPref, room, 1, 'UCH', [], weights);
            
            expect(scorePref).toBeGreaterThan(scoreNoPref);
        });

        it('should return huge negative score if not qualified', () => {
            const staff = mockStaff('Wrong', { 'GCH': 'Expert' });
            const room = mockRoom('SAAL 1', ['UCH']);
            const score = calculateScore(staff, room, 0, 'UCH', [], weights);
            expect(score).toBe(-10000);
        });
    });

    describe('getDominantDepartment', () => {
        it('should return primary dept if no ops', () => {
            const room = mockRoom('SAAL 1', ['UCH']);
            expect(getDominantDepartment(room)).toBe('UCH');
        });

        it('should return DA_VINCI for SAAL 5', () => {
            const room = mockRoom('SAAL 5', ['URO']);
            expect(getDominantDepartment(room)).toBe('DA_VINCI');
        });

        it('should infer dominant dept from operations', () => {
            const room = mockRoom('SAAL 1', ['UCH'], [
                { dept: 'ACH' }, { dept: 'ACH' }, { dept: 'UCH' }
            ]);
            expect(getDominantDepartment(room)).toBe('ACH');
        });
    });
});
