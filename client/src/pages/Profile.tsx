import { useState } from 'react';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Profile() {
    const { user, refreshUser } = useAuth();

    // Password Change State
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Profile Picture State
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setUploadMessage('File size must be less than 2MB');
            return;
        }

        // Convert to base64 for preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewImage(reader.result as string);
            setUploadMessage('');
        };
        reader.readAsDataURL(file);
    };

    const handleSaveProfilePicture = async () => {
        if (!previewImage) return;

        console.log('[Profile] Starting profile picture upload...');
        console.log('[Profile] Image size:', previewImage.length, 'characters');

        setUploading(true);
        setUploadMessage('');
        try {
            console.log('[Profile] Calling updateProfilePicture API...');
            const response = await authService.updateProfilePicture(previewImage);
            console.log('[Profile] API Response:', response);

            setProfilePicture(previewImage);

            console.log('[Profile] Refreshing user data...');
            await refreshUser();
            console.log('[Profile] User refreshed successfully');

            setUploadMessage('Profile picture saved successfully!');
            setTimeout(() => setUploadMessage(''), 3000);
        } catch (err: any) {
            console.error('[Profile] Upload failed:', err);
            console.error('[Profile] Error response:', err.response?.data);
            setUploadMessage(err.response?.data?.message || 'Failed to save');
        } finally {
            setUploading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            setPasswordMessage('Please fill all fields');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordMessage('New password must be at least 6 characters');
            return;
        }

        setPasswordLoading(true);
        setPasswordMessage('');
        try {
            await authService.changePassword({
                currentPassword,
                newPassword,
            });
            setPasswordMessage('Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setTimeout(() => {
                setShowPasswordForm(false);
                setPasswordMessage('');
            }, 2000);
        } catch (err: any) {
            setPasswordMessage(err.response?.data?.message || 'Failed to update password');
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 font-sans text-gray-100">
            {/* Header */}
            <nav className="bg-white/10 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Link to="/dashboard" className="flex items-center space-x-3 group">
                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">
                                    <span className="text-white font-black text-lg">U</span>
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent tracking-tight group-hover:from-white group-hover:to-white transition-all">
                                    UniFlow
                                </h1>
                            </Link>
                            <Link
                                to="/dashboard"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <span className="text-sm font-medium">Back to Dashboard</span>
                            </Link>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">{user?.name}</span>
                            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center font-bold">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                >
                    {/* User Profile Card */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-xl">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            {/* Avatar with Upload */}
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative group">
                                    <input
                                        type="file"
                                        id="profilePicture"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="profilePicture"
                                        className="cursor-pointer block relative"
                                    >
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-4xl font-bold shadow-lg overflow-hidden">
                                            {previewImage || user?.profilePicture ? (
                                                <img src={previewImage || user?.profilePicture || ''} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white">{user?.name?.charAt(0) || 'U'}</span>
                                            )}
                                        </div>

                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="text-center">
                                                <svg className="w-8 h-8 text-white mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3  0 016 0z" />
                                                </svg>
                                                <span className="text-xs text-white font-medium">
                                                    Select Photo
                                                </span>
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Save Button */}
                                {previewImage && (
                                    <button
                                        onClick={handleSaveProfilePicture}
                                        disabled={uploading}
                                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
                                    >
                                        {uploading ? 'Saving...' : 'Save Picture'}
                                    </button>
                                )}
                            </div>

                            {/* User Info */}
                            <div className="flex-1 text-center md:text-left">
                                <h2 className="text-3xl font-bold text-white">{user?.name}</h2>
                                <p className="text-indigo-200">{user?.email}</p>
                                <span className="inline-block mt-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wider text-gray-300">
                                    {user?.role}
                                </span>
                                {uploadMessage && (
                                    <p className={`mt-2 text-sm ${uploadMessage.includes('success') ? 'text-green-300' : 'text-red-300'}`}>
                                        {uploadMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Change Password Section */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                        <button
                            onClick={() => setShowPasswordForm(!showPasswordForm)}
                            className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <h3 className="text-xl font-bold">Change Password</h3>
                            </div>
                            <svg
                                className={`w-5 h-5 transition-transform ${showPasswordForm ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <AnimatePresence>
                            {showPasswordForm && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-white/10"
                                >
                                    <div className="p-6 space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-300">Current Password</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={e => setCurrentPassword(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none transition-all mt-2"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-300">New Password</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none transition-all mt-2"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">Must be at least 6 characters</p>
                                        </div>

                                        {passwordMessage && (
                                            <div className={`p-3 rounded-lg text-sm ${passwordMessage.includes('success') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                {passwordMessage}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleChangePassword}
                                            disabled={passwordLoading}
                                            className="w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                                        >
                                            {passwordLoading ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </motion.div>
            </div>
        </div>
    );
}
