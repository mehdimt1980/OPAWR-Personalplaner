
import { SECURITY_CONFIG } from '../config';
import { jwtDecode } from "jwt-decode";

const KEYS = {
    SESSION: 'or_planner_auth_session',
    ATTEMPTS: 'or_planner_auth_attempts',
    LOCKOUT: 'or_planner_auth_lockout',
    TOKEN: 'or_planner_jwt_token'
};

export interface LoginResult {
    success: boolean;
    error?: 'INVALID_CREDENTIALS' | 'LOCKED_OUT' | 'ERROR' | 'MUST_CHANGE_PASSWORD';
    lockoutRemainingSeconds?: number;
    mustChangePassword?: boolean;
}

export const AuthService = {
    /**
     * Checks if the current user has a valid active session
     */
    isAuthenticated(): boolean {
        if (!SECURITY_CONFIG.ENABLE_AUTH) return true;

        const token = localStorage.getItem(KEYS.TOKEN);
        if (!token) return false;

        try {
            // Check token expiration locally
            const decoded: any = jwtDecode(token);
            const currentTime = Date.now() / 1000;
            
            if (decoded.exp && decoded.exp < currentTime) {
                // Token expired
                localStorage.removeItem(KEYS.TOKEN);
                return false;
            }
            return true;
        } catch (e) {
            // Invalid token format
            localStorage.removeItem(KEYS.TOKEN);
            return false;
        }
    },

    /**
     * Gets the current JWT token
     */
    getToken(): string | null {
        return localStorage.getItem(KEYS.TOKEN);
    },

    /**
     * Attempts to log in via API
     */
    async login(username: string, password: string): Promise<LoginResult> {
        // Lockout logic has been disabled as per requirements.
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                // Save token temporarily even if they need to change pass, so they can authorize the change request
                localStorage.setItem(KEYS.TOKEN, data.accessToken);
                // Clear any legacy lockout keys
                localStorage.removeItem(KEYS.ATTEMPTS);
                localStorage.removeItem(KEYS.LOCKOUT);

                if (data.mustChangePassword) {
                    return { success: false, error: 'MUST_CHANGE_PASSWORD', mustChangePassword: true };
                }

                return { success: true };
            } else {
                if (response.status === 401 || response.status === 403) {
                    return { success: false, error: 'INVALID_CREDENTIALS' };
                } else {
                    return { success: false, error: 'ERROR' };
                }
            }
        } catch (e) {
            return { success: false, error: 'ERROR' };
        }
    },

    async changePassword(newPassword: string): Promise<boolean> {
        const token = this.getToken();
        if (!token) return false;

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newPassword })
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    },

    /**
     * Handles logic for a failed password attempt
     * (Deprecated: Lockout removed)
     */
    handleFailedAttempt(): LoginResult {
        return {
            success: false,
            error: 'INVALID_CREDENTIALS'
        };
    },

    /**
     * Returns the remaining lockout time in seconds, or 0 if not locked out
     */
    getLockoutStatus(): number {
        // Lockout disabled
        return 0;
    },

    logout() {
        localStorage.removeItem(KEYS.TOKEN);
        window.location.reload();
    }
};
