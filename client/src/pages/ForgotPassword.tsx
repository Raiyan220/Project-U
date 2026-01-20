import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { motion } from 'framer-motion';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [step, setStep] = useState(1); //  1 = email, 2 = OTP + password
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            await authService.forgotPassword(email);
            setMessage('OTP sent to your email!');
            setStep(2);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            await authService.resetPassword({ email, otp, newPassword });
            setMessage('Password reset successfully! Redirecting to login...');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid OTP or reset failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 w-full max-w-md border border-white/20 shadow-2xl"
            >
                <div className="flex items-center gap-3 mb-6">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-black text-xl">U</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white">UniFlow</h1>
                    </Link>
                </div>

                <h2 className="text-3xl font-bold text-white mb-2">Reset Password</h2>
                <p className="text-gray-300 mb-6">
                    {step === 1 ? 'Enter your email to receive an OTP' : 'Enter the OTP and your new password'}
                </p>

                {step === 1 ? (
                    <form onSubmit={handleSendOTP} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-200">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-white placeholder-gray-400 mt-2"
                                placeholder="you@example.com"
                            />
                        </div>

                        {message && <div className="p-3 bg-green-500/20 text-green-300 rounded-lg text-sm">{message}</div>}
                        {error && <div className="p-3 bg-red-500/20 text-red-300 rounded-lg text-sm">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Sending...' : 'Send OTP'}
                        </button>

                        <Link to="/login" className="block text-center text-indigo-300 hover:text-white transition-colors">
                            Back to Login
                        </Link>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-200">OTP Code</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={e => setOtp(e.target.value)}
                                required
                                maxLength={6}
                                className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-white text-center font-mono text-2xl tracking-widest mt-2"
                                placeholder="000000"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-200">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full bg-black/20 border border-white/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-white placeholder-gray-400 mt-2"
                                placeholder="At least 6 characters"
                            />
                        </div>

                        {message && <div className="p-3 bg-green-500/20 text-green-300 rounded-lg text-sm">{message}</div>}
                        {error && <div className="p-3 bg-red-500/20 text-red-300 rounded-lg text-sm">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="block w-full text-center text-indigo-300 hover:text-white transition-colors"
                        >
                            Resend OTP
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
