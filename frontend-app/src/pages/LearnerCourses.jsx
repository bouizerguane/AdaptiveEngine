import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Info, Loader2, Search, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { learnerApi } from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';

const teacherLabel = (course) => course.teacherName || course.teacherFullName || course.authorName || course.teacherEmail || course.authorEmail || '';

const CourseCard = ({ course, enrolled, onEnroll, onDetails, busy }) => (
    <article className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col gap-4 dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-start justify-between gap-4">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{course.title || 'Cours sans titre'}</h2>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <User size={16} />
                    <span>{teacherLabel(course) ? `Enseignant : ${teacherLabel(course)}` : 'Enseignant non renseigne'}</span>
                </div>
            </div>
            {enrolled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={14} />
                    Inscrit
                </span>
            )}
        </div>

        <p className="text-sm text-slate-600 leading-6 flex-1 line-clamp-3 dark:text-slate-300">
            {course.description || 'Aucune description disponible pour ce cours.'}
        </p>

        <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onDetails(course)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Info size={16} />
                Details
            </button>
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
                {enrolled ? 'Deja inscrit' : "S'inscrire"}
            </button>
        </div>
    </article>
);

export default function LearnerCourses() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [myCourses, setMyCourses] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyCourseId, setBusyCourseId] = useState(null);
    const [detailsCourse, setDetailsCourse] = useState(null);

    const enrolledIds = useMemo(() => new Set(myCourses.map(course => course.id)), [myCourses]);

    const loadCourses = async (searchQuery = '') => {
        setLoading(true);
        setError('');
        try {
            const [coursesRes, myCoursesRes] = await Promise.all([
                searchQuery.trim() ? learnerApi.searchCourses(searchQuery.trim()) : learnerApi.getAvailableCourses(),
                learnerApi.getMyCourses(user.email),
            ]);
            setCourses(coursesRes.data || []);
            setMyCourses(myCoursesRes.data || []);
        } catch {
            setError("Impossible de charger les cours disponibles.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.email) return;
        const timer = setTimeout(() => loadCourses(query), 300);
        return () => clearTimeout(timer);
    }, [user?.email, query]);

    const handleEnroll = async (courseId) => {
        if (!user?.email) return;
        setBusyCourseId(courseId);
        try {
            await learnerApi.enrollInCourse(courseId, user);
            toast.success('Inscription enregistree.');
            await loadCourses(query);
            setDetailsCourse(null);
        } catch (err) {
            const backendMessage = err?.response?.data?.message
                || err?.response?.data?.error
                || err?.message
                || "L'inscription n'a pas pu etre enregistree.";
            setError(backendMessage);
            toast.error(backendMessage);
        } finally {
            setBusyCourseId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Cours disponibles</h1>
                <p className="text-slate-500 mt-2 dark:text-slate-400">Recherchez un cours et inscrivez-vous pour commencer votre parcours.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                        placeholder="Titre, description ou enseignant"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 size={18} className="animate-spin" />
                    Chargement des cours...
                </div>
            ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                    {error}
                </div>
            ) : courses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:bg-slate-900 dark:border-slate-700">
                    Aucun cours ne correspond a votre recherche.
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
                            onDetails={setDetailsCourse}
                        />
                    ))}
                </div>
            )}

            {detailsCourse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setDetailsCourse(null)}>
                    <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900" onClick={event => event.stopPropagation()}>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{detailsCourse.title || 'Cours sans titre'}</h2>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Enseignant : {teacherLabel(detailsCourse) || 'Non renseigne'}</p>
                        <div className="mt-5 space-y-4 text-sm text-slate-700 dark:text-slate-300">
                            <section>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100">Description</h3>
                                <p className="mt-1 whitespace-pre-line">{detailsCourse.description || 'Aucune description disponible.'}</p>
                            </section>
                            <section>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100">Objectifs pedagogiques</h3>
                                <p className="mt-1 whitespace-pre-line">{detailsCourse.objectifs || 'Objectifs non renseignes.'}</p>
                            </section>
                            <section>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100">Prerequis textuels</h3>
                                <p className="mt-1 whitespace-pre-line">{detailsCourse.prerequisTextuels || 'Prerequis non renseignes.'}</p>
                            </section>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setDetailsCourse(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200">Fermer</button>
                            {!enrolledIds.has(detailsCourse.id) && (
                                <button onClick={() => handleEnroll(detailsCourse.id)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">S'inscrire</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
