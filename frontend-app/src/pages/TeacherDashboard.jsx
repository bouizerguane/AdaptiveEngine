import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Github, Target, Clock, AlertTriangle, BookOpen, Terminal } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { trackingApi, labApi, courseApi, graphApi } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import TeacherCourseCard from '../components/Dashboard/TeacherCourseCard';

export default function TeacherDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [courseTree, setCourseTree] = useState([]);
    const [labsMap, setLabsMap] = useState({});

    const [hasCourses, setHasCourses] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user?.email) return;
            setLoading(true);

            // 1. Fetch courses first (source of truth for Empty State)
            // GET /courses uses @AuthenticationPrincipal to filter by the logged-in teacher
            try {
                const coursesRes = await courseApi.getCourses();
                const myCourses = coursesRes.data || [];
                setHasCourses(myCourses.length > 0);

                const trees = [];
                const tempLabsMap = {};
                for (const course of myCourses) {
                    try {
                        const treeRes = await courseApi.getCourseTree(course.id);
                        if (treeRes.data) trees.push(treeRes.data);
                    } catch (e) { /* ignore */ }
                    try {
                        const labsRes = await labApi.getLabsByCourse(course.id);
                        labsRes.data.forEach(lab => { tempLabsMap[lab.id] = lab; });
                    } catch (e) { /* ignore */ }
                }
                setCourseTree(trees);
                setLabsMap(tempLabsMap);
            } catch (error) {
                console.error("Error fetching teacher courses:", error);
                setHasCourses(false);
            }

            // 2. Fetch dashboard summary independently (won't block the UI)
            try {
                const summaryRes = await trackingApi.getDashboardSummary(user.email);
                setSummary(summaryRes.data);
            } catch (error) {
                console.warn("Dashboard summary unavailable (no student data yet):", error.message);
                setSummary(null); // Will show empty stats in the KPI cards
            }

            setLoading(false);
        };

        fetchDashboardData();
    }, [user]);

    // Utilitaire pour chercher un concept dans les arbres de cours
    const getConceptName = (conceptId) => {
        for (const tree of courseTree) {
            if (tree.modules) {
                for (const mod of tree.modules) {
                    if (mod.chapitres) {
                        for (const chap of mod.chapitres) {
                            if (chap.concepts) {
                                const found = chap.concepts.find(c => c.id === conceptId);
                                if (found) return found.title;
                            }
                        }
                    }
                }
            }
        }
        return `Concept ${conceptId.substring(0, 8)}...`;
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center text-slate-500">Chargement de vos statistiques...</div>;
    }

    if (!hasCourses) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-48 h-48 mb-6 text-indigo-200">
                    <BookOpen className="w-full h-full" strokeWidth={1} />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 mb-4">Bienvenue sur votre Dashboard !</h2>
                <p className="text-slate-500 text-lg mb-8 max-w-lg">
                    Vous n'avez pas encore de statistiques. Créez votre premier cours pour commencer à suivre la progression de vos étudiants.
                </p>
                <button 
                    onClick={() => navigate('/courses')}
                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
                >
                    Créer mon premier cours
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Tableau de bord Enseignant</h1>
                <p className="text-slate-500 mt-2 text-lg">Vue d'ensemble de l'engagement et de la performance sur vos cours.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-medium">Étudiants Actifs</p>
                        <h3 className="text-2xl font-bold text-slate-800">{summary?.activeStudents || 0}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-medium">Succès Moyen</p>
                        <h3 className="text-2xl font-bold text-slate-800">{summary?.avgSuccessRate ? summary.avgSuccessRate.toFixed(1) : '0.0'}%</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                        <Github size={24} />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-medium">TP Validés (Soumis)</p>
                        <h3 className="text-2xl font-bold text-slate-800">{summary?.completedLabs || 0}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Carte des Cours de l'Enseignant */}
                <TeacherCourseCard />

                {/* Point Chaud (Top 5 Concepts) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="text-orange-500" size={20} />
                        <h2 className="text-xl font-bold text-slate-800">Point Chaud : Concepts Difficiles</h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">Concepts avec le taux d'échec le plus élevé, nécessitant potentiellement une révision.</p>
                    
                    <div className="space-y-3">
                        {summary?.topDifficultConcepts && summary.topDifficultConcepts.length > 0 ? (
                            summary.topDifficultConcepts.map((concept, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-700">{getConceptName(concept.conceptId)}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <Clock size={12} /> {(concept.avgTimeSpent / 60).toFixed(1)} min en moyenne
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`font-bold ${concept.avgScore < 50 ? 'text-red-600' : 'text-orange-500'}`}>
                                            {concept.avgScore.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-400 text-center py-4">Pas assez de données pour identifier des points chauds.</p>
                        )}
                    </div>
                </div>

                {/* Graphique de Maîtrise */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="text-indigo-600" size={20} />
                        <h2 className="text-xl font-bold text-slate-800">Maîtrise par Module</h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">Nombre de concepts validés (ACQUIS) par les étudiants pour chaque module.</p>
                    
                    <div className="flex-1 min-h-[250px]">
                        {summary?.masteryByModule && summary.masteryByModule.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={summary.masteryByModule} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorMastery" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#64748b" stopOpacity={0.8}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="moduleName" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                    <Tooltip 
                                        cursor={{fill: '#f8fafc'}}
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    />
                                    <Bar dataKey="validatedConcepts" fill="url(#colorMastery)" radius={[4, 4, 0, 0]} name="Concepts Validés" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-slate-400 text-center py-10">Aucune donnée de maîtrise disponible.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Tableau des soumissions TP */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Terminal size={20} className="text-slate-600" />
                        Dernières Soumissions de TP
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-medium">Apprenant</th>
                                <th className="px-6 py-4 font-medium">Travail Pratique</th>
                                <th className="px-6 py-4 font-medium">Lien GitHub</th>
                                <th className="px-6 py-4 font-medium">Temps Passé</th>
                                <th className="px-6 py-4 font-medium text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {summary?.recentLabSubmissions && summary.recentLabSubmissions.length > 0 ? (
                                summary.recentLabSubmissions.map((sub, idx) => {
                                    const lab = labsMap[sub.labId];
                                    const labTitle = lab?.title || `TP ${sub.labId.substring(0, 8)}...`;
                                    const diffColor = lab?.difficulty === 'EASY' ? 'bg-emerald-100 text-emerald-700' :
                                                      lab?.difficulty === 'HARD' ? 'bg-red-100 text-red-700' :
                                                      'bg-orange-100 text-orange-700';
                                    
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-800">{sub.userId}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-700">{labTitle}</span>
                                                    {lab?.difficulty && (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${diffColor}`}>
                                                            {lab.difficulty}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <a href={sub.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                                    <Github size={14} /> Voir le dépôt
                                                </a>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {(sub.totalTimeSpent / 60).toFixed(0)} min
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500">
                                                {new Date(sub.completedAt).toLocaleDateString()} à {new Date(sub.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">Aucune soumission récente.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
