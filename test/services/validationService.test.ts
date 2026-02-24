
import { describe, it, expect } from 'vitest';
import { validatePlan } from '../../services/validationService';
import { Staff, Room, Assignment } from '../../types';

// Helper Factories
const createStaff = (id: string, skills: any): Staff => ({
    id, name: id, role: 'OTA', skills, isSaalleitung: false, 
    isMFA: false, isJoker: false, isSick: false, workDays: [], 
    preferredRooms: [], leadDepts: [], recoveryDays: [], shifts: {}, vacations: []
});

const createRoom = (id: string, primaryDepts: any[], ops: any[] = []): Room => ({
    id, name: id, primaryDepts, operations: ops, requiredStaffCount: 2
});

describe('Validation Service', () => {

    it('should detect double bookings (Error)', () => {
        const staff = [createStaff('Hans', { 'UCH': 'Expert' })];
        const rooms = [
            createRoom('R1', ['UCH'], [{id:'op1', dept:'UCH', procedure:'Test'}]),
            createRoom('R2', ['UCH'], [{id:'op2', dept:'UCH', procedure:'Test'}])
        ];
        
        // Hans assigned to R1 AND R2
        const assignments: Assignment[] = [
            { roomId: 'R1', staffIds: ['Hans'] },
            { roomId: 'R2', staffIds: ['Hans'] }
        ];

        const issues = validatePlan(rooms, assignments, staff);
        
        // Filter specifically for double booking errors
        const doubleBookingErrors = issues.filter(i => i.details === 'Double Booking');
        
        expect(doubleBookingErrors).toHaveLength(2); // One error per room assignment
        expect(doubleBookingErrors[0].type).toBe('error');
        expect(doubleBookingErrors[0].message).toContain('doppelt');
    });

    it('should detect understaffing (Warning)', () => {
        const staff = [createStaff('Solo', { 'UCH': 'Expert' })];
        const rooms = [createRoom('R1', ['UCH'], [{id:'op1', dept:'UCH', procedure:'Test'}])];
        
        // Only 1 person assigned, need 2
        const assignments: Assignment[] = [
            { roomId: 'R1', staffIds: ['Solo'] }
        ];

        const issues = validatePlan(rooms, assignments, staff);
        
        // We might get multiple warnings, but at least one should be Understaffed
        const understaffedIssue = issues.find(i => i.details === 'Understaffed');
        expect(understaffedIssue).toBeDefined();
        expect(understaffedIssue?.type).toBe('warning');
    });

    it('should detect missing qualification (Error)', () => {
        // Staff is GCH Expert, but room needs UCH
        const staff = [
            createStaff('WrongSkill1', { 'GCH': 'Expert' }),
            createStaff('WrongSkill2', { 'GCH': 'Expert' })
        ];
        const rooms = [createRoom('R1', ['UCH'], [{id:'op1', dept:'UCH', procedure:'Test'}])];
        
        const assignments: Assignment[] = [
            { roomId: 'R1', staffIds: ['WrongSkill1', 'WrongSkill2'] } // 2 unique people to avoid understaffing/double booking
        ];

        const issues = validatePlan(rooms, assignments, staff);
        
        // Should find Missing Skill UCH
        const skillIssue = issues.find(i => i.details?.includes('Missing Skill: UCH'));
        expect(skillIssue).toBeDefined();
        expect(skillIssue?.type).toBe('error');
    });

    it('should accept Junior qualification but issue Warning', () => {
        const staff = [
            createStaff('Junior1', { 'UCH': 'Junior' }),
            createStaff('Junior2', { 'UCH': 'Junior' })
        ];
        const rooms = [createRoom('R1', ['UCH'], [{id:'op1', dept:'UCH', procedure:'Test'}])];
        
        const assignments: Assignment[] = [
            { roomId: 'R1', staffIds: ['Junior1', 'Junior2'] }
        ];

        const issues = validatePlan(rooms, assignments, staff);
        
        const weakSkillIssue = issues.find(i => i.details?.includes('Weak Skill: UCH'));
        expect(weakSkillIssue).toBeDefined();
        expect(weakSkillIssue?.type).toBe('warning');
    });

    it('should validate operations dept, not just room dept (Transfer)', () => {
        // Room is UCH, but OP is GYN
        const staff = [
            createStaff('GynExpert1', { 'GYN': 'Expert' }),
            createStaff('GynExpert2', { 'GYN': 'Expert' })
        ];
        const rooms = [createRoom('R1', ['UCH'], [{id:'op1', dept:'GYN', procedure:'Test'}])];
        
        // Ensure we assign TWO unique staff members to avoid understaffing or double booking noise
        const assignments: Assignment[] = [
            { roomId: 'R1', staffIds: ['GynExpert1', 'GynExpert2'] }
        ];

        const issues = validatePlan(rooms, assignments, staff);
        
        // Should NOT have skill error for GYN (because staff has it)
        // We filter specifically for Skill errors, ignoring any potential double bookings if they existed (though they shouldn't now)
        const skillErrors = issues.filter(i => i.details?.includes('Missing Skill'));
        expect(skillErrors).toHaveLength(0);

        // Should have a transfer warning
        const transferWarning = issues.find(i => i.details?.includes('Transfer'));
        expect(transferWarning).toBeDefined();
    });
});
