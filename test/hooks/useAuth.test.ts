import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from '../../hooks/useAuth';
import { AuthService } from '../../services/authService';

// Mock jwt-decode to return a valid object
vi.mock('jwt-decode', () => ({
    jwtDecode: vi.fn(() => ({
        id: '123',
        username: 'test',
        role: 'admin',
        name: 'Test User',
        exp: Math.floor(Date.now() / 1000) + 3600
    }))
}));

// Mock AuthService
vi.mock('../../services/authService', () => ({
    AuthService: {
        isAuthenticated: vi.fn(() => false),
        getToken: vi.fn(() => null),
        login: vi.fn(),
        logout: vi.fn(),
        changePassword: vi.fn()
    }
}));

describe('useAuth Hook', () => {
    
    it('should initialize with not authenticated state', () => {
        const { result } = renderHook(() => useAuth(false));

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
    });

    it('should detect authenticated user on mount', () => {
        (AuthService.isAuthenticated as any).mockReturnValue(true);
        (AuthService.getToken as any).mockReturnValue('mock-token');
        
        const { result } = renderHook(() => useAuth(false));

        expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle successful login', async () => {
        (AuthService.login as any).mockResolvedValue({
            success: true
        });
        (AuthService.getToken as any).mockReturnValue('mock-token');

        const { result } = renderHook(() => useAuth(false));

        act(() => {
            result.current.login();
        });

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        });
    });

    it('should handle failed login', async () => {
        (AuthService.isAuthenticated as any).mockReturnValue(false);

        const { result } = renderHook(() => useAuth(false));

        expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle logout', async () => {
        (AuthService.isAuthenticated as any).mockReturnValue(false);
        
        const { result } = renderHook(() => useAuth(false));

        act(() => {
            result.current.logout();
        });

        expect(AuthService.logout).toHaveBeenCalled();
    });
});
