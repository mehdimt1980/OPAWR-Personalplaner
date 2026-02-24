// @ts-nocheck

import { Staff, DailyRiskAnalysis, StaffWorkload, AnalyticsSummary, ShiftType, Dept } from '../types';
import { isStaffOnVacation, parseDate, formatDate, addDays, getDayOfWeek } from './planningService';
import { loadPlansByDates, DailyPlan } from './storageService';
import { DEFAULT_SHIFT_CONFIG } from '../constants';

/**
 * Calculates analytics for a future date range (default 14 days).
 * Uses optimized bulk fetching to minimize network requests.
 */
export const generateAnalytics = async (
    startDateStr: string, 
    staffList: Staff[],
    daysToAnalyze: number = 14
): Promise<AnalyticsSummary> => {
    
    const dailyRisks: DailyRiskAnalysis[] = [];
    
    // Enhanced Workload Tracking
    const staffStats: Record<string, { 
        available: number, 
        assigned: number, 
        lead: number, 
        support: number,
        weekendShifts: number,
        dates: string[],
        rooms: Record<string, number>
    }> = {};
    
    const globalDeptOpCounts: Record<string, number> = {};
    const globalSkillGaps: Record<string, number> = {};
    const globalRoomFragmentation: Record<string, number> = {};
    let revenueAtRisk = 0;
    
    // Initialize Workload Map
    staffList.forEach(s => {
        staffStats[s.id] = { available: 0, assigned: 0, lead: 0, support: 0, weekendShifts: 0, dates: [], rooms: {} };
    });

    const start = parseDate(startDateStr);
    const dateStrings: string[] = [];

    // 1. Prepare Date List
    for (let i = 0; i < daysToAnalyze; i++) {
        dateStrings.push(formatDate(addDays(start, i)));
    }

    // 2. Bulk Fetch Plans
    const plansMap = new Map<string, DailyPlan>();
    try {
        const plans = await loadPlansByDates(dateStrings);
        plans.forEach(p => plansMap.set(p.date, p));
    } catch (error) {
        console.error("Analytics data fetch failed", error);
    }

    // 3. Process Days
    for (let i = 0; i < daysToAnalyze; i++) {
        const currentDate = addDays(start, i);
        const dateStr = formatDate(currentDate);
        const dayName = getDayOfWeek(dateStr);

        // Skip weekends for risk alerts
        const isWeekend = dayName === 'Sa' || dayName === 'So';

        // Get plan from map
        const plan = plansMap.get(dateStr);
        const dayShifts = plan?.staffShifts || {};

        // -- Calculate Daily Demand (Ops per Dept) --
        const dailyDemand: Record<string, number> = {};
        
        if (plan && plan.operations) {
            plan.operations.forEach((op: any) => {
                const dept = op.dept || 'Other';
                // Add to global heatmap
                globalDeptOpCounts[dept] = (globalDeptOpCounts[dept] || 0) + 1;
                // Add to daily demand
                dailyDemand[dept] = (dailyDemand[dept] || 0) + 1;
            });
        }

        // -- Analyze Assignments for Workload Tracking --
        const assignedIds = new Set<string>();
        const leadIds = new Set<string>();
        const dailyRoomAssignments: Record<string, string> = {}; // StaffId -> RoomId

        if (plan && plan.assignments) {
            plan.assignments.forEach((a: any) => {
                if (a.staffIds && a.staffIds.length > 0) {
                    a.staffIds.forEach((sid: string, idx: number) => {
                        assignedIds.add(sid);
                        if (idx === 0) leadIds.add(sid);
                        
                        // Track Room Assignment
                        // Convert "SAAL_1" to "Saal 1" for display if needed, but stick to ID for consistency
                        dailyRoomAssignments[sid] = a.roomId.replace('_', ' '); 
                    });
                }
            });
        }

        // -- Analyze Availability --
        let availableExperts: Record<string, number> = {};
        let leadsCount = 0;
        let totalAvailable = 0;
        let sickCount = 0;
        let vacationCount = 0;
        let offCount = 0;
        let recoveryCount = 0;
        let absentCount = 0;
        const issues: string[] = [];
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        let conflictCount = 0;

        staffList.forEach(staff => {
            const shift = dayShifts[staff.id] || 'T1'; // Default to Day shift if not planned
            const isSick = shift === 'SICK'; // Derived from shift, not global flag
            const isVacation = isStaffOnVacation(staff, dateStr);
            const isRecovery = shift === 'RECOVERY';
            const isExplicitOff = shift === 'OFF';
            
            // Check if they usually work this weekday
            const worksToday = staff.workDays.includes(dayName);

            if (isSick) {
                sickCount++;
                absentCount++;
                return;
            }

            if (isVacation) {
                vacationCount++;
                absentCount++;
                return;
            }

            if (isRecovery) {
                recoveryCount++;
                absentCount++;
                return;
            }

            if (isExplicitOff || !worksToday) {
                offCount++;
                absentCount++;
                return;
            }

            // Staff is effectively available
            totalAvailable++;
            
            // Track Weekend Shifts
            if (isWeekend && assignedIds.has(staff.id)) {
                staffStats[staff.id].weekendShifts++;
            }

            // Track Workload Stats (only if not weekend to avoid skewing stats for on-call)
            if (!isWeekend) {
                staffStats[staff.id].available++;
                staffStats[staff.id].dates.push(dateStr);

                // Check actual assignment
                if (assignedIds.has(staff.id)) {
                    staffStats[staff.id].assigned++;
                    
                    // Role distribution
                    if (leadIds.has(staff.id)) {
                        staffStats[staff.id].lead++;
                    } else {
                        staffStats[staff.id].support++;
                    }
                    
                    // Room Rotation History
                    const workedRoom = dailyRoomAssignments[staff.id];
                    if (workedRoom) {
                        staffStats[staff.id].rooms[workedRoom] = (staffStats[staff.id].rooms[workedRoom] || 0) + 1;
                    }
                }
            }

            if (staff.isSaalleitung) leadsCount++;

            // Tally Experts per Dept
            Object.entries(staff.skills).forEach(([dept, level]) => {
                if (level === 'Expert' || level === 'Expert+' || level === 'E') {
                    availableExperts[dept] = (availableExperts[dept] || 0) + 1;
                }
            });
        });

        // -- ACTUAL PLAN VALIDATION (Micro-Check) --
        // Check if existing assignments in the plan are sufficient
        if (plan && plan.assignments && plan.operations) {
            // 1. Group operations by Room Name
            const roomOps: Record<string, number> = {};
            plan.operations.forEach((op: any) => {
                roomOps[op.room] = (roomOps[op.room] || 0) + 1;
            });

            // 2. Map Assignments by Room ID
            const assignmentMap = new Map<string, number>();
            plan.assignments.forEach((a: any) => {
                assignmentMap.set(a.roomId, a.staffIds.length);
            });

            // 3. Check for Understaffing
            Object.keys(roomOps).forEach(roomName => {
                // Reconstruct ID from Name (simple replacement logic used in constants)
                const roomId = roomName.replace(/\s+/g, '_');
                const staffAssigned = assignmentMap.get(roomId) || 0;
                const required = 2; // Standard requirement

                if (staffAssigned < required) {
                    riskLevel = 'CRITICAL';
                    issues.push(`Unterbesetzung: ${roomName} (${staffAssigned}/${required})`);
                    conflictCount += 5;
                }
            });
        }

        // -- THEORETICAL CAPACITY ANALYSIS (Macro-Check) --
        
        if (!isWeekend) {
            // Rule 1: General Staff Count (Capacity)
            // ONLY flag if it's a weekday
            if (totalAvailable < 10) {
                riskLevel = 'CRITICAL';
                issues.push(`Extremer Personalmangel (${totalAvailable} verfügbar)`);
                conflictCount += 5;
            } else if (totalAvailable < 13) {
                riskLevel = 'HIGH';
                issues.push(`Personal knapp (${totalAvailable} verfügbar)`);
                conflictCount += 2;
            }

            // Rule 2: Leadership
            if (leadsCount < 2) {
                if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH';
                issues.push("Zu wenig Saalleitung verfügbar (< 2)");
                conflictCount += 3;
            }

            // Rule 3: Specific Skill Gaps (Demand vs Supply)
            // If we have Ops for a Dept, but NO experts, that is a critical "Cannot Assign" error.
            Object.entries(dailyDemand).forEach(([dept, opCount]) => {
                const expertCount = availableExperts[dept] || 0;
                if (opCount > 0 && expertCount === 0) {
                    riskLevel = 'CRITICAL';
                    issues.push(`ALARM: ${opCount} ${dept}-OPs aber KEIN ${dept}-Experte!`);
                    conflictCount += 5;
                    globalSkillGaps[dept] = (globalSkillGaps[dept] || 0) + 1;
                } else if (opCount > 2 && expertCount === 1) {
                    // 1 Expert for >2 Ops is risky (bottleneck)
                     if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH';
                     issues.push(`Engpass: ${dept} (${expertCount} Exp. für ${opCount} OPs)`);
                     conflictCount += 2;
                }
            });
        }

        // -- METRICS CALCULATION --
        
        // Revenue at Risk
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
            if (plan && plan.operations) {
                plan.operations.forEach((op: any) => {
                    revenueAtRisk += (op.estimatedRevenue || 2500); 
                });
            }
        }

        // Room Fragmentation (Efficiency)
        if (plan && plan.operations) {
             const opsByRoom: Record<string, any[]> = {};
             plan.operations.forEach((op: any) => {
                 if (!opsByRoom[op.room]) opsByRoom[op.room] = [];
                 opsByRoom[op.room].push(op);
             });
             
             Object.entries(opsByRoom).forEach(([room, ops]) => {
                 ops.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
                 let switches = 0;
                 for(let k=0; k < ops.length - 1; k++) {
                     if (ops[k].dept !== ops[k+1].dept) switches++;
                 }
                 if (switches > 0) {
                     globalRoomFragmentation[room] = (globalRoomFragmentation[room] || 0) + switches;
                 }
             });
        }

        dailyRisks.push({
            date: dateStr,
            dayName,
            totalStaffAvailable: totalAvailable,
            leadsAvailable: leadsCount,
            absentCount,
            sickCount,
            vacationCount,
            offCount,
            recoveryCount,
            conflictCount,
            riskLevel,
            issues,
            deptCoverage: availableExperts
        });
    }

    // 4. Process Workload for Burnout & Fairness
    const workload: StaffWorkload[] = staffList.map(s => {
        const stats = staffStats[s.id];
        const daysToConsider = Math.max(1, stats.available); // Avoid divide by zero
        
        // Burnout risk now considers high assignment rate + high lead ratio
        const assignmentRate = stats.assigned / daysToConsider;
        const leadRatio = stats.assigned > 0 ? stats.lead / stats.assigned : 0;
        
        const burnoutRisk = (stats.assigned / daysToAnalyze > 0.8) || (assignmentRate > 0.9 && leadRatio > 0.7);
        
        return {
            staffId: s.id,
            name: s.name,
            role: s.role,
            daysAvailable: stats.available,
            daysAssigned: stats.assigned,
            leadAssignments: stats.lead,
            supportAssignments: stats.support,
            weekendShifts: stats.weekendShifts,
            utilizationRate: Math.round(assignmentRate * 100),
            dates: stats.dates,
            burnoutRisk,
            roomHistory: stats.rooms
        };
    });

    // Sort Workload (Highest Assigned first)
    workload.sort((a, b) => b.daysAssigned - a.daysAssigned);

    return {
        startDate: startDateStr,
        endDate: formatDate(addDays(start, daysToAnalyze - 1)),
        dailyRisks,
        workload,
        deptDistribution: globalDeptOpCounts,
        revenueAtRisk,
        skillGaps: globalSkillGaps,
        roomFragmentation: globalRoomFragmentation
    };
};

