import type { Section, Course } from '../types/course';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { courseService } from '../services/courseService';
import { Bell, BellOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SectionListProps {
    sections: Section[];
    course?: Course;
}

export const SectionList = ({ sections, course }: SectionListProps) => {
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const { data: myTracks } = useQuery({
        queryKey: ['myTracks'],
        queryFn: () => courseService.getMyTracks(),
        enabled: isAuthenticated,
    });

    const trackMutation = useMutation({
        mutationFn: (sectionId: string) => courseService.trackSection(sectionId),
        onMutate: async (sectionId) => {
            await queryClient.cancelQueries({ queryKey: ['myTracks'] });
            const previousTracks = queryClient.getQueryData(['myTracks']);

            const section = sections.find(s => s.id === sectionId);
            if (section && course) {
                const optimisticTrack = {
                    id: `temp-${sectionId}`,
                    sectionId,
                    section: {
                        ...section,
                        course: course
                    }
                };
                queryClient.setQueryData(['myTracks'], (old: any) => [...(old || []), optimisticTrack]);
            } else {
                // Fallback if course data is missing (shouldn't happen if prop is passed)
                queryClient.setQueryData(['myTracks'], (old: any) => [...(old || []), { sectionId }]);
            }

            return { previousTracks };
        },
        onSuccess: () => {
            // Only refetch after successful track
            queryClient.invalidateQueries({ queryKey: ['myTracks'] });
        },
        onError: (_err, _sectionId, context) => {
            queryClient.setQueryData(['myTracks'], context?.previousTracks);
        },
    });

    const untrackMutation = useMutation({
        mutationFn: (sectionId: string) => courseService.untrackSection(sectionId),
        onMutate: async (sectionId) => {
            await queryClient.cancelQueries({ queryKey: ['myTracks'] });
            const previousTracks = queryClient.getQueryData(['myTracks']);
            queryClient.setQueryData(['myTracks'], (old: any) =>
                old?.filter((track: any) => track.sectionId !== sectionId)
            );
            return { previousTracks };
        },
        onSuccess: () => {
            // Only refetch after successful untrack
            queryClient.invalidateQueries({ queryKey: ['myTracks'] });
        },
        onError: (_err, _sectionId, context) => {
            queryClient.setQueryData(['myTracks'], context?.previousTracks);
        },
    });

    const isTracking = (sectionId: string) => {
        return myTracks?.some((track: any) => track.sectionId === sectionId);
    };

    const handleTrackToggle = async (sectionId: string) => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        try {
            if (isTracking(sectionId)) {
                await untrackMutation.mutateAsync(sectionId);
            } else {
                await trackMutation.mutateAsync(sectionId);
            }
        } catch (error) {
            console.error('Tracking toggle failed:', error);
        }
    };
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/20">
                        <th className="py-4 px-4 font-semibold text-gray-300">Section</th>
                        <th className="py-4 px-4 font-semibold text-gray-300">Faculty</th>
                        <th className="py-4 px-4 font-semibold text-gray-300">Prereq.</th>
                        <th className="py-4 px-4 font-semibold text-gray-300">Class Schedule</th>
                        <th className="py-4 px-4 font-semibold text-gray-300">Lab Schedule</th>
                        <th className="py-4 px-4 font-semibold text-gray-300">Exam Day</th>
                        <th className="py-4 px-4 font-semibold text-gray-300 text-center">Seats</th>
                        <th className="py-4 px-4 font-semibold text-gray-300 text-right">Status</th>
                        <th className="py-4 px-4 font-semibold text-gray-300 text-center">Track</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                    {sections.map((section) => {
                        // Helper function to format time
                        const formatTime = (time: number) => {
                            const str = time.toString().padStart(4, '0');
                            const h = parseInt(str.slice(0, 2));
                            const m = str.slice(2);
                            const ampm = h >= 12 ? 'PM' : 'AM';
                            const h12 = h % 12 || 12;
                            return `${h12}:${m} ${ampm}`;
                        };

                        // Deduplicate and separate CLASS and LAB slots
                        const deduplicateSlots = (slots: any[], type: 'CLASS' | 'LAB') => {
                            const dedupMap = new Map<string, any>();
                            slots
                                ?.filter(s => s.type === type)
                                .forEach(slot => {
                                    const key = `${slot.day}-${slot.startTime}-${slot.endTime}-${slot.roomNumber}`;
                                    if (!dedupMap.has(key)) {
                                        dedupMap.set(key, slot);
                                    }
                                });
                            return Array.from(dedupMap.values());
                        };

                        const classSlots = deduplicateSlots(section.slots || [], 'CLASS');
                        const labSlots = deduplicateSlots(section.slots || [], 'LAB');

                        return (
                            <tr key={section.id} className="hover:bg-white/10 transition-colors">
                                <td className="py-4 px-4">
                                    <span className="font-bold text-white">{section.sectionNumber}</span>
                                </td>
                                <td className="py-4 px-4 text-gray-400">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-white">{section.facultyInitials || 'TBA'}</span>
                                        {section.labFacultyInitials && (
                                            <span className="text-xs text-gray-500">Lab: {section.labFacultyInitials}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-sm text-gray-400">
                                    {section.prerequisites || <span className="italic text-gray-600">None</span>}
                                </td>
                                {/* CLASS SCHEDULE */}
                                <td className="py-4 px-4 text-sm text-gray-400">
                                    {classSlots.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {classSlots.map((slot) => (
                                                <div key={slot.id} className="flex gap-2">
                                                    <span className="font-semibold text-blue-400">{slot.day}</span>
                                                    <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                                                    <span className="text-gray-500">[{slot.roomNumber}]</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="italic text-gray-600 text-xs">No class schedule</span>
                                    )}
                                </td>
                                {/* LAB SCHEDULE */}
                                <td className="py-4 px-4 text-sm text-gray-400">
                                    {labSlots.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {labSlots.map((slot) => (
                                                <div key={slot.id} className="flex gap-2">
                                                    <span className="font-semibold text-purple-400">{slot.day}</span>
                                                    <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                                                    <span className="text-gray-500">[{slot.roomNumber}]</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="italic text-gray-600 text-xs">No lab schedule</span>
                                    )}
                                </td>
                                <td className="py-4 px-4 text-sm text-gray-400">
                                    {section.examDate || <span className="italic text-gray-600">TBA</span>}
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className={`text-lg font-bold ${section.enrolled >= section.capacity ? 'text-red-500' : 'text-green-600'}`}>
                                            {section.capacity - section.enrolled}
                                        </span>
                                        <span className="text-xs text-gray-400">of {section.capacity} remaining</span>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${section.status === 'OPEN'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                        }`}>
                                        {section.status}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleTrackToggle(section.id)}
                                        className={`p-2 rounded-xl transition-all ${isTracking(section.id)
                                            ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                        title={isTracking(section.id) ? 'Stop tracking' : 'Track for seat availability'}
                                    >
                                        {isTracking(section.id) ? (
                                            <Bell className="w-5 h-5 fill-current" />
                                        ) : (
                                            <BellOff className="w-5 h-5" />
                                        )}
                                    </motion.button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
