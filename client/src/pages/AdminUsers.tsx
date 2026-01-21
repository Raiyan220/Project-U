import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { adminService, type AdminUser } from '../services/adminService';
import {
    ArrowLeft,
    Users,
    Search,
    X,
    Bell,
    Trash2,
    Calendar,
    Ban,
    Check,
} from 'lucide-react';

export default function AdminUsers() {
    const { user, logout, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [terminatingTrackId, setTerminatingTrackId] = useState<string | null>(null);
    const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

    const isAdmin = user?.role === 'ADMIN';

    // Redirect non-admins after auth loading completes
    useEffect(() => {
        if (!authLoading && user && !isAdmin) {
            navigate('/dashboard');
        }
    }, [authLoading, user, isAdmin, navigate]);

    // Fetch all users - only when admin
    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['adminUsers', searchQuery],
        queryFn: () => adminService.getAllUsers(searchQuery || undefined),
        staleTime: 30000,
        enabled: isAdmin,
    });

    // Fetch selected user's tracks
    const { data: userTracks, isLoading: tracksLoading } = useQuery({
        queryKey: ['adminUserTracks', selectedUser?.id],
        queryFn: () => selectedUser ? adminService.getUserTracks(selectedUser.id) : Promise.resolve([]),
        enabled: !!selectedUser && isAdmin,
    });

    const handleLogout = () => {
        navigate('/');
        setTimeout(() => {
            logout();
        }, 100);
    };

    const handleTerminateTrack = async (trackId: string) => {
        if (!confirm('Are you sure you want to terminate this track? The user will stop receiving notifications for this section.')) {
            return;
        }

        setTerminatingTrackId(trackId);
        try {
            await adminService.terminateTrack(trackId);
            queryClient.invalidateQueries({ queryKey: ['adminUserTracks', selectedUser?.id] });
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            queryClient.invalidateQueries({ queryKey: ['adminStats'] });
        } catch (error) {
            console.error('Failed to terminate track:', error);
            alert('Failed to terminate track. Please try again.');
        } finally {
            setTerminatingTrackId(null);
        }
    };

    const handleToggleUserStatus = async (userId: string, isActive: boolean, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the user when clicking ban button
        const action = isActive ? 'ban' : 'activate';
        if (!confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }

        setTogglingUserId(userId);
        try {
            await adminService.toggleUserStatus(userId);
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            queryClient.invalidateQueries({ queryKey: ['adminStats'] });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Please try again.';
            console.error('Failed to toggle user status:', error);
            alert(`Failed to ${action} user. ${errorMessage}`);
        } finally {
            setTogglingUserId(null);
        }
    };

    const handleDeleteUser = async (userId: string, userName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE user "${userName}"? This action cannot be undone and will remove all their data.`)) {
            return;
        }

        setDeletingUserId(userId);
        try {
            await adminService.deleteUser(userId);
            if (selectedUser?.id === userId) {
                setSelectedUser(null);
            }
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            queryClient.invalidateQueries({ queryKey: ['adminStats'] });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Please try again.';
            console.error('Failed to delete user:', error);
            alert(`Failed to delete user. ${errorMessage}`);
        } finally {
            setDeletingUserId(null);
        }
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
                            <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Users className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent">
                                    User Management
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
                    {/* Search Bar */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/10">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users by name or email..."
                                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Users Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Users List */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 overflow-hidden">
                            <div className="p-4 border-b border-white/10">
                                <h3 className="text-lg font-bold text-white">
                                    All Users ({users?.length || 0})
                                </h3>
                            </div>
                            <div className="max-h-[600px] overflow-y-auto">
                                {usersLoading ? (
                                    <div className="p-8 flex justify-center">
                                        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                                    </div>
                                ) : users && users.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {users.map((u) => (
                                            <motion.button
                                                key={u.id}
                                                onClick={() => setSelectedUser(u)}
                                                className={`w-full p-4 text-left hover:bg-white/5 transition-colors ${selectedUser?.id === u.id ? 'bg-white/10' : ''
                                                    }`}
                                                whileHover={{ x: 4 }}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-shrink-0">
                                                        {u.profilePicture ? (
                                                            <img
                                                                src={u.profilePicture}
                                                                alt={u.name || 'User'}
                                                                className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/50"
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                                                                <span className="text-lg font-bold text-white">
                                                                    {(u.name || u.email)[0].toUpperCase()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-white truncate">
                                                            {u.name || 'Unnamed User'}
                                                        </p>
                                                        <p className="text-sm text-gray-400 truncate">{u.email}</p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${u.role === 'ADMIN'
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-blue-500/20 text-blue-400'
                                                            }`}>
                                                            {u.role}
                                                        </span>
                                                        {u.role !== 'ADMIN' && (
                                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${u.isActive
                                                                ? 'bg-green-500/20 text-green-400'
                                                                : 'bg-red-500/20 text-red-400'
                                                                }`}>
                                                                {u.isActive ? 'Active' : 'Banned'}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-gray-500">
                                                            {u.trackCount} track{u.trackCount !== 1 ? 's' : ''}
                                                        </span>
                                                        {u.role !== 'ADMIN' && (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={(e) => handleToggleUserStatus(u.id, u.isActive, e)}
                                                                    disabled={togglingUserId === u.id || deletingUserId === u.id}
                                                                    className={`p-1 rounded transition-colors ${u.isActive
                                                                        ? 'hover:bg-red-500/20 text-red-400'
                                                                        : 'hover:bg-green-500/20 text-green-400'
                                                                        } disabled:opacity-50`}
                                                                    title={u.isActive ? 'Ban User' : 'Activate User'}
                                                                >
                                                                    {togglingUserId === u.id ? (
                                                                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                                                                    ) : u.isActive ? (
                                                                        <Ban className="w-4 h-4" />
                                                                    ) : (
                                                                        <Check className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeleteUser(u.id, u.name || u.email, e)}
                                                                    disabled={deletingUserId === u.id || togglingUserId === u.id}
                                                                    className="p-1 rounded transition-colors hover:bg-red-500/20 text-red-400 disabled:opacity-50"
                                                                    title="Delete User Permanently"
                                                                >
                                                                    {deletingUserId === u.id ? (
                                                                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                                                                    ) : (
                                                                        <Trash2 className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-400">
                                        No users found
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* User Tracks Panel */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 overflow-hidden">
                            <div className="p-4 border-b border-white/10">
                                <h3 className="text-lg font-bold text-white">
                                    {selectedUser ? (
                                        <>
                                            Tracks for {selectedUser.name || selectedUser.email}
                                        </>
                                    ) : (
                                        'Select a User'
                                    )}
                                </h3>
                            </div>
                            <div className="max-h-[600px] overflow-y-auto">
                                {!selectedUser ? (
                                    <div className="p-8 text-center text-gray-400">
                                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>Select a user to view their tracked sections</p>
                                    </div>
                                ) : tracksLoading ? (
                                    <div className="p-8 flex justify-center">
                                        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                                    </div>
                                ) : userTracks && userTracks.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        <AnimatePresence>
                                            {userTracks.map((track) => (
                                                <motion.div
                                                    key={track.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="p-4"
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-white">
                                                                    {track.section.course.code}
                                                                </span>
                                                                <span className="text-gray-400">
                                                                    Section {track.section.sectionNumber}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-400 mb-2">
                                                                {track.section.course.title}
                                                            </p>
                                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                                <span className="flex items-center gap-1">
                                                                    <Bell className="w-3 h-3" />
                                                                    Every {track.notifyIntervalMinutes} min
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3" />
                                                                    {new Date(track.createdAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className="mt-2">
                                                                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${track.section.capacity - track.section.enrolled > 0
                                                                    ? 'bg-green-500/20 text-green-400'
                                                                    : 'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                    {track.section.capacity - track.section.enrolled > 0
                                                                        ? `${track.section.capacity - track.section.enrolled} seats available`
                                                                        : 'Full'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleTerminateTrack(track.id)}
                                                            disabled={terminatingTrackId === track.id}
                                                            className="flex items-center gap-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            {terminatingTrackId === track.id ? (
                                                                <div className="animate-spin w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full" />
                                                            ) : (
                                                                <>
                                                                    <Trash2 className="w-4 h-4" />
                                                                    <span className="text-sm">Terminate</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-400">
                                        <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>This user has no active tracks</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
