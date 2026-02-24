// @ts-nocheck
import { AuthService } from './authService';
import { Staff, Assignment, Room } from '../types';

interface NotificationPayload {
    to: string;
    body: string;
    staffId: string;
}

interface NotificationResult {
    success: boolean;
    sentCount: number;
    failedCount: number;
    errors?: string[];
}

const API_URL = '/api';

export const NotificationService = {
    /**
     * Sends a list of messages via the backend API
     */
    async sendNotifications(notifications: NotificationPayload[]): Promise<NotificationResult> {
        if (notifications.length === 0) return { success: true, sentCount: 0, failedCount: 0 };

        const token = AuthService.getToken();
        try {
            const response = await fetch(`${API_URL}/notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ notifications })
            });

            if (!response.ok) {
                throw new Error("Failed to send notifications");
            }

            return await response.json();
        } catch (error) {
            console.error("Notification Error:", error);
            return { success: false, sentCount: 0, failedCount: notifications.length, errors: [(error as Error).message] };
        }
    },

    /**
     * Generates smart messages for all assigned staff including partner info
     */
    generatePlanMessages(
        date: string,
        assignments: Assignment[],
        rooms: Room[],
        staffList: Staff[]
    ): NotificationPayload[] {
        const messages: NotificationPayload[] = [];

        assignments.forEach(assignment => {
            const room = rooms.find(r => r.id === assignment.roomId);
            if (!room) return;

            // Determine Start Time
            const startTime = room.operations.length > 0 ? room.operations[0].time : "07:30"; // Default or first op

            assignment.staffIds.forEach((staffId, index) => {
                const staff = staffList.find(s => s.id === staffId);
                
                // Only send if staff exists and has a phone number
                if (staff && staff.phone) {
                    const role = index === 0 ? "Leitung" : "Springer";
                    
                    // Identify Partners (colleagues in the same room)
                    const partnerIds = assignment.staffIds.filter(id => id !== staffId);
                    const partnerNames = partnerIds
                        .map(pid => staffList.find(s => s.id === pid)?.name)
                        .filter(Boolean)
                        .join(' & ');

                    let teamInfo = "";
                    if (partnerNames) {
                        teamInfo = ` mit ${partnerNames}`;
                    }

                    // Construct Smart Message
                    // "Hallo Rita, dein Einsatz am 25.11.2025: Saal 1 als Leitung mit Leon. Start: 07:30. Gruss, OP-Management"
                    const message = `Hallo ${staff.name}, dein Einsatz am ${date}: ${room.name} als ${role}${teamInfo}. Start: ${startTime}. Gruss, OP-Management`;
                    
                    messages.push({
                        to: staff.phone,
                        body: message,
                        staffId: staff.id
                    });
                }
            });
        });

        return messages;
    },

    /**
     * Sends a single update notification to a staff member
     */
    async notifyStaffMember(staff: Staff, message: string): Promise<{ success: boolean, error?: string }> {
        if (!staff.phone) return { success: false, error: "Keine Handynummer hinterlegt." };
        
        const payload: NotificationPayload = {
            to: staff.phone,
            body: message,
            staffId: staff.id
        };

        const result = await this.sendNotifications([payload]);
        
        if (result.success && result.sentCount > 0) {
            return { success: true };
        } else {
            // Format Twilio errors for user
            const rawError = result.errors && result.errors.length > 0 ? result.errors[0] : "Unbekannter Fehler";
            let userError = rawError;

            if (rawError.includes('21608')) {
                userError = "Twilio Trial: Nummer ist nicht verifiziert. Bitte eigene Nummer verwenden.";
            } else if (rawError.includes('21211')) {
                userError = "Ungültige Handynummer.";
            } else if (rawError.includes('21408')) {
                userError = "Länder-Berechtigung fehlt (Permission Settings).";
            }

            return { success: false, error: userError };
        }
    }
};

