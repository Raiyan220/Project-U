import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { courseService } from '../services/courseService';
// import { CourseCard } from '../components/CourseCard'; // Removed as per user request
import { LiveCourseTable } from '../components/LiveCourseTable';
import { useRealtimeSeats } from '../hooks/useRealtimeSeats';
import type { Course } from '../types/course';

export default function Courses() {
    const [searchQuery, setSearchQuery] = useState('');
    const queryClient = useQueryClient();
    const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

    // Real-time seat updates via WebSocket
    const handleSeatUpdate = useCallback(() => {
        // Invalidate queries to refetch updated data
        queryClient.invalidateQueries({ queryKey: ['courses'] });
        setLastUpdateTime(new Date());
    }, [queryClient]);

    const handleSyncComplete = useCallback((stats: any) => {
        if (stats.updatedSections > 0) {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            setLastUpdateTime(new Date());
        }
    }, [queryClient]);

    const { isConnected } = useRealtimeSeats({
        onSeatUpdate: handleSeatUpdate,
        onSyncComplete: handleSyncComplete,
    });

    const { data: courses, isLoading, isError, isFetching } = useQuery({
        queryKey: ['courses', searchQuery],
        queryKeyHashFn: (queryKey) => JSON.stringify(queryKey),
        queryFn: () => courseService.getAllCourses(searchQuery),
        // WebSocket provides real-time updates, no polling needed
    });

    const formatLastUpdate = () => {
        if (!lastUpdateTime) return null;
        const seconds = Math.floor((new Date().getTime() - lastUpdateTime.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-6 md:p-12">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="group">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-105 transition-transform">
                                <span className="text-white font-black text-2xl">U</span>
                            </div>
                        </Link>
                        <div>
                            <h1 className="text-4xl font-extrabold text-white mb-2">
                                USIS / Connect Catalog
                            </h1>
                            <p className="text-gray-300">Live seat tracker for BRAC University courses</p>
                        </div>
                    </div>

                    {/* Real-time status indicator */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-sm font-medium text-gray-200">
                                {isConnected ? 'Live Updates' : 'Connecting...'}
                            </span>
                            {isFetching && (
                                <svg className="w-4 h-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
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
                </header>

                <section className="mb-12">
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Search by code (e.g. CSE110) or course title..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-lg placeholder-gray-400 text-white"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-400 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </section>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="glass h-48 animate-pulse rounded-2xl bg-white/5 border border-white/10" />
                        ))}
                    </div>
                ) : isError ? (
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-red-400 mb-2">Oops! Something went wrong</h2>
                        <p className="text-gray-400">We couldn't load the courses. Please try again later.</p>
                    </div>
                ) : courses?.length === 0 ? (
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-400">No courses found</h2>
                        <p className="text-gray-500 mt-2">Try adjusting your search query</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={searchQuery}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col gap-6"
                        >
                            {courses?.map((course: Course) => (
                                <div key={course.id} className="mb-8 bg-slate-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                        <span className="bg-purple-600 px-3 py-1 rounded-lg text-lg shadow-lg shadow-purple-500/20">{course.code}</span>
                                        <span className="text-gray-300 text-lg font-normal truncate">{course.title}</span>
                                        <span className="ml-auto text-sm bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">
                                            {course.department}
                                        </span>
                                    </h2>
                                    <LiveCourseTable course={course} />
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}

