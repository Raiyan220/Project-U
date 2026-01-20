import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/auth';
import { authService } from '../services/authService';


interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            // Check for token in URL (Google OAuth callback)
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');

            if (token) {
                try {
                    localStorage.setItem('access_token', token);
                    const userData = await authService.getCurrentUser();
                    setUser(userData);
                    // Standardize storage using authService
                    authService.saveAuth({ user: userData, access_token: token });
                    // Clean URL and redirect to dashboard
                    window.history.replaceState({}, document.title, window.location.pathname);
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (error) {
                    console.error('OAuth login failed', error);
                    authService.logout();
                }
            } else {
                // Load user from localStorage if not handling OAuth callback
                const storedUser = authService.getStoredUser();
                if (storedUser) {
                    setUser(storedUser);
                }
            }
        };

        initAuth().finally(() => {
            setIsLoading(false);
        });
    }, []);

    const login = (userData: User, token: string) => {
        setUser(userData);
        authService.saveAuth({ user: userData, access_token: token });
    };

    const logout = () => {
        setUser(null);
        authService.logout();
    };

    const refreshUser = async () => {
        try {
            const userData = await authService.getCurrentUser();
            setUser(userData);
            authService.saveAuth({ user: userData, access_token: localStorage.getItem('access_token') || '' });
        } catch (error) {
            console.error('Failed to refresh user', error);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
