import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardList, Loader2, Lock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { contentApi, courseApi, evaluationApi, graphApi, labApi, labTrackingApi, masteryApi, trackingApi, tutoringApi } from '../api/apiClient';
import { learnerApi } from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';
import { flattenConcepts, normalizeCourseTree } from '../utils/courseOrder';

const conceptLabel = (concept) => concept?.labelPedagogique || concept?.title || 'Concept sans titre';

const statusMeta = {
    MASTERED: { label: 'Maîtrisé', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    LEARNABLE: { label: 'À apprendre', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    BLOCKED: { label: 'Bloqué', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const parseConceptResults = (value) => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.concepts)) return parsed.concepts;
        if (parsed && typeof parsed === 'object' && parsed.conceptId) return [parsed];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const parseExternalResults = (value) => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed.externalPrerequisites) ? parsed.externalPrerequisites : [];
    } catch {
        return [];
    }
};

const adaptiveScorePercent = (score) => {
    const numeric = Number(score);
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 100);
};

const strategyStepLabels = {
    RESOURCE: 'Ressource',
    LAB: 'TP',
    FORMATIVE: 'Evaluation formative',
    REVIEW: 'Revision',
    CHALLENGE: 'Defi',
};

export default function LearnerCourseDetail() {
    const { courseId } = useParams();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [course, setCourse] = useState(null);
    const [selectedConcept, setSelectedConcept] = useState(null);
    const [content, setContent] = useState(null);
    const [selectedLab, setSelectedLab] = useState(null);
    const [recommendation, setRecommendation] = useState(null);
    const [adaptivePath, setAdaptivePath] = useState(null);
    const [adaptivePathFailed, setAdaptivePathFailed] = useState(false);
    const [diagnostic, setDiagnostic] = useState(null);
    const [diagnosticDone, setDiagnosticDone] = useState(true);
    const [conceptStatuses, setConceptStatuses] = useState({});
    const [remediations, setRemediations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [contentLoading, setContentLoading] = useState(false);
    const [formativeEvaluation, setFormativeEvaluation] = useState(null);
    const [conceptProgress, setConceptProgress] = useState({ labSubmitted: false, quizPassed: false });
    const [failedDiagnosticConcepts, setFailedDiagnosticConcepts] = useState([]);
    const [externalConceptPrerequisites, setExternalConceptPrerequisites] = useState([]);
    const [externalDiagnosticResults, setExternalDiagnosticResults] = useState([]);
    const [tutoringFeedbacks, setTutoringFeedbacks] = useState({});

    const concepts = useMemo(() => flattenConcepts(course), [course]);

    useEffect(() => {
        const loadCourse = async () => {
            setLoading(true);
            try {
                const [courseRes, recommendationRes, adaptivePathRes, diagnosticsRes, statusesRes] = await Promise.all([
                    courseApi.getCourseTree(courseId),
                    user?.email
                        ? learnerApi.getNextRecommendation(user.email, courseId).catch(() => ({ data: null }))
                        : Promise.resolve({ data: null }),
                    user?.email
                        ? learnerApi.getAdaptivePath(courseId)
                            .then(response => ({ data: response.data, failed: false }))
                            .catch(error => {
                                console.warn('[LearnerCourseDetail] adaptive path fallback', error?.response?.data || error.message);
                                return { data: null, failed: true };
                            })
                        : Promise.resolve({ data: null, failed: true }),
                    evaluationApi.getCourseDiagnostics(courseId).catch(() => ({ data: [] })),
                    user?.email
                        ? learnerApi.getLearningStatus(user.email, courseId).catch(() => ({ data: [] }))
                        : Promise.resolve({ data: [] }),
                ]);
                const tree = normalizeCourseTree(courseRes.data);
                const diagnostics = diagnosticsRes.data || [];
                const initialDiagnostic = diagnostics.find(item => item.typeEvaluation === 'DIAGNOSTIC_ENTREE')
                    || diagnostics.find(item => item.typeEvaluation === 'DIAGNOSTIC_POSITIONNEMENT')
                    || null;
                const statusMap = Object.fromEntries((statusesRes.data || []).map(item => [item.conceptId, item]));
                setCourse(tree);
                setRecommendation(recommendationRes.data);
                setAdaptivePath(adaptivePathRes.data);
                setAdaptivePathFailed(adaptivePathRes.failed);
                setDiagnostic(initialDiagnostic);
                setConceptStatuses(statusMap);
                let latestFailedResults = [];

                if (initialDiagnostic && user?.email) {
                    const latestDiagnosticRes = await trackingApi.getLatestDiagnostic(user.email, courseId)
                        .then(response => ({ data: response.data ? [response.data] : [] }))
                        .catch(() => trackingApi
                            .getTracesByUserAndEvaluation(user.email, initialDiagnostic.id)
                            .catch(() => ({ data: [] })));
                    const traces = latestDiagnosticRes.data || [];
                    setDiagnosticDone(traces.length > 0);
                    const lastTrace = traces[traces.length - 1];
                    const conceptResults = parseConceptResults(lastTrace?.conceptResults);
                    setExternalDiagnosticResults(parseExternalResults(lastTrace?.conceptResults));
                    const allTreeConcepts = flattenConcepts(tree);
                    const failedResults = conceptResults.filter(result => !result.mastered && result.conceptId);
                    const failedWithContext = await Promise.all(failedResults.map(async result => {
                        const context = await graphApi.getConceptContext(result.conceptId, courseId)
                            .then(response => response.data)
                            .catch(() => ({}));
                        return { ...result, context };
                    }));
                    const internalFailed = failedWithContext.filter(result => result.context?.isInCurrentCourse !== false);
                    const externalFailed = failedWithContext.filter(result => result.context?.isInCurrentCourse === false);
                    const unresolvedExternalFailed = await Promise.all(externalFailed.map(async result => {
                        const mastery = await masteryApi.isConceptMastered(result.conceptId, user.email)
                            .then(response => response.data)
                            .catch(() => ({ mastered: false }));
                        return mastery?.mastered ? null : result;
                    })).then(items => items.filter(Boolean));
                    latestFailedResults = internalFailed;
                    setFailedDiagnosticConcepts(internalFailed);
                    const externalItems = await Promise.all(unresolvedExternalFailed.map(async result => {
                        const [contentRes, labRes, evaluationRes] = await Promise.all([
                            contentApi.getConceptContent(result.conceptId).then(response => response.data).catch(() => null),
                            labApi.getLabByTarget(result.conceptId).then(response => response.data).catch(() => null),
                            evaluationApi.getEvaluation(result.conceptId).then(response => response.data).catch(() => null),
                        ]);
                        return { ...result, content: contentRes, lab: labRes, evaluation: evaluationRes };
                    }));
                    setExternalConceptPrerequisites(externalItems);
                    const remediationItems = await Promise.all(internalFailed.map(async result => {
                        const concept = allTreeConcepts.find(item => item.id === result.conceptId);
                        const [contentRes, labRes] = await Promise.all([
                            contentApi.getConceptContent(result.conceptId).then(() => true).catch(() => false),
                            labApi.getLabByTarget(result.conceptId).then(response => response.data).catch(() => null),
                        ]);
                        return { ...result, concept, hasContent: contentRes, lab: labRes };
                    }));
                    setRemediations(remediationItems);
                    const feedbackEntries = await Promise.all(remediationItems.map(async item => {
                        const conceptName = conceptLabel(item.concept);
                        const feedback = await tutoringApi.getFeedback({
                            eventType: 'DIAGNOSTIC_FAILED',
                            learnerEmail: user.email,
                            courseId,
                            courseTitle: tree.title,
                            conceptId: item.conceptId,
                            conceptName,
                            score: item.score,
                            evaluationType: initialDiagnostic.typeEvaluation,
                        }).then(response => response.data).catch(() => null);
                        return [item.conceptId, feedback];
                    }));
                    setTutoringFeedbacks(Object.fromEntries(feedbackEntries.filter(([, feedback]) => feedback)));
                } else {
                    setDiagnosticDone(true);
                    setRemediations([]);
                    setFailedDiagnosticConcepts([]);
                    setExternalConceptPrerequisites([]);
                    setExternalDiagnosticResults([]);
                    setTutoringFeedbacks({});
                }

                const allConcepts = flattenConcepts(tree);
                const focusConceptId = searchParams.get('focusConcept');
                const focusedConcept = allConcepts.find(item => item.id === focusConceptId);
                const firstFailedConcept = latestFailedResults?.[0]?.conceptId
                    ? allConcepts.find(item => item.id === latestFailedResults[0].conceptId)
                    : null;
                const adaptiveConceptId = adaptivePathRes.data?.nextConcept?.type === 'INTERNAL'
                    ? adaptivePathRes.data?.nextConcept?.conceptId
                    : null;
                const recommendedConcept = allConcepts.find(item => item.id === adaptiveConceptId)
                    || allConcepts.find(item => item.id === recommendationRes.data?.conceptId);
                setSelectedConcept(focusedConcept || firstFailedConcept || recommendedConcept || allConcepts[0] || null);
            } catch (error) {
                toast.error("Impossible de charger le cours.");
            } finally {
                setLoading(false);
            }
        };

        loadCourse();
    }, [courseId, user?.email, searchParams]);

    useEffect(() => {
        if (!selectedConcept?.id) {
            setContent(null);
            return;
        }

        setContentLoading(true);
        setConceptProgress({ labSubmitted: false, quizPassed: false });
        Promise.all([
            contentApi.getConceptContent(selectedConcept.id).then(response => response.data).catch(() => null),
            labApi.getLabByTarget(selectedConcept.id).then(response => response.data).catch(() => null),
            evaluationApi.getEvaluation(selectedConcept.id).then(response => response.data).catch(() => null),
        ])
            .then(async ([contentData, labData, evaluationData]) => {
                setContent(contentData);
                setSelectedLab(labData);
                setFormativeEvaluation(evaluationData?.typeEvaluation === 'FORMATIVE' ? evaluationData : null);
                const [submissionRes, traceRes] = await Promise.all([
                    labData?.id && user?.email
                        ? labTrackingApi.getByLabAndUser(labData.id, user.email).catch(() => ({ data: null }))
                        : Promise.resolve({ data: null }),
                    evaluationData?.id && user?.email
                        ? trackingApi.getTracesByUserAndEvaluation(user.email, evaluationData.id).catch(() => ({ data: [] }))
                        : Promise.resolve({ data: [] }),
                ]);
                const successfulTrace = (traceRes.data || []).some(trace =>
                    Number(trace.scoreObtenu || 0) >= Number(evaluationData?.seuilReussite || 70)
                );
                setConceptProgress({
                    labSubmitted: submissionRes.data?.status === 'COMPLETED',
                    quizPassed: successfulTrace,
                });
            })
            .finally(() => setContentLoading(false));
    }, [selectedConcept?.id, user?.email]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center gap-2 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                Chargement du cours...
            </div>
        );
    }

    if (!course) {
        return (
            <div className="max-w-4xl mx-auto rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
                <AlertTriangle className="inline mr-2" size={18} />
                Cours introuvable.
            </div>
        );
    }

    const adaptiveNextAction = adaptivePath?.nextAction;
    const adaptiveNextConcept = adaptivePath?.nextConcept;
    const adaptiveNextConceptId = adaptiveNextConcept?.conceptId;
    const adaptiveNextConceptName = adaptiveNextConcept?.conceptName || 'Concept inconnu';
    const adaptiveNextConceptType = adaptiveNextConcept?.type || 'INTERNAL';
    const adaptiveNextScore = adaptiveScorePercent(adaptiveNextConcept?.adaptiveScore);
    const adaptiveExplanationReasons = Array.isArray(adaptiveNextConcept?.explanationReasons)
        ? adaptiveNextConcept.explanationReasons
        : [];
    const learnerProfile = adaptivePath?.learnerProfile;
    const learnerProfileGaps = Array.isArray(learnerProfile?.knowledgeGaps) ? learnerProfile.knowledgeGaps : [];
    const learnerMasteryScore = learnerProfile?.masteryScore !== null && learnerProfile?.masteryScore !== undefined
        ? Math.round(Number(learnerProfile.masteryScore))
        : null;
    const pedagogicalStrategy = adaptivePath?.pedagogicalStrategy;
    const pedagogicalSequence = Array.isArray(pedagogicalStrategy?.recommendedSequence)
        ? pedagogicalStrategy.recommendedSequence
        : [];
    const adaptiveConceptStatuses = adaptivePath
        ? Object.fromEntries([
            ...(adaptivePath.masteredConcepts || []).map(item => [item.conceptId, { ...item, status: 'MASTERED' }]),
            ...(adaptivePath.learnableConcepts || []).map(item => [item.conceptId, { ...item, status: 'LEARNABLE' }]),
            ...(adaptivePath.blockedConcepts || []).map(item => [item.conceptId, { ...item, status: 'BLOCKED' }]),
        ])
        : {};
    const effectiveConceptStatuses = adaptivePath ? { ...conceptStatuses, ...adaptiveConceptStatuses } : conceptStatuses;
    const selectedStatus = selectedConcept?.id ? (effectiveConceptStatuses[selectedConcept.id]?.status || 'LEARNABLE') : 'LEARNABLE';
    const selectedBlocked = selectedStatus === 'BLOCKED';
    const diagnosticLocked = adaptivePath
        ? adaptiveNextAction === 'PASS_DIAGNOSTIC'
        : !!diagnostic && !diagnosticDone;
    const failedConceptsStillMissing = failedDiagnosticConcepts.filter(item => effectiveConceptStatuses[item.conceptId]?.status !== 'MASTERED');
    const canRetakeDiagnostic = diagnosticDone && failedDiagnosticConcepts.length > 0 && failedConceptsStillMissing.length === 0;
    const canTakeFormative = !selectedBlocked && !!formativeEvaluation && (selectedStatus === 'MASTERED' || conceptProgress.labSubmitted);
    const showAdaptiveBanner = !!adaptivePath && !adaptivePathFailed;
    const adaptiveInternalReviews = (adaptivePath?.conceptsToReview || []).filter(item => item.type !== 'EXTERNAL');
    const displayedReviewConcepts = adaptiveInternalReviews.length > 0
        ? adaptiveInternalReviews.map(item => ({
            conceptId: item.conceptId,
            conceptName: item.conceptName,
            score: item.score,
        }))
        : failedDiagnosticConcepts;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <Link to="/learner/my-courses" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                        Retour a mes cours
                    </Link>
                    <h1 className="mt-2 text-3xl font-bold text-slate-800">{course.title || 'Cours sans titre'}</h1>
                    <p className="mt-2 max-w-3xl text-slate-500">{course.description || 'Aucune description disponible.'}</p>
                </div>

                {adaptiveNextAction === 'LEARN' && adaptiveNextConceptType === 'INTERNAL' && (
                    <button
                        onClick={() => {
                            const recommended = concepts.find(item => item.id === adaptiveNextConceptId);
                            if (recommended) setSelectedConcept(recommended);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                        <Sparkles size={16} />
                        Prochain concept
                    </button>
                )}
            </div>

            {showAdaptiveBanner && (
                <div className={`rounded-lg border p-4 text-sm ${
                    adaptiveNextAction === 'PASS_DIAGNOSTIC' ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                        : adaptiveNextAction === 'REMEDIATION' ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : adaptiveNextAction === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}>
                    <p className="font-bold">
                        {adaptiveNextAction === 'PASS_DIAGNOSTIC' && 'Diagnostic initial requis'}
                        {adaptiveNextAction === 'REMEDIATION' && 'Concept a reviser'}
                        {adaptiveNextAction === 'LEARN' && 'Prochain concept recommande'}
                        {adaptiveNextAction === 'COMPLETED' && 'Cours termine'}
                    </p>
                    <p className="mt-1">{adaptivePath.decisionExplanation || adaptivePath.recommendationReason}</p>
                    {adaptiveNextConcept && (
                        <div className="mt-3 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                                    {adaptiveNextConceptName}
                                </span>
                                {adaptiveNextScore !== null && (
                                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                                        Score adaptatif : {adaptiveNextScore}%
                                    </span>
                                )}
                                {adaptiveNextConceptType === 'EXTERNAL' ? (
                                    <Link
                                        to={`/learner/external-concepts/${adaptiveNextConceptId}?sourceCourseId=${courseId}`}
                                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                    >
                                        Ouvrir le prerequis externe
                                    </Link>
                                ) : (
                                    <button
                                        onClick={() => {
                                            const concept = concepts.find(item => item.id === adaptiveNextConceptId);
                                            if (concept) setSelectedConcept(concept);
                                        }}
                                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                    >
                                        Ouvrir le concept
                                    </button>
                                )}
                            </div>
                            {(adaptivePath.decisionExplanation || adaptiveExplanationReasons.length > 0) && (
                                <div className="rounded-lg border border-white/60 bg-white/70 p-3">
                                    <p className="font-bold">Pourquoi ce concept ?</p>
                                    {adaptiveExplanationReasons.length > 0 ? (
                                        <ul className="mt-2 space-y-1">
                                            {adaptiveExplanationReasons.map(reason => (
                                                <li key={reason}>- {reason}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mt-1">{adaptivePath.decisionExplanation}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!adaptivePath && recommendation?.conceptId && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-bold">Recommendation adaptative</p>
                    <p className="mt-1">{recommendation.reason}</p>
                </div>
            )}

            {learnerProfile && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="font-bold text-slate-800">Profil apprenant</p>
                            <p className="mt-1 text-slate-500">{learnerProfile.profileExplanation}</p>
                        </div>
                        <span className="inline-flex w-fit rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                            {learnerProfile.profileType || 'DATA_INSUFFICIENT'}
                        </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {learnerMasteryScore !== null && Number.isFinite(learnerMasteryScore) && (
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                                Maitrise : {learnerMasteryScore}%
                            </span>
                        )}
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                            Traces : {learnerProfile.tracesCount ?? 0}
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                            TP completes : {learnerProfile.completedLabsCount ?? 0}
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                            Temps : {Math.round((learnerProfile.totalLearningTime || 0) / 60)} min
                        </span>
                    </div>
                    {learnerProfileGaps.length > 0 && (
                        <div className="mt-4">
                            <p className="font-semibold text-slate-700">Lacunes detectees</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {learnerProfileGaps.map(gap => (
                                    <span key={gap} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                                        {gap}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {pedagogicalStrategy && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="font-bold text-slate-800">Strategie pedagogique</p>
                            <p className="mt-1 text-slate-500">{pedagogicalStrategy.strategyExplanation}</p>
                        </div>
                        <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            {pedagogicalStrategy.strategyType || 'STANDARD'}
                        </span>
                    </div>
                    {pedagogicalSequence.length > 0 && (
                        <div className="mt-4">
                            <p className="font-semibold text-slate-700">Sequence recommandee</p>
                            <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {pedagogicalSequence.map((step, index) => (
                                    <li key={`${step}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                                        {index + 1}. {strategyStepLabels[step] || step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                    {pedagogicalStrategy.tutoringMessageHint && (
                        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-indigo-900">
                            <p className="font-semibold">Conseil tutorat</p>
                            <p className="mt-1 text-xs leading-relaxed">{pedagogicalStrategy.tutoringMessageHint}</p>
                        </div>
                    )}
                </div>
            )}

            {diagnosticLocked ? (
                <div className="rounded-lg border border-indigo-200 bg-white p-8 text-center shadow-sm">
                    <ClipboardList className="mx-auto mb-3 text-indigo-600" size={42} />
                    <h2 className="text-xl font-bold text-slate-800">Diagnostic initial</h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                        Passez le diagnostic initial pour identifier les concepts deja maitrises et obtenir votre premier parcours personnalise.
                    </p>
                    {diagnostic?.targetId ? (
                        <Link
                            to={`/student/quiz/${diagnostic.targetId}`}
                            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                        >
                            <ClipboardList size={16} />
                            Passer le diagnostic initial
                        </Link>
                    ) : (
                        <p className="mt-5 text-sm font-semibold text-amber-700">
                            Aucun diagnostic initial n'est encore disponible pour ce cours.
                        </p>
                    )}
                </div>
            ) : diagnostic && diagnosticDone && !adaptivePath && recommendation?.conceptId ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                    <p className="font-bold">Votre parcours personnalisé</p>
                    <p className="mt-1">Premier concept recommande : {recommendation.label}</p>
                </div>
            ) : null}

            {diagnostic && diagnosticDone && displayedReviewConcepts.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h2 className="font-bold text-amber-900">Concepts a reviser</h2>
                            <p className="mt-1 text-amber-800">Le test est passe. Le parcours reste oriente vers les lacunes detectees.</p>
                        </div>
                        {canRetakeDiagnostic ? (
                            <Link to={`/student/quiz/${diagnostic.targetId}?retake=1`} className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800">
                                Repasser le test de positionnement
                            </Link>
                        ) : (
                            <span className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-amber-800 border border-amber-200">
                                Vous pourrez repasser le test lorsque les concepts non maitrises seront maitrises.
                            </span>
                        )}
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {displayedReviewConcepts.map(item => {
                            const concept = concepts.find(conceptItem => conceptItem.id === item.conceptId);
                            const masteredNow = effectiveConceptStatuses[item.conceptId]?.status === 'MASTERED';
                            return (
                                <button key={item.conceptId} onClick={() => concept && setSelectedConcept(concept)} className="rounded-lg border border-amber-200 bg-white p-3 text-left hover:border-amber-400">
                                    <p className="font-bold text-slate-800">{concept ? conceptLabel(concept) : (item.conceptName || 'Concept inconnu')}</p>
                                    {item.score !== undefined && <p className="text-xs text-slate-500">Score diagnostic : {item.score}%</p>}
                                    <p className={masteredNow ? 'text-xs font-semibold text-emerald-700' : 'text-xs font-semibold text-amber-700'}>
                                        {masteredNow ? 'Maintenant maitrise' : 'Encore a travailler'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {diagnostic && diagnosticDone && externalDiagnosticResults.filter(item => !item.mastered).length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    <p className="font-bold text-slate-800">Prerequis externes a revoir</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {externalDiagnosticResults.filter(item => !item.mastered).map(item => (
                            <span key={item.label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                                Revisez : {item.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {diagnostic && diagnosticDone && externalConceptPrerequisites.length > 0 && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-5 text-sm">
                    <h2 className="font-bold text-sky-900">Prérequis externe à réviser</h2>
                    <p className="mt-1 text-sky-800">
                        Ces concepts appartiennent à un autre cours. Vous pouvez les réviser ici sans inscription automatique au cours propriétaire.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {externalConceptPrerequisites.map(item => (
                            <div key={item.conceptId} className="rounded-lg border border-sky-200 bg-white p-4">
                                <p className="font-bold text-slate-800">{item.context?.conceptName || item.conceptName || item.name || 'Concept inconnu'}</p>
                                <p className="mt-1 text-xs text-slate-500">Cours source : {item.context?.courseTitle || 'Non renseigné'}</p>
                                <p className="mt-1 text-xs text-slate-500">Score diagnostic : {item.score}%</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {item.content?.htmlContent && (
                                        <Link
                                            to={`/learner/external-concepts/${item.conceptId}?sourceCourseId=${courseId}`}
                                            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                        >
                                            Consulter la ressource
                                        </Link>
                                    )}
                                    {item.lab?.id && (
                                        <Link to={`/student/lab/${item.lab.id}?sourceCourseId=${encodeURIComponent(courseId)}&conceptId=${encodeURIComponent(item.conceptId)}`} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                                            Réaliser le TP
                                        </Link>
                                    )}
                                    {item.evaluation?.id && (
                                        <Link to={`/student/quiz/${item.conceptId}`} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                                            Évaluation formative
                                        </Link>
                                    )}
                                </div>
                                {!item.content?.htmlContent && !item.lab?.id && !item.evaluation?.id && (
                                    <p className="mt-3 text-xs text-slate-500">Aucune ressource de révision disponible pour ce prérequis externe.</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {remediations.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                    <h2 className="font-bold text-amber-900">Remediation recommandee</h2>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {remediations.map(item => (
                            <div key={item.conceptId} className="rounded-lg border border-amber-200 bg-white p-4 text-sm">
                                <p className="font-bold text-slate-800">{conceptLabel(item.concept)}</p>
                                <p className="mt-1 text-slate-500">Score diagnostic : {item.score}%</p>
                                {tutoringFeedbacks[item.conceptId] && (
                                    <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-900">
                                        <p className="font-semibold">Feedback pedagogique</p>
                                        <p className="mt-1 text-xs leading-relaxed">{tutoringFeedbacks[item.conceptId].message}</p>
                                        {Array.isArray(tutoringFeedbacks[item.conceptId].actions) && (
                                            <ul className="mt-2 space-y-1 text-xs text-amber-800">
                                                {tutoringFeedbacks[item.conceptId].actions.map(action => (
                                                    <li key={action}>- {action}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {item.hasContent && (
                                        <button
                                            onClick={() => item.concept && setSelectedConcept(item.concept)}
                                            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                        >
                                            Revoir la ressource
                                        </button>
                                    )}
                                    {item.lab?.id && (
                                        <Link to={`/student/lab/${item.lab.id}`} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                                            Realiser le TP
                                        </Link>
                                    )}
                                    <Link to={`/student/quiz/${item.conceptId}`} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                                        Evaluation formative
                                    </Link>
                                </div>
                                {!item.hasContent && !item.lab?.id && (
                                    <p className="mt-3 text-xs text-slate-500">Aucune ressource de remediation disponible pour ce concept.</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
                <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-800">
                        <BookOpen size={18} />
                        Plan du cours
                    </h2>

                    {concepts.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucun module, chapitre ou concept n'est encore associe a ce cours.</p>
                    ) : (
                        <div className="space-y-4">
                            {(course.modules || []).map(module => (
                                <section key={module.id} className="space-y-2">
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{module.title || 'Module'}</h3>
                                    {(module.chapitres || []).map(chapitre => (
                                        <div key={chapitre.id} className="rounded-lg bg-slate-50 p-2">
                                            <p className="mb-1 px-2 text-xs font-semibold text-slate-500">{chapitre.title || 'Chapitre'}</p>
                                            <div className="space-y-1">
                                                {(chapitre.concepts || []).map(concept => {
                                                    const selected = selectedConcept?.id === concept.id;
                                                    const recommended = adaptiveNextConceptId === concept.id || (!adaptivePath && recommendation?.conceptId === concept.id);
                                                    const status = effectiveConceptStatuses[concept.id]?.status || 'LEARNABLE';
                                                    const meta = statusMeta[status] || statusMeta.LEARNABLE;
                                                    const blocked = diagnosticLocked || status === 'BLOCKED';
                                                    return (
                                                        <button
                                                            key={concept.id}
                                                            disabled={blocked}
                                                            title={diagnosticLocked ? 'Diagnostic initial requis' : blocked ? 'Prerequis non maitrises' : undefined}
                                                            onClick={() => !blocked && setSelectedConcept({ ...concept, moduleTitle: module.title, chapitreTitle: chapitre.title })}
                                                            className={`flex w-full items-start justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition border ${
                                                                blocked ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : selected ? 'bg-indigo-600 text-white border-indigo-600' : recommended ? 'bg-emerald-50 text-slate-800 border-emerald-200' : 'bg-white text-slate-700 border-transparent hover:bg-indigo-50'
                                                            }`}
                                                        >
                                                            <span>{conceptLabel(concept)}</span>
                                                            <span className="flex shrink-0 items-center gap-1">
                                                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${selected ? 'border-white/40 bg-white/10 text-white' : diagnosticLocked ? statusMeta.BLOCKED.className : meta.className}`}>
                                                                    {diagnosticLocked ? 'Diagnostic requis' : meta.label}
                                                                </span>
                                                                {status === 'BLOCKED' && <Lock size={13} className={selected ? 'text-white' : 'text-amber-600'} />}
                                                                {recommended && <Sparkles size={14} className={selected ? 'text-white' : 'text-emerald-600'} />}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </section>
                            ))}
                        </div>
                    )}
                </aside>

                <main className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    {diagnosticLocked ? (
                        <div className="p-8 text-center text-slate-500">
                            Passez le diagnostic initial pour debloquer le parcours du cours.
                        </div>
                    ) : selectedConcept ? (
                        <>
                            <div className="border-b border-slate-100 p-6">
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                                    <span>{selectedConcept.moduleTitle || 'Module'}</span>
                                    <span>/</span>
                                    <span>{selectedConcept.chapitreTitle || 'Chapitre'}</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800">{conceptLabel(selectedConcept)}</h2>
                                {selectedConcept.description && (
                                    <p className="mt-2 text-slate-500">{selectedConcept.description}</p>
                                )}
                                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
                                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                                        Ressource : {content?.htmlContent ? 'oui' : 'non'}
                                    </span>
                                    <span className={`rounded-lg border px-3 py-2 font-semibold ${conceptProgress.labSubmitted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                        TP soumis : {conceptProgress.labSubmitted ? 'oui' : 'non'}
                                    </span>
                                    <span className={`rounded-lg border px-3 py-2 font-semibold ${conceptProgress.quizPassed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                        Quiz reussi : {conceptProgress.quizPassed ? 'oui' : 'non'}
                                    </span>
                                    <span className={`rounded-lg border px-3 py-2 font-semibold ${statusMeta[selectedStatus]?.className || statusMeta.LEARNABLE.className}`}>
                                        Statut : {statusMeta[selectedStatus]?.label || 'A apprendre'}
                                    </span>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    {selectedBlocked && (
                                        <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                                            <Lock size={16} />
                                            Prerequis non maitrises
                                        </span>
                                    )}
                                    {!selectedBlocked && selectedLab?.id && (
                                        <Link
                                            to={`/student/lab/${selectedLab.id}`}
                                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                                        >
                                            {selectedStatus === 'MASTERED' ? 'Refaire le TP' : 'Realiser le TP'}
                                        </Link>
                                    )}
                                    {!selectedBlocked && !selectedLab?.id && (
                                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                                            Aucun TP disponible pour ce concept.
                                        </span>
                                    )}
                                    {canTakeFormative ? (
                                        <Link
                                            to={`/student/quiz/${selectedConcept.id}`}
                                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                        >
                                            <ClipboardList size={16} />
                                            Passer l'evaluation formative
                                        </Link>
                                    ) : !selectedBlocked && formativeEvaluation ? (
                                        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                                            <ClipboardList size={16} />
                                            Realisez d'abord le TP.
                                        </span>
                                    ) : !selectedBlocked ? (
                                        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                                            <ClipboardList size={16} />
                                            Aucune evaluation formative disponible pour ce concept.
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="p-6">
                                {contentLoading ? (
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Loader2 size={18} className="animate-spin" />
                                        Chargement du contenu...
                                    </div>
                                ) : content?.htmlContent ? (
                                    <div
                                        className="prose prose-slate max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-emerald-300"
                                        dangerouslySetInnerHTML={{ __html: content.htmlContent }}
                                    />
                                ) : displayedReviewConcepts.some(item => item.conceptId === selectedConcept.id) ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center text-amber-800">
                                        Vous devez reviser le concept non maitrise : {conceptLabel(selectedConcept)}. Aucune ressource n'est encore disponible.
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                                        Aucun contenu n'est encore associe a ce concept.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            Selectionnez un concept pour commencer.
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
