import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    MapPin,
    Clock,
    RefreshCw,
    Building2,
    ArrowLeft,
    Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Room {
    roomNumber: string;
    building: string;
}

const OpenRooms: React.FC = () => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [buildings, setBuildings] = useState<string[]>([]);
    const [selectedBuilding, setSelectedBuilding] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = days[currentTime.getDay()];

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch buildings and initial rooms
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [buildingsRes, roomsRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL}/rooms/buildings`),
                    axios.get(`${import.meta.env.VITE_API_URL}/rooms/available`)
                ]);
                setBuildings(buildingsRes.data);
                setRooms(roomsRes.data);
            } catch (err) {
                setError('Failed to load room data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Fetch rooms when building changes
    const fetchRooms = async (building: string) => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/rooms/available`, {
                params: { building }
            });
            setRooms(res.data);
        } catch (err) {
            setError('Failed to update rooms');
        } finally {
            setLoading(false);
        }
    };

    const handleBuildingChange = (b: string) => {
        setSelectedBuilding(b);
        fetchRooms(b);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 text-slate-100 p-4 md:p-8 font-['Outfit']">
            {/* Header */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                <div>
                    <Link to="/dashboard" className="flex items-center text-indigo-300 hover:text-white transition-colors mb-4 group text-sm font-medium">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboard
                    </Link>
                    <div className="flex items-center gap-4 mb-2">
                        <Link to="/" className="group">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-105 transition-transform">
                                <span className="text-white font-black text-2xl">U</span>
                            </div>
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-bold text-white">
                            Open Room Finder
                        </h1>
                    </div>
                    <p className="text-indigo-200 mt-2 text-lg">
                        Find a quiet place to study right now.
                    </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl flex items-center gap-4 shadow-xl">
                    <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/20">
                        <Clock className="w-6 h-6 text-indigo-300" />
                    </div>
                    <div>
                        <p className="text-xs text-indigo-300 uppercase tracking-wider font-bold">Current Time</p>
                        <p className="text-xl font-bold text-white">{currentDay}, {formatTime(currentTime)}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-6xl mx-auto mb-10">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[280px]">
                        <div className="relative group">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300 group-focus-within:text-white transition-colors" />
                            <select
                                value={selectedBuilding}
                                onChange={(e) => handleBuildingChange(e.target.value)}
                                className="w-full bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-2xl py-4 pl-12 pr-4 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all hover:bg-white/20"
                            >
                                <option className="bg-indigo-900 text-white" value="">All Floors</option>
                                {buildings.map(b => (
                                    <option className="bg-indigo-900 text-white" key={b} value={b}>{b === 'UB' ? 'Main/TBA' : `Floor ${b}`}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={() => fetchRooms(selectedBuilding)}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-600/20"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="max-w-6xl mx-auto">
                {loading && rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                        <p className="text-xl text-indigo-200">Searching for open rooms...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center text-red-300">
                        <p className="text-xl font-bold mb-2">Oops! Something went wrong.</p>
                        <p>{error}</p>
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 p-20 rounded-3xl text-center">
                        <Building2 className="w-16 h-16 text-white/20 mx-auto mb-6" />
                        <p className="text-2xl font-bold text-gray-300">No rooms available at the moment.</p>
                        <p className="text-gray-400 mt-2">Try checking a different floor or time.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {rooms.map((room, idx) => (
                            <div
                                key={`${room.building}-${room.roomNumber}-${idx}`}
                                className="group relative bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl hover:bg-white/20 transition-all hover:-translate-y-1 cursor-default hover:border-purple-500/50 overflow-hidden"
                            >
                                {/* Glow Effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-purple-500/0 group-hover:from-purple-500/10 transition-all duration-500" />

                                <div className="relative z-10 flex flex-col items-center">
                                    <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full mb-3 uppercase tracking-tighter border border-emerald-500/20">
                                        Free
                                    </span>
                                    <p className="text-2xl font-black text-white group-hover:text-purple-300 transition-colors">
                                        {room.roomNumber}
                                    </p>
                                    <p className="text-xs text-indigo-200 mt-1 flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-indigo-300" />
                                        {room.building === 'UB' ? 'UB' : `Floor ${room.building}`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="max-w-6xl mx-auto mt-16 p-6 bg-white/5 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center gap-6 justify-between">
                <div className="flex items-center gap-4 text-gray-400 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Real-time data synced from university portal</span>
                </div>
                <div className="text-gray-500 text-xs">
                    University Hours: 08:00 AM - 06:20 PM
                </div>
            </div>
        </div>
    );
};

export default OpenRooms;
