import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { AuthService } from '../../services/authService';

// Mock jwt-decode to return a valid token object instead of parsing the dummy strings
vi.mock('jwt-decode', () => ({
    jwtDecode: vi.fn(() => ({ 
        exp: Math.floor(Date.now() / 1000) + 3600 // Expires in 1 hour
    }))
}));

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = vi.fn();

describe('Auth Service', () => {
    
    // Mock window.location.reload for the logout test
    // We need to redefine window.location because it's read-only in some environments
    const originalLocation = window.location;

    beforeAll(() => {
        // Create a mock location object
        delete (window as any).location;
        (window as any).location = { reload: vi.fn() };
    });

    afterAll(() => {
        // Restore original location
        delete (window as any).location;
        (window as any).location = originalLocation;
    });

    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('isAuthenticated', () => {
        it('should return true if token exists', () => {
            localStorageMock.setItem('or_planner_jwt_token', 'valid-token');
            expect(AuthService.isAuthenticated()).toBe(true);
        });

        it('should return false if no token', () => {
            expect(AuthService.isAuthenticated()).toBe(false);
        });
    });

    describe('getToken', () => {
        it('should retrieve stored token', () => {
            localStorageMock.setItem('or_planner_jwt_token', 'test-token');
            expect(AuthService.getToken()).toBe('test-token');
        });

        it('should return null if no token', () => {
            expect(AuthService.getToken()).toBeNull();
        });
    });

    describe('login', () => {
        it('should login successfully with valid credentials', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ 
                    accessToken: 'jwt-token-123', 
                    mustChangePassword: false,
                    user: { username: 'testuser', role: 'admin' }
                })
            });

            const result = await AuthService.login('testuser', 'password123');

            expect(result.success).toBe(true);
            expect(AuthService.getToken()).toBe('jwt-token-123');
        });

        it('should handle must change password', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ 
                    accessToken: 'temp-token', 
                    mustChangePassword: true 
                })
            });

            const result = await AuthService.login('newuser', 'temp');

            expect(result.success).toBe(false);
            expect(result.error).toBe('MUST_CHANGE_PASSWORD');
            expect(result.mustChangePassword).toBe(true);
        });

        it('should handle invalid credentials', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 401
            });

            const result = await AuthService.login('wrong', 'credentials');

            expect(result.success).toBe(false);
            expect(result.error).toBe('INVALID_CREDENTIALS');
        });

        it('should handle network errors', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network failure'));

            const result = await AuthService.login('user', 'pass');

            expect(result.success).toBe(false);
            expect(result.error).toBe('ERROR');
        });

        it('should clear legacy lockout data on successful login', async () => {
            localStorageMock.setItem('or_planner_auth_attempts', '3');
            localStorageMock.setItem('or_planner_auth_lockout', Date.now().toString());

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ accessToken: 'token', mustChangePassword: false })
            });

            await AuthService.login('user', 'pass');

            expect(localStorageMock.getItem('or_planner_auth_attempts')).toBeNull();
            expect(localStorageMock.getItem('or_planner_auth_lockout')).toBeNull();
        });
    });

    describe('changePassword', () => {
        it('should change password with valid token', async () => {
            localStorageMock.setItem('or_planner_jwt_token', 'valid-token');

            (global.fetch as any).mockResolvedValueOnce({
                ok: true
            });

            const result = await AuthService.changePassword('newpassword123');

            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/auth/change-password',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer valid-token'
                    })
                })
            );
        });

        it('should fail if no token', async () => {
            const result = await AuthService.changePassword('newpass');
            expect(result).toBe(false);
        });

        it('should handle API errors', async () => {
            localStorageMock.setItem('or_planner_jwt_token', 'token');

            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 400
            });

            const result = await AuthService.changePassword('weak');
            expect(result).toBe(false);
        });
    });

    describe('logout', () => {
        it('should clear token on logout', () => {
            localStorageMock.setItem('or_planner_jwt_token', 'token');
            localStorageMock.setItem('or_planner_auth_session', 'session');

            AuthService.logout();

            expect(AuthService.getToken()).toBeNull();
            expect(window.location.reload).toHaveBeenCalled();
        });
    });
});
