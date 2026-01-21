import { api } from '../lib/axios';

export interface Feedback {
    id: string;
    message: string;
    email: string | null;
    name: string | null;
    userId: string | null;
    isRead: boolean;
    createdAt: string;
}

export interface CreateFeedbackDto {
    message: string;
    email?: string;
    name?: string;
}

export const feedbackService = {
    submit: async (dto: CreateFeedbackDto): Promise<Feedback> => {
        const { data } = await api.post('/feedback', dto);
        return data;
    },

    // Admin-only methods
    getAll: async (): Promise<Feedback[]> => {
        const { data } = await api.get('/feedback');
        return data;
    },

    getUnreadCount: async (): Promise<{ count: number }> => {
        const { data } = await api.get('/feedback/unread-count');
        return data;
    },

    markAsRead: async (id: string): Promise<Feedback> => {
        const { data } = await api.patch(`/feedback/${id}/read`);
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/feedback/${id}`);
    },
};
