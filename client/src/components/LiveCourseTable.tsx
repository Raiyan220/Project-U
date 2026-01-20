import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Course } from '../types/course';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { courseService } from '../services/courseService';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface LiveCourseTableProps {
    course: Course;
}

export const LiveCourseTable = ({ course }: LiveCourseTableProps) => {
    const [visibleCount, setVisibleCount] = useState(10);
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

            const section = course.sections?.find(s => s.id === sectionId);
            if (section) {
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
                queryClient.setQueryData(['myTracks'], (old: any) => [...(old || []), { sectionId }]);
            }

            return { previousTracks };
        },
        onError: (_err, _sectionId, context) => {
            queryClient.setQueryData(['myTracks'], context?.previousTracks);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['myTracks'] });
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
        onError: (_err, _sectionId, context) => {
            queryClient.setQueryData(['myTracks'], context?.previousTracks);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['myTracks'] });
        },
    });

    const isTracking = (sectionId: string) => {
        return (myTracks as any[])?.some((track: { sectionId: string }) => track.sectionId === sectionId);
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

    const sections = course.sections || [];
    const hasMore = visibleCount < sections.length;

    const handleShowMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900/90 backdrop-blur-md shadow-2xl mt-4 ring-1 ring-white/10"
        >
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-950 text-sky-400 uppercase text-xs font-bold tracking-wider border-b border-slate-700">
                        <tr>
                            <th className="px-4 py-4 border-r border-slate-700/50">Course Code</th>
                            <th className="px-4 py-4 border-r border-slate-700/50 text-center">Fac. Init.</th>
                            <th className="px-4 py-4 border-r border-slate-700/50 text-center">Prereq.</th>
                            <th className="px-4 py-4 border-r border-slate-700/50 text-center">Seat Cap.</th>
                            <th className="px-4 py-4 border-r border-slate-700/50 text-center">Booked</th>
                            <th className="px-4 py-4 border-r border-slate-700/50 text-center">Available</th>
                            <th className="px-4 py-4 border-r border-slate-700/50 text-center w-1/5">Class Schedule</th>
                            <th className="px-4 py-4 border-r border-slate-700/50 text-center w-1/5">Lab Schedule</th>
                            <th className="px-4 py-4 border-r border-slate-700/50 text-center">Exam Day</th>
                            <th className="px-4 py-4 text-center">Track</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {sections.slice(0, visibleCount).map((section, index) => {
                            const available = Math.max(0, section.capacity - section.enrolled);
                            const isClosed = available === 0;
                            const classSlots = section.slots?.filter(s => s.type === 'CLASS') || [];
                            const labSlots = section.slots?.filter(s => s.type === 'LAB') || [];

                            return (
                                <tr
                                    key={section.id}
                                    className={`hover:bg-blue-600/10 transition-colors ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-transparent'}`}
                                >
                                    <td className="px-4 py-4 font-medium border-r border-slate-700/50 text-white">
                                        <span className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-xs tracking-wide font-mono text-sky-300">
                                            {course.code}-[{section.sectionNumber}]
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center border-r border-slate-700/50 font-mono font-bold">
                                        <div className="flex flex-col">
                                            <span className="text-amber-400">{section.facultyInitials || <span className="text-slate-500 text-xs">TBA</span>}</span>
                                            {section.labFacultyInitials && (
                                                <span className="text-[10px] text-pink-400 mt-1">Lab: {section.labFacultyInitials}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center border-r border-slate-700/50 text-xs text-slate-400">
                                        {section.prerequisites || 'N/A'}
                                    </td>
                                    <td className="px-4 py-4 text-center border-r border-slate-700/50 text-xs text-slate-300">
                                        {section.capacity}
                                    </td>
                                    <td className="px-4 py-4 text-center border-r border-slate-700/50 text-blue-400 text-xs font-bold">
                                        {section.enrolled}
                                    </td>
                                    <td className={`px-4 py-4 text-center border-r border-slate-700/50 font-black text-lg`}>
                                        <span className={`px-3 py-1 rounded-md border ${isClosed ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]'}`}>
                                            {available}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-[11px] leading-tight border-r border-slate-700/50 text-center whitespace-pre-line tracking-wide uppercase">
                                        {classSlots.length > 0 ? (
                                            classSlots.map(slot => (
                                                <div key={slot.id} className="mb-1.5 flex flex-col items-center">
                                                    <span className="font-bold text-white bg-slate-800 px-1.5 rounded-sm mb-0.5">{slot.day}</span>
                                                    <span className="text-slate-300">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                                                    <span className="text-sky-500 font-mono font-bold text-[10px] mt-0.5">[{slot.roomNumber}]</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-slate-600 italic">TBA</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-[11px] leading-tight border-r border-slate-700/50 text-center whitespace-pre-line tracking-wide uppercase">
                                        {labSlots.length > 0 ? (
                                            labSlots.map(slot => (
                                                <div key={slot.id} className="mb-1.5 flex flex-col items-center">
                                                    <span className="font-bold text-pink-200 bg-purple-900/30 px-1.5 rounded-sm mb-0.5">{slot.day}</span>
                                                    <span className="text-slate-300">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                                                    <span className="text-pink-400 font-mono font-bold text-[10px] mt-0.5">[{slot.roomNumber}]</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-slate-600 italic">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-center border-r border-slate-700/50 text-white">
                                        {section.examDate ? (
                                            <div className="flex flex-col gap-1 items-center bg-slate-800/50 p-1 rounded">
                                                <span className="font-medium text-sky-100">{section.examDate.split(' ').slice(0, 3).join(' ')}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{section.examDate.split(' ').slice(3).join(' ')}</span>
                                            </div>
                                        ) : 'TBA'}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => handleTrackToggle(section.id)}
                                            className={`p-2 rounded-xl transition-all border ${isTracking(section.id)
                                                ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-slate-500'
                                                }`}
                                            title={isTracking(section.id) ? 'Stop tracking' : 'Track for seat availability'}
                                        >
                                            {isTracking(section.id) ? (
                                                <Bell className="w-4 h-4 fill-current" />
                                            ) : (
                                                <BellOff className="w-4 h-4" />
                                            )}
                                        </motion.button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {hasMore && (
                <div className="p-4 bg-slate-900 border-t border-slate-700 text-center">
                    <button
                        onClick={handleShowMore}
                        className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white transition-all focus:outline-none flex items-center justify-center mx-auto shadow-lg shadow-blue-600/20"
                    >
                        Show More Sections ({sections.length - visibleCount} remaining)
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            )}
        </motion.div>
    );
};

// Helper: 1100 -> 11:00 AM
const formatTime = (time: number) => {
    if (!time) return '';
    const str = time.toString().padStart(4, '0');
    const h = parseInt(str.slice(0, 2));
    const m = str.slice(2);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
};
