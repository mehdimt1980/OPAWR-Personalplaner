// @ts-nocheck

import { Room, Staff, Assignment, Dept, AnalyticsSummary, ChatMessage, AppConfig } from '../types';
import { validatePlan } from './validationService';
import { AuthService } from './authService';

// --- DATA MINIFICATION HELPERS (Token Optimization) ---

const simplifyStaff = (s: Staff) => {
    // Only send relevant skills (Expert/Junior) to save tokens
    const relevantSkills = Object.entries(s.skills)
        .filter(([_, level]) => level === 'Expert' || level === 'Expert+' || level === 'E' || level === 'Junior' || level === 'J')
        .map(([dept, level]) => `${dept}:${level}`)
        .join(', ');

    return `ID:${s.id} | Name:${s.name} | Role:${s.role}${s.isSaalleitung ? '(LEAD)' : ''} | Shift:${s.currentShift} | Skills:[${relevantSkills}]`;
};

const simplifyRoom = (r: Room, assignments: Assignment[], staffList: Staff[], issues: any[]) => {
    const assignment = assignments.find(a => a.roomId === r.id);
    const assignedNames = assignment?.staffIds.map(id => {
        const s = staffList.find(st => st.id === id);
        return s ? `${s.name}(${s.role})` : 'Unknown';
    }).join(', ') || 'EMPTY';

    const roomIssues = issues.filter(i => i.roomId === r.id).map(i => i.message).join('; ');

    return `RoomID:${r.id} | Name:${r.name} | Depts:${r.primaryDepts.join('/')} | Ops:${r.operations.length} | Staff:[${assignedNames}] | Issues:[${roomIssues}]`;
};

export const getAiAdvice = async (
  rooms: Room[], 
  staff: Staff[], 
  currentAssignments: Assignment[],
  query: string,
  history: ChatMessage[] = [],
  dateStr: string = "",
  appConfig?: AppConfig
): Promise<{ text: string, shouldRefresh: boolean, clientAction?: string }> => {
  
  // 1. Analyze Current State
  const issues = validatePlan(rooms, currentAssignments, staff);
  const assignedIds = new Set(currentAssignments.flatMap(a => a.staffIds));

  // 2. Optimized Context Building
  const availableStaff = staff.filter(s => {
      // Basic checks
      if (assignedIds.has(s.id) || s.isSick) return false;
      
      const shiftCode = s.currentShift || 'T1';
      
      // Dynamic Shift Configuration Check
      if (appConfig?.shifts && appConfig.shifts[shiftCode]) {
          // If 'isAssignable' is explicitly false, exclude them
          if (appConfig.shifts[shiftCode].isAssignable === false) return false;
      } else {
          // Fallback legacy behavior
          if (shiftCode === 'OFF' || shiftCode === 'RECOVERY') return false;
      }
      
      return true;
  }).map(simplifyStaff);

  const roomStatus = rooms.map(r => simplifyRoom(r, currentAssignments, staff, issues));

  // 3. Conversation History Formatting
  const conversationContext = history.slice(-6).map(msg => 
      `<${msg.role}>${msg.text}</${msg.role}>`
  ).join('\n');

  // 4. Advanced System Prompt
  const prompt = `
    <system_identity>
    You are the **Lead OP Coordinator AI** at Klinikum Gütersloh.
    
    CORE RULE: **Every active operating room MUST have 2 staff members assigned.**
    - Ideally: 1 Expert (Lead) + 1 Support.
    - Never leave a room with 1 person if possible.
    
    AVAILABLE TOOLS:
    1. \`find_candidates(date, roomId)\`: Finds qualified available staff for a room. USE THIS FIRST if you don't know who is free.
    2. \`assign_staff(date, roomId, staffIds)\`: Assigns staff. **Always pass 2 IDs** if you are filling a room. This tool now returns validation warnings (e.g. Understaffed). Read them!
    3. \`swap_staff(date, staffId1, staffId2)\`: Swaps two people.
    4. \`clear_room(date, roomId)\`: Empties a room.
    5. \`set_shift(date, staffId, shift)\`: Mark as SICK/OFF/T1.
    6. \`auto_assign(date)\`: Runs global optimization. Use if user asks to "fill all rooms".
    
    CONTEXT RULES:
    - Current Plan Date: **${dateStr}**. ALWAYS use this date for tool calls.
    - If user says "Assign X to Room Y", check if Room Y already has 1 person. If so, keep them and add X (send both IDs), unless user says "Swap".
    - If a tool returns a "WARNING", tell the user about it in your response.
    
    You speak **German** (Deutsch).
    Your tone is: Efficient, Direct, Solution-Oriented.
    </system_identity>

    <context_data>
    <date>${dateStr}</date>
    <rooms>
    ${roomStatus.join('\n')}
    </rooms>

    <available_bench>
    ${availableStaff.join('\n')}
    </available_bench>

    <current_conflicts>
    ${issues.map(i => `- ${i.message} in Room ${i.roomId}`).join('\n')}
    </current_conflicts>
    </context_data>

    <conversation_history>
    ${conversationContext}
    </conversation_history>

    <user_query>
    ${query}
    </user_query>
  `;

  try {
    const token = AuthService.getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/ask', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
            prompt,
            date: dateStr // Pass explicit date to backend as fallback
        })
    });

    if (!response.ok) {
        try {
            const errorText = await response.text();
            const errObj = JSON.parse(errorText);
            return { text: errObj.error || "Server Error", shouldRefresh: false };
        } catch (e) { return { text: "Netzwerkfehler.", shouldRefresh: false }; }
    }

    const data = await response.json();
    return { 
        text: data.text || "Ich konnte keine Antwort generieren.",
        shouldRefresh: !!data.toolExecuted,
        clientAction: data.clientAction
    };

  } catch (error) {
    console.error("Gemini Request Error:", error);
    return { text: "Entschuldigung, ich bin momentan nicht erreichbar.", shouldRefresh: false };
  }
};

/**
 * Generates a high-level executive summary based on Analytics Data
 */
export const generateExecutiveReport = async (analyticsData: AnalyticsSummary): Promise<string> => {
    // Pre-calculate math to help the AI (LLMs are bad at math)
    const utilizationRate = Math.round(
        analyticsData.workload.reduce((acc, curr) => acc + curr.utilizationRate, 0) / (analyticsData.workload.length || 1)
    );
    const criticalDays = analyticsData.dailyRisks.filter(d => d.riskLevel === 'HIGH' || d.riskLevel === 'CRITICAL');
    
    // Minified Context for Report
    const summaryContext = {
        period: `${analyticsData.startDate} - ${analyticsData.endDate}`,
        metrics: {
            utilization_avg: `${utilizationRate}%`,
            critical_days_count: criticalDays.length,
            revenue_risk: `${analyticsData.revenueAtRisk.toLocaleString('de-DE')} €`,
            top_bottleneck_dept: Object.entries(analyticsData.skillGaps).sort((a,b) => b[1]-a[1])[0]?.[0] || "None"
        },
        critical_alerts: criticalDays.map(d => `${d.date}: ${d.issues.join(', ')}`).slice(0, 5)
    };

    const prompt = `
        <role>Executive Hospital Consultant</role>
        <task>Write a strategic Management Summary (German) based on the provided data.</task>
        
        <data>
        ${JSON.stringify(summaryContext, null, 2)}
        </data>

        <output_format>
        📊 **Management Summary**
        [2 sentences on stability and revenue risk]

        🚨 **Kritische Engpässe**
        [Bullet points on specific days/departments that need attention]

        💡 **Strategische Empfehlung**
        [1-2 actionable advice items]
        </output_format>
    `;

    try {
        const token = AuthService.getToken();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) return "Report konnte nicht erstellt werden.";
        
        const data = await response.json();
        return data.text || "Keine Daten erhalten.";
    } catch (e) {
        return "Verbindungsfehler beim Report.";
    }
};

