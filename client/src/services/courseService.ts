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

    async getRecentDrops() {
        const response = await api.get<{
            sectionId: string;
            courseCode: string;
            sectionNumber: string;
            available: number;
            timestamp: string;
        }[]>('/courses/recent-drops');
        return response.data;
    },

    async trackCourse(courseId: string) {
        const response = await api.post<{ trackedCount: number }>(
            `/courses/track-course/${courseId}`,
        );
        return response.data;
    },

    async getAllCourses(query?: string) {
        const timestamp = Date.now();
        const queryString = query
            ? `?q=${encodeURIComponent(query)}&_t=${timestamp}`
            : `?_t=${timestamp}`;
        const response = await api.get<Course[]>(`/courses${queryString}`);
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
