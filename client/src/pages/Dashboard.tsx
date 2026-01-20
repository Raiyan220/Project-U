import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { courseService } from '../services/courseService';
import { useEffect, useState, useCallback } from 'react';
import type { Course } from '../types/course';
import { LiveCourseTable } from '../components/LiveCourseTable';
import { useRealtimeSeats } from '../hooks/useRealtimeSeats';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Map as MapIcon } from 'lucide-react';

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Course[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [syncing, setSyncing] = useState(false);

    // Use React Query for stats with caching
    const { data: stats } = useQuery({
        queryKey: ['courseStats'],
        queryFn: () => courseService.getStats(),
        staleTime: 30000, // Consider data fresh for 30 seconds
        gcTime: 60000, // Keep in cache for 1 minute
    });

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) return;
        try {
            const results = await courseService.getAllCourses(query);
            setSearchResults(results);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }, []);

    // Real-time updates via WebSocket
    const { isConnected } = useRealtimeSeats({
        onSeatUpdate: () => {
            queryClient.invalidateQueries({ queryKey: ['courseStats'] });
            queryClient.invalidateQueries({ queryKey: ['myTracks'] });
            if (searchQuery) performSearch(searchQuery);
        },
        onSyncComplete: (data) => {
            if (data.updatedSections > 0) {
                queryClient.invalidateQueries({ queryKey: ['courseStats'] });
                queryClient.invalidateQueries({ queryKey: ['myTracks'] });
                if (searchQuery) performSearch(searchQuery);
            }
        }
    });

    const handleSync = async () => {
        setSyncing(true);
        try {
            await courseService.syncCourses();
            queryClient.invalidateQueries({ queryKey: ['courseStats'] });
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setSyncing(false);
        }
    };

    const handleLogout = () => {
        navigate('/');
        setTimeout(() => {
            logout();
        }, 100);
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            await performSearch(searchQuery);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 font-sans text-gray-100">
            {/* Header */}
            <nav className="bg-white/10 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link to="/" className="flex items-center space-x-3 group">
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">
                                <span className="text-white font-black text-lg">U</span>
                            </div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent tracking-tight group-hover:from-white group-hover:to-white transition-all">
                                UniFlow
                            </h1>
                        </Link>

                        <div className="flex items-center space-x-4">
                            {/* Live Status Indicator */}
                            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 mr-4">
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-xs font-medium text-gray-300">
                                    {isConnected ? 'Real-time' : 'Connecting...'}
                                </span>
                            </div>

                            {/* Digital Clock */}
                            <div className="hidden lg:flex flex-col items-center gap-0 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 mr-4">
                                <span className="text-sm font-black text-gray-100 font-mono">
                                    {formatTime(currentTime)}
                                </span>
                                <span className="text-[8px] font-bold text-indigo-400 tracking-widest uppercase">
                                    {formatDate(currentTime)}
                                </span>
                            </div>


                            <Link to="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-all group">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-100 group-hover:text-white transition-colors">{user?.name || 'Student'}</p>
                                    <p className="text-xs text-gray-400 capitalize group-hover:text-gray-300 transition-colors">{user?.role.toLowerCase()}</p>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    {user?.profilePicture ? (
                                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-400 group-hover:border-purple-300 transition-colors">
                                            <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </>
                                    )}
                                    <span className="text-[9px] font-bold text-purple-400 group-hover:text-purple-300 transition-colors uppercase tracking-wider">Profile</span>
                                </div>
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 text-sm font-medium text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Welcome Card */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-white/10">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-2">
                                    Welcome back, {user?.name || user?.email}! 👋
                                </h2>
                                <p className="text-gray-400">
                                    You're successfully logged in. Here's your dashboard.
                                </p>
                            </div>
                            <div>
                                <button
                                    onClick={handleSync}
                                    disabled={syncing}
                                    className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {syncing ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Syncing Data...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Sync Real-Time Data
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm font-medium">Total Courses</p>
                                    <p className="text-4xl font-bold mt-2">{stats?.totalCourses || 0}</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-purple-100 text-sm font-medium">Total Sections</p>
                                    <p className="text-4xl font-bold mt-2">{stats?.totalSections || 0}</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-100 text-sm font-medium">Available Seats</p>
                                    <p className="text-4xl font-bold mt-2">{stats?.totalAvailableSeats || 0}</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                            onClick={() => navigate('/open-rooms')}
                            className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-indigo-100 text-sm font-medium">Room Finder</p>
                                    <p className="text-2xl font-bold mt-2">Find Free Rooms</p>
                                    <p className="text-xs text-indigo-200 mt-1">Check currently empty rooms</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <MapIcon className="w-6 h-6" />
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 }}
                            onClick={() => navigate('/routine-maker')}
                            className="bg-gradient-to-br from-pink-500 via-pink-600 to-rose-600 rounded-xl p-6 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-pink-100 text-sm font-medium">Schedule</p>
                                    <p className="text-2xl font-bold mt-2">Routine Maker</p>
                                    <p className="text-xs text-pink-200 mt-1">Design your semester</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6 }}
                            onClick={() => navigate('/cgpa-calculator')}
                            className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 rounded-xl p-6 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-100 text-sm font-medium">Calculator</p>
                                    <p className="text-2xl font-bold mt-2">CGPA Projector</p>
                                    <p className="text-xs text-orange-200 mt-1">Calculate your grades</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 3.666A5.977 5.977 0 0113.19 17.748M5.216 11A5.992 5.992 0 0113.19 5.252m0 0A5.966 5.966 0 0119.295 11M9 17.748c2.26 2.266 5.686 2.266 7.946 0M3 13.138l9 4.155 9-4.155" />
                                    </svg>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    <MyTrackedCourses />

                    {/* Live Search Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
                    >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div>
                                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200 uppercase tracking-tight">
                                    Live Seat Tracker
                                </h2>
                                <p className="text-gray-400 mt-1">
                                    Status updates automatically in real-time as seats are taken.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSearch} className="mb-8">
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Enter course code (e.g. CSE110)"
                                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono uppercase"
                                />
                                <button
                                    type="submit"
                                    disabled={isSearching}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
                                >
                                    {isSearching ? 'Searching...' : 'Check Status'}
                                </button>
                            </div>
                        </form>

                        {searchResults.length > 0 ? (
                            <div className="space-y-8">
                                {searchResults.map(course => (
                                    <div key={course.id}>
                                        <h3 className="text-xl font-bold text-white mb-2 ml-1">{course.code} - {course.title}</h3>
                                        <LiveCourseTable course={course} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            !isSearching && searchQuery && (
                                <div className="text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                                    No courses found matching "{searchQuery}"
                                </div>
                            )
                        )}
                    </motion.div>
                </motion.div>
            </div >
        </div >
    );
}

function MyTrackedCourses() {
    const queryClient = useQueryClient();
    const [untrackingId, setUntrackingId] = useState<string | null>(null);
    const [updatingIntervalId, setUpdatingIntervalId] = useState<string | null>(null);

    const { data: tracks, isLoading } = useQuery({
        queryKey: ['myTracks'],
        queryFn: () => courseService.getMyTracks(),
    });

    const handleUntrack = async (sectionId: string) => {
        setUntrackingId(sectionId);
        try {
            await courseService.untrackSection(sectionId);
            queryClient.invalidateQueries({ queryKey: ['myTracks'] });
        } catch (error) {
            console.error('Failed to untrack section:', error);
        } finally {
            setUntrackingId(null);
        }
    };

    const handleIntervalChange = async (sectionId: string, intervalMinutes: number) => {
        setUpdatingIntervalId(sectionId);
        try {
            await courseService.updateNotifyInterval(sectionId, intervalMinutes);
            queryClient.invalidateQueries({ queryKey: ['myTracks'] });
        } catch (error) {
            console.error('Failed to update interval:', error);
        } finally {
            setUpdatingIntervalId(null);
        }
    };

    const intervalOptions = [
        { value: 1, label: '1 min' },
        { value: 2, label: '2 min' },
        { value: 3, label: '3 min' },
        { value: 5, label: '5 min' },
        { value: 10, label: '10 min' },
        { value: 15, label: '15 min' },
        { value: 30, label: '30 min' },
        { value: 60, label: '1 hour' },
    ];

    if (isLoading) return null;
    if (!tracks || tracks.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
        >
            <div className="flex items-center gap-2 mb-6">
                <Bell className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white">My Tracked Sections</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(tracks as any[]).map((track) => {
                    // Skip if track data is incomplete (e.g. during optimistic updates)
                    if (!track.section) return null;

                    return (
                        <div key={track.id || track.sectionId} className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                                        {track.section.course.code}
                                    </h3>
                                    <p className="text-xs text-gray-400">{track.section.course.title}</p>
                                </div>
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-bold">
                                    Section {track.section.sectionNumber}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <div className="flex flex-col">
                                    <span className={`text-xl font-bold ${track.section.enrolled >= track.section.capacity ? 'text-red-400' : 'text-green-400'}`}>
                                        {track.section.capacity - track.section.enrolled}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Seats Left</span>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs px-2 py-1 rounded ${track.section.status === 'OPEN' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {track.section.status}
                                    </span>
                                </div>
                            </div>

                            {/* Email Interval Selector */}
                            <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-xs text-gray-400">Email every</span>
                                    </div>
                                    <select
                                        value={track.notifyIntervalMinutes || 5}
                                        onChange={(e) => handleIntervalChange(track.section.id, parseInt(e.target.value))}
                                        disabled={updatingIntervalId === track.section.id}
                                        className="bg-white/10 border border-white/20 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                                    >
                                        {intervalOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value} className="bg-gray-800">
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Stop Tracking Button */}
                            <button
                                onClick={() => handleUntrack(track.section.id)}
                                disabled={untrackingId === track.section.id}
                                className="w-full mt-4 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {untrackingId === track.section.id ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Stopping...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                        </svg>
                                        Stop Tracking
                                    </>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}


