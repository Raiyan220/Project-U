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
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-6 md:p-12 font-sans">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-6">
                        <Link to="/dashboard" className="group">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                                <span className="text-white font-black text-lg">U</span>
                            </div>
                        </Link>
                        <div>
                            <h1 className="text-4xl font-extrabold text-white mb-2">
                                CGPA Calculator
                            </h1>
                            <p className="text-gray-300">Calculate your semester GPA and cumulative CGPA</p>
                        </div>
                    </div>
                    <Link
                        to="/dashboard"
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all backdrop-blur-sm border border-white/20"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Courses Input */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl h-fit"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">This Semester's Courses</h2>
                            <button
                                onClick={addCourse}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm rounded-lg transition-all shadow-lg"
                            >
                                <Plus className="w-4 h-4" />
                                Add Course
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {courses.map((course, index) => (
                                <motion.div
                                    key={course.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-purple-500/50 transition-all"
                                >
                                    <div className="space-y-3">
                                        {/* Course Name */}
                                        <input
                                            type="text"
                                            placeholder="Course name (optional)"
                                            value={course.name}
                                            onChange={(e) => updateCourse(course.id, 'name', e.target.value)}
                                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        {/* Credits and Grade Row */}
                                        <div className="grid grid-cols-12 gap-3 items-center">
                                            <div className="col-span-5">
                                                <select
                                                    value={course.credits}
                                                    onChange={(e) => updateCourse(course.id, 'credits', parseFloat(e.target.value))}
                                                    className="w-full bg-gradient-to-br from-purple-900 to-indigo-900 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                                                    className="w-full bg-gradient-to-br from-purple-900 to-indigo-900 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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

                    {/* Right Column: Previous CGPA + Results + Grade Scale */}
                    <div className="space-y-6">
                        {/* Previous CGPA Input */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl"
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Calculator className="w-5 h-5" />
                                Previous CGPA (Optional)
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-300 mb-2">Current CGPA</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="4"
                                        placeholder="3.50"
                                        value={currentCGPA}
                                        onChange={(e) => setCurrentCGPA(e.target.value)}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-300 mb-2">Completed Credits</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        placeholder="45"
                                        value={completedCredits}
                                        onChange={(e) => setCompletedCredits(e.target.value)}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                        </motion.div>

                        {/* Results */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 text-white shadow-2xl"
                        >
                            <h3 className="text-lg font-bold mb-4">Results</h3>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                    <p className="text-xs text-purple-100 mb-1">Semester GPA</p>
                                    <p className="text-3xl font-black">{calculateSemesterGPA()}</p>
                                </div>

                                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                    <p className="text-xs text-purple-100 mb-1">Credits</p>
                                    <p className="text-3xl font-black">{getTotalCredits()}</p>
                                </div>
                            </div>

                            {currentCGPA && completedCredits && (
                                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                    <p className="text-sm text-purple-100 mb-1">New Cumulative CGPA</p>
                                    <p className="text-4xl font-black">{calculateCumulativeCGPA()}</p>
                                </div>
                            )}
                        </motion.div>

                        {/* Grade Scale */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20"
                        >
                            <h3 className="text-base font-bold text-white mb-4">Grade Scale</h3>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                {Object.entries(gradePoints).map(([grade, points]) => (
                                    <div key={grade} className="flex justify-between px-3 py-2 bg-white/5 rounded-lg">
                                        <span className="font-bold text-white">{grade}</span>
                                        <span className="text-gray-300">{points.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Interactive CGPA Goal Advisor */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mt-8 bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-purple-400/30 shadow-2xl"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-5">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-pink-400" />
                                CGPA Goal Advisor
                                {advisorProvider && (
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-purple-200">
                                        {advisorProvider === 'gemini' ? 'Gemini AI' : advisorProvider === 'groq' ? 'Groq AI' : 'Smart Mode'}
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-purple-200">
                                Check if your target CGPA is achievable before graduation and explore scenarios.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                        <div>
                            <label className="block text-xs text-purple-200 mb-1.5">Total Degree Credits</label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={totalDegreeCredits}
                                onChange={(e) => setTotalDegreeCredits(e.target.value)}
                                placeholder="136"
                                className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-purple-200 mb-1.5">Target CGPA</label>
                            <input
                                type="number"
                                min="0"
                                max="4"
                                step="0.01"
                                value={targetCGPA}
                                onChange={(e) => setTargetCGPA(e.target.value)}
                                placeholder="3.50"
                                className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-purple-200 mb-1.5">Avg. Credits / Semester</label>
                            <input
                                type="number"
                                min="1"
                                max="24"
                                step="1"
                                value={creditsPerSem}
                                onChange={(e) => setCreditsPerSem(e.target.value)}
                                placeholder="12"
                                className="w-full bg-purple-950/50 border border-purple-400/30 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>

                    {goalAnalysis ? (
                        <div className={`p-4 rounded-2xl border mb-5 ${goalAnalysis.possible
                            ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-100'
                            : 'bg-rose-500/15 border-rose-400/35 text-rose-100'}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <span className="text-sm font-extrabold">
                                    {goalAnalysis.possible ? 'Goal is Achievable' : 'Goal Exceeds 4.00 Cap'}
                                </span>
                                <span className="text-xs font-mono font-bold">
                                    Required Avg GPA: {Math.max(0, goalAnalysis.requiredGPA).toFixed(2)} • Max Possible: {goalAnalysis.maxCGPA.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-xs leading-relaxed">{goalAnalysis.summary}</p>
                        </div>
                    ) : (
                        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-400/20 text-xs text-purple-200 mb-5">
                            Fill in your <strong>Current CGPA</strong> and <strong>Completed Credits</strong> above to see your required GPA and feasibility.
                        </div>
                    )}

                    {/* Quick Questions & Interactive Advisor Chat */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {[
                            'Is my target CGPA possible?',
                            'What is the maximum CGPA I can reach?',
                            'How much does retaking a low-grade course help?',
                        ].map((q) => (
                            <button
                                key={q}
                                onClick={() => askAdvisor(q)}
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
                                    <span className="font-bold mr-1.5">{m.role === 'user' ? 'You:' : 'Advisor:'}</span>
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
                            placeholder="Ask anything about your CGPA, retakes, or semester plan..."
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
