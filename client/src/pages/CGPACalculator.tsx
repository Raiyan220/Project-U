import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Trash2, Calculator, Sparkles, Send, Loader2 } from 'lucide-react';
import { api } from '../lib/axios';

interface Course {
    id: string;
    name: string;
    credits: number;
    grade: string;
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

export default function CGPACalculator() {
    const [courses, setCourses] = useState<Course[]>([
        { id: '1', name: '', credits: 3, grade: 'A' }
    ]);
    const [currentCGPA, setCurrentCGPA] = useState<string>('');
    const [completedCredits, setCompletedCredits] = useState<string>('');
    const [totalDegreeCredits, setTotalDegreeCredits] = useState<string>('136');
    const [targetCGPA, setTargetCGPA] = useState<string>('3.50');
    const [creditsPerSem, setCreditsPerSem] = useState<string>('12');
    const [advisorQuestion, setAdvisorQuestion] = useState<string>('');
    const [advisorMessages, setAdvisorMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
    const [advisorLoading, setAdvisorLoading] = useState(false);
    const [advisorProvider, setAdvisorProvider] = useState<string | null>(null);

    const goalAnalysis = useMemo(() => {
        const curr = parseFloat(currentCGPA);
        const done = parseFloat(completedCredits);
        const total = parseFloat(totalDegreeCredits);
        const target = parseFloat(targetCGPA);
        const perSem = Math.max(1, parseFloat(creditsPerSem) || 12);

        if (Number.isNaN(curr) || Number.isNaN(done) || Number.isNaN(total) || Number.isNaN(target)) {
            return null;
        }
        const remaining = total - done;
        if (remaining <= 0) {
            return {
                possible: curr >= target,
                remaining: 0,
                requiredGPA: 0,
                maxCGPA: curr,
                semestersLeft: 0,
                summary: curr >= target
                    ? `You already completed ${done}/${total} credits with ${curr.toFixed(2)} CGPA (goal ${target.toFixed(2)} achieved!).`
                    : `All ${total} credits are completed at ${curr.toFixed(2)} CGPA. Only retaking lower-grade courses can raise it.`,
            };
        }

        const requiredGPA = (target * total - curr * done) / remaining;
        const maxCGPA = (curr * done + 4.0 * remaining) / total;
        const semestersLeft = Math.ceil(remaining / perSem);
        const possible = requiredGPA <= 4.0;

        let summary = '';
        if (requiredGPA <= 0) {
            summary = `Your target ${target.toFixed(2)} is already secured—you just need to pass your remaining ${remaining} credits.`;
        } else if (requiredGPA <= 3.3) {
            summary = `Very achievable! You need an average of ${requiredGPA.toFixed(2)} GPA (B+ range) across your remaining ${remaining} credits (~${semestersLeft} semesters).`;
        } else if (requiredGPA <= 3.75) {
            summary = `Achievable with steady focus: you need ${requiredGPA.toFixed(2)} GPA average across ${remaining} remaining credits (~${semestersLeft} semesters).`;
        } else if (requiredGPA <= 4.0) {
            summary = `Tough but mathematically possible! You need ${requiredGPA.toFixed(2)} GPA average (mostly A/A- grades) in all ${remaining} remaining credits.`;
        } else {
            summary = `Not possible with ${remaining} remaining credits alone (would require ${requiredGPA.toFixed(2)} GPA > 4.00). Even getting straight 4.00s reaches ${maxCGPA.toFixed(2)} CGPA. Retaking low-grade courses can push it higher.`;
        }

        return { possible, remaining, requiredGPA, maxCGPA, semestersLeft, summary };
    }, [currentCGPA, completedCredits, totalDegreeCredits, targetCGPA, creditsPerSem]);

    const askAdvisor = async (customPrompt?: string) => {
        const q = (customPrompt ?? advisorQuestion).trim();
        if (!q || advisorLoading) return;

        const nextHistory = [...advisorMessages, { role: 'user' as const, text: q }];
        setAdvisorMessages(nextHistory);
        if (!customPrompt) setAdvisorQuestion('');
        setAdvisorLoading(true);

        try {
            const curr = currentCGPA ? parseFloat(currentCGPA) : undefined;
            const done = completedCredits ? parseFloat(completedCredits) : undefined;
            const total = totalDegreeCredits ? parseFloat(totalDegreeCredits) : 136;
            const target = targetCGPA ? parseFloat(targetCGPA) : undefined;
            const perSem = creditsPerSem ? parseFloat(creditsPerSem) : 12;

            const res = await api.post<{ reply: string; provider: string }>('/ai/cgpa-chat', {
                message: q,
                history: advisorMessages.slice(-8),
                context: {
                    currentCGPA: curr,
                    completedCredits: done,
                    totalDegreeCredits: total,
                    targetCGPA: target,
                    creditsPerSem: perSem,
                    requiredGPA: goalAnalysis?.requiredGPA,
                    maxCGPA: goalAnalysis?.maxCGPA,
                    remainingCredits: goalAnalysis?.remaining,
                    semesterGPA: parseFloat(calculateSemesterGPA()),
                    semesterCredits: getTotalCredits(),
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
                        : 'Could not reach the AI advisor right now—please try again in a moment.',
                },
            ]);
        } finally {
            setAdvisorLoading(false);
        }
    };

    const addCourse = () => {
        setCourses([...courses, {
            id: Date.now().toString(),
            name: '',
            credits: 3,
            grade: 'A'
        }]);
    };

    const removeCourse = (id: string) => {
        if (courses.length > 1) {
            setCourses(courses.filter(c => c.id !== id));
        }
    };

    const updateCourse = (id: string, field: keyof Course, value: any) => {
        setCourses(courses.map(c =>
            c.id === id ? { ...c, [field]: value } : c
        ));
    };

    const calculateSemesterGPA = () => {
        let totalPoints = 0;
        let totalCredits = 0;

        courses.forEach(course => {
            if (course.grade && course.credits > 0) {
                totalPoints += gradePoints[course.grade] * course.credits;
                totalCredits += course.credits;
            }
        });

        return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
    };

    const calculateCumulativeCGPA = () => {
        const semesterGPA = parseFloat(calculateSemesterGPA());
        const newCredits = courses.reduce((sum, c) => sum + c.credits, 0);

        if (!currentCGPA || !completedCredits) {
            return semesterGPA.toFixed(2);
        }

        const prevCGPA = parseFloat(currentCGPA);
        const prevCredits = parseFloat(completedCredits);

        const totalPoints = (prevCGPA * prevCredits) + (semesterGPA * newCredits);
        const totalCredits = prevCredits + newCredits;

        return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
    };

    const getTotalCredits = () => {
        return courses.reduce((sum, c) => sum + c.credits, 0);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="group">
                            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                                <span className="text-white font-black text-xl">U</span>
                            </div>
                        </Link>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
                                CGPA Calculator &amp; AI Mentor
                            </h1>
                            <p className="text-sm text-purple-200">Calculate your semester GPA, project your cumulative CGPA, and chat with your AI Mentor</p>
                        </div>
                    </div>
                    <Link
                        to="/dashboard"
                        className="self-start sm:self-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all backdrop-blur-sm border border-white/20"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>

                {/* Top Results Summary Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-purple-600/80 to-indigo-700/80 rounded-2xl p-5 border border-purple-400/30 shadow-xl">
                        <p className="text-xs text-purple-200 font-semibold uppercase tracking-wider mb-1">Semester GPA</p>
                        <p className="text-3xl font-black text-white">{calculateSemesterGPA()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-600/80 to-purple-700/80 rounded-2xl p-5 border border-purple-400/30 shadow-xl">
                        <p className="text-xs text-purple-200 font-semibold uppercase tracking-wider mb-1">Semester Credits</p>
                        <p className="text-3xl font-black text-white">{getTotalCredits()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-pink-600/70 to-purple-700/80 rounded-2xl p-5 border border-pink-400/30 shadow-xl">
                        <p className="text-xs text-pink-100 font-semibold uppercase tracking-wider mb-1">Projected Cumulative CGPA</p>
                        <p className="text-3xl font-black text-white">{calculateCumulativeCGPA()}</p>
                    </div>
                </div>

                {/* Balanced 2-Column Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column (6 cols): Previous CGPA + Semester Courses */}
                    <div className="lg:col-span-6 space-y-6">
                        {/* Previous CGPA Input */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl"
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-purple-300" />
                                Current Academic Standing
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-purple-200 mb-1.5">Current CGPA</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="4"
                                        placeholder="3.50"
                                        value={currentCGPA}
                                        onChange={(e) => setCurrentCGPA(e.target.value)}
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3.5 py-2.5 text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-purple-200 mb-1.5">Completed Credits</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        placeholder="90"
                                        value={completedCredits}
                                        onChange={(e) => setCompletedCredits(e.target.value)}
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3.5 py-2.5 text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                        </motion.div>

                        {/* This Semester's Courses */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-bold text-white">This Semester&apos;s Courses</h2>
                                <button
                                    onClick={addCourse}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Course
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                                {courses.map((course, index) => (
                                    <motion.div
                                        key={course.id}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        className="bg-purple-950/35 rounded-2xl p-4 border border-purple-400/20 hover:border-purple-400/45 transition-all"
                                    >
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                placeholder="Course name (optional)"
                                                value={course.name}
                                                onChange={(e) => updateCourse(course.id, 'name', e.target.value)}
                                                className="w-full bg-purple-950/50 border border-purple-400/25 rounded-xl px-3 py-2 text-sm text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                            <div className="grid grid-cols-12 gap-3 items-center">
                                                <div className="col-span-5">
                                                    <select
                                                        value={course.credits}
                                                        onChange={(e) => updateCourse(course.id, 'credits', parseFloat(e.target.value))}
                                                        className="w-full bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        style={{ colorScheme: 'dark' }}
                                                    >
                                                        <option value={0.75} className="bg-purple-900 text-white">0.75 Credits</option>
                                                        <option value={1} className="bg-purple-900 text-white">1 Credit</option>
                                                        <option value={1.5} className="bg-purple-900 text-white">1.5 Credits</option>
                                                        <option value={2} className="bg-purple-900 text-white">2 Credits</option>
                                                        <option value={3} className="bg-purple-900 text-white">3 Credits</option>
                                                        <option value={4} className="bg-purple-900 text-white">4 Credits</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-5">
                                                    <select
                                                        value={course.grade}
                                                        onChange={(e) => updateCourse(course.id, 'grade', e.target.value)}
                                                        className="w-full bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-400/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        style={{ colorScheme: 'dark' }}
                                                    >
                                                        {grades.map(grade => (
                                                            <option key={grade} value={grade} className="bg-purple-900 text-white">{grade}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-2 flex justify-center">
                                                    <button
                                                        onClick={() => removeCourse(course.id)}
                                                        disabled={courses.length === 1}
                                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column (6 cols): AI CGPA Mentor at the top + Grade Scale below */}
                    <div className="lg:col-span-6 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-purple-400/30 shadow-2xl"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-pink-400" />
                                        AI CGPA Mentor
                                        {advisorProvider && (
                                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-purple-200">
                                                {advisorProvider === 'gemini' ? 'Gemini AI' : advisorProvider === 'groq' ? 'Groq AI' : 'Smart Mode'}
                                            </span>
                                        )}
                                    </h2>
                                    <p className="text-xs text-purple-200">
                                        Check if your target CGPA is achievable and chat about your plan.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div>
                                    <label className="block text-[11px] text-purple-200 mb-1">Total Credits</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={totalDegreeCredits}
                                        onChange={(e) => setTotalDegreeCredits(e.target.value)}
                                        placeholder="136"
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                                        placeholder="3.50"
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-purple-200 mb-1">Credits / Sem</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        step="1"
                                        value={creditsPerSem}
                                        onChange={(e) => setCreditsPerSem(e.target.value)}
                                        placeholder="12"
                                        className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>

                            {goalAnalysis ? (
                                <div className={`p-4 rounded-2xl border mb-4 ${goalAnalysis.possible
                                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-100'
                                    : 'bg-rose-500/15 border-rose-400/35 text-rose-100'}`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                        <span className="text-sm font-extrabold">
                                            {goalAnalysis.possible ? 'Goal is Achievable' : 'Goal Exceeds 4.00 Cap'}
                                        </span>
                                        <span className="text-xs font-mono font-bold">
                                            Req. GPA: {Math.max(0, goalAnalysis.requiredGPA).toFixed(2)} • Max: {goalAnalysis.maxCGPA.toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-xs leading-relaxed">{goalAnalysis.summary}</p>
                                </div>
                            ) : (
                                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-400/20 text-xs text-purple-200 mb-4">
                                    Enter your <strong>Current CGPA</strong> and <strong>Completed Credits</strong> on the left to unlock your personalized roadmap.
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 mb-3">
                                {[
                                    'Is my target CGPA possible?',
                                    'What is my max possible CGPA?',
                                    'How much does retaking a course help?',
                                ].map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => void askAdvisor(q)}
                                        className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/30 text-xs text-purple-100 transition-colors"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>

                            {(advisorMessages.length > 0 || advisorLoading) && (
                                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar mb-3 p-3 rounded-xl bg-purple-950/40 border border-purple-400/20">
                                    {advisorMessages.map((m, idx) => (
                                        <div key={idx} className={`text-xs p-2.5 rounded-lg whitespace-pre-wrap ${m.role === 'user'
                                            ? 'bg-purple-600/30 text-white ml-8'
                                            : 'bg-indigo-950/60 text-purple-100 mr-8 border border-purple-400/20'}`}>
                                            <span className="font-bold mr-1.5">{m.role === 'user' ? 'You:' : 'Mentor:'}</span>
                                            {m.text}
                                        </div>
                                    ))}
                                    {advisorLoading && (
                                        <div className="text-xs p-2.5 rounded-lg bg-indigo-950/60 text-purple-200 mr-8 border border-purple-400/20 flex items-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Thinking...
                                        </div>
                                    )}
                                </div>
                            )}

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void askAdvisor();
                                }}
                                className="flex gap-2"
                            >
                                <input
                                    type="text"
                                    value={advisorQuestion}
                                    onChange={(e) => setAdvisorQuestion(e.target.value)}
                                    placeholder="Ask your AI CGPA Mentor anything..."
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
                        </motion.div>

                        {/* Compact Grade Scale */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-5 border border-white/20"
                        >
                            <h3 className="text-sm font-bold text-white mb-3">BRACU Grade Scale</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                                {Object.entries(gradePoints).map(([grade, points]) => (
                                    <div key={grade} className="flex justify-between px-3 py-1.5 bg-purple-950/40 border border-purple-400/15 rounded-lg">
                                        <span className="font-bold text-white">{grade}</span>
                                        <span className="text-purple-200">{points.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Custom Scrollbar Styles */}
                <style>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: rgba(255, 255, 255, 0.05);
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(168, 85, 247, 0.5);
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(168, 85, 247, 0.7);
                    }
                `}</style>
            </div>
        </div>
    );
}
