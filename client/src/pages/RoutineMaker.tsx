import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { courseService } from '../services/courseService';
import type { Course, Section } from '../types/course';
import { Link } from 'react-router-dom';
import { Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';

type SectionWithCode = Section & { _displayCode?: string };

interface GeneratedRoutine {
    sections: SectionWithCode[];
    campusDays: number;
    sameDayExams: number;
    floorJumps: number;
    score: number;
}

const toMins = (hhmm: number) => Math.floor(hhmm / 100) * 60 + (hhmm % 100);

const getExamDayKey = (examDate?: string): string | null => {
    if (!examDate) return null;
    // Matches "Jan 7, 2027" or "Monday, January 11, 2027" before time window
    const match = examDate.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
    return match ? match[1] : examDate.split(/\d{1,2}:\d{2}/)[0].trim();
};

const getFloorNum = (building?: string): number | null => {
    if (!building) return null;
    const m = building.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : null;
};

const sectionsOverlap = (a: Section, b: Section): boolean => {
    for (const sa of a.slots || []) {
        for (const sb of b.slots || []) {
            if (sa.day === sb.day && sa.startTime < sb.endTime && sa.endTime > sb.startTime) {
                return true;
            }
        }
    }
    return false;
};

export default function RoutineMaker() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSections, setSelectedSections] = useState<SectionWithCode[]>([]);
    const [focusedSection, setFocusedSection] = useState<{ courseCode: string; courseTitle: string; section: Section } | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

    // Smart Auto-Routine Generator state
    const [showAutoGen, setShowAutoGen] = useState(false);
    const [autoCourseInput, setAutoCourseInput] = useState('');
    const [onlyOpenSeats, setOnlyOpenSeats] = useState(true);
    const [noEightAm, setNoEightAm] = useState(false);
    const [avoidFaculties, setAvoidFaculties] = useState('');
    const [priorityMode, setPriorityMode] = useState<'FEWEST_DAYS' | 'NO_SAME_DAY_EXAM' | 'BALANCED'>('BALANCED');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedRoutines, setGeneratedRoutines] = useState<GeneratedRoutine[]>([]);

    const { data: courses, isLoading } = useQuery({
        queryKey: ['courses', searchQuery],
        queryFn: () => courseService.getAllCourses(searchQuery),
    });

    // Auto-dismiss notification
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Group courses by code: { "CSE110": [ ...sections ], "CSE220": [ ... ] }
    const groupedSections = useMemo(() => {
        if (!courses) return {};
        const groups: Record<string, { courseCode: string; courseTitle: string; section: Section }[]> = {};

        courses.forEach(course => {
            course.sections?.forEach(section => {
                if (!groups[course.code]) {
                    groups[course.code] = [];
                }
                groups[course.code].push({ courseCode: course.code, courseTitle: course.title, section });
            });
        });

        // Filter based on search
        if (!searchQuery) return groups;

        const filteredGroups: Record<string, typeof groups['string']> = {};
        const q = searchQuery.toLowerCase();

        Object.keys(groups).forEach(code => {
            // Check if code matches or any section number matches
            const codeMatch = code.toLowerCase().includes(q);
            const sections = groups[code].filter(item =>
                codeMatch || item.section.sectionNumber.toString().includes(q)
            );

            if (sections.length > 0) {
                filteredGroups[code] = sections;
            }
        });

        return filteredGroups;
    }, [courses, searchQuery]);

    const checkTimeClash = (newSection: Section) => {
        for (const existing of selectedSections) {
            for (const newSlot of newSection.slots || []) {
                for (const existingSlot of existing.slots || []) {
                    if (newSlot.day === existingSlot.day) {
                        // Check overlap
                        if (newSlot.startTime < existingSlot.endTime && newSlot.endTime > existingSlot.startTime) {
                            // @ts-ignore
                            const code = existing._displayCode || existing.courseId;
                            return `Clash with ${code} (${existing.sectionNumber}) on ${newSlot.day}`;
                        }
                    }
                }
            }
        }
        return null;
    };

    const checkExamClash = (newSection: Section) => {
        if (!newSection.examDate) return null;
        for (const existing of selectedSections) {
            if (existing.examDate === newSection.examDate) {
                // @ts-ignore
                const code = existing._displayCode || existing.courseId;
                return `Exam Clash with ${code} (${existing.sectionNumber})`;
            }
        }
        return null;
    };

    const handleAddSection = (wrapper: { courseCode: string; section: Section }) => {
        // 1. Check if course already added (match both display code and courseId UUID)
        const alreadyHasCourse = selectedSections.find(
            (s) => s._displayCode === wrapper.courseCode || s.courseId === wrapper.section.courseId,
        );
        if (alreadyHasCourse) {
            setNotification({ type: 'error', message: `Already selected a section for ${wrapper.courseCode}` });
            return;
        }

        // 2. Time Clash
        const timeClash = checkTimeClash(wrapper.section);
        if (timeClash) {
            setNotification({ type: 'error', message: timeClash });
            return;
        }

        // 3. Exam Clash
        const examClash = checkExamClash(wrapper.section);
        if (examClash) {
            setNotification({ type: 'error', message: examClash });
            return;
        }

        // Add
        const sectionWithCode: SectionWithCode = { ...wrapper.section, _displayCode: wrapper.courseCode };
        setSelectedSections([...selectedSections, sectionWithCode]);
        setNotification({ type: 'success', message: `Added ${wrapper.courseCode} Sec ${wrapper.section.sectionNumber}` });
    };

    // Detect Same-Day Multiple Exams & Tight Back-to-Back Floor Transitions
    const routineWarnings = useMemo(() => {
        const warnings: string[] = [];

        // 1. Same-day exam check
        const examDayMap = new Map<string, string[]>();
        for (const sec of selectedSections) {
            const dayKey = getExamDayKey(sec.examDate);
            if (!dayKey) continue;
            const list = examDayMap.get(dayKey) || [];
            list.push(`${sec._displayCode || sec.courseId} (${sec.sectionNumber})`);
            examDayMap.set(dayKey, list);
        }
        examDayMap.forEach((list, dayKey) => {
            if (list.length > 1) {
                warnings.push(`Same-day exams on ${dayKey}: ${list.join(' & ')}`);
            }
        });

        // 2. Back-to-back floor transition check (<= 15 min gap across different floors)
        const slotsByDay = new Map<string, { code: string; start: number; end: number; building: string }[]>();
        for (const sec of selectedSections) {
            for (const slot of sec.slots || []) {
                const arr = slotsByDay.get(slot.day) || [];
                arr.push({
                    code: `${sec._displayCode || sec.courseId}`,
                    start: slot.startTime,
                    end: slot.endTime,
                    building: slot.building,
                });
                slotsByDay.set(slot.day, arr);
            }
        }
        slotsByDay.forEach((list, day) => {
            list.sort((a, b) => a.start - b.start);
            for (let i = 0; i < list.length - 1; i++) {
                const curr = list[i];
                const next = list[i + 1];
                const gap = toMins(next.start) - toMins(curr.end);
                const f1 = getFloorNum(curr.building);
                const f2 = getFloorNum(next.building);
                if (gap >= 0 && gap <= 15 && f1 !== null && f2 !== null && Math.abs(f1 - f2) >= 2) {
                    warnings.push(`Tight ${gap}m transition on ${day.slice(0, 3)}: Floor ${f1} → Floor ${f2} (${curr.code} → ${next.code})`);
                }
            }
        });

        return warnings;
    }, [selectedSections]);

    // Smart Auto-Routine Generator solver
    const handleGenerateRoutines = async () => {
        const codes = Array.from(
            new Set(
                autoCourseInput
                    .split(/[\s,]+/)
                    .map((c) => c.trim().toUpperCase())
                    .filter(Boolean),
            ),
        ).slice(0, 6);

        if (codes.length === 0) {
            setNotification({ type: 'error', message: 'Enter at least 1 course code (e.g. CSE220, MAT215)' });
            return;
        }

        const avoidSet = new Set(
            avoidFaculties
                .split(/[\s,]+/)
                .map((f) => f.trim().toUpperCase())
                .filter(Boolean),
        );

        setIsGenerating(true);
        setGeneratedRoutines([]);
        try {
            const courseResponses = await Promise.all(
                codes.map((code) => courseService.getAllCourses(code)),
            );

            const buckets: SectionWithCode[][] = [];
            for (let i = 0; i < codes.length; i++) {
                const code = codes[i];
                const matchedCourse = courseResponses[i].find(
                    (c: Course) => c.code.toUpperCase() === code,
                );
                if (!matchedCourse || !matchedCourse.sections?.length) {
                    setNotification({ type: 'error', message: `Course ${code} not found or has no sections` });
                    setIsGenerating(false);
                    return;
                }

                const filtered = matchedCourse.sections
                    .filter((sec) => {
                        if (onlyOpenSeats && sec.enrolled >= sec.capacity) return false;
                        if (avoidSet.size > 0 && sec.facultyInitials) {
                            const facs = sec.facultyInitials.split(',').map((f) => f.trim().toUpperCase());
                            if (facs.some((f) => avoidSet.has(f))) return false;
                        }
                        if (noEightAm && sec.slots?.some((s) => s.startTime < 900)) return false;
                        return true;
                    })
                    .slice(0, 18) // Keep solver fast
                    .map((sec) => ({ ...sec, _displayCode: matchedCourse.code }));

                if (filtered.length === 0) {
                    setNotification({ type: 'error', message: `No sections of ${code} match your filters` });
                    setIsGenerating(false);
                    return;
                }
                buckets.push(filtered);
            }

            // Backtracking search (cap explored combos for instant response)
            const results: GeneratedRoutine[] = [];
            let steps = 0;
            const MAX_STEPS = 4000;

            const scoreRoutine = (combo: SectionWithCode[]): GeneratedRoutine => {
                const daySet = new Set<string>();
                const examDays = new Map<string, number>();
                const slotsByDay = new Map<string, { start: number; end: number; building: string }[]>();

                for (const sec of combo) {
                    const exKey = getExamDayKey(sec.examDate);
                    if (exKey) examDays.set(exKey, (examDays.get(exKey) || 0) + 1);
                    for (const sl of sec.slots || []) {
                        daySet.add(sl.day);
                        const list = slotsByDay.get(sl.day) || [];
                        list.push({ start: sl.startTime, end: sl.endTime, building: sl.building });
                        slotsByDay.set(sl.day, list);
                    }
                }

                let sameDayExams = 0;
                examDays.forEach((cnt) => {
                    if (cnt > 1) sameDayExams += cnt - 1;
                });

                let floorJumps = 0;
                slotsByDay.forEach((list) => {
                    list.sort((a, b) => a.start - b.start);
                    for (let i = 0; i < list.length - 1; i++) {
                        const gap = toMins(list[i + 1].start) - toMins(list[i].end);
                        const f1 = getFloorNum(list[i].building);
                        const f2 = getFloorNum(list[i + 1].building);
                        if (gap >= 0 && gap <= 15 && f1 !== null && f2 !== null && Math.abs(f1 - f2) >= 2) {
                            floorJumps++;
                        }
                    }
                });

                const campusDays = daySet.size;
                let penalty = campusDays * 10 + sameDayExams * 15 + floorJumps * 6;
                if (priorityMode === 'FEWEST_DAYS') penalty = campusDays * 30 + sameDayExams * 8 + floorJumps * 4;
                if (priorityMode === 'NO_SAME_DAY_EXAM') penalty = sameDayExams * 40 + campusDays * 10 + floorJumps * 4;

                return { sections: combo, campusDays, sameDayExams, floorJumps, score: 100 - penalty };
            };

            const backtrack = (idx: number, chosen: SectionWithCode[]) => {
                if (steps++ > MAX_STEPS || results.length >= 40) return;
                if (idx === buckets.length) {
                    results.push(scoreRoutine([...chosen]));
                    return;
                }
                for (const cand of buckets[idx]) {
                    const hasClash = chosen.some(
                        (ex) =>
                            sectionsOverlap(ex, cand) ||
                            (ex.examDate && cand.examDate && ex.examDate === cand.examDate),
                    );
                    if (!hasClash) {
                        chosen.push(cand);
                        backtrack(idx + 1, chosen);
                        chosen.pop();
                    }
                }
            };

            backtrack(0, []);
            results.sort((a, b) => b.score - a.score);
            const top = results.slice(0, 5);
            setGeneratedRoutines(top);

            if (top.length === 0) {
                setNotification({ type: 'error', message: 'No clash-free combination found for those filters' });
            }
        } catch (err) {
            console.error('Auto-routine error:', err);
            setNotification({ type: 'error', message: 'Failed to generate routines' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRemoveSection = (sectionId: string) => {
        setSelectedSections(selectedSections.filter(s => s.id !== sectionId));
        setNotification({ type: 'success', message: 'Course removed' });
    };

    const downloadRoutine = async () => {
        const element = document.getElementById('routine-table');
        if (element) {
            const canvas = await html2canvas(element);
            const data = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = data;
            link.download = 'my-routine.png';
            link.click();
        }
    };

    // Helper to format time
    const formatTime = (time: number) => {
        if (!time) return '';
        const h = Math.floor(time / 100);
        const m = time % 100;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${formattedH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    // Helper to render grid
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const timeSlots = [
        { start: 800, end: 920, label: '08:00-09:20' },
        { start: 930, end: 1050, label: '09:30-10:50' },
        { start: 1100, end: 1220, label: '11:00-12:20' },
        { start: 1230, end: 1350, label: '12:30-01:50' },
        { start: 1400, end: 1520, label: '02:00-03:20' },
        { start: 1530, end: 1650, label: '03:30-04:50' },
        { start: 1700, end: 1820, label: '05:00-06:20' },
    ];

    const getCourseForSlot = (day: string, slotStart: number, slotEnd: number) => {
        for (const sec of selectedSections) {
            const matchedSlot = sec.slots?.find(
                (s) => s.day === day && s.startTime >= slotStart - 5 && s.startTime < slotEnd - 5,
            );
            if (matchedSlot) {
                return { section: sec, slot: matchedSlot };
            }
        }
        return null;
    };

    const toggleCourse = (code: string) => {
        setExpandedCourse(expandedCourse === code ? null : code);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-4 md:p-8 text-white font-sans">
            <div className="max-w-[1700px] mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="group">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-105 transition-transform">
                                <span className="text-white font-black text-xl">U</span>
                            </div>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-extrabold text-white">
                                Routine Builder
                            </h1>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowAutoGen((v) => !v)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 transition-all"
                    >
                        <Sparkles className="w-4 h-4" />
                        {showAutoGen ? 'Hide Auto-Routine Generator' : 'Smart Auto-Routine Generator'}
                    </button>
                </header>

                {/* Smart Auto-Routine Generator Panel */}
                <AnimatePresence>
                    {showAutoGen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 bg-white/10 border border-purple-400/30 rounded-2xl p-5 backdrop-blur-xl overflow-hidden"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-pink-400" />
                                        Smart Auto-Routine Generator
                                    </h2>
                                    <p className="text-xs text-indigo-200">
                                        Enter your target courses and constraints—we'll find top clash-free schedules automatically.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                <input
                                    type="text"
                                    placeholder="Courses (e.g. CSE220, MAT215, ENG102)"
                                    value={autoCourseInput}
                                    onChange={(e) => setAutoCourseInput(e.target.value)}
                                    className="md:col-span-2 px-4 py-2.5 rounded-xl bg-black/30 border border-white/15 text-sm text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Avoid Faculties (e.g. TBA, ABC)"
                                    value={avoidFaculties}
                                    onChange={(e) => setAvoidFaculties(e.target.value)}
                                    className="px-4 py-2.5 rounded-xl bg-black/30 border border-white/15 text-sm text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <select
                                    value={priorityMode}
                                    onChange={(e) => setPriorityMode(e.target.value as any)}
                                    className="px-4 py-2.5 rounded-xl bg-black/30 border border-white/15 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option className="bg-indigo-950" value="BALANCED">Balanced Routine</option>
                                    <option className="bg-indigo-950" value="FEWEST_DAYS">Fewest Campus Days</option>
                                    <option className="bg-indigo-950" value="NO_SAME_DAY_EXAM">Avoid Same-Day Exams</option>
                                </select>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-200">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={onlyOpenSeats}
                                            onChange={(e) => setOnlyOpenSeats(e.target.checked)}
                                            className="rounded accent-purple-500"
                                        />
                                        Only Open Seats
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={noEightAm}
                                            onChange={(e) => setNoEightAm(e.target.checked)}
                                            className="rounded accent-purple-500"
                                        />
                                        No 8:00 AM Classes
                                    </label>
                                </div>

                                <button
                                    onClick={handleGenerateRoutines}
                                    disabled={isGenerating}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? 'Solving...' : 'Generate Clash-Free Routines'}
                                </button>
                            </div>

                            {generatedRoutines.length > 0 && (
                                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {generatedRoutines.map((routine, idx) => (
                                        <div key={idx} className="bg-black/30 border border-white/15 rounded-xl p-3.5 flex flex-col justify-between gap-2">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-purple-300">Option #{idx + 1}</span>
                                                    <span className="text-[10px] text-emerald-300 font-semibold">
                                                        {routine.campusDays} days/wk • {routine.sameDayExams} same-day exams • {routine.floorJumps} tight jumps
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {routine.sections.map((s) => (
                                                        <div key={s.id} className="text-xs flex justify-between text-gray-200">
                                                            <span className="font-bold">{s._displayCode} [{s.sectionNumber}]</span>
                                                            <span className="text-gray-400">{s.facultyInitials || 'TBA'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedSections(routine.sections);
                                                    setNotification({ type: 'success', message: `Applied Routine Option #${idx + 1}` });
                                                }}
                                                className="mt-2 w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Apply Routine
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Exam Clash & Floor Transition Warnings */}
                {routineWarnings.length > 0 && (
                    <div className="mb-5 bg-amber-500/15 border border-amber-400/40 rounded-xl p-3.5 flex flex-col gap-1">
                        {routineWarnings.map((w, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-amber-200 font-medium">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>{w}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Notification */}
                <AnimatePresence>
                    {notification && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -20 }}
                            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl border backdrop-blur-md flex items-center gap-3 min-w-[300px] justify-center
                                ${notification.type === 'success'
                                    ? 'bg-green-500/90 border-green-400 text-white'
                                    : 'bg-red-500/90 border-red-400 text-white'}`}
                        >
                            <span className="font-bold">{notification.message}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Top Section: 3 Columns Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6 h-[600px] lg:h-[600px]">

                    {/* COL 1: Available Courses (Accordion) (3 cols) */}
                    <div className="lg:col-span-3 flex flex-col h-full bg-black/20 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md">
                        <div className="p-4 border-b border-white/10 bg-white/5">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Select Course</h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search (e.g. CSE110)"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-gray-500"
                                />
                                <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
                            ) : Object.keys(groupedSections).length === 0 ? (
                                <div className="p-4 text-center text-gray-400 text-sm">No courses found</div>
                            ) : (
                                <div>
                                    {Object.keys(groupedSections).slice(0, 50).map(code => (
                                        <div key={code} className="border-b border-white/5 last:border-0">
                                            <button
                                                onClick={() => toggleCourse(code)}
                                                className={`w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors
                                                    ${expandedCourse === code ? 'bg-purple-600/10' : ''}`}
                                            >
                                                <span className="font-bold text-sm text-purple-200">{code}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                                        {groupedSections[code].length}
                                                    </span>
                                                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedCourse === code ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </button>

                                            <AnimatePresence>
                                                {expandedCourse === code && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden bg-black/20"
                                                    >
                                                        {groupedSections[code].map((item) => (
                                                            <div
                                                                key={item.section.id}
                                                                onClick={() => setFocusedSection(item)}
                                                                className={`p-2 pl-4 flex justify-between items-center cursor-pointer border-t border-white/5 hover:bg-white/5
                                                                    ${focusedSection?.section.id === item.section.id ? 'bg-purple-600/20' : ''}`}
                                                            >
                                                                <div>
                                                                    <div className="text-xs font-bold text-gray-200">Sec {item.section.sectionNumber}</div>
                                                                    <div className="text-[10px] text-gray-400 flex items-center gap-2">
                                                                        <span>{item.section.facultyInitials}</span>
                                                                        <span className={`${Math.max(0, item.section.capacity - item.section.enrolled) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {Math.max(0, item.section.capacity - item.section.enrolled)} Seat
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAddSection(item);
                                                                    }}
                                                                    className="p-1 px-2 rounded bg-purple-600 hover:bg-purple-500 text-[10px] font-bold shadow transition-colors"
                                                                >
                                                                    ADD
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COL 2: Info (5 cols) */}
                    <div className="lg:col-span-6 flex flex-col h-full bg-indigo-900/40 rounded-2xl border border-indigo-500/30 overflow-hidden backdrop-blur-xl relative">
                        {focusedSection ? (
                            <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">
                                            {focusedSection.courseCode}
                                        </h2>
                                        <p className="text-indigo-300 text-sm">{focusedSection.courseTitle}</p>
                                    </div>
                                    <div className="bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                                        <span className="block text-2xl font-black text-white text-center">{focusedSection.section.sectionNumber}</span>
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Section</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Faculty</p>
                                        <p className="text-xl font-bold text-white">{focusedSection.section.facultyInitials}</p>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Exam Date</p>
                                        <p className="text-sm font-medium text-pink-300">
                                            {focusedSection.section.examDate || 'TBA'}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-6 flex-1">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-3">Schedule</p>
                                    <div className="space-y-2">
                                        {focusedSection.section.slots?.filter(s => s.type === 'CLASS').map((s, i) => (
                                            <div key={i} className="flex items-center text-sm bg-white/5 p-2 rounded-lg">
                                                <span className="font-bold text-white w-20">{s.day}</span>
                                                <span className="text-indigo-200 font-mono">{formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                                                <span className="ml-auto text-xs bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300">{s.roomNumber}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleAddSection(focusedSection)}
                                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg rounded-xl shadow-lg transition-all border border-white/10 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add this Section
                                </button>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="text-sm">Select a course to view details</p>
                            </div>
                        )}
                    </div>

                    {/* COL 3: Selected (4 cols) -> Adjusted to 3 to fit grid 12? No, I used 3-6-3 = 12 */}
                    <div className="lg:col-span-3 flex flex-col h-full bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Selected</h2>
                            <span className="bg-purple-600 px-2 py-0.5 rounded textxs font-bold shadow">{selectedSections.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                            {selectedSections.map(sec => (
                                <div key={sec.id} className="bg-indigo-600/20 border border-indigo-500/30 p-2.5 rounded-lg group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            {/* @ts-ignore */}
                                            <div className="font-bold text-sm text-white">{sec._displayCode || sec.courseId} <span className="text-xs font-normal text-indigo-300">Sec {sec.sectionNumber}</span></div>
                                            <div className="text-[10px] text-gray-400">{sec.facultyInitials}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveSection(sec.id)}
                                            className="text-red-400 hover:text-red-200 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="mt-1 space-y-0.5">
                                        {sec.slots?.filter(s => s.type === 'CLASS').map((s, idx) => (
                                            <div key={idx} className="flex justify-between text-[10px] text-indigo-200">
                                                <span>{s.day.slice(0, 3)}</span>
                                                <span>{formatTime(s.startTime)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {selectedSections.length === 0 && (
                                <div className="text-center text-gray-500 text-xs mt-10">Empty routine</div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Bottom: Compact Routine Table */}
                <div className="glass p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/20">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Class Routine</h2>
                        <button
                            onClick={downloadRoutine}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-bold text-xs transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                        </button>
                    </div>

                    <div className="overflow-x-auto pb-2" id="routine-table">
                        <div className="bg-[#0f1016] p-3 rounded-xl min-w-[800px] border border-white/10">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 border border-gray-800 bg-gray-900/80 text-gray-400 font-bold text-xs w-24 text-left">Time/Day</th>
                                        {days.map((day) => (
                                            <th key={day} className="p-2 border border-gray-800 bg-gray-900/80 text-gray-400 font-bold text-xs text-center">
                                                {day.slice(0, 3)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSlots.map((slot) => (
                                        <tr key={slot.label}>
                                            <td className="p-2 border border-gray-800 bg-gray-900/40 text-[10px] text-gray-500 font-mono font-bold text-center">
                                                {slot.label}
                                            </td>
                                            {days.map((day) => {
                                                const match = getCourseForSlot(day, slot.start, slot.end);
                                                const courseTuple = match?.section;
                                                const matchedSlot = match?.slot;

                                                return (
                                                    <td key={day} className="border border-gray-800 relative h-16 p-0.5">
                                                        {courseTuple && matchedSlot && (
                                                            <div className={`w-full h-full rounded md:rounded-lg flex flex-col items-center justify-center p-1 text-center shadow-sm border ${matchedSlot.type === 'LAB'
                                                                ? 'bg-pink-600/50 border-pink-400/40'
                                                                : 'bg-indigo-600/60 border-indigo-400/30'}`}>
                                                                {/* @ts-ignore */}
                                                                <span className="font-bold text-white text-xs leading-none">
                                                                    {courseTuple._displayCode || courseTuple.courseId}
                                                                    {matchedSlot.type === 'LAB' ? ' LAB' : ''}
                                                                </span>
                                                                <span className="text-[9px] text-indigo-200 leading-none mt-0.5">Sec {courseTuple.sectionNumber}</span>
                                                                <span className="text-[8px] text-gray-300 font-mono leading-none mt-0.5">{matchedSlot.roomNumber}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="mt-2 text-center text-gray-600 text-[10px]">
                                UniFlow Routine - {selectedSections.length * 3} Cr
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
