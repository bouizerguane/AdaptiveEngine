import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Search, UserMinus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { graphApi } from '../api/apiClient';
import CustomDialog from '../components/CustomDialog';
import { useAuth } from '../context/AuthContext';

const displayLearnerName = (learner) => {
    const fullName = [learner?.prenom, learner?.nom].filter(Boolean).join(' ').trim();
    return fullName || 'Nom non renseigné';
};

export default function TeacherEnrollments() {
    const { user } = useAuth();
    const teacherEmail = user?.email || '';
    const [courses, setCourses] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [enrollments, setEnrollments] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [loadingEnrollments, setLoadingEnrollments] = useState(false);
    const [query, setQuery] = useState('');
    const [dialog, setDialog] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

    const selectedCourse = courses.find(course => course.id === selectedCourseId);

    const filteredEnrollments = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return enrollments;
        return enrollments.filter(item =>
            (item.email || '').toLowerCase().includes(normalized)
            || (item.nom || '').toLowerCase().includes(normalized)
            || (item.prenom || '').toLowerCase().includes(normalized)
        );
    }, [enrollments, query]);

    useEffect(() => {
        if (!teacherEmail) return;

        setLoadingCourses(true);
        graphApi.getTeacherCourses(teacherEmail)
            .then(response => {
                const data = response.data || [];
                setCourses(data);
                setSelectedCourseId(current => current || data[0]?.id || '');
            })
            .catch(() => toast.error('Impossible de charger vos cours.'))
            .finally(() => setLoadingCourses(false));
    }, [teacherEmail]);

    useEffect(() => {
        if (!selectedCourseId || !teacherEmail) {
            setEnrollments([]);
            return;
        }

        setLoadingEnrollments(true);
        graphApi.getCourseEnrollments(selectedCourseId)
            .then(response => setEnrollments(response.data || []))
            .catch(error => {
                const message = error.response?.data?.message || 'Impossible de charger les inscriptions.';
                setEnrollments([]);
                toast.error(message);
            })
            .finally(() => setLoadingEnrollments(false));
    }, [selectedCourseId, teacherEmail]);

    const askUnenroll = (learner) => {
        setDialog({
            isOpen: true,
            type: 'confirm',
            title: 'Confirmer la desinscription',
            message: `Voulez-vous vraiment desinscrire ${displayLearnerName(learner)} de ce cours ? Les traces et acquis existants seront conserves.`,
            confirmText: 'Desinscrire',
            confirmVariant: 'danger',
            onConfirm: () => handleUnenroll(learner),
        });
    };

    const handleUnenroll = async (learner) => {
        try {
            await graphApi.unenrollLearner(selectedCourseId, learner.email);
            setEnrollments(current => current.filter(item => item.email !== learner.email));
            setDialog({
                isOpen: true,
                type: 'success',
                title: 'Apprenant desinscrit',
                message: `${displayLearnerName(learner)} ne fait plus partie de ce cours.`,
            });
        } catch (error) {
            setDialog({
                isOpen: true,
                type: 'error',
                title: 'Erreur',
                message: error.response?.data?.message || 'La desinscription a echoue.',
            });
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                        <Users size={18} />
                        Enseignant
                    </div>
                    <h1 className="mt-2 text-3xl font-bold text-slate-800">Gestion des inscriptions</h1>
                    <p className="mt-1 text-slate-500">Consultez et gerez les apprenants inscrits a vos cours.</p>
                </div>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                {loadingCourses ? (
                    <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 size={18} className="animate-spin" />
                        Chargement des cours...
                    </div>
                ) : courses.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                        Aucun cours trouve pour cet enseignant.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-slate-600">Cours</span>
                            <select
                                value={selectedCourseId}
                                onChange={event => setSelectedCourseId(event.target.value)}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                                {courses.map(course => (
                                    <option key={course.id} value={course.id}>{course.title || 'Cours sans titre'}</option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-slate-600">Recherche apprenant</span>
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-200">
                                <Search size={16} className="text-slate-400" />
                                <input
                                    value={query}
                                    onChange={event => setQuery(event.target.value)}
                                    placeholder="Nom ou email"
                                    className="w-full bg-transparent text-sm outline-none"
                                />
                            </div>
                        </label>
                    </div>
                )}
            </section>

            {selectedCourse && (
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-2 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="flex items-center gap-2 font-bold text-slate-800">
                                <BookOpen size={18} />
                                {selectedCourse.title || 'Cours sans titre'}
                            </h2>
                            <p className="text-sm text-slate-500">{filteredEnrollments.length} apprenant(s) affiche(s)</p>
                        </div>
                    </div>

                    {loadingEnrollments ? (
                        <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
                            <Loader2 size={18} className="animate-spin" />
                            Chargement des inscriptions...
                        </div>
                    ) : filteredEnrollments.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">
                            Aucun apprenant inscrit pour ce cours.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3">Apprenant</th>
                                        <th className="px-5 py-3">Email</th>
                                        <th className="px-5 py-3">Inscrit le</th>
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredEnrollments.map(learner => (
                                        <tr key={learner.email} className="hover:bg-slate-50">
                                            <td className="px-5 py-3 font-semibold text-slate-800">{displayLearnerName(learner)}</td>
                                            <td className="px-5 py-3 text-slate-500">{learner.email}</td>
                                            <td className="px-5 py-3 text-slate-500">
                                                {learner.enrolledAt ? new Date(learner.enrolledAt).toLocaleString() : 'Non renseigné'}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => askUnenroll(learner)}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                                                >
                                                    <UserMinus size={14} />
                                                    Desinscrire
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            <CustomDialog
                isOpen={dialog.isOpen}
                type={dialog.type}
                title={dialog.title}
                message={dialog.message}
                confirmText={dialog.confirmText}
                confirmVariant={dialog.confirmVariant}
                onConfirm={dialog.onConfirm}
                onClose={() => setDialog(previous => ({ ...previous, isOpen: false }))}
            />
        </div>
    );
}
