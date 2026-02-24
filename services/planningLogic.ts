// @ts-nocheck

import { Staff, Room, WeightConfig, StaffPairing, AppConfig } from '../types';
import { DEFAULT_APP_CONFIG } from '../constants';

/**
 * Validates if staff can work in a specific room based on capabilities and data features.
 * Now uses Generic Rule Engine from AppConfig.
 */
export const isQualifiedForRoom = (
    staff: Staff, 
    room: Room,
    config: AppConfig = DEFAULT_APP_CONFIG
): boolean => {
    
    // 1. Check Special Rules (e.g. Robotics, Hybrid OP, Radiation)
    const specialRules = config.logic?.specialRules || [];
    
    // Iterate over all generic rules
    for (const rule of specialRules) {
        const trigger = rule.triggerDept; // e.g. "DA_VINCI"
        
        // Check if room triggers this rule (either via primary tag/dept OR via an operation in the room)
        const hasTriggerOps = room.operations.some(op => op.dept === trigger);
        const isTriggerRoom = room.primaryDepts.includes(trigger) || hasTriggerOps || (room.tags && room.tags.includes(trigger));
        
        if (isTriggerRoom) {
            // Staff MUST have the required skill at the required level
            const staffSkill = staff.skills[rule.requiredSkill];
            
            // "Expert" requirement means Expert or Expert+
            if (rule.minLevel === 'Expert') {
                if (staffSkill !== 'Expert' && staffSkill !== 'Expert+' && staffSkill !== 'E') {
                    return false; // Fails hard rule
                }
            } else {
                // "Junior" requirement (or just "Present")
                if (!staffSkill) {
                    return false; // Fails basic requirement
                }
            }
        }
    }

    // 2. General Skill Match
    // Staff must have 'Expert' or 'Junior' in at least one of the room's active departments
    // (either static primary depts OR dynamic depts from operations)
    const activeDepts = new Set<string>(room.primaryDepts);
    room.operations.forEach(op => activeDepts.add(op.dept));

    const hasRelevantSkill = Array.from(activeDepts).some(dept => {
        const skill = staff.skills[dept];
        return skill === 'Expert' || skill === 'Expert+' || skill === 'Junior' || skill === 'E' || skill === 'J';
    });

    return hasRelevantSkill;
};

/**
 * Determines the "Dominant" department of a room for the day.
 */
export const getDominantDepartment = (room: Room): string => {
    // Legacy support: if the room is configured as a DA_VINCI room in the DB, enforce it.
    if (room.primaryDepts.includes('DA_VINCI')) {
        return 'DA_VINCI';
    }

    const deptCounts: Record<string, number> = {};
    
    // Count ops per dept
    room.operations.forEach(op => {
        deptCounts[op.dept] = (deptCounts[op.dept] || 0) + 1;
    });
    
    // Find max
    let max = 0;
    // Explicitly type as string to avoid TypeScript error
    let dominant: string = room.primaryDepts[0] || 'UCH'; // Fallback if empty
    
    Object.entries(deptCounts).forEach(([dept, count]) => {
        if (count > max) {
            max = count;
            dominant = dept;
        }
    });

    return dominant;
};

/**
 * Calculates score for assignment priority.
 * Higher score = Better fit.
 * Uses weights object instead of hardcoded values.
 */
export const calculateScore = (
    staff: Staff, 
    room: Room, 
    slotIndex: number, 
    dominantDept: string, 
    existingTeam: Staff[] = [],
    weights: WeightConfig = DEFAULT_APP_CONFIG.weights, // Fallback
    pairings: StaffPairing[] = [], // Optional pairings
    config: AppConfig = DEFAULT_APP_CONFIG // Optional Config for Rules
): number => {
    let score = 0;

    // --- 1. PAIRING CHECK (Highest Priority) ---
    if (pairings.length > 0) {
        const userPair = pairings.find(p => p.staffId1 === staff.id || p.staffId2 === staff.id);
        if (userPair) {
            const partnerId = userPair.staffId1 === staff.id ? userPair.staffId2 : userPair.staffId1;
            const partnerInRoom = existingTeam.some(s => s.id === partnerId);
            
            if (partnerInRoom) {
                return weights.PAIRING_BONUS ?? 20000;
            }
        }
    }

    // --- 2. QUALIFICATION CHECK ---
    if (!isQualifiedForRoom(staff, room, config)) {
        return -(weights.UNQUALIFIED_PENALTY ?? 1000000);
    }

    const skillInDominant = staff.skills[dominantDept];
    const isExpertDominant = skillInDominant === 'Expert' || skillInDominant === 'Expert+' || skillInDominant === 'E';
    const isJuniorDominant = skillInDominant === 'Junior' || skillInDominant === 'J';

    // === DEPARTMENT PRIORITY BOOSTER ===
    if (staff.departmentPriority && staff.departmentPriority.length > 0) {
        const priorityIndex = staff.departmentPriority.indexOf(dominantDept);
        if (priorityIndex !== -1) {
            const baseBonus = weights.DEPT_PRIORITY_BONUS ?? 2500;
            const priorityBonus = Math.max(0, baseBonus - (priorityIndex * 1000)); 
            score += priorityBonus;
        } else {
            score -= (weights.DEPT_PRIORITY_MISMATCH_PENALTY ?? 4000);
        }
    }

    // === PAIRING RULE: Prevent Double Saalleitung ===
    const hasLead = existingTeam.some(s => s.isSaalleitung);
    if (hasLead && staff.isSaalleitung) {
        score -= weights.DOUBLE_LEAD_PENALTY; 
    }

    // === SLOT 0: SAALLEITUNG / LEAD ===
    if (slotIndex === 0) {
        // Base Leadership Preference: If person is a Lead, they belong in the first slot!
        if (staff.isSaalleitung) {
            score += weights.LEAD_ROLE_BONUS;
        }

        // Specific Lead Bonuses
        const matchesOps = staff.leadDepts.includes(dominantDept);
        const matchesRoom = room.primaryDepts.some(d => staff.leadDepts.includes(d));
        const hasSpecificLeadAssignments = staff.leadDepts.length > 0;
        
        if (matchesOps || matchesRoom) {
            if (matchesOps) score += weights.OP_MATCH_BONUS;
            if (matchesRoom) score += weights.ROOM_OWNER_BONUS;
        } else if (hasSpecificLeadAssignments) {
            // Wrong specific Lead (e.g. URO Lead in ACH room)
            score -= (weights.WRONG_LEAD_PENALTY ?? 500000); 
        }

        // Skill-based Slot 0 Scoring (for non-leads or general leads)
        if (isExpertDominant) {
            score += weights.EXPERT_MATCH_BONUS; 
        } else if (isJuniorDominant) {
            score += weights.JUNIOR_MATCH_BONUS;
        }

        // Extra penalty for Leads with NO qualification for this room
        if (staff.isSaalleitung && !isExpertDominant && !isJuniorDominant) {
            score -= 10000;
        }
    } 
    // === SLOT 1: SPRINGER / SECOND ===
    else {
        if (isExpertDominant) score += weights.SPRINGER_EXPERT_BONUS;
        if (isJuniorDominant) score += weights.SPRINGER_JUNIOR_BONUS; 
        
        // Avoid putting Saalleitung in Springer slot if possible
        if (staff.isSaalleitung) score -= weights.DOUBLE_LEAD_SPRINGER_PENALTY; 
    }

    // === COMMON PRIORITIES ===
    if (staff.preferredRooms.some(r => r.toLowerCase() === room.name.toLowerCase())) {
        score += weights.PREFERRED_ROOM_BONUS; 
    }

    const otherDepts = new Set(room.operations.map(o => o.dept).filter(d => d !== dominantDept));
    otherDepts.forEach(d => {
         if (staff.skills[d] === 'Expert' || staff.skills[d] === 'Expert+' || staff.skills[d] === 'E') {
             score += weights.SECONDARY_SKILL_BONUS; 
         }
    });

    if (staff.isJoker) score -= weights.JOKER_PENALTY;

    return score;
};


