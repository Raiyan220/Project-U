import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return null; // or a loading spinner
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500">
            <div className="min-h-screen backdrop-blur-sm bg-black/10 flex items-center justify-center p-4">
                <div className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2">
                    <div className="flex items-center space-x-2.5">
                        <img
                            src="/uniflow-logo.svg"
                            alt="UniFlow — BRACU Connect+"
                            className="w-10 h-10 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                        />
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(139,92,246,0.3)] tracking-tight">
                                UniFlow
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 text-[11px] font-bold text-white tracking-wide">
                                BRACU Connect+
                            </span>
                        </div>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className="text-6xl md:text-7xl font-bold text-white mb-6">
                            Never Miss a{' '}
                            <span className="bg-gradient-to-r from-yellow-200 to-pink-200 bg-clip-text text-transparent">
                                Seat Opening
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
                            Your <span className="font-bold text-white">BRACU Connect+</span> &amp; <span className="font-bold text-white">PrePreReg</span> companion. Track live <span className="font-bold">Connect</span> seat status, build smart routines, find open rooms, and plan with the AI CGPA Mentor.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                            <Link
                                to="/register"
                                className="px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl"
                            >
                                Get Started Free
                            </Link>
                            <Link
                                to="/login"
                                className="px-8 py-4 bg-white/10 backdrop-blur-md text-white border-2 border-white/30 rounded-xl font-bold text-lg hover:bg-white/20 transition-all transform hover:scale-105"
                            >
                                Sign In
                            </Link>
                        </div>

                        {/* Features */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
                            <Link to="/courses" className="block">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 h-full hover:bg-white/20 transition-colors cursor-pointer"
                                >
                                    <div className="w-12 h-12 bg-blue-400 rounded-lg flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-2">Real-Time Updates</h3>
                                    <p className="text-white/80 text-sm">
                                        Live seat availability tracking from your university's system
                                    </p>
                                </motion.div>
                            </Link>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 h-full"
                            >
                                <div className="w-12 h-12 bg-purple-400 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Instant Notifications</h3>
                                <p className="text-white/80 text-sm">
                                    Get browser push &amp; email alerts the moment a section opens
                                </p>
                            </motion.div>

                            <Link to="/open-rooms" className="block">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 h-full hover:bg-white/20 transition-colors cursor-pointer"
                                >
                                    <div className="w-12 h-12 bg-pink-400 rounded-lg flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-2">Empty Room Finder</h3>
                                    <p className="text-white/80 text-sm">
                                        Discover free study rooms in Main &amp; ANNEX buildings in real-time
                                    </p>
                                </motion.div>
                            </Link>

                            <Link to="/cgpa-calculator" className="block">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-amber-300/30 h-full hover:bg-white/20 transition-colors cursor-pointer relative"
                                >
                                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[10px] font-extrabold uppercase">
                                        AI Powered
                                    </span>
                                    <div className="w-12 h-12 bg-amber-400 rounded-lg flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-2">AI CGPA Mentor</h3>
                                    <p className="text-white/80 text-sm">
                                        Plan your target CGPA, check feasibility, and chat for retake advice
                                    </p>
                                </motion.div>
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* Developer Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="absolute bottom-4 left-0 right-0 text-center"
                >
                    <p className="text-white/60 text-sm">
                        Developed by{' '}
                        <a
                            href="https://www.facebook.com/share/1JmtqT5rAo/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white hover:text-blue-200 font-medium transition-colors border-b border-white/30 hover:border-blue-200"
                        >
                            Md.Al-Raiyan
                        </a>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
