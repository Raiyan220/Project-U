import React, { useState, useEffect } from 'react';
import { api } from '../lib/axios';
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
    roomType?: 'LAB' | 'THEORY';
    status: 'FREE' | 'BUSY';
    currentClass?: string;
    freeUntil?: number | null;
    busyUntil?: number;
    freeMinutes?: number;
}

const OpenRooms: React.FC = () => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [buildings, setBuildings] = useState<string[]>([]);
    const [selectedBuilding, setSelectedBuilding] = useState<string>('');
    const [selectedDay, setSelectedDay] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>(''); // "HH:MM"
    const [minDuration, setMinDuration] = useState<number>(0); // minutes
    const [roomTypeFilter, setRoomTypeFilter] = useState<'ALL' | 'THEORY' | 'LAB'>('ALL');
    const [onlyFree, setOnlyFree] = useState<boolean>(false);
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
                    api.get('/rooms/buildings'),
                    api.get('/rooms/available')
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

    // Fetch rooms when building, day, or time changes
    const fetchRooms = async (building = selectedBuilding, day = selectedDay, timeStr = selectedTime) => {
        try {
            setLoading(true);
            setError(null);
            const params: Record<string, string> = {};
            if (building) params.building = building;
            if (day) params.day = day;
            if (timeStr) params.time = timeStr.replace(':', '');
            const res = await api.get('/rooms/available', { params });
            setRooms(res.data);
        } catch (err) {
            setError('Failed to update rooms');
        } finally {
            setLoading(false);
        }
    };

    const handleBuildingChange = (b: string) => {
        setSelectedBuilding(b);
        fetchRooms(b, selectedDay, selectedTime);
    };

    const handleDayChange = (d: string) => {
        setSelectedDay(d);
        fetchRooms(selectedBuilding, d, selectedTime);
    };

    const handleTimeChange = (t: string) => {
        setSelectedTime(t);
        fetchRooms(selectedBuilding, selectedDay, t);
    };

    const handleResetTime = () => {
        setSelectedDay('');
        setSelectedTime('');
        fetchRooms(selectedBuilding, '', '');
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatTimeFromHHMM = (hhmm: number) => {
        const h = Math.floor(hhmm / 100);
        const m = hhmm % 100;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
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

            {/* Building Quick-Tabs */}
            <div className="max-w-6xl mx-auto mb-5 flex flex-wrap gap-2">
                {[
                    { key: '', label: 'All Buildings' },
                    { key: 'ANNEX', label: 'ANNEX Building (AN)' },
                    { key: 'AS', label: 'AS Labs (AS)' },
                ].map((tab) => (
                    <button
                        key={tab.key || 'ALL'}
                        onClick={() => handleBuildingChange(tab.key)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${selectedBuilding === tab.key
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400 shadow-lg shadow-amber-500/20'
                            : 'bg-white/10 text-indigo-100 border-white/15 hover:bg-white/20'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="max-w-6xl mx-auto mb-8 space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative group">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300 group-focus-within:text-white transition-colors" />
                            <select
                                value={selectedBuilding}
                                onChange={(e) => handleBuildingChange(e.target.value)}
                                className="w-full bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-2xl py-3.5 pl-12 pr-4 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all hover:bg-white/20"
                            >
                                <option className="bg-indigo-900 text-white" value="">All Floors & Buildings</option>
                                {buildings.map(b => (
                                    <option className="bg-indigo-900 text-white" key={b} value={b}>
                                        {b === 'ANNEX'
                                            ? 'ANNEX Building (AN1 / AN2 / ANG)'
                                            : b === 'AS'
                                                ? 'AS Labs (AS1 / AS2 / ASG)'
                                                : b === 'UB'
                                                    ? 'Main / TBA'
                                                    : `Floor ${b}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <select
                        value={selectedDay}
                        onChange={(e) => handleDayChange(e.target.value)}
                        className="bg-white/10 border border-white/20 text-white rounded-2xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 hover:bg-white/20"
                    >
                        <option className="bg-indigo-900 text-white" value="">Today ({currentDay.slice(0, 3)})</option>
                        {days.map(d => (
                            <option className="bg-indigo-900 text-white" key={d} value={d}>{d}</option>
                        ))}
                    </select>

                    <input
                        type="time"
                        value={selectedTime}
                        onChange={(e) => handleTimeChange(e.target.value)}
                        aria-label="Check time"
                        className="bg-white/10 border border-white/20 text-white rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />

                    {(selectedDay || selectedTime) && (
                        <button
                            onClick={handleResetTime}
                            className="bg-white/10 hover:bg-white/20 text-indigo-200 px-4 py-3.5 rounded-2xl text-sm font-semibold border border-white/15"
                        >
                            Now
                        </button>
                    )}

                    <button
                        onClick={() => fetchRooms()}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-600/20"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Room Type & Duration Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {(['ALL', 'THEORY', 'LAB'] as const).map(rt => (
                            <button
                                key={rt}
                                onClick={() => setRoomTypeFilter(rt)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${roomTypeFilter === rt
                                    ? 'bg-indigo-500 text-white border-indigo-400 shadow'
                                    : 'bg-white/5 text-indigo-200 border-white/10 hover:bg-white/10'}`}
                            >
                                {rt === 'ALL' ? 'All Rooms' : rt === 'THEORY' ? 'Theory Rooms' : 'Lab Rooms'}
                            </button>
                        ))}

                        <span className="text-white/20 mx-1">|</span>

                        {[
                            { label: 'Any Duration', mins: 0 },
                            { label: 'Free 1h+', mins: 60 },
                            { label: 'Free 1.5h+', mins: 90 },
                            { label: 'Free 3h+', mins: 180 },
                        ].map(opt => (
                            <button
                                key={opt.mins}
                                onClick={() => {
                                    setMinDuration(opt.mins);
                                    if (opt.mins > 0) setOnlyFree(true);
                                }}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${minDuration === opt.mins
                                    ? 'bg-emerald-500/80 text-white border-emerald-400 shadow'
                                    : 'bg-white/5 text-indigo-200 border-white/10 hover:bg-white/10'}`}
                            >
                                {opt.label}
                            </button>
                        ))}

                        <button
                            onClick={() => setOnlyFree(v => !v)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${onlyFree
                                ? 'bg-purple-500/80 text-white border-purple-400'
                                : 'bg-white/5 text-indigo-200 border-white/10 hover:bg-white/10'}`}
                        >
                            {onlyFree ? 'Showing Free Only' : 'Include Busy'}
                        </button>
                    </div>

                    <div className="text-xs text-indigo-200 font-medium">
                        {rooms.filter(r => r.status === 'FREE').length} Free / {rooms.length} Total Rooms
                    </div>
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
                ) : (() => {
                    const filteredRooms = rooms
                        .filter((room) => {
                            if (onlyFree && room.status !== 'FREE') return false;
                            if (roomTypeFilter !== 'ALL') {
                                const inferredType = room.roomType || (/L$/i.test(room.roomNumber) ? 'LAB' : 'THEORY');
                                if (inferredType !== roomTypeFilter) return false;
                            }
                            if (minDuration > 0 && (room.freeMinutes ?? 0) < minDuration) return false;
                            return true;
                        })
                        .sort((a, b) => {
                            if (a.status === b.status) return (b.freeMinutes ?? 0) - (a.freeMinutes ?? 0);
                            return a.status === 'FREE' ? -1 : 1;
                        });

                    const isAnnexRoom = (r: Room) => /^AN/i.test(r.building) || /^AN/i.test(r.roomNumber);
                    const annexRooms = filteredRooms.filter(isAnnexRoom);
                    const otherRooms = filteredRooms.filter((r) => !isAnnexRoom(r));

                    const renderRoomCard = (room: Room, idx: number) => {
                        const isBusy = room.status === 'BUSY';
                        const isLab = (room.roomType || (/L$/i.test(room.roomNumber) ? 'LAB' : 'THEORY')) === 'LAB';
                        const badgeText = isBusy
                            ? `BUSY: Free at ${formatTimeFromHHMM(room.busyUntil!)}`
                            : room.freeUntil
                                ? `Until ${formatTimeFromHHMM(room.freeUntil)}`
                                : 'Free rest of day';
                        const isLongAvailability = !isBusy && (!room.freeUntil || (room.freeMinutes ?? 0) >= 90);
                        const floorLabel = room.building === 'UB'
                            ? 'UB'
                            : /^AN/i.test(room.building)
                                ? `ANNEX (${room.building})`
                                : /^AS/i.test(room.building)
                                    ? `AS (${room.building})`
                                    : `Floor ${room.building}`;

                        return (
                            <div
                                key={`${room.building}-${room.roomNumber}-${idx}`}
                                className={`group relative backdrop-blur-xl border p-5 rounded-2xl transition-all hover:-translate-y-1 cursor-default overflow-hidden
                                    ${isBusy
                                        ? 'bg-slate-900/40 border-slate-700/50 grayscale-[0.5] hover:grayscale-0'
                                        : 'bg-white/10 border-white/20 hover:bg-white/20 hover:border-purple-500/50 shadow-lg shadow-purple-900/10'}`}
                            >
                                <div className="relative z-10 flex flex-col items-center">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mb-3 uppercase tracking-wider border 
                                        ${isBusy
                                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                            : isLongAvailability
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20'
                                                : 'bg-amber-500/20 text-amber-300 border-amber-500/20'}`}>
                                        {badgeText}
                                    </span>

                                    <p className={`text-2xl font-black transition-colors ${isBusy ? 'text-slate-400' : 'text-white group-hover:text-purple-300'}`}>
                                        {room.roomNumber}
                                    </p>

                                    <p className="text-[10px] text-indigo-200 mt-1 flex items-center gap-1 font-medium">
                                        <MapPin className="w-3 h-3 text-indigo-300" />
                                        {floorLabel}
                                        <span className={`ml-1 px-1.5 py-0.2 rounded text-[8px] font-bold ${isLab ? 'bg-pink-500/20 text-pink-300' : 'bg-sky-500/20 text-sky-300'}`}>
                                            {isLab ? 'LAB' : 'THEORY'}
                                        </span>
                                    </p>

                                    {isBusy && room.currentClass && (
                                        <div className="mt-3 pt-3 border-t border-slate-700/50 w-full text-center">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-tighter mb-0.5">Ongoing Class</p>
                                            <p className="text-[11px] font-bold text-slate-300 truncate px-2">{room.currentClass}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    };

                    if (filteredRooms.length === 0) {
                        return (
                            <div className="bg-white/5 border border-white/10 p-16 rounded-3xl text-center">
                                <Building2 className="w-14 h-14 text-white/20 mx-auto mb-4" />
                                <p className="text-xl font-bold text-gray-300">No matching rooms found.</p>
                                <p className="text-gray-400 text-sm mt-1">Try adjusting your duration or room-type filter.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="space-y-10">
                            {annexRooms.length > 0 && (
                                <section className="bg-amber-500/5 border border-amber-400/25 rounded-3xl p-6">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                                        <div className="flex items-center gap-3">
                                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                                                New Wing
                                            </span>
                                            <h2 className="text-xl font-bold text-white">ANNEX Building (AN1 / AN2 / ANG)</h2>
                                        </div>
                                        <span className="text-xs text-amber-200 font-semibold">
                                            {annexRooms.filter(r => r.status === 'FREE').length} Free / {annexRooms.length} Rooms
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {annexRooms.map(renderRoomCard)}
                                    </div>
                                </section>
                            )}

                            {otherRooms.length > 0 && (
                                <section>
                                    {annexRooms.length > 0 && (
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-xl font-bold text-white">Main Campus &amp; Labs</h2>
                                            <span className="text-xs text-indigo-200 font-semibold">
                                                {otherRooms.filter(r => r.status === 'FREE').length} Free / {otherRooms.length} Rooms
                                            </span>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {otherRooms.map(renderRoomCard)}
                                    </div>
                                </section>
                            )}
                        </div>
                    );
                })()}
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
