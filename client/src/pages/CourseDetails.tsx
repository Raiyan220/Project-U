import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import { courseService } from '../services/courseService';
import { SectionList } from '../components/SectionList';
import { useRealtimeSeats } from '../hooks/useRealtimeSeats';

export default function CourseDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

    // Real-time seat updates via WebSocket
    const handleSeatUpdate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['course', id] });
        setLastUpdateTime(new Date());
    }, [queryClient, id]);

    const handleSyncComplete = useCallback((stats: any) => {
        if (stats.updatedSections > 0) {
            queryClient.invalidateQueries({ queryKey: ['course', id] });
            setLastUpdateTime(new Date());
        }
    }, [queryClient, id]);

    const { isConnected } = useRealtimeSeats({
        onSeatUpdate: handleSeatUpdate,
        onSyncComplete: handleSyncComplete,
    });

    const { data: course, isLoading, isError, isFetching } = useQuery({
        queryKey: ['course', id],
        queryFn: () => courseService.getCourseById(id!),
        enabled: !!id,
        // WebSocket provides real-time updates, no polling needed
    });

    const formatLastUpdate = () => {
        if (!lastUpdateTime) return null;
        const seconds = Math.floor((new Date().getTime() - lastUpdateTime.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (isError || !course) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-500 mb-4">Course not found</h2>
                    <button
                        onClick={() => navigate('/courses')}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Back to Catalog
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-6 md:p-12 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-6">
                        <Link to="/" className="group">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                                <span className="text-white font-black text-lg">U</span>
                            </div>
                        </Link>
                        <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => navigate('/courses')}
                            className="flex items-center text-gray-300 font-semibold hover:text-white transition-colors group"
                        >
                            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Catalog
                        </motion.button>
                    </div>

                    {/* Real-time status indicator */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 shadow-sm">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-xs font-medium text-gray-200">
                                {isConnected ? 'Live' : 'Connecting...'}
                            </span>
                            {isFetching && (
                                <svg className="w-3 h-3 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            )}
                        </div>
                        {lastUpdateTime && (
                            <span className="text-xs text-gray-400">
                                Updated {formatLastUpdate()}
                            </span>
                        )}
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-8 md:p-12 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-8"
                >
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                        <div>
                            <span className="px-4 py-1.5 bg-purple-500/20 text-purple-200 border border-purple-500/30 rounded-xl text-sm font-bold uppercase tracking-wider mb-4 inline-block">
                                {course.code}
                            </span>
                            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                                {course.title}
                            </h1>
                            <p className="text-gray-400 text-lg mt-2">{course.department}</p>
                        </div>

                        <div className="flex flex-col items-end">
                            <span className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">Total Sections</span>
                            <span className="text-4xl font-black text-purple-400">{course.sections?.length || 0}</span>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-10">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-white">Available Sections</h2>
                            <div className="flex items-center gap-4 text-sm font-medium text-gray-300">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span>Open</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <span>Closed</span>
                                </div>
                            </div>
                        </div>

                        {course.sections && course.sections.length > 0 ? (
                            <SectionList sections={course.sections} course={course} />
                        ) : (
                            <div className="bg-white/5 rounded-2xl p-12 text-center border border-dashed border-white/10">
                                <p className="text-gray-400 text-lg italic">No sections found for this course.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

