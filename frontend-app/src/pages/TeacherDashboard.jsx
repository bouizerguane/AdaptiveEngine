import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BookOpen,
    CheckCircle2,
    Github,
    GraduationCap,
    Lightbulb,
    Loader2,
    Target,
    Terminal,
    TrendingUp,
    Users,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { courseApi, graphApi, labApi, trackingApi } from '../api/apiClient';
import learnerApi from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';
import TeacherCourseCard from '../components/Dashboard/TeacherCourseCard';
import { flattenConcepts, normalizeCourseTree } from '../utils/courseOrder';

const conceptTitle = (concept) =>
    concept?.labelPedagogique || concept?.title || concept?.name || concept?.libelle || 'Concept inconnu';

const courseTitle = (course) => course?.title || course?.titre || course?.name || 'Cours sans titre';

const learnerName = (learner) => {
    const fullName = [learner?.prenom, learner?.nom].filter(Boolean).join(' ').trim();
    return fullName || learner?.fullName || learner?.name || learner?.email || 'Apprenant';
};

const looksLikeUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

const learnerSecondaryLabel = (value) => {
    if (!value || looksLikeUuid(value)) return 'Identifiant non affiche';
    return value;
};

const percent = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const difficultBadge = (failureRate) => {
    if (failureRate >= 70) {
        return { label: 'eleve', className: 'border-red-200 bg-red-50 text-red-700' };
    }
    if (failureRate >= 40) {
        return { label: 'moyen', className: 'border-amber-200 bg-amber-50 text-amber-700' };
    }
    return { label: 'faible', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

export default function TeacherDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [courses, setCourses] = useState([]);
    const [labsMap, setLabsMap] = useState({});
    const [conceptMap, setConceptMap] = useState({});
    const [studentsMap, setStudentsMap] = useState({});
    const [courseProgress, setCourseProgress] = useState([]);
    const [studentsInDifficulty, setStudentsInDifficulty] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user?.email) return;
            setLoading(true);

            try {
                const [coursesRes, summaryRes] = await Promise.all([
                    graphApi.getTeacherCourses(user.email).catch(() => ({ data: [] })),
                    trackingApi.getDashboardSummary().catch(() => ({ data: null })),
                ]);

                const teacherCourses = coursesRes.data || [];
                const dashboardSummary = summaryRes.data || null;
                const trees = [];
                const labsById = {};
                const conceptsById = {};
                const learnersByEmail = {};
                const progressByCourse = [];
                const weakStudents = [];

                for (const course of teacherCourses) {
                    const currentCourseId = course.id;
                    const currentCourseTitle = courseTitle(course);

                    const [treeRes, labsRes, enrollmentsRes] = await Promise.all([
                        currentCourseId
                            ? courseApi.getCourseTree(currentCourseId).catch(() => ({ data: null }))
                            : Promise.resolve({ data: null }),
                        currentCourseId
                            ? labApi.getLabsByCourse(currentCourseId).catch(() => ({ data: [] }))
                            : Promise.resolve({ data: [] }),
                        currentCourseId
                            ? graphApi.getCourseEnrollments(currentCourseId).catch(() => ({ data: [] }))
                            : Promise.resolve({ data: [] }),
                    ]);

                    const tree = normalizeCourseTree(treeRes.data || course);
                    if (tree) {
                        trees.push(tree);
                        flattenConcepts(tree).forEach((concept) => {
                            conceptsById[concept.id] = {
                                ...concept,
                                conceptName: conceptTitle(concept),
                                courseId: currentCourseId,
                                courseTitle: currentCourseTitle,
                            };
                        });
                    }

                    (labsRes.data || []).forEach((lab) => {
                        if (lab?.id) labsById[lab.id] = lab;
                    });

                    const enrollments = enrollmentsRes.data || [];
                    enrollments.forEach((learner) => {
                        const email = learner.email || learner.learnerEmail;
                        if (email) learnersByEmail[email] = learner;
                    });

                    const courseConcepts = tree ? flattenConcepts(tree) : [];
                    let masteredInstances = 0;
                    let expectedInstances = courseConcepts.length * enrollments.length;

                    for (const learner of enrollments) {
                        const learnerEmail = learner.email || learner.learnerEmail;
                        if (!learnerEmail || !currentCourseId || courseConcepts.length === 0) continue;

                        const statusRes = await learnerApi
                            .getLearningStatus(learnerEmail, currentCourseId)
                            .catch(() => ({ data: [] }));
                        const statuses = statusRes.data || [];
                        const masteredCount = statuses.filter((item) => item.status === 'MASTERED').length;
                        const learnerProgress = percent((masteredCount / courseConcepts.length) * 100);
                        const nonMasteredCount = Math.max(courseConcepts.length - masteredCount, 0);

                        masteredInstances += masteredCount;

                        if (learnerProgress < 50 || nonMasteredCount >= 2) {
                            weakStudents.push({
                                email: learnerEmail,
                                name: learnerName(learner),
                                courseTitle: currentCourseTitle,
                                progress: learnerProgress,
                                nonMasteredCount,
                            });
                        }
                    }

                    progressByCourse.push({
                        courseId: currentCourseId,
                        title: currentCourseTitle,
                        learners: enrollments.length,
                        totalConcepts: courseConcepts.length,
                        masteredConcepts: masteredInstances,
                        expectedConcepts: expectedInstances,
                        progress: expectedInstances > 0 ? percent((masteredInstances / expectedInstances) * 100) : 0,
                    });
                }

                setCourses(teacherCourses);
                setSummary(dashboardSummary);
                setLabsMap(labsById);
                setConceptMap(conceptsById);
                setStudentsMap(learnersByEmail);
                setCourseProgress(progressByCourse);
                setStudentsInDifficulty(weakStudents);
            } catch (error) {
                console.error('Erreur chargement dashboard enseignant:', error);
                setSummary(null);
                setCourses([]);
                setLabsMap({});
                setConceptMap({});
                setStudentsMap({});
                setCourseProgress([]);
                setStudentsInDifficulty([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    const difficultConcepts = useMemo(() => {
        return (summary?.topDifficultConcepts || []).map((concept) => {
            const conceptInfo = conceptMap[concept.conceptId];
            const avgScore = Number(concept.avgScore || 0);
            const failureRate = percent(100 - avgScore);
            return {
                ...concept,
                conceptName: conceptInfo?.conceptName || 'Concept inconnu',
                courseTitle: conceptInfo?.courseTitle || 'Cours non identifie',
                failureRate,
                attempts: concept.attempts || concept.nbTentatives || 0,
                avgTimeMinutes: Number(concept.avgTimeSpent || 0) / 60,
                badge: difficultBadge(failureRate),
            };
        });
    }, [summary, conceptMap]);

    const suggestions = useMemo(() => {
        const items = [];
        const hardest = difficultConcepts.find((item) => item.failureRate >= 70);
        const lowProgressCourse = courseProgress.find((item) => item.learners > 0 && item.progress < 50);

        if (hardest) {
            items.push({
                title: `Renforcer le concept "${hardest.conceptName}"`,
                message: 'Fort taux d echec : proposer une ressource plus progressive ou un exemple supplementaire.',
            });
        }
        if ((summary?.completedLabs || 0) < Object.keys(labsMap).length && Object.keys(labsMap).length > 0) {
            items.push({
                title: 'Clarifier les TP peu soumis',
                message: 'Peu de TP sont termines : simplifier les consignes ou ajouter une etape guidee.',
            });
        }
        if (lowProgressCourse) {
            items.push({
                title: `Revoir le contenu de "${lowProgressCourse.title}"`,
                message: 'Progression faible : verifier les prerequis et ajouter une remediation courte.',
            });
        }
        if (items.length === 0) {
            items.push({
                title: 'Aucune alerte pedagogique majeure',
                message: 'Les donnees actuelles ne montrent pas de blocage prioritaire.',
            });
        }
        return items;
    }, [courseProgress, difficultConcepts, labsMap, summary]);

    const activeStudents = summary?.activeStudents || Object.keys(studentsMap).length || 0;
    const avgProgress = courseProgress.length
        ? courseProgress.reduce((sum, item) => sum + item.progress, 0) / courseProgress.length
        : 0;

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center gap-3 text-slate-500">
                <Loader2 className="animate-spin" size={22} />
                Chargement de vos statistiques...
            </div>
        );
    }

    if (courses.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-6 h-40 w-40 text-indigo-200">
                    <BookOpen className="h-full w-full" strokeWidth={1} />
                </div>
                <h2 className="mb-4 text-3xl font-bold text-slate-800">Bienvenue sur votre dashboard</h2>
                <p className="mb-8 max-w-lg text-lg text-slate-500">
                    Vous n'avez pas encore de cours. Creez un premier cours pour commencer a suivre la progression des apprenants.
                </p>
                <button
                    onClick={() => navigate('/courses')}
                    className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                >
                    Creer mon premier cours
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Tableau de bord Enseignant</h1>
                <p className="mt-2 text-lg text-slate-500">
                    Suivi des cours, concepts difficiles, progression et apprenants a accompagner.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <KpiCard icon={<BookOpen size={24} />} label="Cours" value={courses.length} color="blue" />
                <KpiCard icon={<Users size={24} />} label="Apprenants actifs" value={activeStudents} color="indigo" />
                <KpiCard icon={<GraduationCap size={24} />} label="Progression moyenne" value={`${avgProgress.toFixed(1)}%`} color="emerald" />
                <KpiCard icon={<Github size={24} />} label="TP soumis" value={summary?.completedLabs || 0} color="purple" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <TeacherCourseCard />

                <section className="rounded-lg border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center gap-2">
                        <TrendingUp className="text-emerald-600" size={20} />
                        <h2 className="text-xl font-bold text-slate-800">Progression par cours</h2>
                    </div>
                    <div className="space-y-4">
                        {courseProgress.length > 0 ? (
                            courseProgress.map((item) => (
                                <div key={item.courseId || item.title} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-800">{item.title}</p>
                                            <p className="text-sm text-slate-500">
                                                {item.learners} apprenant(s) - {item.totalConcepts} concept(s)
                                            </p>
                                        </div>
                                        <span className="text-lg font-bold text-slate-800">{item.progress.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                        <div
                                            className="h-full rounded-full bg-emerald-500 transition-all"
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Calcul : concepts maitrises / total des concepts attendus pour les apprenants inscrits.
                                    </p>
                                </div>
                            ))
                        ) : (
                            <EmptyState message="Aucune donnee de progression disponible pour le moment." />
                        )}
                    </div>
                </section>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-lg border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-orange-500" size={20} />
                        <h2 className="text-xl font-bold text-slate-800">Concepts difficiles</h2>
                    </div>
                    <div className="space-y-3">
                        {difficultConcepts.length > 0 ? (
                            difficultConcepts.map((concept, index) => (
                                <div key={`${concept.conceptName}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-slate-800">{concept.conceptName}</p>
                                            <p className="text-sm text-slate-500">{concept.courseTitle}</p>
                                        </div>
                                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${concept.badge.className}`}>
                                            {concept.badge.label}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                                        <Metric label="Taux d'echec" value={`${concept.failureRate.toFixed(1)}%`} />
                                        <Metric label="Tentatives" value={concept.attempts} />
                                        <Metric label="Temps moyen" value={`${concept.avgTimeMinutes.toFixed(1)} min`} />
                                    </div>
                                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                                        Ce concept necessite une remediation.
                                    </p>
                                </div>
                            ))
                        ) : (
                            <EmptyState message="Pas assez de donnees pour identifier des concepts difficiles." />
                        )}
                    </div>
                </section>

                <section className="rounded-lg border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <Target className="text-indigo-600" size={20} />
                        <h2 className="text-xl font-bold text-slate-800">Maitrise par module</h2>
                    </div>
                    <div className="min-h-[280px]">
                        {summary?.masteryByModule && summary.masteryByModule.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={summary.masteryByModule} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="moduleName" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgb(15 23 42 / 0.12)' }}
                                    />
                                    <Bar dataKey="validatedConcepts" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Concepts maitrises" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message="Aucune donnee de maitrise disponible." />
                        )}
                    </div>
                </section>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-lg border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <Users className="text-red-500" size={20} />
                        <h2 className="text-xl font-bold text-slate-800">Etudiants en difficulte</h2>
                    </div>
                    <div className="space-y-3">
                        {studentsInDifficulty.length > 0 ? (
                            studentsInDifficulty.slice(0, 8).map((student) => (
                                <div key={`${student.email}-${student.courseTitle}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-800">{student.name}</p>
                                            <p className="text-sm text-slate-500">{student.email}</p>
                                            <p className="mt-1 text-sm text-slate-600">{student.courseTitle}</p>
                                        </div>
                                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-bold text-red-700">
                                            {student.progress.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <EmptyState message="Aucun apprenant en difficulte detecte avec les donnees actuelles." />
                        )}
                    </div>
                </section>

                <section className="rounded-lg border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <Lightbulb className="text-amber-500" size={20} />
                        <h2 className="text-xl font-bold text-slate-800">Suggestions pedagogiques</h2>
                    </div>
                    <div className="space-y-3">
                        {suggestions.map((item, index) => (
                            <div key={index} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                <p className="font-semibold text-slate-800">{item.title}</p>
                                <p className="mt-1 text-sm text-slate-500">{item.message}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <section className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                        <Terminal size={20} className="text-slate-600" />
                        Dernieres soumissions de TP
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-medium">Apprenant</th>
                                <th className="px-6 py-4 font-medium">Travail pratique</th>
                                <th className="px-6 py-4 font-medium">Lien GitHub</th>
                                <th className="px-6 py-4 font-medium">Temps passe</th>
                                <th className="px-6 py-4 text-right font-medium">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {summary?.recentLabSubmissions && summary.recentLabSubmissions.length > 0 ? (
                                summary.recentLabSubmissions.map((submission, index) => {
                                    const lab = labsMap[submission.labId];
                                    const learner = studentsMap[submission.userId] || { email: submission.userId };
                                    return (
                                        <tr key={`${submission.labId}-${index}`} className="transition-colors hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-800">{learnerName(learner)}</p>
                                                <p className="text-xs text-slate-500">{learnerSecondaryLabel(submission.userId)}</p>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">{lab?.title || 'TP sans titre'}</td>
                                            <td className="px-6 py-4">
                                                {submission.githubRepoUrl ? (
                                                    <a
                                                        href={submission.githubRepoUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                                                    >
                                                        <Github size={14} /> Voir le depot
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400">Lien absent</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {Number(submission.totalTimeSpent || 0) > 0
                                                    ? `${(Number(submission.totalTimeSpent) / 60).toFixed(0)} min`
                                                    : 'Non renseigne'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500">
                                                {submission.completedAt
                                                    ? new Date(submission.completedAt).toLocaleString()
                                                    : 'Date inconnue'}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                                        Aucune soumission recente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function KpiCard({ icon, label, value, color }) {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        indigo: 'bg-indigo-100 text-indigo-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        purple: 'bg-purple-100 text-purple-600',
    };

    return (
        <div className="flex items-center gap-4 rounded-lg border border-slate-100 bg-white p-6 shadow-sm">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            </div>
        </div>
    );
}

function Metric({ label, value }) {
    return (
        <div className="rounded-lg border border-slate-100 bg-white p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 font-bold text-slate-800">{value}</p>
        </div>
    );
}

function EmptyState({ message }) {
    return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            <CheckCircle2 className="mx-auto mb-2 text-slate-300" size={22} />
            {message}
        </div>
    );
}
