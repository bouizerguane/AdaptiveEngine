import { useEffect, useState } from 'react';
import { BookOpen, Compass, Loader2, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { learnerApi } from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';

export default function LearnerDashboard() {
    const { user } = useAuth();
    const [myCourses, setMyCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSummary = async () => {
            if (!user?.email) return;
            setLoading(true);
            try {
                const res = await learnerApi.getMyCourses(user.email);
                setMyCourses(res.data || []);
            } catch (error) {
                toast.error("Impossible de charger votre tableau de bord.");
            } finally {
                setLoading(false);
            }
        };

        loadSummary();
    }, [user?.email]);

    const firstCourse = myCourses[0];

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Espace Apprenant</h1>
                <p className="text-slate-500 mt-2 text-lg">
                    Bienvenue dans votre parcours. Choisissez un cours, inscrivez-vous, puis reprenez vos apprentissages depuis vos cours.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <section className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                            {loading ? <Loader2 size={22} className="animate-spin" /> : <BookOpen size={22} />}
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Cours inscrits</p>
                            <p className="text-2xl font-bold text-slate-800">{loading ? '-' : myCourses.length}</p>
                        </div>
                    </div>
                </section>

                <Link to="/learner/courses" className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
                            <Compass size={22} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Explorer</p>
                            <p className="text-lg font-bold text-slate-800">Cours disponibles</p>
                        </div>
                    </div>
                </Link>

                <Link to="/learner/my-courses" className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                            <PlayCircle size={22} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Reprendre</p>
                            <p className="text-lg font-bold text-slate-800">Mes cours</p>
                        </div>
                    </div>
                </Link>
            </div>

            <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-800 mb-3">Prochain cours</h2>
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 size={18} className="animate-spin" />
                        Chargement...
                    </div>
                ) : firstCourse ? (
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">{firstCourse.title}</h3>
                            <p className="text-sm text-slate-500 mt-1">{firstCourse.description || 'Aucune description disponible.'}</p>
                        </div>
                        <Link to="/learner/my-courses" className="inline-flex justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                            Continuer
                        </Link>
                    </div>
                ) : (
                    <div className="text-slate-500">
                        Aucun cours inscrit pour le moment.
                        <Link to="/learner/courses" className="ml-2 font-semibold text-indigo-600 hover:text-indigo-700">
                            Explorer les cours
                        </Link>
                    </div>
                )}
            </section>
        </div>
    );
}
