// @ts-nocheck

import { Assignment, Room, Staff, AppConfig, StaffPairing } from '../types';
import { calculateScore, getDominantDepartment, isQualifiedForRoom } from './planningLogic';

// Calculate global score for the schedule using Config Weights
const calculateGlobalScheduleScore = (assignments: Assignment[], rooms: Room[], staffList: Staff[], config: AppConfig, pairings: StaffPairing[]): number => {
    let totalScore = 0;
    
    assignments.forEach(assignment => {
        const room = rooms.find(r => r.id === assignment.roomId);
        if (!room) return;

        const dominantDept = getDominantDepartment(room);
        const team = assignment.staffIds.map(id => staffList.find(s => s.id === id)).filter(Boolean) as Staff[];
        
        // Loop through all assigned team members
        for (let i = 0; i < team.length; i++) {
            // Calculate score for each staff member in their respective slot
            // Passing the current team (excluding self) to check for pairings
            const currentTeam = team.filter((_, idx) => idx !== i);
            totalScore += calculateScore(team[i], room, i, dominantDept, currentTeam, config.weights, pairings);
        }
        
        // Bonus for Full Team (matches required count)
        if (team.length >= room.requiredStaffCount) {
            totalScore += 500; 
        }
    });

    return totalScore;
};

self.onmessage = (e: MessageEvent) => {
    const { initialAssignments, rooms, staffList, availableStaff, config, pairings } = e.data;

    // Deep copy to avoid reference issues
    let currentAssignments = JSON.parse(JSON.stringify(initialAssignments)) as Assignment[];
    let currentGlobalScore = calculateGlobalScheduleScore(currentAssignments, rooms, staffList, config, pairings);
    
    let improvementsFound = true;
    let iterations = 0;
    const MAX_ITERATIONS = 50; // Safety break

    // HILL CLIMBING ALGORITHM
    while (improvementsFound && iterations < MAX_ITERATIONS) {
        improvementsFound = false;
        iterations++;
        
        // Identify unassigned staff (Bench) for this iteration
        const assignedIds = new Set(currentAssignments.flatMap((a: Assignment) => a.staffIds));
        const bench = (availableStaff as Staff[]).filter(s => !assignedIds.has(s.id));

        // STRATEGY 1: Try swapping Room Staff <-> Bench OR Filling Empty Slots
        for (let i = 0; i < currentAssignments.length; i++) {
            const assignment = currentAssignments[i];
            const room = rooms.find((r: Room) => r.id === assignment.roomId);
            if (!room) continue;

            const dominantDept = getDominantDepartment(room);

            // Iterate through ALL REQUIRED slots in this room (to allow filling empty ones)
            for (let slot = 0; slot < room.requiredStaffCount; slot++) {
                const originalId = assignment.staffIds[slot]; // May be undefined if slot is empty
                
                // --- CASE A: SLOT IS FILLED -> TRY SWAP ---
                if (originalId) {
                    for (const benchStaff of bench) {
                        // Safety: Check if already assigned in this pass (since bench array is static for this loop)
                        if (assignedIds.has(benchStaff.id)) continue;

                        // Optimization: Pre-check qualification before expensive swap/score
                        if (!isQualifiedForRoom(benchStaff, room, config)) continue;

                        // Perform Swap
                        assignment.staffIds[slot] = benchStaff.id;

                        const newScore = calculateGlobalScheduleScore(currentAssignments, rooms, staffList, config, pairings);

                        if (newScore > currentGlobalScore) {
                            currentGlobalScore = newScore;
                            improvementsFound = true;
                            // Update our tracking set for the inner loop
                            assignedIds.delete(originalId);
                            assignedIds.add(benchStaff.id);
                            break; // Move to next slot/room immediately to bank the win
                        } else {
                            // Revert Swap
                            assignment.staffIds[slot] = originalId;
                        }
                    }
                } 
                // --- CASE B: SLOT IS EMPTY -> TRY FILL ---
                else {
                    for (const benchStaff of bench) {
                        if (assignedIds.has(benchStaff.id)) continue;
                        if (!isQualifiedForRoom(benchStaff, room, config)) continue;

                        // Perform Fill (Push to array)
                        assignment.staffIds.push(benchStaff.id);

                        const newScore = calculateGlobalScheduleScore(currentAssignments, rooms, staffList, config, pairings);

                        if (newScore > currentGlobalScore) {
                            currentGlobalScore = newScore;
                            improvementsFound = true;
                            assignedIds.add(benchStaff.id);
                            break; // Success
                        } else {
                            // Revert Fill
                            assignment.staffIds.pop();
                        }
                    }
                }

                if (improvementsFound) break;
            }
            if (improvementsFound) break;
        }

        if (improvementsFound) continue; // Restart loop if we found a better state

        // STRATEGY 2: Try swapping Room Staff <-> Room Staff (Lateral Moves)
        for (let i = 0; i < currentAssignments.length; i++) {
            for (let j = i + 1; j < currentAssignments.length; j++) {
                const assignmentA = currentAssignments[i];
                const assignmentB = currentAssignments[j];
                
                const roomA = rooms.find((r: Room) => r.id === assignmentA.roomId);
                const roomB = rooms.find((r: Room) => r.id === assignmentB.roomId);
                
                if (!roomA || !roomB) continue;

                // Dynamic Swapping: Iterate all slot combinations
                for (let slotA = 0; slotA < assignmentA.staffIds.length; slotA++) {
                    for (let slotB = 0; slotB < assignmentB.staffIds.length; slotB++) {
                        
                        const idA = assignmentA.staffIds[slotA];
                        const idB = assignmentB.staffIds[slotB];
                        if (!idA || !idB) continue;

                        const staffA = staffList.find((s: Staff) => s.id === idA);
                        const staffB = staffList.find((s: Staff) => s.id === idB);

                        if (!staffA || !staffB) continue;

                        // Optimization: Pre-check qualifications
                        if (!isQualifiedForRoom(staffA, roomB, config) || !isQualifiedForRoom(staffB, roomA, config)) continue;

                        // Perform Swap
                        assignmentA.staffIds[slotA] = idB;
                        assignmentB.staffIds[slotB] = idA;

                        const newScore = calculateGlobalScheduleScore(currentAssignments, rooms, staffList, config, pairings);

                        if (newScore > currentGlobalScore) {
                            currentGlobalScore = newScore;
                            improvementsFound = true;
                            break; 
                        } else {
                            // Revert
                            assignmentA.staffIds[slotA] = idA;
                            assignmentB.staffIds[slotB] = idB;
                        }
                    }
                    if (improvementsFound) break;
                }
                if (improvementsFound) break;
            }
            if (improvementsFound) break;
        }
    }

    // Generate post-optimization alerts (e.g., remaining empty rooms)
    const alerts: string[] = [];
    currentAssignments.forEach((a: Assignment) => {
        const room = rooms.find((r: Room) => r.id === a.roomId);
        if (!room) return;
        const dominant = getDominantDepartment(room);
        
        if (a.staffIds.length === 0) {
            alerts.push(`KRITISCH: ${room.name} (${dominant}) hat KEIN Personal.`);
        } else if (a.staffIds.length < room.requiredStaffCount) {
            alerts.push(`WARNUNG: ${room.name} (${dominant}) ist unterbesetzt (${a.staffIds.length}/${room.requiredStaffCount}).`);
        }
    });

    self.postMessage({
        assignments: currentAssignments,
        alerts,
        score: currentGlobalScore
    });
};

