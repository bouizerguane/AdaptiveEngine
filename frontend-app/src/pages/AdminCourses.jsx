import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Filter, Loader2, RefreshCw, Search, Trash2, User } from 'lucide-react';
import { adminApi, graphApi } from '../api/apiClient';
import CustomDialog from '../components/CustomDialog';

const normalizeRole = (role) => (role || '').replace('ROLE_', '');

const teacherLabel = (course) => {
    const rawTeacher = course.teacherName || course.teacherFullName || course.authorName || course.teacherEmail || course.authorEmail || course.author || '';
    if (!rawTeacher) return 'Inconnu';
    if (rawTeacher === 'anonymousUser') return 'Invalide';
    return rawTeacher;
};

const teacherIdentity = (course) => course.teacherEmail || course.authorEmail || teacherLabel(course);

export default function AdminCourses() {
    const [courses, setCourses] = useState([]);
    const [users, setUsers] = useState([]);
    const [teacherFilter, setTeacherFilter] = useState('');
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [dialog, setDialog] = useState({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onConfirm: null,
        confirmText: 'Confirmer',
        confirmVariant: 'primary',
    });

    const teachers = useMemo(
        () => users.filter(user => normalizeRole(user.role) === 'TEACHER'),
        [users]
    );

    const filteredCourses = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return courses.filter(course => {
            const teacher = teacherIdentity(course);
            const matchesTeacher = !teacherFilter || teacher === teacherFilter;
            const matchesQuery = !normalizedQuery
                || (course.title || '').toLowerCase().includes(normalizedQuery)
                || (course.description || '').toLowerCase().includes(normalizedQuery);
            return matchesTeacher && matchesQuery;
        });
    }, [courses, teacherFilter, query]);

    const selectedVisibleCount = filteredCourses.filter(course => selectedIds.has(course.id)).length;
    const allVisibleSelected = filteredCourses.length > 0 && selectedVisibleCount === filteredCourses.length;

    const loadData = async () => {
        setLoading(true);
        try {
            const [coursesRes, usersRes] = await Promise.all([
                graphApi.getAdminCourses(),
                adminApi.getAllUsers(),
            ]);
            setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
            setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
            setSelectedIds(new Set());
        } catch (error) {
            setDialog({
                isOpen: true,
                type: 'error',
                title: 'Erreur de chargement',
                message: "Impossible de charger les cours.",
                onConfirm: null,
                confirmText: 'Compris',
                confirmVariant: 'primary',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const toggleCourse = (courseId) => {
        setSelectedIds(previous => {
            const next = new Set(previous);
            if (next.has(courseId)) next.delete(courseId);
            else next.add(courseId);
            return next;
        });
    };

    const toggleVisible = () => {
        setSelectedIds(previous => {
            const next = new Set(previous);
            if (allVisibleSelected) {
                filteredCourses.forEach(course => next.delete(course.id));
            } else {
                filteredCourses.forEach(course => next.add(course.id));
            }
            return next;
        });
    };

    const performBulkDelete = async (courseIds) => {
        setDialog(previous => ({ ...previous, isOpen: false }));
        setDeleting(true);
        try {
            const res = await graphApi.deleteCoursesBulk(courseIds);
            const summary = res.data || {};
            await loadData();
            setDialog({
                isOpen: true,
                type: 'success',
                title: 'Suppression terminée',
                message: `${summary.deletedCourses ?? 0} cours supprimé(s), ${summary.deletedContents ?? 0} contenu(s) supprimé(s), ${summary.deletedEvaluations ?? 0} quiz supprimé(s), ${summary.deletedLabs ?? 0} TP supprimé(s).`,
                onConfirm: null,
                confirmText: 'Continuer',
                confirmVariant: 'primary',
            });
        } catch (error) {
            setDialog({
                isOpen: true,
                type: 'error',
                title: 'Erreur de suppression',
                message: error.response?.data?.error || error.response?.data?.message || "Impossible de supprimer les cours sélectionnés.",
                onConfirm: null,
                confirmText: 'Compris',
                confirmVariant: 'primary',
            });
        } finally {
            setDeleting(false);
        }
    };

    const deleteSelectedCourses = () => {
        const courseIds = Array.from(selectedIds);
        if (courseIds.length === 0) return;

        setDialog({
            isOpen: true,
            type: 'confirm',
            title: 'Confirmer la suppression',
            message: 'Voulez-vous vraiment supprimer les cours sélectionnés ? Cette action supprimera aussi les ressources, quiz et TP associés.',
            onConfirm: () => performBulkDelete(courseIds),
            confirmText: 'Supprimer',
            confirmVariant: 'danger',
        });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <BookOpen className="text-indigo-600" size={30} />
                        Gestion des cours
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Administrez les cours publiés et supprimez uniquement les cours explicitement sélectionnés.
                    </p>
                </div>
                <button
                    onClick={loadData}
                    disabled={loading || deleting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Actualiser
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Filtrer par nom ou description du cours"
                            className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div className="relative">
                        <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={teacherFilter}
                            onChange={(event) => setTeacherFilter(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="">Tous les enseignants</option>
                            {teachers.map(teacher => (
                                <option key={teacher.id || teacher.email} value={teacher.email}>
                                    {[teacher.prenom, teacher.nom].filter(Boolean).join(' ') || teacher.email}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
                    <div className="text-sm text-slate-600">
                        <span className="font-bold text-slate-800">{filteredCourses.length}</span> cours affiche(s)
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="font-bold text-indigo-700">{selectedIds.size}</span> selectionne(s)
                    </div>
                    <button
                        onClick={toggleVisible}
                        disabled={filteredCourses.length === 0}
                        className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 disabled:text-slate-400"
                    >
                        {allVisibleSelected ? 'Désélectionner les résultats' : 'Sélectionner les résultats'}
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
                        <Loader2 size={18} className="animate-spin" />
                        Chargement des cours...
                    </div>
                ) : filteredCourses.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        Aucun cours ne correspond aux filtres.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="w-12 p-4">
                                        <input
                                            type="checkbox"
                                            checked={allVisibleSelected}
                                            onChange={toggleVisible}
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                                        />
                                    </th>
                                    <th className="p-4 font-semibold">Cours</th>
                                    <th className="p-4 font-semibold">Enseignant</th>
                                    <th className="p-4 font-semibold">Statut</th>
                                    <th className="p-4 font-semibold">Creation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCourses.map(course => (
                                    <tr key={course.id} className="hover:bg-slate-50">
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(course.id)}
                                                onChange={() => toggleCourse(course.id)}
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-800">{course.title || 'Cours sans titre'}</p>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.description || 'Aucune description'}</p>
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            <span className="inline-flex items-center gap-2">
                                                <User size={15} />
                                                {teacherLabel(course)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                                {course.status || 'PUBLISHED'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {course.createdAt ? new Date(course.createdAt).toLocaleDateString('fr-FR') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">
                    {selectedIds.size} cours selectionne(s). Les contenus, quiz et TP associes seront nettoyes avant suppression Neo4j.
                </p>
                <button
                    onClick={deleteSelectedCourses}
                    disabled={selectedIds.size === 0 || deleting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    Supprimer les cours sélectionnés
                </button>
            </div>

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
