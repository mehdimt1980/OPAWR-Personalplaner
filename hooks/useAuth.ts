
import { useState, useEffect } from 'react';
import { AuthService } from '../services/authService';
import { jwtDecode } from "jwt-decode";
import { UserRole } from '../types';

interface DecodedToken {
    id: string;
    username: string;
    role: UserRole;
    name: string;
    exp: number;
}

export const useAuth = (isPublicView: boolean) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [user, setUser] = useState<{ username: string, role: UserRole, name: string } | null>(null);

  useEffect(() => {
    if (isPublicView) {
        setIsAuthChecking(false);
        return;
    }

    const checkAuth = () => {
        const isAuth = AuthService.isAuthenticated();
        setIsAuthenticated(isAuth);
        
        if (isAuth) {
            const token = AuthService.getToken();
            if (token) {
                if (token === 'client_side_valid_token') {
                    // Fallback for transition
                    setUser({ username: 'admin', role: 'admin', name: 'Developer' });
                } else {
                    try {
                        const decoded = jwtDecode<DecodedToken>(token);
                        setUser({ 
                            username: decoded.username, 
                            role: decoded.role, 
                            name: decoded.name 
                        });
                    } catch (e) {
                        console.error("Invalid Token", e);
                        AuthService.logout();
                    }
                }
            }
        }
        setIsAuthChecking(false);
    };
    checkAuth();
  }, [isPublicView]);

  const login = () => {
      setIsAuthenticated(true);
      const token = AuthService.getToken();
      if (token) {
          try {
              const decoded = jwtDecode<DecodedToken>(token);
              setUser({ username: decoded.username, role: decoded.role, name: decoded.name });
          } catch (e) {
              // fallback
          }
      }
  };

  const logout = () => {
      AuthService.logout();
      setIsAuthenticated(false);
      setUser(null);
  };

  return { isAuthenticated, isAuthChecking, user, login, logout };
};
