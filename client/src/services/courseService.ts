import { api } from '../lib/axios';
import type { Course } from '../types/course';

export const courseService = {
    async getStats() {
        const response = await api.get<{
            totalCourses: number;
            totalSections: number;
            totalAvailableSeats: number;
        }>('/courses/stats');
        return response.data;
    },

    async getAllCourses(query?: string) {
        const response = await api.get<Course[]>(`/courses${query ? `?q=${query}` : ''}`);
        return response.data;
    },

    async getCourseById(id: string) {
        const response = await api.get<Course>(`/courses/${id}`);
        return response.data;
    },

    async syncCourses() {
        const response = await api.post('/courses/sync');
        return response.data;
    },

    async trackSection(sectionId: string) {
        const response = await api.post(`/courses/track/${sectionId}`);
        return response.data;
    },

    async untrackSection(sectionId: string) {
        const response = await api.delete(`/courses/track/${sectionId}`);
        return response.data;
    },

    async getMyTracks() {
        const response = await api.get<any[]>('/courses/tracking/my');
        return response.data;
    },

    async updateNotifyInterval(sectionId: string, intervalMinutes: number) {
        const response = await api.patch(`/courses/track/${sectionId}/interval`, {
            intervalMinutes,
        });
        return response.data;
    },
};
