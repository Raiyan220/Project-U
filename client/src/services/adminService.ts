import { api } from '../lib/axios';

export interface AdminStats {
    totalUsers: number;
    totalTracks: number;
    totalSections: number;
    emailsToday: number;
}

export interface EmailStats {
    dailyStats: Array<{ date: string; count: number }>;
    total: number;
    sent: number;
    failed: number;
}

export interface AdminUser {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
    profilePicture: string | null;
    trackCount: number;
}

export interface UserTrack {
    id: string;
    userId: string;
    sectionId: string;
    active: boolean;
    notifyIntervalMinutes: number;
    createdAt: string;
    section: {
        id: string;
        sectionNumber: string;
        capacity: number;
        enrolled: number;
        status: string;
        course: {
            id: string;
            code: string;
            title: string;
        };
    };
}

export const adminService = {
    getStats: async (): Promise<AdminStats> => {
        const { data } = await api.get('/admin/stats');
        return data;
    },

    getEmailStats: async (): Promise<EmailStats> => {
        const { data } = await api.get('/admin/emails/stats');
        return data;
    },

    getAllUsers: async (search?: string): Promise<AdminUser[]> => {
        const params = search ? { search } : {};
        const { data } = await api.get('/admin/users', { params });
        return data;
    },

    getUserTracks: async (userId: string): Promise<UserTrack[]> => {
        const { data } = await api.get(`/admin/users/${userId}/tracks`);
        return data;
    },

    terminateTrack: async (trackId: string): Promise<void> => {
        await api.delete(`/admin/tracks/${trackId}`);
    },

    toggleUserStatus: async (userId: string): Promise<{ message: string; isActive: boolean }> => {
        const { data } = await api.patch(`/admin/users/${userId}/status`);
        return data;
    },

    deleteUser: async (userId: string): Promise<void> => {
        await api.delete(`/admin/users/${userId}`);
    },
};
