import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Course } from '../types/course';

interface CourseCardProps {
    course: Course;
}

export const CourseCard = ({ course }: CourseCardProps) => {
    const navigate = useNavigate();

    return (
        <motion.div
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/courses/${course.id}`)}
            className="glass p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 cursor-pointer hover:bg-white/20 transition-all h-full flex flex-col justify-between"
        >
            <div>
                <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-200 border border-purple-500/30 rounded-lg text-sm font-semibold">
                        {course.code}
                    </span>
                    <span className="text-xs text-gray-400">
                        {course.department}
                    </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                    {course.title}
                </h3>
            </div>

            <div className="mt-4 flex items-center text-sm text-gray-400">
                <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2-2 0 00-2-2M5 11V9a2-2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                </svg>
                <span>{course._count?.sections || 0} Sections Available</span>
            </div>
        </motion.div>
    );
};
