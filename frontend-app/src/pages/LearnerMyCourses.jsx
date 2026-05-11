import { useEffect, useState } from 'react';
import { BookOpen, Loader2, PlayCircle, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { learnerApi } from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';

const teacherLabel = (course) => course.teacherName || course.teacherFullName || course.authorName || course.teacherEmail || course.authorEmail || '';

export default function LearnerMyCourses() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadMyCourses = async () => {
            if (!user?.email) return;
            setLoading(true);
            try {
                const res = await learnerApi.getMyCourses(user.email);
                setCourses(res.data || []);
            } catch (error) {
                toast.error("Impossible de charger vos cours.");
            } finally {
                setLoading(false);
            }
        };

        loadMyCourses();
    }, [user?.email]);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Mes cours</h1>
                <p className="text-slate-500 mt-2">Retrouvez les cours auxquels vous êtes inscrit.</p>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 size={18} className="animate-spin" />
                    Chargement de vos cours...
                </div>
            ) : courses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                    <BookOpen className="mx-auto text-slate-400 mb-3" size={36} />
                    <p className="text-slate-600 font-medium">Vous n'êtes inscrit à aucun cours.</p>
                    <Link to="/learner/courses" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                        Explorer les cours
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {courses.map(course => (
                        <article key={course.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{course.title || 'Cours sans titre'}</h2>
                                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                    <User size={16} />
                                    <span>{teacherLabel(course) ? `Enseignant : ${teacherLabel(course)}` : 'Enseignant non renseigne'}</span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 leading-6 flex-1">
                                {course.description || 'Aucune description disponible pour ce cours.'}
                            </p>
                            <Link to={`/learner/courses/${course.id}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                <PlayCircle size={16} />
                                Voir le cours
                            </Link>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
