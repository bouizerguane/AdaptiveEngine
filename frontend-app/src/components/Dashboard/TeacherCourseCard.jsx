import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { courseApi } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';

export default function TeacherCourseCard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [myCourses, setMyCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [treesMap, setTreesMap] = useState({});

    useEffect(() => {
        const fetchCourses = async () => {
            if (!user?.email) return;
            try {
                setLoading(true);
                // GET /courses already filters by authenticated teacher via @AuthenticationPrincipal
                const res = await courseApi.getCourses();
                const courses = res.data || [];
                setMyCourses(courses);

                // Fetch trees to calculate modules count
                const tMap = {};
                for (const course of courses) {
                    try {
                        const treeRes = await courseApi.getCourseTree(course.id);
                        if (treeRes.data) {
                            tMap[course.id] = treeRes.data.modules?.length || 0;
                        }
                    } catch (e) {
                        tMap[course.id] = 0;
                    }
                }
                setTreesMap(tMap);
            } catch (error) {
                console.error("Error fetching teacher courses", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCourses();
    }, [user]);

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <BookOpen className="text-indigo-600" size={20} />
                    <h2 className="text-lg font-bold text-slate-800">Mes Cours</h2>
                </div>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    {myCourses.length} Total
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[300px]">
                {myCourses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                        <p className="text-slate-500 text-sm mb-4">Vous n'avez pas encore de cours.</p>
                        <button 
                            onClick={() => navigate('/courses')}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg hover:bg-indigo-100 transition-colors text-sm"
                        >
                            Créer mon premier cours
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {myCourses.map((course) => (
                            <div 
                                key={course.id} 
                                onClick={() => navigate('/courses')}
                                className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center group"
                            >
                                <div>
                                    <h3 className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors line-clamp-1">{course.title}</h3>
                                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{course.description || "Aucune description"}</p>
                                </div>
                                <div className="text-right shrink-0 ml-4">
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                        {treesMap[course.id] || 0} Module{treesMap[course.id] > 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
