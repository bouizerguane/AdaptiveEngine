import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Compass, Loader2, Lock, PlayCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { courseApi, graphApi, labTrackingApi, masteryApi, trackingApi, tutoringApi } from '../api/apiClient';
import { learnerApi } from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';
import { flattenConcepts, normalizeCourseTree } from '../utils/courseOrder';

const teacherLabel = (course) => course?.teacherName || course?.authorName || course?.teacherEmail || course?.authorEmail || 'Enseignant non renseigne';
const conceptLabel = (concept) => concept?.labelPedagogique || concept?.title || concept?.name || 'Concept sans titre';
const shortText = (value, length = 90) => {
    const text = value || '';
    return text.length > length ? `${text.slice(0, length)}...` : text;
};

const parseConceptResults = (value) => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        return Array.isArray(parsed.concepts) ? parsed.concepts : [];
    } catch {
        return [];
    }
};

const tutoringEventFromAction = (nextAction) => {
    if (nextAction === 'REMEDIATION') return 'DIAGNOSTIC_FAILED';
    if (nextAction === 'COMPLETED') return 'CONCEPT_MASTERED';
    return 'GENERAL';
};

const profileTypeLabels = {
    DATA_INSUFFICIENT: 'Donnees insuffisantes',
    NEEDS_REMEDIATION: 'Remediation necessaire',
    PROGRESSING: 'Progression active',
    HIGH_PERFORMING: 'Tres bonne maitrise',
};

const strategyTypeLabels = {
    RECOVERY: 'Parcours de remediation',
    SUPPORTIVE: 'Progression guidee',
    STANDARD: 'Progression standard',
    ADVANCED: 'Approfondissement',
};

const sequenceLabels = {
    RESOURCE: 'Ressource',
    REVIEW: 'Revision',
    LAB: 'TP',
    FORMATIVE: 'Evaluation formative',
    CHALLENGE: 'Defi',
};

const formatHistoryDate = (value) => {
    if (!value) return 'Date inconnue';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    return date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const traceLabel = (trace) => {
    if (trace.typeEvaluation === 'VALIDATION') return `Validation finale terminee : ${trace.scoreObtenu ?? 0}%`;
    if (trace.typeEvaluation === 'FORMATIVE') return `Evaluation formative terminee : ${trace.scoreObtenu ?? 0}%`;
    if (trace.typeEvaluation?.startsWith('DIAGNOSTIC')) return 'Diagnostic initial termine';
    return `Evaluation terminee : ${trace.scoreObtenu ?? 0}%`;
};

export default function LearnerDashboard() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [courseProgress, setCourseProgress] = useState([]);
    const [recommendation, setRecommendation] = useState(null);
    const [reviewConcepts, setReviewConcepts] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [learningHistory, setLearningHistory] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboard = async () => {
            if (!user?.email) return;
            setLoading(true);
            try {
                const myCoursesRes = await learnerApi.getMyCourses(user.email);
                const enrolledCourses = myCoursesRes.data || [];
                setCourses(enrolledCourses);

                if (enrolledCourses.length === 0) {
                    setCourseProgress([]);
                    setRecommendation(null);
                    setReviewConcepts([]);
                    setRecentActivity([]);
                    setLearningHistory([]);
                    setNotifications([]);
                    return;
                }

                const progressItems = await Promise.all(enrolledCourses.map(async (course) => {
                    const [treeRes, statusRes, recommendationRes, latestDiagnosticRes, adaptivePathRes] = await Promise.all([
                        courseApi.getCourseTree(course.id).catch(() => ({ data: course })),
                        learnerApi.getLearningStatus(user.email, course.id).catch(() => ({ data: [] })),
                        learnerApi.getNextRecommendation(user.email, course.id).catch(() => ({ data: null })),
                        trackingApi.getLatestDiagnostic(user.email, course.id).catch(() => ({ data: null })),
                        learnerApi.getAdaptivePath(course.id).catch(() => ({ data: null })),
                    ]);

                    const tree = normalizeCourseTree(treeRes.data);
                    const concepts = flattenConcepts(tree);
                    const statuses = statusRes.data || [];
                    const statusMap = Object.fromEntries(statuses.map(item => [item.conceptId, item]));
                    const mastered = statuses.filter(item => item.status === 'MASTERED').length;
                    const learnable = statuses.filter(item => item.status === 'LEARNABLE').length;
                    const blocked = statuses.filter(item => item.status === 'BLOCKED').length;
                    const total = concepts.length;
                    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
                    const adaptivePath = adaptivePathRes.data;
                    const strategy = adaptivePath?.pedagogicalStrategy;
                    const strategyFeedback = strategy
                        ? await tutoringApi.getFeedback({
                            eventType: tutoringEventFromAction(adaptivePath.nextAction),
                            learnerEmail: user.email,
                            courseId: course.id,
                            courseTitle: course.title,
                            conceptId: adaptivePath.nextConcept?.conceptId,
                            conceptName: adaptivePath.nextConcept?.conceptName,
                            strategyType: strategy.strategyType,
                            nextAction: adaptivePath.nextAction,
                            profileType: adaptivePath.learnerProfile?.profileType,
                            masteryScore: adaptivePath.learnerProfile?.masteryScore,
                            knowledgeGaps: adaptivePath.learnerProfile?.knowledgeGaps || [],
                            recommendedSequence: strategy.recommendedSequence || [],
                            tutoringMessageHint: strategy.tutoringMessageHint,
                        }).then(response => response.data).catch(() => null)
                        : null;

                    const failedResults = parseConceptResults(latestDiagnosticRes.data?.conceptResults)
                        .filter(item => item?.conceptId && !item.mastered);
                    const unresolved = await Promise.all(failedResults.map(async result => {
                        const treeConcept = concepts.find(item => item.id === result.conceptId);
                        const isMastered = statusMap[result.conceptId]?.status === 'MASTERED'
                            || await masteryApi.isConceptMastered(result.conceptId, user.email)
                                .then(response => !!response.data?.mastered)
                                .catch(() => false);
                        if (isMastered) return null;
                        const context = treeConcept
                            ? { conceptName: conceptLabel(treeConcept), courseId: course.id, courseTitle: course.title, isInCurrentCourse: true }
                            : await graphApi.getConceptContext(result.conceptId, course.id).then(response => response.data).catch(() => null);
                        return {
                            conceptId: result.conceptId,
                            score: result.score,
                            name: context?.conceptName || conceptLabel(treeConcept),
                            courseId: context?.isInCurrentCourse === false ? course.id : course.id,
                            sourceCourseTitle: context?.courseTitle || course.title,
                            currentCourseTitle: course.title,
                            external: context?.isInCurrentCourse === false,
                        };
                    }));

                    return {
                        course,
                        tree,
                        total,
                        mastered,
                        learnable,
                        blocked,
                        percent,
                        recommendation: recommendationRes.data,
                        adaptivePath,
                        strategyFeedback,
                        reviewConcepts: unresolved.filter(Boolean),
                    };
                }));

                setCourseProgress(progressItems);
                setRecommendation(progressItems.find(item => item.adaptivePath?.nextAction && item.adaptivePath.nextAction !== 'COMPLETED')
                    || progressItems.find(item => item.adaptivePath?.nextAction === 'COMPLETED')
                    || progressItems.find(item => item.recommendation?.conceptId)
                    || null);
                setReviewConcepts(progressItems.flatMap(item => item.reviewConcepts));

                const [tracesRes, labsRes] = await Promise.all([
                    trackingApi.getTracesByUser(user.email).catch(() => ({ data: [] })),
                    labTrackingApi.getByUser(user.email).catch(() => ({ data: [] })),
                ]);
                const conceptNames = Object.fromEntries(progressItems.flatMap(item =>
                    flattenConcepts(item.tree).map(concept => [concept.id, conceptLabel(concept)])
                ));
                const activities = [
                    ...(tracesRes.data || []).map(trace => ({
                        type: trace.typeEvaluation?.startsWith('DIAGNOSTIC') ? 'Diagnostic' : trace.scoreObtenu >= 70 ? 'Quiz reussi' : 'Quiz',
                        date: trace.horodatage,
                        label: trace.typeEvaluation || trace.evaluationId || 'Evaluation',
                    })),
                    ...(labsRes.data || []).filter(lab => lab.status === 'COMPLETED').map(lab => ({
                        type: 'TP soumis',
                        date: lab.completedAt,
                        label: lab.githubRepoUrl || lab.labId,
                    })),
                ]
                    .filter(item => item.date)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 3);
                setRecentActivity(activities);
                const history = [
                    ...(tracesRes.data || []).map(trace => ({
                        type: trace.typeEvaluation?.startsWith('DIAGNOSTIC') ? 'diagnostic' : trace.typeEvaluation === 'VALIDATION' ? 'validation' : 'quiz',
                        date: trace.horodatage,
                        title: traceLabel(trace),
                        detail: trace.targetId && conceptNames[trace.targetId] ? conceptNames[trace.targetId] : 'Activite enregistree',
                    })),
                    ...(labsRes.data || []).filter(lab => lab.status === 'COMPLETED').map(lab => ({
                        type: 'lab',
                        date: lab.completedAt,
                        title: 'TP soumis',
                        detail: lab.githubRepoUrl || 'Soumission enregistree',
                    })),
                    ...progressItems.flatMap(item => (item.reviewConcepts || []).map(concept => ({
                        type: 'remediation',
                        date: new Date().toISOString(),
                        title: 'Remediation recommandee',
                        detail: `${concept.name} - ${item.course.title}`,
                    }))),
                    ...progressItems.filter(item => item.adaptivePath?.nextConcept?.conceptName).map(item => ({
                        type: 'recommendation',
                        date: new Date().toISOString(),
                        title: 'Nouveau concept recommande',
                        detail: `${item.adaptivePath.nextConcept.conceptName} - ${item.course.title}`,
                    })),
                ]
                    .filter(item => item.date)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 10);
                setLearningHistory(history);
                const notificationItems = [];
                if (progressItems.some(item => item.adaptivePath?.nextAction === 'REMEDIATION' || item.reviewConcepts.length > 0)) {
                    notificationItems.push({ tone: 'amber', message: 'Une remediation est recommandee.' });
                }
                if (progressItems.some(item => item.adaptivePath?.nextAction === 'LEARN')) {
                    notificationItems.push({ tone: 'indigo', message: 'Un nouveau concept est recommande.' });
                }
                if (progressItems.some(item => item.adaptivePath?.nextAction === 'COMPLETED' || (item.total > 0 && item.mastered === item.total))) {
                    notificationItems.push({ tone: 'emerald', message: 'Un cours est termine ou pret pour la validation finale.' });
                }
                if (progressItems.some(item => item.learnable > 0 && item.strategyFeedback)) {
                    notificationItems.push({ tone: 'sky', message: 'Un conseil personnalise est disponible pour votre prochaine activite.' });
                }
                setNotifications(notificationItems.slice(0, 4));
            } catch (error) {
                console.error('[LearnerDashboard] load failed', error);
                toast.error("Impossible de charger votre tableau de bord.");
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [user?.email]);

    const summary = useMemo(() => courseProgress.reduce((acc, item) => ({
        totalConcepts: acc.totalConcepts + item.total,
        mastered: acc.mastered + item.mastered,
        learnable: acc.learnable + item.learnable,
        blocked: acc.blocked + item.blocked,
        completedCourses: acc.completedCourses + (item.adaptivePath?.nextAction === 'COMPLETED' || (item.total > 0 && item.mastered === item.total) ? 1 : 0),
    }), { totalConcepts: 0, mastered: 0, learnable: 0, blocked: 0, completedCourses: 0 }), [courseProgress]);
    const activeCourses = Math.max(courses.length - summary.completedCourses, 0);
    const primaryAdaptivePath = recommendation?.adaptivePath;
    const primaryProfile = primaryAdaptivePath?.learnerProfile;
    const primaryStrategy = primaryAdaptivePath?.pedagogicalStrategy;
    const primaryFeedback = recommendation?.strategyFeedback;

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center gap-2 text-slate-500 dark:text-slate-300">
                <Loader2 size={18} className="animate-spin" />
                Chargement du tableau de bord...
            </div>
        );
    }

    if (courses.length === 0) {
        return (
            <div className="max-w-4xl mx-auto rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <Compass className="mx-auto mb-3 text-indigo-600" size={42} />
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Vous n'etes inscrit a aucun cours.</h1>
                <p className="mt-2 text-slate-500 dark:text-slate-300">Découvrez les cours disponibles pour commencer votre parcours.</p>
                <Link to="/learner/courses" className="mt-5 inline-flex rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                    Decouvrir les cours
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Dashboard apprenant</h1>
                <p className="mt-2 text-slate-500 dark:text-slate-300">Votre progression, vos lacunes et la prochaine action utile.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                {[
                    ['Cours inscrits', courses.length, BookOpen, 'text-indigo-600 bg-indigo-50'],
                    ['En cours', activeCourses, Compass, 'text-sky-600 bg-sky-50'],
                    ['Maitrises', summary.mastered, CheckCircle2, 'text-emerald-600 bg-emerald-50'],
                    ['Termines', summary.completedCourses, CheckCircle2, 'text-emerald-600 bg-emerald-50'],
                    ['A apprendre', summary.learnable, PlayCircle, 'text-indigo-600 bg-indigo-50'],
                ].map(([label, value, Icon, color]) => (
                    <section key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className={`rounded-lg p-2 ${color}`}><Icon size={20} /></div>
                            <div>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                            </div>
                        </div>
                    </section>
                ))}
            </div>

            {primaryAdaptivePath ? (
                <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} /> Recommandation Adaptive Engine</p>
                            <h2 className="mt-1 text-xl font-bold">
                                {primaryAdaptivePath.nextAction === 'COMPLETED'
                                    ? 'Cours termine'
                                    : primaryAdaptivePath.nextConcept?.conceptName || 'Diagnostic initial requis'}
                            </h2>
                            <p className="text-sm">{recommendation.course.title}</p>
                            <p className="mt-1 text-sm opacity-80">{primaryAdaptivePath.decisionExplanation || primaryAdaptivePath.recommendationReason}</p>
                        </div>
                        <Link to={`/learner/courses/${recommendation.course.id}`} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                            Ouvrir le cours
                        </Link>
                    </div>
                </section>
            ) : recommendation?.recommendation?.conceptId && (
                <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} /> Recommandation principale</p>
                            <h2 className="mt-1 text-xl font-bold">{recommendation.recommendation.label || 'Concept recommande'}</h2>
                            <p className="text-sm">{recommendation.course.title}</p>
                            <p className="mt-1 text-sm opacity-80">{recommendation.recommendation.reason}</p>
                        </div>
                        <Link to={`/learner/courses/${recommendation.course.id}?focusConcept=${recommendation.recommendation.conceptId}`} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                            Continuer
                        </Link>
                    </div>
                </section>
            )}

            {(primaryProfile || primaryStrategy || primaryFeedback) && (
                <section className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <h2 className="font-bold text-slate-800 dark:text-slate-100">Situation actuelle</h2>
                        {primaryProfile ? (
                            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                <p className="font-semibold text-indigo-700 dark:text-indigo-300">{profileTypeLabels[primaryProfile.profileType] || 'Situation en cours d analyse'}</p>
                                {primaryProfile.masteryScore !== null && primaryProfile.masteryScore !== undefined && (
                                    <p>Maitrise : {Math.round(Number(primaryProfile.masteryScore))}%</p>
                                )}
                                <p>Traces : {primaryProfile.tracesCount ?? 0}</p>
                                <p>TP completes : {primaryProfile.completedLabsCount ?? 0}</p>
                                {(primaryProfile.knowledgeGaps || []).length > 0 && (
                                    <p>Lacunes : {primaryProfile.knowledgeGaps.join(', ')}</p>
                                )}
                            </div>
                        ) : <p className="mt-3 text-sm text-slate-500">Votre situation sera precisee apres les premieres activites.</p>}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <h2 className="font-bold text-slate-800 dark:text-slate-100">Approche recommandee</h2>
                        {primaryStrategy ? (
                            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                <p className="font-semibold text-emerald-700 dark:text-emerald-300">{strategyTypeLabels[primaryStrategy.strategyType] || 'Progression standard'}</p>
                                <p>{primaryStrategy.strategyExplanation}</p>
                                <p>Sequence : {(primaryStrategy.recommendedSequence || []).map(step => sequenceLabels[step] || step).join(' -> ')}</p>
                            </div>
                        ) : <p className="mt-3 text-sm text-slate-500">Aucune approche specifique disponible actuellement.</p>}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <h2 className="font-bold text-slate-800 dark:text-slate-100">Conseil personnalise</h2>
                        {primaryFeedback ? (
                            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                <p>{primaryFeedback.message}</p>
                                {primaryFeedback.motivationalMessage && <p className="font-semibold text-emerald-700 dark:text-emerald-300">{primaryFeedback.motivationalMessage}</p>}
                            </div>
                        ) : <p className="mt-3 text-sm text-slate-500">Aucun conseil personnalise disponible actuellement.</p>}
                    </div>
                </section>
            )}

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Progression par cours</h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {courseProgress.map(item => (
                        <article key={item.course.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{item.course.title}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Enseignant : {teacherLabel(item.course)}</p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{shortText(item.course.description)}</p>
                                </div>
                                <Link to={`/learner/courses/${item.course.id}`} className="rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900">
                                    Continuer
                                </Link>
                            </div>
                            <div className="mt-4">
                                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    <span>{item.mastered}/{item.total} concepts maitrises</span>
                                    <span>{item.percent}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${item.percent}%` }} />
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Concepts a reviser</h2>
                    {reviewConcepts.length === 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">Aucune remediation necessaire.</p>
                            <p className="mt-1">Vous pouvez continuer votre progression.</p>
                        </div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {reviewConcepts.map(item => (
                                <div key={`${item.courseId}-${item.conceptId}`} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {item.external ? `Prerequis externe - ${item.sourceCourseTitle}` : item.currentCourseTitle}
                                        </p>
                                    </div>
                                    <Link to={item.external ? `/learner/external-concepts/${item.conceptId}?sourceCourseId=${item.courseId}` : `/learner/courses/${item.courseId}?focusConcept=${item.conceptId}`} className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-bold text-white">
                                        Reviser
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Notifications pedagogiques</h2>
                    {notifications.length === 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Aucune notification pedagogique pour le moment.
                        </div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {notifications.map((item, index) => {
                                const toneClass = item.tone === 'amber'
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : item.tone === 'emerald'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                        : item.tone === 'sky'
                                            ? 'border-sky-200 bg-sky-50 text-sky-800'
                                            : 'border-indigo-200 bg-indigo-50 text-indigo-800';
                                return (
                                    <div key={`${item.message}-${index}`} className={`rounded-lg border p-3 text-sm font-semibold ${toneClass}`}>
                                        {item.message}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Historique d'apprentissage</h2>
                    {learningHistory.length === 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Aucune activite recente.
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {learningHistory.map((item, index) => {
                                const color = item.type === 'remediation'
                                    ? 'bg-amber-500'
                                    : item.type === 'validation' || item.type === 'lab'
                                        ? 'bg-emerald-500'
                                        : item.type === 'recommendation'
                                            ? 'bg-indigo-500'
                                            : 'bg-slate-400';
                                return (
                                    <div key={`${item.type}-${item.date}-${index}`} className="flex gap-3">
                                        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${color}`} />
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{item.detail}</p>
                                            <p className="text-xs text-slate-400">{formatHistoryDate(item.date)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Activite recente</h2>
                    {recentActivity.length === 0 ? (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <AlertTriangle size={16} className="mt-0.5" />
                            Aucune activite recente pour le moment.
                        </div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {recentActivity.map((item, index) => (
                                <div key={`${item.type}-${item.date}-${index}`} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                                    <p className="font-bold text-slate-800 dark:text-slate-100">{item.type}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{shortText(item.label, 60)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
