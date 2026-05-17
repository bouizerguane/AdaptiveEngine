import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { contentApi, evaluationApi, trackingApi, masteryApi, adaptiveApi, courseApi, graphApi } from '../api/apiClient';
import { learnerApi } from '../api/learnerApi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import CustomDialog from '../components/CustomDialog';
import {
    ClipboardList, CheckCircle, XCircle, Timer, Loader2,
    AlertTriangle, Lightbulb, ChevronLeft, ChevronRight, Send, Lock
} from 'lucide-react';

/* ─── Helpers ─── */
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const pad = (n) => String(n).padStart(2, '0');
const formatTime = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const getConceptTitle = (concept) => concept?.labelPedagogique || concept?.title || concept?.name || concept?.libelle || concept?.label || '';
const collectConceptNames = (course) => {
    const names = {};
    (course?.modules || []).forEach(module => {
        (module.chapitres || []).forEach(chapitre => {
            (chapitre.concepts || []).forEach(concept => {
                if (concept?.id) names[concept.id] = getConceptTitle(concept);
            });
        });
    });
    return names;
};

const evaluationLabels = {
    DIAGNOSTIC_ENTREE: 'Diagnostic initial',
    DIAGNOSTIC_POSITIONNEMENT: 'Diagnostic de positionnement',
    FORMATIVE: 'Evaluation formative',
    VALIDATION: 'Validation finale',
};

const difficultyLabels = {
    EASY: 'Facile',
    MEDIUM: 'Moyen',
    HARD: 'Avance',
};

export default function StudentQuiz() {
    const { targetId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    /* ─── State ─── */
    const [evaluation, setEvaluation] = useState(null);
    const [questions, setQuestions] = useState([]);  // potentially shuffled
    const [loading, setLoading] = useState(true);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState({});       // { questionIdx: answer }
    const [revealedHints, setRevealedHints] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [conceptNameMap, setConceptNameMap] = useState({});
    const [context, setContext] = useState({ courseId: '', courseTitle: '', conceptTitle: '' });
    const [diagnosticAlreadyPassed, setDiagnosticAlreadyPassed] = useState(false);
    const [validationLocked, setValidationLocked] = useState(false);
    const [validationProgress, setValidationProgress] = useState({ mastered: 0, total: 0 });

    /* ─── Tracking refs ─── */
    const startTimeRef = useRef(Date.now());
    const tabSwitchesRef = useRef(0);
    const timerRef = useRef(null);
    const [timeLeft, setTimeLeft] = useState(null);   // seconds, null = no limit
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

    /* ─── Load Evaluation ─── */
    useEffect(() => {
        evaluationApi.getEvaluation(targetId)
            .then(r => {
                const ev = r.data;
                setEvaluation(ev);
                const bank = ev.questions || [];
                const n    = ev.nbQuestionsATirer || 0;   // 0 = toutes

                let drawn;
                if (n > 0 && n < bank.length) {
                    if (ev.equilibrerDifficulte) {
                        // Tirage stratifié : répartition proportionnelle F/M/D
                        const byLevel = { EASY: [], MEDIUM: [], HARD: [] };
                        bank.forEach(q => { (byLevel[q.difficulty] || byLevel.MEDIUM).push(q); });
                        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
                        const quotaFor = (levelCount) => Math.max(0, Math.round((levelCount / bank.length) * n));

                        let picked = [];
                        ['EASY', 'MEDIUM', 'HARD'].forEach(lvl => {
                            const quota = quotaFor(byLevel[lvl].length);
                            picked = [...picked, ...shuffle(byLevel[lvl]).slice(0, quota)];
                        });
                        // Ajustement si l'arrondi n'atteint pas n exactement
                        if (picked.length < n) {
                            const rest = shuffle(bank.filter(q => !picked.includes(q)));
                            picked = [...picked, ...rest.slice(0, n - picked.length)];
                        }
                        drawn = shuffle(picked.slice(0, n));
                    } else {
                        drawn = [...bank].sort(() => Math.random() - 0.5).slice(0, n);
                    }
                } else {
                    drawn = ev.shuffleQuestions ? [...bank].sort(() => Math.random() - 0.5) : bank;
                }

                setQuestions(drawn);
                if (ev.tempsImparti > 0) setTimeLeft(ev.tempsImparti * 60);
                startTimeRef.current = Date.now();
                const isInitialDiagnostic = ['DIAGNOSTIC_ENTREE', 'DIAGNOSTIC_POSITIONNEMENT'].includes(ev.typeEvaluation);
                const courseId = ev.courseId || (ev.targetType === 'COURSE' ? ev.targetId : null);
                if (isInitialDiagnostic && user?.email && courseId && searchParams.get('retake') !== '1') {
                    trackingApi.getLatestDiagnostic(user.email, courseId)
                        .then(response => {
                            setDiagnosticAlreadyPassed(!!response.data?.idTrace);
                        })
                        .catch(() => {
                            setDiagnosticAlreadyPassed(false);
                        });
                } else {
                    setDiagnosticAlreadyPassed(false);
                }
                if (courseId) {
                    Promise.all([
                        courseApi.getCourseTree(courseId).then(response => response.data).catch(() => null),
                        graphApi.getCoursePrerequisiteConcepts(courseId).then(response => response.data || []).catch(() => []),
                        user?.email
                            ? learnerApi.getLearningStatus(user.email, courseId).then(response => response.data || []).catch(() => [])
                            : Promise.resolve([]),
                    ]).then(([courseTree, prerequisiteConcepts, learningStatuses]) => {
                        const names = collectConceptNames(courseTree);
                        prerequisiteConcepts.forEach(concept => {
                            if (concept?.id) names[concept.id] = getConceptTitle(concept);
                        });
                        const courseConceptIds = Object.keys(collectConceptNames(courseTree));
                        const masteredCount = (learningStatuses || []).filter(item => item.status === 'MASTERED').length;
                        const courseValidation = ev.typeEvaluation === 'VALIDATION' && (ev.targetType || 'COURSE') === 'COURSE';
                        setValidationProgress({ mastered: masteredCount, total: courseConceptIds.length });
                        setValidationLocked(Boolean(
                            courseValidation
                            && user?.role === 'ROLE_STUDENT'
                            && courseConceptIds.length > 0
                            && masteredCount < courseConceptIds.length
                        ));
                        setConceptNameMap(names);
                        setContext({
                            courseId,
                            courseTitle: courseTree?.title || '',
                            conceptTitle: names[ev.targetId] || names[drawn.find(question => question.conceptId)?.conceptId] || '',
                        });
                    });
                } else if ((ev.targetType || 'CONCEPT') === 'CONCEPT') {
                    setContext(previous => ({ ...previous, conceptTitle: conceptNameMap[ev.targetId] || '' }));
                    setValidationLocked(false);
                }
            })
            .catch(() => toast.error('Impossible de charger l\'évaluation.'))
            .finally(() => setLoading(false));
    }, [targetId, user?.email, searchParams]);

    /* ─── Anti-Triche: Blur Detection ─── */
    useEffect(() => {
        if (!evaluation || submitted || evaluation.typeEvaluation !== 'VALIDATION') return;
        const handleBlur = () => { 
            tabSwitchesRef.current += 1; 
            setDialogConfig({ isOpen: true, type: 'warning', title: 'Action non autorisée', message: 'Attention, vous avez quitté la page de l\'évaluation ! Cette action a été enregistrée et peut affecter votre résultat.' });
        };
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, [evaluation, submitted]);

    /* ─── Countdown Timer ─── */
    useEffect(() => {
        if (timeLeft === null || submitted) return;
        if (timeLeft <= 0) { handleSubmit(true); return; }
        timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [timeLeft, submitted]);

    /* ─── Submit Handler ─── */
    const handleSubmit = useCallback(async (autoSubmit = false) => {
        if (submitted || submitting || !evaluation) return;
        clearTimeout(timerRef.current);

        if (!autoSubmit) {
            const unanswered = questions.findIndex((_, i) => answers[i] === undefined);
            if (unanswered !== -1) return toast.error(`Veuillez répondre à la question ${unanswered + 1}.`);
        }

        setSubmitting(true);
        const correct = questions.filter((q, i) => answers[i] === q.correctAnswer).length;
        const total = questions.length;
        const scoreObtenu = total > 0 ? Math.round((correct / total) * 100) : 0;
        // Pour DIAGNOSTIC_POSITIONNEMENT, utiliser seuilDeSaut s'il est défini
        const seuil = (evaluation.typeEvaluation === 'DIAGNOSTIC_POSITIONNEMENT' && evaluation.seuilDeSaut != null)
            ? evaluation.seuilDeSaut
            : evaluation.seuilReussite;
        const passed = scoreObtenu >= seuil;
        const tempsConsultation = Math.round((Date.now() - startTimeRef.current) / 1000);

        const feedbackGenere = passed
            ? `✅ Réussi ! Score : ${scoreObtenu}% (seuil : ${evaluation.seuilReussite}%).`
            : `❌ Insuffisant. Score : ${scoreObtenu}% (seuil : ${evaluation.seuilReussite}%). ${evaluation.remediationResourceId ? 'Une ressource de remédiation est disponible.' : 'Révisez et réessayez.'}`;

        const userId = user?.email || 'anonymous';
        const isDiagnostic = ['DIAGNOSTIC_ENTREE', 'DIAGNOSTIC_POSITIONNEMENT'].includes(evaluation.typeEvaluation);
        const courseId = evaluation.courseId || (evaluation.targetType === 'COURSE' ? evaluation.targetId : null);
        const conceptBuckets = questions.reduce((acc, question, index) => {
            const conceptId = question.conceptId || ((evaluation.targetType || 'CONCEPT') === 'CONCEPT' ? evaluation.targetId : null);
            if (!conceptId) return acc;
            if (!acc[conceptId]) acc[conceptId] = { conceptId, totalQuestions: 0, correctAnswers: 0 };
            acc[conceptId].totalQuestions += 1;
            if (answers[index] === question.correctAnswer) acc[conceptId].correctAnswers += 1;
            return acc;
        }, {});
        const conceptResults = Object.values(conceptBuckets).map(result => {
            const score = result.totalQuestions > 0 ? Math.round((result.correctAnswers / result.totalQuestions) * 100) : 0;
            return { ...result, score, mastered: score >= evaluation.seuilReussite };
        });
        const externalBuckets = questions.reduce((acc, question, index) => {
            const label = question.externalPrerequisiteLabel?.trim() || (question.generalQuestion ? 'Question generale sans concept' : '');
            if (!label || question.conceptId) return acc;
            if (!acc[label]) acc[label] = { label, totalQuestions: 0, correctAnswers: 0 };
            acc[label].totalQuestions += 1;
            if (answers[index] === question.correctAnswer) acc[label].correctAnswers += 1;
            return acc;
        }, {});
        const externalPrerequisiteResults = Object.values(externalBuckets).map(result => {
            const score = result.totalQuestions > 0 ? Math.round((result.correctAnswers / result.totalQuestions) * 100) : 0;
            return { ...result, score, mastered: score >= evaluation.seuilReussite };
        });

        // Détermine la source de maîtrise pour l'Adaptive Engine (LSTM)
        const masterySource = isDiagnostic
            ? evaluation.typeEvaluation
            : (evaluation.typeEvaluation === 'FORMATIVE' || evaluation.typeEvaluation === 'VALIDATION') && passed
                ? 'QUIZ_DIRECT'
                : null;

        try {
            await trackingApi.saveTrace({
                userId,
                learnerEmail: userId,
                studentEmail: userId,
                courseId,
                evaluationId: evaluation.id,
                typeEvaluation: evaluation.typeEvaluation,
                targetId:     evaluation.targetId,
                targetType:   evaluation.targetType || 'CONCEPT',
                scoreObtenu,
                tempsConsultation,
                horodatage: new Date().toISOString(),
                feedbackGenere,
                tabSwitchesCount: tabSwitchesRef.current,
                masterySource,
                conceptResults: JSON.stringify({ concepts: conceptResults, externalPrerequisites: externalPrerequisiteResults }),
            });
        } catch { /* Non-bloquant */ }

        // ✨ Si diagnostic de module réussi → valider tous les concepts du module dans Neo4j
        let adaptiveResult = null;
        if (isDiagnostic && courseId) {
            try {
                const response = await adaptiveApi.submitDiagnostic({
                    learnerEmail: userId,
                    courseId,
                    evaluationId: evaluation.id,
                    typeEvaluation: evaluation.typeEvaluation,
                    conceptResults,
                });
                adaptiveResult = response.data;
            } catch (e) {
                console.warn('Adaptive diagnostic failed (non-bloquant)', e);
            }
        }

        let moduleValidated = false;
        if (!isDiagnostic && passed && evaluation.typeEvaluation === 'DIAGNOSTIC_POSITIONNEMENT' && evaluation.targetId) {
            try {
                await masteryApi.validateModule(evaluation.targetId);
                moduleValidated = true;
            } catch (e) {
                console.warn('Validation module mastery failed (non-bloquant)', e);
            }
        }

        if (passed && (evaluation.typeEvaluation === 'FORMATIVE' || evaluation.typeEvaluation === 'VALIDATION') && (evaluation.targetType || 'CONCEPT') === 'CONCEPT' && evaluation.targetId) {
            try {
                await masteryApi.validateConcept(evaluation.targetId, 'QUIZ_DIRECT');
            } catch (e) {
                console.warn('Validation concept mastery failed (non-bloquant)', e);
            }
        }

        const firstFailedConceptId = conceptResults.find(item => !item.mastered && item.conceptId)?.conceptId || '';
        const firstFailedHasContent = firstFailedConceptId
            ? await contentApi.getConceptContent(firstFailedConceptId).then(response => !!response.data?.htmlContent).catch(() => false)
            : false;
        const firstFailedContext = firstFailedConceptId
            ? await graphApi.getConceptContext(firstFailedConceptId, courseId).then(response => response.data).catch(() => null)
            : null;
        const recommendationConceptId = adaptiveResult?.nextRecommendation?.conceptId || '';
        const nextResult = {
            scoreObtenu,
            correct,
            total,
            passed,
            feedbackGenere,
            autoSubmit,
            moduleValidated,
            conceptResults,
            externalPrerequisiteResults,
            adaptiveResult,
            firstFailedConceptId,
            firstFailedHasContent,
            firstFailedContext,
            recommendationConceptId,
            courseId,
        };
        setResult(nextResult);
        setSubmitted(true);
        setSubmitting(false);
        if (autoSubmit) setDialogConfig({ isOpen: true, type: 'warning', title: 'Temps écoulé', message: 'Le temps imparti est écoulé. Vos réponses ont été soumises automatiquement.' });
    }, [submitted, submitting, evaluation, questions, answers, user?.email]);

    /* ─── Navigation ─── */
    const canGoBack = evaluation?.allowBacktrack !== false;
    const goNext = () => setCurrentIdx(i => Math.min(i + 1, questions.length - 1));
    const goPrev = () => { if (canGoBack) setCurrentIdx(i => Math.max(i - 1, 0)); };

    const selectAnswer = (answer) => {
        if (submitted) return;
        setAnswers(prev => ({ ...prev, [currentIdx]: answer }));
        if (evaluation.showImmediateFeedback) {
            // immediately advance after feedback delay
            setTimeout(() => { if (currentIdx < questions.length - 1) goNext(); }, 1200);
        }
    };

    const toggleHint = (idx) => setRevealedHints(p => ({ ...p, [idx]: !p[idx] }));

    /* ─── Loaders ─── */
    if (loading) return (
        <div className="flex h-64 items-center justify-center gap-2 text-slate-500 dark:text-slate-300">
            <Loader2 className="animate-spin" size={20}/> Chargement de l'evaluation...
        </div>
    );
    if (!evaluation) return (
        <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-300">
            <AlertTriangle className="mr-2"/> Aucune evaluation disponible pour ce concept.
        </div>
    );

    const q = questions[currentIdx];
    const isValidation = evaluation.typeEvaluation === 'VALIDATION';
    const isFormative = evaluation.typeEvaluation === 'FORMATIVE';
    const isInitialDiagnostic = ['DIAGNOSTIC_ENTREE', 'DIAGNOSTIC_POSITIONNEMENT'].includes(evaluation.typeEvaluation);
    const currentAnswer = answers[currentIdx];
    const answeredCount = Object.keys(answers).length;
    const displayConceptName = (conceptId) => conceptNameMap[conceptId] || 'Concept non identifie';

    if (!submitted && diagnosticAlreadyPassed && isInitialDiagnostic) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-8 text-center text-indigo-800 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
                    <ClipboardList className="mx-auto mb-3 text-indigo-600" size={42} />
                    <h1 className="text-xl font-bold">Diagnostic deja passe</h1>
                    <p className="mx-auto mt-2 max-w-lg text-sm">
                        Diagnostic deja passe. Le repassage sera disponible apres maitrise des concepts recommandes.
                    </p>
                    <button onClick={() => navigate(-1)} className="mt-5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                        Retour au cours
                    </button>
                </div>
            </div>
        );
    }

    /* ─── RESULT SCREEN ─── */
    if (!submitted && validationLocked && isValidation) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <Lock className="mx-auto mb-3 text-amber-600" size={42} />
                    <h1 className="text-xl font-bold">Validation finale verrouillee</h1>
                    <p className="mx-auto mt-2 max-w-lg text-sm">
                        Vous devez maitriser les concepts requis avant de passer la validation finale.
                        Progression actuelle : {validationProgress.mastered}/{validationProgress.total} concepts maitrises.
                    </p>
                    <button
                        onClick={() => context.courseId ? navigate(`/learner/courses/${context.courseId}`) : navigate(-1)}
                        className="mt-5 rounded-lg bg-amber-700 px-5 py-2 text-sm font-bold text-white hover:bg-amber-800"
                    >
                        Retour au cours
                    </button>
                </div>
            </div>
        );
    }

    if (submitted && result) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4">
                <div className={`rounded-lg p-8 text-center shadow-sm border ${result.passed ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900' : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'}`}>
                    {result.passed ? <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4"/> : <XCircle size={64} className="text-red-500 mx-auto mb-4"/>}
                    <p className="text-5xl font-black mb-1" style={{ color: result.passed ? '#059669' : '#dc2626' }}>{result.scoreObtenu}%</p>
                    <p className="font-semibold text-slate-700 mb-1">{result.correct} / {result.total} correctes</p>
                    {isValidation && tabSwitchesRef.current > 0 && (
                        <p className="text-xs text-amber-600 mt-2 font-medium">{tabSwitchesRef.current} changement(s) d'onglet detecte(s)</p>
                    )}
                    <p className="text-slate-500 text-sm mt-3 max-w-sm mx-auto">{result.feedbackGenere}</p>
                    {/* Banniere module validé automatiquement */}
                    {result.moduleValidated && (
                        <div className="mt-4 mx-auto max-w-sm px-4 py-3 bg-sky-50 border border-sky-200 rounded-lg text-sky-700 text-sm font-semibold">
                            Saut de niveau valide. Tous les concepts de ce module sont marques comme acquis.
                        </div>
                    )}
                    {result.adaptiveResult?.nextRecommendation?.conceptId && (
                        <div className="mt-4 mx-auto max-w-sm px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-sm text-left">
                            <p className="font-bold">Votre parcours personnalise</p>
                            <p className="mt-1">{result.adaptiveResult.nextRecommendation.label}</p>
                            <p className="mt-1 text-xs text-indigo-500">{result.adaptiveResult.nextRecommendation.reason}</p>
                        </div>
                    )}
                    {(result.conceptResults?.length > 0 || result.externalPrerequisiteResults?.length > 0) && (
                        <div className="mt-5 grid gap-3 text-left">
                            {result.conceptResults?.length > 0 && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
                                    <p className="font-bold text-slate-800">Resultats par concept</p>
                                    <div className="mt-2 space-y-1">
                                        {result.conceptResults.map(item => (
                                            <p key={item.conceptId} className={item.mastered ? 'text-emerald-700' : 'text-red-700'}>
                                                {displayConceptName(item.conceptId)} : {item.score}% - {item.mastered ? 'maitrise' : 'non maitrise'}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {result.externalPrerequisiteResults?.length > 0 && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
                                    <p className="font-bold text-slate-800">Prerequis externes</p>
                                    <div className="mt-2 space-y-1">
                                        {result.externalPrerequisiteResults.map(item => (
                                            <p key={item.label} className={item.mastered ? 'text-emerald-700' : 'text-red-700'}>
                                                {item.label} : {item.score}% - {item.mastered ? 'maitrise' : 'non maitrise'}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {!result.passed && !isInitialDiagnostic && (
                        <button onClick={() => navigate(-1)}
                            className="inline-block mt-4 px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition text-sm">
                            Revoir le contenu du concept
                        </button>
                    )}
                    <div className="flex justify-center gap-3 mt-6">
                        {!result.passed && !isValidation && !isInitialDiagnostic && (
                            <button onClick={() => { setSubmitted(false); setAnswers({}); setResult(null); setCurrentIdx(0); startTimeRef.current = Date.now(); if (evaluation.tempsImparti > 0) setTimeLeft(evaluation.tempsImparti * 60); }}
                                className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition text-sm">
                                Reessayer
                            </button>
                        )}
                        {isInitialDiagnostic && result.firstFailedConceptId && result.firstFailedHasContent && (
                            <button
                                onClick={() => navigate(result.firstFailedContext?.isInCurrentCourse === false
                                    ? `/learner/external-concepts/${encodeURIComponent(result.firstFailedConceptId)}?sourceCourseId=${encodeURIComponent(result.courseId || '')}`
                                    : `/learner/courses/${result.courseId}?focusConcept=${encodeURIComponent(result.firstFailedConceptId)}`)}
                                className="px-5 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition text-sm"
                            >
                                Reviser ce concept
                            </button>
                        )}
                        {isInitialDiagnostic && result.recommendationConceptId && (
                            <button
                                onClick={() => navigate(`/learner/courses/${result.courseId}?focusConcept=${encodeURIComponent(result.recommendationConceptId)}`)}
                                className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition text-sm"
                            >
                                Voir la recommandation
                            </button>
                        )}
                        <button onClick={() => result.courseId ? navigate(`/learner/courses/${result.courseId}`) : navigate(-1)} className="px-5 py-2 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-800 transition text-sm">
                            Retour au cours
                        </button>
                    </div>
                </div>
                {/* Detailed answers review */}
                <div className="mt-8 space-y-3">
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Correction détaillée</h3>
                    {questions.map((question, i) => {
                        const isRight = answers[i] === question.correctAnswer;
                        return (
                            <div key={i} className={`p-4 rounded-lg border text-sm ${isRight ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900' : 'border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900'}`}>
                                <p className="font-semibold text-slate-800 mb-1">{i + 1}. {question.text}</p>
                                <p className={isRight ? 'text-emerald-700' : 'text-red-600'}>
                                    Votre réponse : <strong>{answers[i] || '—'}</strong>
                                </p>
                                {!isRight && <p className="text-emerald-700">Réponse correcte : <strong>{question.correctAnswer}</strong></p>}
                            </div>
                        );
                    })}
                </div>
                <CustomDialog 
                    isOpen={dialogConfig.isOpen} 
                    type={dialogConfig.type}
                    title={dialogConfig.title}
                    message={dialogConfig.message}
                    onConfirm={dialogConfig.onConfirm}
                    onClose={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
                />
            </div>
        );
    }

    /* ─── QUIZ PLAYER ─── */
    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {context.courseId ? (
                    <Link to={`/learner/courses/${context.courseId}`} className="font-semibold text-indigo-600 hover:text-indigo-700">
                        {context.courseTitle || 'Retour au cours'}
                    </Link>
                ) : (
                    <button onClick={() => navigate(-1)} className="font-semibold text-indigo-600 hover:text-indigo-700">
                        Retour au cours
                    </button>
                )}
                <span>/</span>
                <span>{context.conceptTitle || 'Concept'}</span>
                <span>/</span>
                <span className="font-semibold text-slate-700 dark:text-slate-100">Quiz</span>
            </div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="text-xs text-indigo-500 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                        <ClipboardList size={12}/> {evaluationLabels[evaluation.typeEvaluation] || 'Evaluation'}
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Evaluation en cours</h1>
                </div>
                {/* Timer */}
                {timeLeft !== null && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-lg shadow-sm ${timeLeft < 60 ? 'bg-red-50 text-red-600 border border-red-300 animate-pulse' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'}`}>
                        <Timer size={18}/> {formatTime(timeLeft)}
                    </div>
                )}
            </div>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Question {currentIdx + 1} / {questions.length}</span>
                    <span>{answeredCount} répondue(s)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}/>
                </div>
            </div>

            {/* Question Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start justify-between mb-4">
                    <p className="font-semibold text-slate-800 text-base leading-snug flex-1 dark:text-slate-100">{q.text}</p>
                    {q.difficulty && (
                        <span className={`ml-3 text-xs px-2 py-0.5 rounded-full border font-bold shrink-0 ${
                            q.difficulty === 'EASY' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                            q.difficulty === 'MEDIUM' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                            'text-red-600 bg-red-50 border-red-200'}`}>
                            {difficultyLabels[q.difficulty] || q.difficulty}
                        </span>
                    )}
                </div>

                {/* Options */}
                <div className="space-y-2">
                    {(q.options || []).filter(o => o).map((opt, oIdx) => {
                        const isSelected = currentAnswer === opt;
                        const isCorrect = opt === q.correctAnswer;
                        let cls = 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
                        if (evaluation.showImmediateFeedback && currentAnswer) {
                            if (isCorrect) cls = 'border-emerald-400 bg-emerald-50 text-emerald-700 font-bold';
                            else if (isSelected) cls = 'border-red-400 bg-red-50 text-red-700';
                            else cls = 'border-slate-100 bg-slate-50 text-slate-400';
                        } else if (isSelected) { cls = 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'; }
                        return (
                            <button key={oIdx} onClick={() => selectAnswer(opt)}
                                className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm ${cls}`}>
                                {opt}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Hint (FORMATIVE only) */}
            {isFormative && q.hintText && (
                <div className="mb-4">
                    <button onClick={() => toggleHint(currentIdx)}
                        className="text-sm text-emerald-600 font-semibold flex items-center gap-1.5 hover:text-emerald-700 transition">
                        <Lightbulb size={15}/> {revealedHints[currentIdx] ? 'Masquer l\'indice' : 'Afficher un indice'}
                    </button>
                    {revealedHints[currentIdx] && (
                        <div className="mt-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                            {q.hintText}
                        </div>
                    )}
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={goPrev} disabled={currentIdx === 0 || !canGoBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition disabled:opacity-30 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                    <ChevronLeft size={16}/> Precedent
                </button>

                {currentIdx < questions.length - 1 ? (
                    <button onClick={goNext}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition">
                        Suivant <ChevronRight size={16}/>
                    </button>
                ) : (
                    <button onClick={() => handleSubmit(false)} disabled={submitting}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition ${submitting ? 'bg-indigo-400 text-white cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                        {submitting ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}
                        {submitting ? 'Envoi...' : 'Soumettre mes reponses'}
                    </button>
                )}
            </div>

            {/* Question dots navigation */}
            <div className="flex justify-center flex-wrap gap-1.5 mt-5">
                {questions.map((_, i) => (
                    <button key={i} onClick={() => (canGoBack || i > currentIdx) && setCurrentIdx(i)}
                        className={`w-7 h-7 rounded-full text-xs font-bold transition ${i === currentIdx ? 'bg-indigo-600 text-white' : answers[i] !== undefined ? 'bg-emerald-400 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                        {i + 1}
                    </button>
                ))}
            </div>
            
            <CustomDialog 
                isOpen={dialogConfig.isOpen} 
                type={dialogConfig.type}
                title={dialogConfig.title}
                message={dialogConfig.message}
                onConfirm={dialogConfig.onConfirm}
                onClose={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
