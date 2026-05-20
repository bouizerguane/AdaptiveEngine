import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardList, Loader2, Lock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { contentApi, courseApi, evaluationApi, graphApi, labApi, labTrackingApi, masteryApi, trackingApi, tutoringApi } from '../api/apiClient';
import { learnerApi } from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';
import { flattenConcepts, normalizeCourseTree } from '../utils/courseOrder';
import { normalizeResourceHtml } from '../utils/resourceHtml';

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
    FORMATIVE: 'Évaluation formative',
    REVIEW: 'Revision',
    CHALLENGE: 'Defi',
};

const tutoringEventFromAction = (nextAction) => {
    if (nextAction === 'REMEDIATION') return 'DIAGNOSTIC_FAILED';
    if (nextAction === 'COMPLETED') return 'CONCEPT_MASTERED';
    return 'GENERAL';
};

const actionLabels = {
    PASS_DIAGNOSTIC: 'Diagnostic requis',
    REMEDIATION: 'Revision',
    LEARN: 'Apprentissage',
    COMPLETED: 'Cours terminé',
};

const profileTypeLabels = {
    DATA_INSUFFICIENT: 'Données insuffisantes',
    NEEDS_REMEDIATION: 'Remédiation nécessaire',
    PROGRESSING: 'Progression active',
    HIGH_PERFORMING: 'Très bonne maîtrise',
};

const strategyTypeLabels = {
    RECOVERY: 'Approche de remédiation',
    SUPPORTIVE: 'Approche guidée',
    STANDARD: 'Approche standard',
    ADVANCED: 'Approche avancée',
};

const learningPathStatusMeta = {
    TO_REVIEW: {
        label: 'À revoir',
        dotClassName: 'bg-amber-500',
        badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
        cardClassName: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20',
    },
    READY: {
        label: 'Accessible',
        dotClassName: 'bg-indigo-500',
        badgeClassName: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200',
        cardClassName: 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/20',
    },
    LOCKED: {
        label: 'Verrouillé',
        dotClassName: 'bg-slate-400',
        badgeClassName: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
        cardClassName: 'border-slate-200 bg-slate-50 opacity-80 dark:border-slate-700 dark:bg-slate-800/60',
    },
    COMPLETED: {
        label: 'Maîtrisé',
        dotClassName: 'bg-emerald-500',
        badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
        cardClassName: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20',
    },
};

const pathFreshnessMessage = (pathFreshness) => {
    if (!pathFreshness?.refreshedAfterEvent) return null;
    if (pathFreshness.refreshReason === 'QUIZ_COMPLETED' || pathFreshness.lastEventType === 'quiz.completed') {
        return "Votre parcours a été mis à jour après l'évaluation.";
    }
    if (pathFreshness.refreshReason === 'LAB_SUBMITTED' || pathFreshness.lastEventType === 'lab.submitted') {
        return 'Votre parcours a été mis à jour après le TP.';
    }
    return pathFreshness.message || 'Votre parcours a été mis à jour après votre dernière activité.';
};

const numberOrNull = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const buildPedagogicalReasonBadges = ({
    adaptiveNextAction,
    adaptiveNextConcept,
    learnerProfile,
    learnerMasteryScore,
    pedagogicalStrategy,
    pathStep,
    mlSuccessProbability,
}) => {
    if (!adaptiveNextConcept) return [];

    const breakdown = adaptiveNextConcept.scoreBreakdown || {};
    const prerequisiteScore = numberOrNull(breakdown.prerequisiteScore);
    const repeatedFailuresCount = Number(pathStep?.repeatedFailuresCount || 0);
    const hasPersistentDifficulty = Boolean(pathStep?.persistentDifficulty) || repeatedFailuresCount >= 3;
    const isRemediation = adaptiveNextAction === 'REMEDIATION'
        || pedagogicalStrategy?.strategyType === 'RECOVERY'
        || pathStep?.status === 'TO_REVIEW';
    const highMasteryProgression = Boolean(pathStep?.highMasteryProgression);
    const highMastery = learnerProfile?.profileType === 'HIGH_PERFORMING'
        || (learnerMasteryScore !== null && learnerMasteryScore >= 80);

    const badges = [];

    if (hasPersistentDifficulty) {
        badges.push({
            key: 'persistent-difficulty',
            label: 'Difficultés détectées',
            message: 'Une révision ciblée est proposée pour renforcer vos acquis.',
            className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
        });
    }

    if (isRemediation) {
        badges.push({
            key: 'remediation',
            label: 'Remédiation recommandée',
            message: 'Certaines difficultés récentes suggèrent une consolidation avant de poursuivre.',
            className: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200',
        });
    }

    if (highMasteryProgression) {
        badges.push({
            key: 'high-mastery-progression',
            label: 'Progression accélérée contrôlée',
            message: 'Votre niveau actuel permet une progression plus soutenue tout en respectant les prérequis pédagogiques.',
            className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
        });
    }

    if (prerequisiteScore !== null && prerequisiteScore >= 0.5) {
        badges.push({
            key: 'prerequisites',
            label: 'Prérequis validés',
            message: 'Le concept recommandé est accessible dans votre parcours actuel.',
            className: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200',
        });
    }

    if (highMastery) {
        badges.push({
            key: 'mastery',
            label: 'Niveau de maîtrise élevé',
            message: 'Votre profil montre une bonne maîtrise des activités déjà réalisées.',
            className: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200',
        });
    }

    if (mlSuccessProbability !== null) {
        badges.push({
            key: 'ml',
            label: 'Signal ML expérimental',
            message: `Probabilité estimée de réussite : ${mlSuccessProbability}%.`,
            className: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200',
        });
    }

    return badges;
};

const tabs = [
    { id: 'course', label: 'Cours' },
    { id: 'adaptive', label: 'Parcours adaptatif' },
    { id: 'remediation', label: 'Remédiation' },
    { id: 'evaluations', label: 'Évaluations' },
    { id: 'progress', label: 'Progression' },
];

const adaptiveRefreshKey = (courseId) => `adaptive-refresh:${courseId}`;

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
    const [diagnostic, setDiagnostic] = useState(null);
    const [courseValidation, setCourseValidation] = useState(null);
    const [courseValidationTrace, setCourseValidationTrace] = useState(null);
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
    const [strategyTutoringFeedback, setStrategyTutoringFeedback] = useState(null);
    const [activeTab, setActiveTab] = useState('course');
    const [refreshNonce, setRefreshNonce] = useState(0);

    const concepts = useMemo(() => flattenConcepts(course), [course]);

    const consumeAdaptiveRefreshMarker = useCallback(() => {
        if (!courseId) return false;
        const key = adaptiveRefreshKey(courseId);
        const pending = sessionStorage.getItem(key);
        if (!pending) return false;
        sessionStorage.removeItem(key);
        setRefreshNonce(value => value + 1);
        window.setTimeout(() => setRefreshNonce(value => value + 1), 900);
        return true;
    }, [courseId]);

    const loadCourse = useCallback(async () => {
        setLoading(true);
        try {
                const [courseRes, recommendationRes, adaptivePathRes, diagnosticsRes, statusesRes, evaluationsRes] = await Promise.all([
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
                    evaluationApi.getCourseEvaluations(courseId).catch(() => ({ data: [] })),
                ]);
                const tree = normalizeCourseTree(courseRes.data);
                const diagnostics = diagnosticsRes.data || [];
                const evaluations = evaluationsRes.data || [];
                const initialDiagnostic = diagnostics.find(item => item.typeEvaluation === 'DIAGNOSTIC_ENTREE')
                    || diagnostics.find(item => item.typeEvaluation === 'DIAGNOSTIC_POSITIONNEMENT')
                    || null;
                const validationEvaluation = evaluations.find(item =>
                    (item.typeEvaluation === 'VALIDATION_COURS' || item.typeEvaluation === 'VALIDATION')
                    && ((item.targetType || 'COURSE') === 'COURSE')
                    && (item.targetId === courseId || item.courseId === courseId)
                ) || null;
                const statusMap = Object.fromEntries((statusesRes.data || []).map(item => [item.conceptId, item]));
                setCourse(tree);
                setRecommendation(recommendationRes.data);
                setAdaptivePath(adaptivePathRes.data);
                setDiagnostic(initialDiagnostic);
                setCourseValidation(validationEvaluation);
                setConceptStatuses(statusMap);
                if (validationEvaluation?.id && user?.email) {
                    const validationTraceRes = await trackingApi
                        .getTracesByUserAndEvaluation(user.email, validationEvaluation.id)
                        .catch(() => ({ data: [] }));
                    const traces = validationTraceRes.data || [];
                    setCourseValidationTrace(traces[traces.length - 1] || null);
                } else {
                    setCourseValidationTrace(null);
                }
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
                            evaluationApi.getEvaluation(result.conceptId, 'FORMATIVE').then(response => response.data).catch(() => null),
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
    }, [courseId, user?.email, searchParams]);

    useEffect(() => {
        loadCourse();
    }, [loadCourse, refreshNonce]);

    useEffect(() => {
        consumeAdaptiveRefreshMarker();
    }, [consumeAdaptiveRefreshMarker]);

    useEffect(() => {
        const onReturnToPage = () => {
            if (document.visibilityState === 'visible') {
                consumeAdaptiveRefreshMarker();
            }
        };
        window.addEventListener('focus', consumeAdaptiveRefreshMarker);
        window.addEventListener('pageshow', consumeAdaptiveRefreshMarker);
        document.addEventListener('visibilitychange', onReturnToPage);
        return () => {
            window.removeEventListener('focus', consumeAdaptiveRefreshMarker);
            window.removeEventListener('pageshow', consumeAdaptiveRefreshMarker);
            document.removeEventListener('visibilitychange', onReturnToPage);
        };
    }, [consumeAdaptiveRefreshMarker]);

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
            evaluationApi.getEvaluation(selectedConcept.id, 'FORMATIVE').then(response => response.data).catch(() => null),
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

    useEffect(() => {
        const strategy = adaptivePath?.pedagogicalStrategy;
        if (!strategy || !user?.email) {
            setStrategyTutoringFeedback(null);
            return;
        }

        tutoringApi.getFeedback({
            eventType: tutoringEventFromAction(adaptivePath.nextAction),
            learnerEmail: user.email,
            courseId,
            courseTitle: course?.title,
            conceptId: adaptivePath.nextConcept?.conceptId,
            conceptName: adaptivePath.nextConcept?.conceptName,
            strategyType: strategy.strategyType,
            nextAction: adaptivePath.nextAction,
            profileType: adaptivePath.learnerProfile?.profileType,
            masteryScore: adaptivePath.learnerProfile?.masteryScore,
            knowledgeGaps: adaptivePath.learnerProfile?.knowledgeGaps || [],
            recommendedSequence: strategy.recommendedSequence || [],
            tutoringMessageHint: strategy.tutoringMessageHint,
        })
            .then(response => setStrategyTutoringFeedback(response.data))
            .catch(() => setStrategyTutoringFeedback(null));
    }, [adaptivePath, course?.title, courseId, user?.email]);

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
    const mlSuccessProbability = adaptiveScorePercent(adaptiveNextConcept?.mlSuccessProbability);
    const mlEnhancedScore = adaptiveScorePercent(adaptiveNextConcept?.mlEnhancedScore);
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
    const freshnessMessage = pathFreshnessMessage(adaptivePath?.pathFreshness);
    const recommendedLearningPath = Array.isArray(adaptivePath?.recommendedLearningPath)
        ? adaptivePath.recommendedLearningPath
        : [];
    const adaptiveNextPathStep = adaptiveNextConceptId
        ? recommendedLearningPath.find(step => step.conceptId === adaptiveNextConceptId)
        : null;
    const pedagogicalReasonBadges = buildPedagogicalReasonBadges({
        adaptiveNextAction,
        adaptiveNextConcept,
        learnerProfile,
        learnerMasteryScore,
        pedagogicalStrategy,
        pathStep: adaptiveNextPathStep,
        mlSuccessProbability,
    });
    const hasExplainableRecommendation = Boolean(adaptiveNextConcept)
        && (
            Boolean(adaptivePath?.decisionExplanation)
            || adaptiveExplanationReasons.length > 0
            || pedagogicalReasonBadges.length > 0
        );
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
    const adaptiveInternalReviews = (adaptivePath?.conceptsToReview || []).filter(item => item.type !== 'EXTERNAL');
    const displayedReviewConcepts = adaptiveInternalReviews.length > 0
        ? adaptiveInternalReviews.map(item => ({
            conceptId: item.conceptId,
            conceptName: item.conceptName,
            score: item.score,
        }))
        : failedDiagnosticConcepts;
    const masteredConceptCount = concepts.filter(concept => effectiveConceptStatuses[concept.id]?.status === 'MASTERED').length;
    const learnableConceptCount = concepts.filter(concept => effectiveConceptStatuses[concept.id]?.status === 'LEARNABLE').length;
    const blockedConceptCount = concepts.filter(concept => effectiveConceptStatuses[concept.id]?.status === 'BLOCKED').length;
    const globalProgressPercent = concepts.length > 0 ? Math.round((masteredConceptCount / concepts.length) * 100) : 0;
    const hasRemediationItems = displayedReviewConcepts.length > 0
        || externalDiagnosticResults.filter(item => !item.mastered).length > 0
        || externalConceptPrerequisites.length > 0
        || remediations.length > 0;
    const allConceptsMastered = concepts.length > 0 && masteredConceptCount === concepts.length;
    const courseCompleted = adaptiveNextAction === 'COMPLETED' || allConceptsMastered;
    const validationScore = courseValidationTrace?.scoreObtenu;
    const validationPassed = validationScore !== undefined
        ? Number(validationScore) >= Number(courseValidation?.seuilReussite || 70)
        : false;

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

                {activeTab === 'course' && adaptiveNextAction === 'LEARN' && adaptiveNextConceptType === 'INTERNAL' && (
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

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex min-w-max gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                                activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'course' && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{course.title || 'Cours sans titre'}</h2>
                            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{course.description || 'Aucune description disponible.'}</p>
                        </div>
                        <div className="min-w-[180px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">Progression globale</p>
                            <p className="mt-1 text-2xl font-bold text-indigo-600">{globalProgressPercent}%</p>
                            <p className="text-xs text-slate-500">{masteredConceptCount}/{concepts.length} concepts maîtrisés</p>
                        </div>
                    </div>
                    {adaptivePath?.decisionExplanation && (
                        <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                            {courseCompleted ? 'Cours terminé.' : adaptivePath.decisionExplanation}
                        </p>
                    )}
                </div>
            )}

            {activeTab === 'adaptive' && (
                <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Votre accompagnement personnalise</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Les informations ci-dessous regroupent la recommandation, votre situation actuelle et le conseil d'accompagnement.
                        </p>
                        {freshnessMessage && (
                            <p className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                                {freshnessMessage}
                            </p>
                        )}
                    </div>

                    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Prochaine étape</p>
                        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{actionLabels[adaptiveNextAction] || 'Parcours en cours'}</p>
                                <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">
                                    {adaptiveNextConcept ? adaptiveNextConceptName : courseCompleted ? 'Cours terminé' : 'Aucune recommandation disponible'}
                                </p>
                                {adaptiveNextScore !== null && (
                                    <p className="mt-1 text-sm font-semibold text-emerald-700">Score adaptatif : {adaptiveNextScore}%</p>
                                )}
                                {mlSuccessProbability !== null && (
                                    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-100">
                                        <p className="font-bold">Signal ML</p>
                                        <p className="mt-1">Probabilité estimée de réussite : {mlSuccessProbability}%</p>
                                        {mlEnhancedScore !== null && (
                                            <p className="mt-1 text-xs font-semibold">Score combiné expérimental : {mlEnhancedScore}%</p>
                                        )}
                                        <p className="mt-1 text-xs">
                                            Ce score est expérimental et utilisé uniquement comme aide à la décision.
                                        </p>
                                    </div>
                                )}
                            </div>
                            {adaptiveNextAction === 'PASS_DIAGNOSTIC' && diagnostic?.targetId && (
                                <Link to={`/student/quiz/${diagnostic.targetId}`} className="inline-flex w-fit items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                                    <ClipboardList size={16} />
                                    Passer le diagnostic
                                </Link>
                            )}
                            {adaptiveNextConcept && adaptiveNextConceptType === 'EXTERNAL' && (
                                <Link to={`/learner/external-concepts/${adaptiveNextConceptId}?sourceCourseId=${courseId}`} className="inline-flex w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                                    Ouvrir le prérequis
                                </Link>
                            )}
                            {adaptiveNextConcept && adaptiveNextConceptType !== 'EXTERNAL' && (
                                <button
                                    onClick={() => {
                                        const concept = concepts.find(item => item.id === adaptiveNextConceptId);
                                        if (concept) {
                                            setSelectedConcept(concept);
                                            setActiveTab('course');
                                        }
                                    }}
                                    className="inline-flex w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                                >
                                    Ouvrir le concept
                                </button>
                            )}
                        </div>
                    </section>

                    {hasExplainableRecommendation && (
                        <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Pourquoi cette recommandation ?</p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Cette synthèse traduit les signaux du moteur en repères pédagogiques simples.
                                    </p>
                                </div>
                                {adaptiveNextScore !== null && (
                                    <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                                        Score adaptatif : {adaptiveNextScore}%
                                    </span>
                                )}
                            </div>

                            {pedagogicalReasonBadges.length > 0 && (
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    {pedagogicalReasonBadges.map(reason => (
                                        <div key={reason.key} className={`rounded-lg border p-3 ${reason.className}`}>
                                            <div className="flex items-center gap-2 text-sm font-bold">
                                                <CheckCircle2 size={16} />
                                                <span>{reason.label}</span>
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed">{reason.message}</p>
                                            {reason.key === 'ml' && (
                                                <p className="mt-2 text-xs leading-relaxed">
                                                    Ce signal prédictif reste expérimental : il aide à comparer les recommandations, mais ne remplace pas la logique pédagogique principale.
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {adaptivePath?.decisionExplanation && (
                                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    <p className="font-bold text-slate-800 dark:text-slate-100">Explication du parcours</p>
                                    <p className="mt-1">{adaptivePath.decisionExplanation}</p>
                                </div>
                            )}

                            {adaptiveExplanationReasons.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Raisons détaillées</p>
                                    <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                        {adaptiveExplanationReasons.map(reason => (
                                            <li key={reason}>- {reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Parcours personnalisé</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Une vue ordonnée des étapes du cours selon votre situation actuelle.
                                </p>
                            </div>
                            {recommendedLearningPath.length > 0 && (
                                <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {recommendedLearningPath.length} étape{recommendedLearningPath.length > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {recommendedLearningPath.length > 0 ? (
                            <ol className="mt-4 space-y-3">
                                {recommendedLearningPath.map((step, index) => {
                                    const meta = learningPathStatusMeta[step.status] || {
                                        label: step.status || 'Étape',
                                        dotClassName: 'bg-slate-400',
                                        badgeClassName: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
                                        cardClassName: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                                    };
                                    const score = adaptiveScorePercent(step.adaptiveScore);
                                    const reasons = Array.isArray(step.explanationReasons) ? step.explanationReasons.filter(Boolean) : [];
                                    return (
                                        <li key={`${step.conceptId || step.conceptName || 'step'}-${step.order || index}`} className="relative pl-8">
                                            {index < recommendedLearningPath.length - 1 && (
                                                <span className="absolute left-[11px] top-7 h-[calc(100%-1rem)] w-px bg-slate-200 dark:bg-slate-700" />
                                            )}
                                            <span className={`absolute left-0 top-4 h-6 w-6 rounded-full border-4 border-white shadow-sm dark:border-slate-900 ${meta.dotClassName}`} />
                                            <div className={`rounded-lg border p-4 ${meta.cardClassName}`}>
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                            {step.order || index + 1}. {step.conceptName || 'Concept sans titre'}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${meta.badgeClassName}`}>
                                                                {meta.label}
                                                            </span>
                                                            {score !== null && (
                                                                <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-slate-900 dark:text-emerald-200">
                                                                    Score adaptatif : {score}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {reasons.length > 0 ? (
                                                    <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                                        {reasons.map((reason, reasonIndex) => (
                                                            <li key={`${step.conceptId || step.order || index}-reason-${reasonIndex}`}>- {reason}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                                        Aucune explication détaillée n'est disponible pour cette étape.
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        ) : (
                            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                Le parcours personnalisé sera affiché dès que le moteur aura suffisamment d'informations.
                            </p>
                        )}
                    </section>

                    <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Votre situation actuelle</p>
                        {learnerProfile ? (
                            <>
                                <p className="mt-2 text-sm font-semibold text-indigo-700">
                                    {profileTypeLabels[learnerProfile.profileType] || "Situation en cours d'analyse"}
                                </p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{learnerProfile.profileExplanation}</p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    {learnerMasteryScore !== null && Number.isFinite(learnerMasteryScore) && (
                                        <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Maîtrise : {learnerMasteryScore}%</span>
                                    )}
                                    <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Activités : {learnerProfile.tracesCount ?? 0}</span>
                                    <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">TP completes : {learnerProfile.completedLabsCount ?? 0}</span>
                                    <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Temps : {Math.round((learnerProfile.totalLearningTime || 0) / 60)} min</span>
                                </div>
                                {learnerProfileGaps.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {learnerProfileGaps.map(gap => (
                                            <span key={gap} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{gap}</span>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="mt-2 text-sm text-slate-500">Votre situation sera précisée après les premières activités.</p>
                        )}
                    </section>

                    <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Approche recommandée</p>
                        <p className="mt-2 text-sm font-semibold text-emerald-700">
                            {strategyTypeLabels[pedagogicalStrategy?.strategyType] || 'Approche standard'}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{pedagogicalStrategy?.strategyExplanation || 'Une progression normale est proposée pour ce cours.'}</p>
                        {pedagogicalSequence.length > 0 && (
                            <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {pedagogicalSequence.map((step, index) => (
                                    <li key={`${step}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {index + 1}. {strategyStepLabels[step] || step}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>

                    <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Conseil personnalise</p>
                        {strategyTutoringFeedback ? (
                            <div className="mt-2 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                <p>{strategyTutoringFeedback.message}</p>
                                {strategyTutoringFeedback.motivationalMessage && (
                                    <p className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-800">{strategyTutoringFeedback.motivationalMessage}</p>
                                )}
                                {Array.isArray(strategyTutoringFeedback.recommendedActions) && strategyTutoringFeedback.recommendedActions.length > 0 && (
                                    <ul className="space-y-1">
                                        {strategyTutoringFeedback.recommendedActions.map(action => (
                                            <li key={action}>- {action}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-slate-500">{pedagogicalStrategy?.tutoringMessageHint || 'Le conseil personnalisé apparaîtra lorsque le service de tutorat sera disponible.'}</p>
                        )}
                    </section>
                </div>
            )}

            {activeTab === 'evaluations' && !diagnosticLocked && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">Diagnostic initial</p>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">
                                {diagnosticDone
                                    ? 'Diagnostic effectué. Le parcours peut utiliser vos résultats pour proposer la suite.'
                                    : 'Le diagnostic initial doit être passé avant de commencer le parcours.'}
                            </p>
                        </div>
                        {diagnostic?.targetId && (
                            <Link to={`/student/quiz/${diagnostic.targetId}${diagnosticDone ? '?retake=1' : ''}`} className="inline-flex w-fit items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                                <ClipboardList size={15} />
                                {diagnosticDone ? 'Repasser le diagnostic' : 'Passer le diagnostic'}
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'evaluations' && selectedConcept && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">Évaluation formative</p>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">
                                {formativeEvaluation
                                    ? `Évaluation disponible pour ${conceptLabel(selectedConcept)}.`
                                    : `Aucune évaluation formative disponible pour ${conceptLabel(selectedConcept)}.`}
                            </p>
                            {formativeEvaluation && !canTakeFormative && !selectedBlocked && (
                                <p className="mt-1 text-xs font-semibold text-amber-700">Réalisez d'abord le TP associé au concept.</p>
                            )}
                        </div>
                        {formativeEvaluation && canTakeFormative && (
                            <Link to={`/student/quiz/${selectedConcept.id}`} className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                                <ClipboardList size={15} />
                                Passer l'évaluation
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'evaluations' && !diagnosticLocked && (
                <div className={`rounded-lg border p-5 text-sm shadow-sm ${
                    courseCompleted ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'
                }`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="font-bold text-slate-800">Validation finale du cours</p>
                            <p className="mt-1 text-slate-600">
                                {courseCompleted
                                    ? 'Tous les concepts requis sont maîtrisés. Vous pouvez passer la validation finale du cours.'
                                    : `${masteredConceptCount}/${concepts.length} concepts maîtrisés. La validation finale sera accessible une fois le parcours terminé.`}
                            </p>
                            {courseValidationTrace && (
                                <p className={`mt-2 font-semibold ${validationPassed ? 'text-emerald-700' : 'text-red-700'}`}>
                                    Dernier score final : {validationScore}% - {validationPassed ? 'réussite' : 'échec'}
                                </p>
                            )}
                        </div>
                        {courseValidation?.targetId ? (
                            courseCompleted ? (
                                <Link
                                    to={`/student/quiz/${courseValidation.targetId}?typeEvaluation=${encodeURIComponent(courseValidation.typeEvaluation || 'VALIDATION_COURS')}`}
                                    className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                                >
                                    <ClipboardList size={15} />
                                    Passer la validation
                                </Link>
                            ) : (
                                <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                                    <Lock size={14} />
                                    Verrouillee
                                </span>
                            )
                        ) : (
                            <span className="inline-flex w-fit rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
                                Aucune validation finale configurée.
                            </span>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'evaluations' && diagnosticLocked ? (
                <div className="rounded-lg border border-indigo-200 bg-white p-8 text-center shadow-sm">
                    <ClipboardList className="mx-auto mb-3 text-indigo-600" size={42} />
                    <h2 className="text-xl font-bold text-slate-800">Diagnostic initial</h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                        Passez le diagnostic initial pour identifier les concepts déjà maîtrisés et obtenir votre premier parcours personnalisé.
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
            ) : activeTab === 'adaptive' && diagnostic && diagnosticDone && !adaptivePath && recommendation?.conceptId ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                    <p className="font-bold">Votre parcours personnalisé</p>
                    <p className="mt-1">Premier concept recommandé : {recommendation.label}</p>
                </div>
            ) : null}

            {activeTab === 'remediation' && diagnostic && diagnosticDone && displayedReviewConcepts.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h2 className="font-bold text-amber-900">Concepts a reviser</h2>
                            <p className="mt-1 text-amber-800">Le test est passé. Le parcours reste orienté vers les lacunes détectées.</p>
                        </div>
                        {canRetakeDiagnostic ? (
                            <Link to={`/student/quiz/${diagnostic.targetId}?retake=1`} className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800">
                                Repasser le test de positionnement
                            </Link>
                        ) : (
                            <span className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-amber-800 border border-amber-200">
                                Vous pourrez repasser le test lorsque les concepts non maîtrisés seront maîtrisés.
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
                                        {masteredNow ? 'Maintenant maîtrisé' : 'Encore à travailler'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'remediation' && diagnostic && diagnosticDone && externalDiagnosticResults.filter(item => !item.mastered).length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    <p className="font-bold text-slate-800">Prérequis externes à revoir</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {externalDiagnosticResults.filter(item => !item.mastered).map(item => (
                            <span key={item.label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                                Revisez : {item.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'remediation' && diagnostic && diagnosticDone && externalConceptPrerequisites.length > 0 && (
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

            {activeTab === 'remediation' && remediations.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                    <h2 className="font-bold text-amber-900">Remédiation recommandée</h2>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {remediations.map(item => (
                            <div key={item.conceptId} className="rounded-lg border border-amber-200 bg-white p-4 text-sm">
                                <p className="font-bold text-slate-800">{conceptLabel(item.concept)}</p>
                                <p className="mt-1 text-slate-500">Score diagnostic : {item.score}%</p>
                                {tutoringFeedbacks[item.conceptId] && (
                                    <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-900">
                                        <p className="font-semibold">Conseil de revision</p>
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
                                        Évaluation formative
                                    </Link>
                                </div>
                                {!item.hasContent && !item.lab?.id && (
                                    <p className="mt-3 text-xs text-slate-500">Aucune ressource de remédiation disponible pour ce concept.</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'remediation' && !hasRemediationItems && (
                <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    Aucune remédiation n'est nécessaire pour le moment.
                </div>
            )}

            {activeTab === 'progress' && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Progression</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <span className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-semibold text-slate-500">Progression globale</p>
                            <p className="mt-1 text-2xl font-bold text-indigo-600">{globalProgressPercent}%</p>
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-semibold text-slate-500">Concepts maîtrisés</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-600">{masteredConceptCount}</p>
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-semibold text-slate-500">Concepts a apprendre</p>
                            <p className="mt-1 text-2xl font-bold text-indigo-600">{learnableConceptCount}</p>
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-semibold text-slate-500">Concepts bloqués</p>
                            <p className="mt-1 text-2xl font-bold text-amber-600">{blockedConceptCount}</p>
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-semibold text-slate-500">Traces</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{learnerProfile?.tracesCount ?? 0}</p>
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-semibold text-slate-500">TP completes</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{learnerProfile?.completedLabsCount ?? 0}</p>
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-semibold text-slate-500">Score moyen</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                                {learnerProfile?.averageAssessmentScore !== null && learnerProfile?.averageAssessmentScore !== undefined
                                    ? `${Math.round(Number(learnerProfile.averageAssessmentScore))}%`
                                    : '-'}
                            </p>
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-semibold text-slate-500">Temps total</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{Math.round((learnerProfile?.totalLearningTime || 0) / 60)} min</p>
                        </span>
                    </div>
                </div>
            )}

            {activeTab === 'course' && <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
                <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-800">
                        <BookOpen size={18} />
                        Plan du cours
                    </h2>

                    {concepts.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucun module, chapitre ou concept n'est encore associé à ce cours.</p>
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
                                                            title={diagnosticLocked ? 'Diagnostic initial requis' : blocked ? 'Prérequis non maîtrisés' : undefined}
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
                            Passez le diagnostic initial pour débloquer le parcours du cours.
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
                                        Quiz réussi : {conceptProgress.quizPassed ? 'oui' : 'non'}
                                    </span>
                                    <span className={`rounded-lg border px-3 py-2 font-semibold ${statusMeta[selectedStatus]?.className || statusMeta.LEARNABLE.className}`}>
                                        Statut : {statusMeta[selectedStatus]?.label || 'A apprendre'}
                                    </span>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    {selectedBlocked && (
                                        <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                                            <Lock size={16} />
                                            Prérequis non maîtrisés
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
                                            Passer l'évaluation formative
                                        </Link>
                                    ) : !selectedBlocked && formativeEvaluation ? (
                                        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                                            <ClipboardList size={16} />
                                            Realisez d'abord le TP.
                                        </span>
                                    ) : !selectedBlocked ? (
                                        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                                            <ClipboardList size={16} />
                                            Aucune évaluation formative disponible pour ce concept.
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
                                        dangerouslySetInnerHTML={{ __html: normalizeResourceHtml(content.htmlContent) }}
                                    />
                                ) : displayedReviewConcepts.some(item => item.conceptId === selectedConcept.id) ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center text-amber-800">
                                        Vous devez réviser le concept non maîtrisé : {conceptLabel(selectedConcept)}. Aucune ressource n'est encore disponible.
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                                        Aucun contenu n'est encore associé à ce concept.
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
            </div>}
        </div>
    );
}
