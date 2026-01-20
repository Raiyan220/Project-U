import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Trash2, Calculator } from 'lucide-react';

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
