import { api } from '../lib/axios';
import type { AuthResponse, LoginDto, RegisterDto, User } from '../types/auth';


export const authService = {
    async register(data: RegisterDto): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>('/auth/register', data);
        return response.data;
    },

    async login(data: LoginDto): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>('/auth/login', data);
        return response.data;
    },

    logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
    },

    saveAuth(authData: AuthResponse) {
        localStorage.setItem('access_token', authData.access_token);
        localStorage.setItem('user', JSON.stringify(authData.user));
    },

    getStoredUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem('access_token');
    },

    async getCurrentUser(): Promise<User> {
        const response = await api.get<User>('/auth/me');
        return response.data;
    },

    async changePassword(data: any) {
        const response = await api.post('/auth/change-password', data);
        return response.data;
    },

    async forgotPassword(email: string) {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },

    async resetPassword(data: any) {
        const response = await api.post('/auth/reset-password', data);
        return response.data;
    },

    async updateProfilePicture(profilePicture: string) {
        const response = await api.post('/auth/profile-picture', { profilePicture });
        return response.data;
    },
};
