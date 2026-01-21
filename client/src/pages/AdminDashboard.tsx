import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { adminService } from '../services/adminService';
import { Users, Bell, Mail, BarChart3, Settings, ArrowLeft, TrendingUp, Activity } from 'lucide-react';

export default function AdminDashboard() {
    const { user, logout, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();

    const isAdmin = user?.role === 'ADMIN';

    // Redirect non-admins after auth loading completes
    useEffect(() => {
        if (!authLoading && user && !isAdmin) {
            navigate('/dashboard');
        }
    }, [authLoading, user, isAdmin, navigate]);

    // Fetch stats - only when admin
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['adminStats'],
        queryFn: () => adminService.getStats(),
        refetchInterval: 30000,
        enabled: isAdmin,
    });

    // Fetch email stats - only when admin
    const { data: emailStats, isLoading: emailLoading } = useQuery({
        queryKey: ['adminEmailStats'],
        queryFn: () => adminService.getEmailStats(),
        refetchInterval: 60000,
        enabled: isAdmin,
    });

    const handleLogout = () => {
        navigate('/');
        setTimeout(() => {
            logout();
        }, 100);
    };

    const maxEmailCount = emailStats?.dailyStats
        ? Math.max(...emailStats.dailyStats.map(d => d.count), 1)
        : 1;

    // Show loading while auth is loading
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    // Redirect will happen via useEffect, show nothing while redirecting
    if (!user || !isAdmin) {
        return null;
    }


    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 font-sans text-gray-100">
            {/* Header */}
            <nav className="bg-white/10 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <Link to="/dashboard" className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                                <span className="text-sm font-medium">Back to Dashboard</span>
                            </Link>
                            <div className="h-6 w-px bg-white/20" />
                            <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/20">
                                    <Settings className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-red-200 to-orange-200 bg-clip-text text-transparent">
                                    Admin Panel
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-400">{user?.email}</span>
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
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-2">
                                    Admin Dashboard 🛡️
                                </h2>
                                <p className="text-gray-400">
                                    Monitor platform activity and manage users
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Link
                                    to="/admin/users"
                                    className="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40"
                                >
                                    <Users className="w-5 h-5 mr-2" />
                                    Manage Users
                                </Link>
                                <Link
                                    to="/admin/feedback"
                                    className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl shadow-lg shadow-green-500/20 transition-all hover:shadow-green-500/40"
                                >
                                    <Mail className="w-5 h-5 mr-2" />
                                    View Feedback
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm font-medium">Total Users</p>
                                    <p className="text-4xl font-bold mt-2">
                                        {statsLoading ? '...' : stats?.totalUsers || 0}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <Users className="w-6 h-6" />
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
                                    <p className="text-purple-100 text-sm font-medium">Active Tracks</p>
                                    <p className="text-4xl font-bold mt-2">
                                        {statsLoading ? '...' : stats?.totalTracks || 0}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <Bell className="w-6 h-6" />
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
                                    <p className="text-green-100 text-sm font-medium">Total Sections</p>
                                    <p className="text-4xl font-bold mt-2">
                                        {statsLoading ? '...' : stats?.totalSections || 0}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <BarChart3 className="w-6 h-6" />
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                            className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-6 text-white shadow-lg"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-100 text-sm font-medium">Emails Today</p>
                                    <p className="text-4xl font-bold mt-2">
                                        {statsLoading ? '...' : stats?.emailsToday || 0}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <Mail className="w-6 h-6" />
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Email Analytics Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Email Chart */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/10"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                                    Email Activity (Last 7 Days)
                                </h3>
                            </div>

                            {emailLoading ? (
                                <div className="h-48 flex items-center justify-center">
                                    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                                </div>
                            ) : (
                                <div className="h-48 flex items-end justify-between gap-2 px-4">
                                    {emailStats?.dailyStats.map((day, index) => (
                                        <div key={day.date} className="flex flex-col items-center flex-1">
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: `${(day.count / maxEmailCount) * 100}%` }}
                                                transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                                                className="w-full bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-lg min-h-[4px] relative group cursor-pointer"
                                            >
                                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {day.count} emails
                                                </div>
                                            </motion.div>
                                            <span className="text-xs text-gray-400 mt-2">
                                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>

                        {/* Email Summary */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/10"
                        >
                            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                                <Activity className="w-5 h-5 text-green-400" />
                                Email Summary
                            </h3>

                            {emailLoading ? (
                                <div className="h-32 flex items-center justify-center">
                                    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                        <span className="text-gray-400">Total Sent</span>
                                        <span className="text-2xl font-bold text-white">{emailStats?.total || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                                        <span className="text-green-400">Successful</span>
                                        <span className="text-2xl font-bold text-green-400">{emailStats?.sent || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                                        <span className="text-red-400">Failed</span>
                                        <span className="text-2xl font-bold text-red-400">{emailStats?.failed || 0}</span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Quick Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="mt-8 bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/10"
                    >
                        <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Link
                                to="/admin/users"
                                className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group"
                            >
                                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                    <Users className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-white">User Management</p>
                                    <p className="text-sm text-gray-400">View and manage users</p>
                                </div>
                            </Link>
                            <Link
                                to="/dashboard"
                                className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group"
                            >
                                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                                    <Bell className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-white">Track Sections</p>
                                    <p className="text-sm text-gray-400">Track courses as admin</p>
                                </div>
                            </Link>
                            <Link
                                to="/open-rooms"
                                className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group"
                            >
                                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                                    <BarChart3 className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-white">Open Rooms</p>
                                    <p className="text-sm text-gray-400">Find available rooms</p>
                                </div>
                            </Link>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
