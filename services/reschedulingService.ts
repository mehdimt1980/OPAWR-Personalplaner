// @ts-nocheck


import { Operation, Staff, ReschedulingOption, Room, Dept } from '../types';
import { loadPlansByDates, loadRoomConfig } from './storageService';
import { parseDate, formatDate, addDays, getDayOfWeek } from './planningService';
import { generateAnalytics } from './analyticsService';
import { estimateOpDetails } from './dataService';

const ROOM_CAPACITY_MINUTES = 480; // 8 hours (8:00 - 16:00) standard shift

/**
 * The Brain of the Operation.
 * Finds the best slots for cancelled operations in the near future.
 */
export const findSmartReschedulingOptions = async (
    cancelledOps: Operation[],
    staffList: Staff[],
    startDateStr: string,
    daysToLook: number = 7
): Promise<ReschedulingOption[]> => {
    
    // 1. Prepare Future Dates
    const start = parseDate(startDateStr);
    const dateStrings: string[] = [];
    // Start looking from tomorrow (or next day)
    for (let i = 1; i <= daysToLook; i++) {
        dateStrings.push(formatDate(addDays(start, i)));
    }

    // 2. Load Plans & Analytics for Context
    const plans = await loadPlansByDates(dateStrings);
    const analytics = await generateAnalytics(dateStrings[0], staffList, daysToLook);
    
    // 3. Load Active Rooms from Config
    // FIX: Remove hardcoded fallback. Use empty array if DB is empty.
    const roomConfig = await loadRoomConfig();
    const activeRoomNames = roomConfig && roomConfig.length > 0 
        ? roomConfig.map(r => r.name) 
        : []; 

    const suggestions: ReschedulingOption[] = [];

    // 4. Process Each Cancelled Op
    for (const op of cancelledOps) {
        let bestOptionsForOp: ReschedulingOption[] = [];
        
        // Ensure revenue data is available for legacy operations
        let estimatedRevenue = op.estimatedRevenue;
        if (!estimatedRevenue || estimatedRevenue === 0) {
            const details = estimateOpDetails(op.procedure);
            estimatedRevenue = details.revenue;
            // Also ensure priority is set if missing
            if (!op.priority) op.priority = details.priority;
        }

        // Iterate through future days
        for (const date of dateStrings) {
            const plan = plans.find(p => p.date === date);
            const riskData = analytics.dailyRisks.find(r => r.date === date);
            const dayName = getDayOfWeek(date);

            // Constraint 1: Skip Weekends (usually)
            if (dayName === 'Sa' || dayName === 'So') continue;

            // Constraint 2: Skip High Risk Days
            // If the day is already CRITICAL or HIGH risk due to staffing, don't add more load.
            if (riskData && (riskData.riskLevel === 'CRITICAL' || riskData.riskLevel === 'HIGH')) {
                continue;
            }

            // Inspect Rooms on this day
            const opsByRoom: Record<string, Operation[]> = {};
            if (plan && plan.operations) {
                plan.operations.forEach((o: any) => {
                    const rName = o.room;
                    if (!opsByRoom[rName]) opsByRoom[rName] = [];
                    opsByRoom[rName].push(o);
                });
            }

            for (const roomName of activeRoomNames) {
                const roomOps = opsByRoom[roomName] || [];
                const opCount = roomOps.length;

                // --- NEW LOGIC: TIME BLOCK FITTING ---
                const currentDuration = roomOps.reduce((sum, o) => sum + (o.durationMinutes || 60), 0);
                const remainingTime = ROOM_CAPACITY_MINUTES - currentDuration;
                
                // If operation doesn't fit in the remaining time, skip
                if (op.durationMinutes > remainingTime) continue;


                let score = 0;
                let matchType: 'PERFECT_FIT' | 'EMPTY_ROOM' | 'LOAD_BALANCING' = 'LOAD_BALANCING';
                let reason = "";
                let batchingBonus = false;

                // Logic A: Context Match (The "Combine" Logic)
                // Does this room already have ops of the same department?
                const sameDeptOps = roomOps.filter(o => o.dept === op.dept).length;
                
                if (sameDeptOps > 0) {
                    score += 80; // HUGE bonus for "Batching" (Cleaning time saved)
                    matchType = 'PERFECT_FIT';
                    reason = `${sameDeptOps} weitere ${op.dept}-OPs an diesem Tag (Cluster-Effekt).`;
                    batchingBonus = true;
                } else if (opCount === 0) {
                    // Logic B: Empty Room
                    // Only feasible if we have surplus staff
                    if (riskData && riskData.totalStaffAvailable >= 16) {
                        score += 30;
                        matchType = 'EMPTY_ROOM';
                        reason = "Saal ist komplett frei & Personal verfügbar.";
                    } else {
                        // Room is empty, but staff is tight. Risky.
                        score -= 50; 
                    }
                } else {
                    // Logic C: Load Balancing (Mixed Depts)
                    // Room has ops, but different dept. Possible, but less ideal due to equipment/staff changes.
                    score += 10; 
                    matchType = 'LOAD_BALANCING';
                    reason = `Saal hat Kapazität (${Math.floor(remainingTime/60)}h frei), aber gemischtes Programm.`;
                }

                // Logic D: Staff Expertise Check
                // Does the day have experts for this OP's dept?
                const expertsAvailable = riskData?.deptCoverage[op.dept] || 0;
                if (expertsAvailable === 0) {
                    score = -500; // VETO: No experts available this day
                } else {
                    score += expertsAvailable * 10; // Bonus for more experts
                }

                // Logic E: Priority / Revenue Weighting
                if (op.priority === 'HIGH') {
                    score += 100; // Priority Handling
                }

                // Metrics Calculation
                const oldUtilization = Math.round((currentDuration / ROOM_CAPACITY_MINUTES) * 100);
                const newUtilization = Math.round(((currentDuration + op.durationMinutes) / ROOM_CAPACITY_MINUTES) * 100);
                const utilizationImpact = newUtilization - oldUtilization;

                if (score > 20) {
                    bestOptionsForOp.push({
                        originalOp: op,
                        targetDate: date,
                        targetRoom: roomName,
                        matchType,
                        reasoning: reason,
                        score,
                        metrics: {
                            utilizationImpact,
                            revenueProtected: estimatedRevenue,
                            batchingBonus,
                            timeFitScore: Math.round((op.durationMinutes / remainingTime) * 100) // How "snug" is the fit?
                        }
                    });
                }
            }
        }

        // Sort options for this Op and take top 1
        bestOptionsForOp.sort((a, b) => b.score - a.score);
        if (bestOptionsForOp.length > 0) {
            suggestions.push(bestOptionsForOp[0]);
        }
    }

    return suggestions;
};

