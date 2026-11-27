import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Plus,
    Trash2,
    Calculator,
    Sparkles,
    Send,
    Loader2,
    RotateCcw,
    TrendingUp,
    Award,
    BookOpen,
    Target,
} from 'lucide-react';
import { api } from '../lib/axios';

interface Course {
    id: string;
    name: string;
    credits: number;
    grade: string;
    isRetake: boolean;
    previousGrade: string;
}

const gradePoints: Record<string, number> = {
    'A+': 4.00,
    'A': 4.00,
    'A-': 3.70,
    'B+': 3.30,
    'B': 3.00,
    'B-': 2.70,
    'C+': 2.30,
    'C': 2.00,
    'C-': 1.70,
    'D+': 1.30,
    'D': 1.00,
    'F': 0.00,
};

const grades = Object.keys(gradePoints);
const retakePreviousGrades = ['F', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-'];

const DEFAULT_COURSES: Course[] = [
    { id: '1', name: '', credits: 3, grade: 'A', isRetake: false, previousGrade: 'D' },
    { id: '2', name: '', credits: 3, grade: 'A-', isRetake: false, previousGrade: 'D' },
    { id: '3', name: '', credits: 3, grade: 'B+', isRetake: false, previousGrade: 'D' },
];

export default function CGPACalculator() {
    const [courses, setCourses] = useState<Course[]>(DEFAULT_COURSES);
    const [currentCGPA, setCurrentCGPA] = useState<string>('');
    const [completedCredits, setCompletedCredits] = useState<string>('');
    const [totalDegreeCredits, setTotalDegreeCredits] = useState<string>('136');
    const [targetCGPA, setTargetCGPA] = useState<string>('3.50');
    const [creditsPerSem, setCreditsPerSem] = useState<string>('12');
    const [advisorQuestion, setAdvisorQuestion] = useState<string>('');
    const [advisorMessages, setAdvisorMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
    const [advisorLoading, setAdvisorLoading] = useState(false);
    const [advisorProvider, setAdvisorProvider] = useState<string | null>(null);

    // Exact, unrounded semester & cumulative calculations (including retake replacement logic)
    const calculations = useMemo(() => {
        let semPoints = 0;
        let semCredits = 0;
        let newOnlyPoints = 0;
        let newOnlyCredits = 0;
        let retakeDeltaPoints = 0;
        let retakeCredits = 0;

        for (const c of courses) {
            if (c.credits <= 0) continue;
            const gp = gradePoints[c.grade] ?? 0;
            semPoints += gp * c.credits;
            semCredits += c.credits;

            if (c.isRetake) {
                const prevGp = gradePoints[c.previousGrade] ?? 0;
                retakeDeltaPoints += (gp - prevGp) * c.credits;
                retakeCredits += c.credits;
            } else {
                newOnlyPoints += gp * c.credits;
                newOnlyCredits += c.credits;
            }
        }

        const semesterGPA = semCredits > 0 ? semPoints / semCredits : 0;

        const parsedCurr = parseFloat(currentCGPA);
        const parsedDone = parseFloat(completedCredits);
        const hasStanding =
            currentCGPA.trim() !== '' &&
            completedCredits.trim() !== '' &&
            !Number.isNaN(parsedCurr) &&
            !Number.isNaN(parsedDone) &&
            parsedCurr >= 0 &&
            parsedCurr <= 4 &&
            parsedDone >= 0;

        let projectedCGPA = semesterGPA;
        let projectedCredits = newOnlyCredits;
        let cgpaDelta = 0;

        if (hasStanding) {
            const basePoints = parsedCurr * parsedDone;
            const totalPoints = Math.max(0, basePoints + newOnlyPoints + retakeDeltaPoints);
            projectedCredits = parsedDone + newOnlyCredits;
            projectedCGPA = projectedCredits > 0
                ? Math.min(4.0, totalPoints / projectedCredits)
                : 0;
            cgpaDelta = projectedCGPA - parsedCurr;
        }

        return {
            semesterGPA,
            semCredits,
            newOnlyCredits,
            retakeCredits,
            hasStanding,
            parsedCurr: hasStanding ? parsedCurr : 0,
            parsedDone: hasStanding ? parsedDone : 0,
            projectedCGPA,
            projectedCredits,
            cgpaDelta,
        };
    }, [courses, currentCGPA, completedCredits]);

    const goalAnalysis = useMemo(() => {
        const total = parseFloat(totalDegreeCredits);
        const target = parseFloat(targetCGPA);
        const perSem = Math.max(1, parseFloat(creditsPerSem) || 12);

        if (
            !calculations.hasStanding ||
            Number.isNaN(total) ||
            total <= 0 ||
            Number.isNaN(target) ||
            target < 0 ||
            target > 4
        ) {
            return null;
        }

        const curr = calculations.parsedCurr;
        const done = calculations.parsedDone;
        const remaining = Math.max(0, total - done);

        // Projected after this semester's draft courses
        const projRemaining = Math.max(0, total - calculations.projectedCredits);
        const projMaxCGPA = Math.min(
            4.0,
            (calculations.projectedCGPA * calculations.projectedCredits + 4.0 * projRemaining) / total,
        );

        if (remaining <= 0) {
            return {
                possible: curr >= target,
                remaining: 0,
                requiredGPA: 0,
                maxCGPA: curr,
                projMaxCGPA,
                semestersLeft: 0,
                retakesNeeded: 0,
                summary:
                    curr >= target
                        ? `You have completed ${done}/${total} credits with ${curr.toFixed(2)} CGPA — your ${target.toFixed(2)} goal is achieved!`
                        : `All ${total} degree credits are completed at ${curr.toFixed(2)} CGPA. Retaking lower-grade courses (e.g. D or F) is the only way to raise it.`,
            };
        }

        const requiredGPA = (target * total - curr * done) / remaining;
        const maxCGPA = Math.min(4.0, (curr * done + 4.0 * remaining) / total);
        const semestersLeft = Math.ceil(remaining / perSem);
        const possible = requiredGPA <= 4.0;

        // How many 3-credit D (1.00) -> A (4.00) retakes would close the gap if impossible
        const deficitPoints = Math.max(0, target * total - (curr * done + 4.0 * remaining));
        const retakesNeeded = deficitPoints > 0 ? Math.ceil(deficitPoints / (3 * 3.0)) : 0;

        let summary = '';
        if (requiredGPA <= 0) {
            summary = `Your ${target.toFixed(2)} target is already secured — passing your remaining ${remaining} credits keeps you above it.`;
        } else if (requiredGPA <= 3.3) {
            summary = `Very achievable! You need an average of ${requiredGPA.toFixed(2)} GPA (B+ range) across ${remaining} remaining credits (~${semestersLeft} sem).`;
        } else if (requiredGPA <= 3.75) {
            summary = `Achievable with steady focus: aim for a ${requiredGPA.toFixed(2)} GPA average across ${remaining} remaining credits (~${semestersLeft} sem).`;
        } else if (requiredGPA <= 4.0) {
            summary = `Challenging but possible! You need ${requiredGPA.toFixed(2)} GPA average (mostly A / A-) across all ${remaining} remaining credits.`;
        } else {
            summary = `Not possible with ${remaining} remaining credits alone (requires ${requiredGPA.toFixed(2)} GPA > 4.00). Straight 4.00s reach ${maxCGPA.toFixed(2)}. Retaking ~${retakesNeeded} low-grade (D→A) 3-credit course${retakesNeeded > 1 ? 's' : ''} can close the gap.`;
        }

        return {
            possible,
            remaining,
            requiredGPA,
            maxCGPA,
            projMaxCGPA,
            semestersLeft,
            retakesNeeded,
            summary,
        };
    }, [calculations, totalDegreeCredits, targetCGPA, creditsPerSem]);

    const askAdvisor = async (customPrompt?: string) => {
        const q = (customPrompt ?? advisorQuestion).trim();
        if (!q || advisorLoading) return;

        const nextHistory = [...advisorMessages, { role: 'user' as const, text: q }];
        setAdvisorMessages(nextHistory);
        if (!customPrompt) setAdvisorQuestion('');
        setAdvisorLoading(true);

        try {
            const total = totalDegreeCredits ? parseFloat(totalDegreeCredits) : 136;
            const target = targetCGPA ? parseFloat(targetCGPA) : undefined;
            const perSem = creditsPerSem ? parseFloat(creditsPerSem) : 12;

            const res = await api.post<{ reply: string; provider: string }>('/ai/cgpa-chat', {
                message: q,
                history: advisorMessages.slice(-8),
                context: {
                    currentCGPA: calculations.hasStanding ? calculations.parsedCurr : undefined,
                    completedCredits: calculations.hasStanding ? calculations.parsedDone : undefined,
                    totalDegreeCredits: total,
                    targetCGPA: target,
                    creditsPerSem: perSem,
                    requiredGPA: goalAnalysis?.requiredGPA,
                    maxCGPA: goalAnalysis?.maxCGPA,
                    remainingCredits: goalAnalysis?.remaining,
                    semesterGPA: Number(calculations.semesterGPA.toFixed(2)),
                    semesterCredits: calculations.semCredits,
                },
            });

            setAdvisorProvider(res.data.provider);
            setAdvisorMessages([...nextHistory, { role: 'ai', text: res.data.reply }]);
        } catch {
            setAdvisorMessages([
                ...nextHistory,
                {
                    role: 'ai',
                    text: goalAnalysis
                        ? `${goalAnalysis.summary} (Max possible CGPA: ${goalAnalysis.maxCGPA.toFixed(2)})`
                        : 'Could not reach the AI mentor right now — please try again in a moment.',
                },
            ]);
        } finally {
            setAdvisorLoading(false);
        }
    };

    const addCourse = () => {
        setCourses((prev) => [
            ...prev,
            {
                id: Date.now().toString(),
                name: '',
                credits: 3,
                grade: 'A',
                isRetake: false,
                previousGrade: 'D',
            },
        ]);
    };

    const removeCourse = (id: string) => {
        if (courses.length > 1) {
            setCourses((prev) => prev.filter((c) => c.id !== id));
        }
    };

    const updateCourse = <K extends keyof Course>(id: string, field: K, value: Course[K]) => {
        setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    };

    const resetCalculator = () => {
        setCourses(DEFAULT_COURSES.map((c, i) => ({ ...c, id: `${Date.now()}-${i}` })));
        setCurrentCGPA('');
        setCompletedCredits('');
        setTotalDegreeCredits('136');
        setTargetCGPA('3.50');
        setCreditsPerSem('12');
    };

    const totalDeg = Math.max(1, parseFloat(totalDegreeCredits) || 136);
    const completionPct = Math.min(100, Math.round((calculations.projectedCredits / totalDeg) * 100));

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3.5">
                        <Link to="/dashboard" className="group shrink-0">
                            <img
                                src="/uniflow-logo.svg"
                                alt="UniFlow"
                                className="w-11 h-11 rounded-xl shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform"
                            />
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                                CGPA Calculator &amp; AI Mentor
                            </h1>
                            <p className="text-xs md:text-sm text-purple-200">
                                Accurate BRACU GPA, retake replacement math, degree roadmap &amp; live AI mentoring
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            onClick={resetCalculator}
                            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-purple-100 text-xs font-semibold rounded-xl transition-all border border-white/15 flex items-center gap-1.5"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset
                        </button>
                        <Link
                            to="/dashboard"
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs md:text-sm font-semibold rounded-xl transition-all backdrop-blur-sm border border-white/20"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>

                {/* Top KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-purple-600/80 to-indigo-700/80 rounded-2xl p-4 md:p-5 border border-purple-400/30 shadow-xl">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] text-purple-200 font-semibold uppercase tracking-wider">Semester GPA</p>
                            <BookOpen className="w-4 h-4 text-purple-200/80" />
                        </div>
                        <p className="text-3xl font-black text-white">{calculations.semesterGPA.toFixed(2)}</p>
                        <p className="text-[11px] text-purple-200/80 mt-1">
                            {calculations.semCredits} cr ({calculations.newOnlyCredits} new
                            {calculations.retakeCredits > 0 ? ` + ${calculations.retakeCredits} retake` : ''})
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-pink-600/75 to-purple-700/80 rounded-2xl p-4 md:p-5 border border-pink-400/30 shadow-xl">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] text-pink-100 font-semibold uppercase tracking-wider">Projected CGPA</p>
                            <TrendingUp className="w-4 h-4 text-pink-100/80" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-white">{calculations.projectedCGPA.toFixed(2)}</p>
                            {calculations.hasStanding && (
                                <span
                                    className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                                        calculations.cgpaDelta >= 0
                                            ? 'bg-emerald-400/20 text-emerald-200'
                                            : 'bg-rose-400/20 text-rose-200'
                                    }`}
                                >
                                    {calculations.cgpaDelta >= 0 ? '+' : ''}
                                    {calculations.cgpaDelta.toFixed(2)}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-pink-100/80 mt-1">
                            {calculations.hasStanding
                                ? `From ${calculations.parsedCurr.toFixed(2)} (${calculations.parsedDone} cr)`
                                : 'Enter standing below to project'}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-600/80 to-purple-700/80 rounded-2xl p-4 md:p-5 border border-purple-400/30 shadow-xl">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] text-purple-200 font-semibold uppercase tracking-wider">Degree Progress</p>
                            <Award className="w-4 h-4 text-purple-200/80" />
                        </div>
                        <p className="text-3xl font-black text-white">
                            {calculations.projectedCredits}
                            <span className="text-base font-semibold text-purple-200">/{totalDeg} cr</span>
                        </p>
                        <div className="w-full h-1.5 bg-purple-950/60 rounded-full mt-2 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-pink-400 to-purple-300 rounded-full transition-all duration-300"
                                style={{ width: `${completionPct}%` }}
                            />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-violet-600/80 to-indigo-800/80 rounded-2xl p-4 md:p-5 border border-purple-400/30 shadow-xl">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] text-purple-200 font-semibold uppercase tracking-wider">Max Possible</p>
                            <Target className="w-4 h-4 text-purple-200/80" />
                        </div>
                        <p className="text-3xl font-black text-white">
                            {goalAnalysis ? goalAnalysis.maxCGPA.toFixed(2) : '4.00'}
                        </p>
                        <p className="text-[11px] text-purple-200/80 mt-1">
                            {goalAnalysis
                                ? `With straight 4.00s (${goalAnalysis.remaining} cr left)`
                                : 'Enter standing for ceiling'}
                        </p>
                    </div>
                </div>

                {/* Main 2-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column (7 cols): Academic Standing + Courses */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Unified Academic Standing & Degree Target Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl"
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-purple-300" />
                                Academic Standing &amp; Degree Goal
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <div>
                                    <label className="block text-[11px] text-purple-200 mb-1">Current CGPA</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="4"
                                        placeholder="e.g. 3.40"
                                        value={currentCGPA}
                                        onChange={(e) => setCurrentCGPA(e.target.value)}
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-purple-200 mb-1">Completed Cr</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="250"
                                        placeholder="e.g. 90"
                                        value={completedCredits}
                                        onChange={(e) => setCompletedCredits(e.target.value)}
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-purple-200 mb-1">Total Degree Cr</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="250"
                                        step="1"
                                        value={totalDegreeCredits}
                                        onChange={(e) => setTotalDegreeCredits(e.target.value)}
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-purple-200 mb-1">Target CGPA</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="4"
                                        step="0.01"
                                        value={targetCGPA}
                                        onChange={(e) => setTargetCGPA(e.target.value)}
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[11px] text-purple-200 mb-1">Cr / Sem</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        step="1"
                                        value={creditsPerSem}
                                        onChange={(e) => setCreditsPerSem(e.target.value)}
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>

                            {goalAnalysis && (
                                <div
                                    className={`mt-4 p-4 rounded-2xl border ${
                                        goalAnalysis.possible
                                            ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-100'
                                            : 'bg-rose-500/15 border-rose-400/35 text-rose-100'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                        <span className="text-sm font-extrabold">
                                            {goalAnalysis.possible ? 'Goal is Achievable' : 'Goal Exceeds 4.00 Cap'}
                                        </span>
                                        <span className="text-xs font-mono font-bold">
                                            Req. Avg GPA: {Math.max(0, goalAnalysis.requiredGPA).toFixed(2)} • After Sem Max: {goalAnalysis.projMaxCGPA.toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-xs leading-relaxed">{goalAnalysis.summary}</p>
                                </div>
                            )}
                        </motion.div>

                        {/* This Semester's Courses (supports New + Retake courses) */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white">This Semester&apos;s Courses</h2>
                                    <p className="text-xs text-purple-200/80">
                                        Toggle <strong>Retake</strong> to replace an older grade without adding extra credits
                                    </p>
                                </div>
                                <button
                                    onClick={addCourse}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Course
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                                {courses.map((course, index) => (
                                    <div
                                        key={course.id}
                                        className="bg-purple-950/35 rounded-2xl p-4 border border-purple-400/20 hover:border-purple-400/45 transition-all space-y-3"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold text-purple-300 w-6">#{index + 1}</span>
                                            <input
                                                type="text"
                                                placeholder="Course code (e.g. CSE220)"
                                                value={course.name}
                                                onChange={(e) => updateCourse(course.id, 'name', e.target.value)}
                                                className="flex-1 min-w-[140px] bg-purple-950/50 border border-purple-400/25 rounded-xl px-3 py-2 text-sm text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateCourse(course.id, 'isRetake', !course.isRetake)}
                                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                    course.isRetake
                                                        ? 'bg-amber-500/25 border-amber-400/50 text-amber-200'
                                                        : 'bg-purple-900/40 border-purple-400/25 text-purple-200 hover:bg-purple-800/40'
                                                }`}
                                            >
                                                {course.isRetake ? 'Retake: ON' : 'New Course'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeCourse(course.id)}
                                                disabled={courses.length === 1}
                                                className="p-2 text-red-400 hover:bg-red-500/15 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Remove course"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className={`grid gap-3 ${course.isRetake ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                            <div>
                                                <label className="block text-[10px] text-purple-300 mb-1">Credits</label>
                                                <select
                                                    value={course.credits}
                                                    onChange={(e) => updateCourse(course.id, 'credits', parseFloat(e.target.value))}
                                                    className="w-full bg-purple-950/80 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    style={{ colorScheme: 'dark' }}
                                                >
                                                    <option value={0.75}>0.75 Cr</option>
                                                    <option value={1}>1.0 Cr</option>
                                                    <option value={1.5}>1.5 Cr</option>
                                                    <option value={2}>2.0 Cr</option>
                                                    <option value={3}>3.0 Cr</option>
                                                    <option value={4}>4.0 Cr</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-purple-300 mb-1">
                                                    {course.isRetake ? 'New Grade' : 'Expected Grade'}
                                                </label>
                                                <select
                                                    value={course.grade}
                                                    onChange={(e) => updateCourse(course.id, 'grade', e.target.value)}
                                                    className="w-full bg-purple-950/80 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    style={{ colorScheme: 'dark' }}
                                                >
                                                    {grades.map((g) => (
                                                        <option key={g} value={g}>
                                                            {g} ({gradePoints[g].toFixed(2)})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            {course.isRetake && (
                                                <div>
                                                    <label className="block text-[10px] text-amber-200 mb-1">Previous Grade</label>
                                                    <select
                                                        value={course.previousGrade}
                                                        onChange={(e) => updateCourse(course.id, 'previousGrade', e.target.value)}
                                                        className="w-full bg-amber-950/60 border border-amber-400/40 rounded-xl px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                        style={{ colorScheme: 'dark' }}
                                                    >
                                                        {retakePreviousGrades.map((g) => (
                                                            <option key={g} value={g}>
                                                                {g} ({gradePoints[g].toFixed(2)})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column (5 cols): AI CGPA Mentor + BRACU Grade Scale */}
                    <div className="lg:col-span-5 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-purple-400/30 shadow-2xl"
                        >
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-pink-400" />
                                        AI CGPA Mentor
                                        {advisorProvider && (
                                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-purple-200">
                                                {advisorProvider === 'gemini'
                                                    ? 'Gemini AI'
                                                    : advisorProvider === 'groq'
                                                      ? 'Groq AI'
                                                      : 'Smart Mode'}
                                            </span>
                                        )}
                                    </h2>
                                    <p className="text-xs text-purple-200">
                                        Ask about target CGPA, retakes, semester load, or study strategy.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {[
                                    'Is my target CGPA possible?',
                                    'What is my max possible CGPA?',
                                    'How much does retaking a D help?',
                                ].map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => void askAdvisor(q)}
                                        className="px-2.5 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/30 text-xs text-purple-100 transition-colors"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void askAdvisor();
                                }}
                                className="flex gap-2 mb-3"
                            >
                                <input
                                    type="text"
                                    value={advisorQuestion}
                                    onChange={(e) => setAdvisorQuestion(e.target.value)}
                                    placeholder="Ask your AI CGPA Mentor..."
                                    className="flex-1 bg-purple-950/50 border border-purple-400/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <button
                                    type="submit"
                                    disabled={advisorLoading}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4" />
                                    Ask
                                </button>
                            </form>

                            {(advisorMessages.length > 0 || advisorLoading) && (
                                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar p-3 rounded-xl bg-purple-950/40 border border-purple-400/20">
                                    {advisorLoading && (
                                        <div className="text-xs p-2.5 rounded-lg bg-indigo-950/60 text-purple-200 mr-6 border border-purple-400/20 flex items-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Thinking...
                                        </div>
                                    )}
                                    {[...advisorMessages].reverse().map((m, idx) => (
                                        <div
                                            key={idx}
                                            className={`text-xs p-2.5 rounded-lg whitespace-pre-wrap ${
                                                m.role === 'user'
                                                    ? 'bg-purple-600/30 text-white ml-6'
                                                    : 'bg-indigo-950/60 text-purple-100 mr-6 border border-purple-400/20'
                                            }`}
                                        >
                                            <span className="font-bold mr-1.5">
                                                {m.role === 'user' ? 'You:' : 'Mentor:'}
                                            </span>
                                            {m.text}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>

                        {/* BRACU Grade Scale */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-5 border border-white/20"
                        >
                            <h3 className="text-sm font-bold text-white mb-3">BRACU Grade Scale</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                                {Object.entries(gradePoints).map(([grade, points]) => (
                                    <div
                                        key={grade}
                                        className="flex justify-between px-3 py-1.5 bg-purple-950/40 border border-purple-400/15 rounded-lg"
                                    >
                                        <span className="font-bold text-white">{grade}</span>
                                        <span className="text-purple-200">{points.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.5); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(168, 85, 247, 0.7); }
                `}</style>
            </div>
        </div>
    );
}
