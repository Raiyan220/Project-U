import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { feedbackService, type Feedback } from '../services/feedbackService';
import {
    ArrowLeft,
    MessageCircle,
    Mail,
    User,
    Clock,
    Check,
    Trash2,
    ExternalLink,
} from 'lucide-react';

export default function AdminFeedback() {
    const { user, logout, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const isAdmin = user?.role === 'ADMIN';

    // Redirect non-admins after auth loading completes
    useEffect(() => {
        if (!authLoading && user && !isAdmin) {
            navigate('/dashboard');
        }
    }, [authLoading, user, isAdmin, navigate]);

    // Fetch all feedback - only when admin
    const { data: feedbackList, isLoading: feedbackLoading } = useQuery({
        queryKey: ['adminFeedback'],
        queryFn: () => feedbackService.getAll(),
        enabled: isAdmin,
    });

    const handleLogout = () => {
        navigate('/');
        setTimeout(() => {
            logout();
        }, 100);
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            await feedbackService.markAsRead(id);
            queryClient.invalidateQueries({ queryKey: ['adminFeedback'] });
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this feedback?')) {
            return;
        }
        try {
            await feedbackService.delete(id);
            queryClient.invalidateQueries({ queryKey: ['adminFeedback'] });
        } catch (error) {
            console.error('Failed to delete feedback:', error);
            alert('Failed to delete feedback');
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

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

    const unreadCount = feedbackList?.filter((f: Feedback) => !f.isRead).length || 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 font-sans text-gray-100">
            {/* Header */}
            <nav className="bg-white/10 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <Link to="/admin" className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                                <span className="text-sm font-medium">Back to Admin</span>
                            </Link>
                            <div className="h-6 w-px bg-white/20" />
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                    <MessageCircle className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-lg font-bold text-white">User Feedback</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-300">{user.email}</span>
                            <button
                                onClick={handleLogout}
                                className="text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                User Feedback
                                {unreadCount > 0 && (
                                    <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                                        {unreadCount} new
                                    </span>
                                )}
                            </h1>
                            <p className="text-gray-400 mt-2">
                                View and manage user feedback and suggestions
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Feedback List */}
                <div className="space-y-4">
                    {feedbackLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                        </div>
                    ) : feedbackList && feedbackList.length > 0 ? (
                        feedbackList.map((feedback: Feedback) => (
                            <motion.div
                                key={feedback.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border ${feedback.isRead ? 'border-white/10' : 'border-indigo-500/50'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        {/* User Info */}
                                        <div className="flex items-center gap-4 mb-3">
                                            {feedback.name && (
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <User className="w-4 h-4" />
                                                    {feedback.name}
                                                </div>
                                            )}
                                            {feedback.email && (
                                                <a
                                                    href={`mailto:${feedback.email}`}
                                                    className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300"
                                                >
                                                    <Mail className="w-4 h-4" />
                                                    {feedback.email}
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <Clock className="w-4 h-4" />
                                                {formatDate(feedback.createdAt)}
                                            </div>
                                        </div>

                                        {/* Message */}
                                        <p className="text-white whitespace-pre-wrap">{feedback.message}</p>

                                        {/* Tags */}
                                        <div className="flex items-center gap-2 mt-3">
                                            {!feedback.isRead && (
                                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs font-medium">
                                                    New
                                                </span>
                                            )}
                                            {feedback.userId && (
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                                                    Registered User
                                                </span>
                                            )}
                                            {!feedback.userId && (
                                                <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs font-medium">
                                                    Anonymous
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {!feedback.isRead && (
                                            <button
                                                onClick={() => handleMarkAsRead(feedback.id)}
                                                className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-lg transition-colors"
                                                title="Mark as read"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(feedback.id)}
                                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                                            title="Delete feedback"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="text-center py-16">
                            <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-xl font-medium text-gray-400">No feedback yet</h3>
                            <p className="text-gray-500 mt-2">
                                User feedback will appear here when submitted
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
