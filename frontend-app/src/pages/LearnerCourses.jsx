import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2, Search, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { learnerApi } from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';

const CourseCard = ({ course, enrolled, onEnroll, busy }) => (
    <article className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
            <div>
                <h2 className="text-lg font-bold text-slate-800">{course.title || 'Cours sans titre'}</h2>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <User size={16} />
                    <span>{course.teacherEmail || 'Enseignant non renseigné'}</span>
                </div>
            </div>
            {enrolled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={14} />
                    Inscrit
                </span>
            )}
        </div>

        <p className="text-sm text-slate-600 leading-6 flex-1">
            {course.description || 'Aucune description disponible pour ce cours.'}
        </p>

        <button
            onClick={() => onEnroll(course.id)}
            disabled={enrolled || busy}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                enrolled || busy
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
        >
            {busy ? <Loader2 size={16} className="animate-spin" /> : enrolled ? <CheckCircle2 size={16} /> : <BookOpen size={16} />}
            {enrolled ? 'Déjà inscrit' : "S'inscrire"}
        </button>
    </article>
);

export default function LearnerCourses() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [myCourses, setMyCourses] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [busyCourseId, setBusyCourseId] = useState(null);

    const enrolledIds = useMemo(() => new Set(myCourses.map(course => course.id)), [myCourses]);

    const loadCourses = async (searchQuery = '') => {
        setLoading(true);
        try {
            const [coursesRes, myCoursesRes] = await Promise.all([
                searchQuery.trim() ? learnerApi.searchCourses(searchQuery.trim()) : learnerApi.getAvailableCourses(),
                learnerApi.getMyCourses(user.email),
            ]);
            setCourses(coursesRes.data || []);
            setMyCourses(myCoursesRes.data || []);
        } catch (error) {
            toast.error("Impossible de charger les cours disponibles.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.email) loadCourses();
    }, [user?.email]);

    const handleSearch = (event) => {
        event.preventDefault();
        loadCourses(query);
    };

    const handleEnroll = async (courseId) => {
        if (!user?.email) return;
        setBusyCourseId(courseId);
        try {
            await learnerApi.enrollInCourse(courseId, user.email);
            toast.success('Inscription enregistrée.');
            await loadCourses(query);
        } catch (error) {
            toast.error("L'inscription n'a pas pu être enregistrée.");
        } finally {
            setBusyCourseId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Cours disponibles</h1>
                <p className="text-slate-500 mt-2">Recherchez un cours et inscrivez-vous pour commencer votre parcours.</p>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        placeholder="Titre, description ou enseignant"
                    />
                </div>
                <button className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                    Rechercher
                </button>
            </form>

            {loading ? (
                <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 size={18} className="animate-spin" />
                    Chargement des cours...
                </div>
            ) : courses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                    Aucun cours ne correspond à votre recherche.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {courses.map(course => (
                        <CourseCard
                            key={course.id}
                            course={course}
                            enrolled={enrolledIds.has(course.id)}
                            busy={busyCourseId === course.id}
                            onEnroll={handleEnroll}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
