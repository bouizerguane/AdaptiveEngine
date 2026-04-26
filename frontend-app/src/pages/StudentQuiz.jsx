import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { evaluationApi, trackingApi, masteryApi } from '../api/apiClient';
import toast from 'react-hot-toast';
import CustomDialog from '../components/CustomDialog';
import {
    ClipboardList, CheckCircle, XCircle, Timer, Loader2,
    AlertTriangle, Lightbulb, ChevronLeft, ChevronRight, Send
} from 'lucide-react';

/* ─── Helpers ─── */
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const pad = (n) => String(n).padStart(2, '0');
const formatTime = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

export default function StudentQuiz() {
    const { targetId } = useParams();
    const navigate = useNavigate();

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
            })
            .catch(() => toast.error('Impossible de charger l\'évaluation.'))
            .finally(() => setLoading(false));
    }, [targetId]);

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

        const userId = JSON.parse(localStorage.getItem('user') || '{}')?.id || 'anonymous';

        // Détermine la source de maîtrise pour l'Adaptive Engine (LSTM)
        const masterySource = evaluation.typeEvaluation === 'DIAGNOSTIC_POSITIONNEMENT' && passed
            ? 'DIAGNOSTIC_MODULE_SKIP'
            : (evaluation.typeEvaluation === 'FORMATIVE' || evaluation.typeEvaluation === 'VALIDATION') && passed
                ? 'QUIZ_DIRECT'
                : null;

        try {
            await trackingApi.saveTrace({
                userId,
                evaluationId: evaluation.id,
                targetId:     evaluation.targetId,
                targetType:   evaluation.targetType || 'CONCEPT',
                scoreObtenu,
                tempsConsultation,
                horodatage: new Date().toISOString(),
                feedbackGenere,
                tabSwitchesCount: tabSwitchesRef.current,
                masterySource,
            });
        } catch { /* Non-bloquant */ }

        // ✨ Si diagnostic de module réussi → valider tous les concepts du module dans Neo4j
        let moduleValidated = false;
        if (passed && evaluation.typeEvaluation === 'DIAGNOSTIC_POSITIONNEMENT' && evaluation.targetId) {
            try {
                await masteryApi.validateModule(evaluation.targetId, userId);
                moduleValidated = true;
            } catch (e) {
                console.warn('Validation module mastery failed (non-bloquant)', e);
            }
        }

        setResult({ scoreObtenu, correct, total, passed, feedbackGenere, autoSubmit, moduleValidated });
        setSubmitted(true);
        setSubmitting(false);
        if (autoSubmit) setDialogConfig({ isOpen: true, type: 'warning', title: 'Temps écoulé', message: 'Le temps imparti est écoulé. Vos réponses ont été soumises automatiquement.' });
    }, [submitted, submitting, evaluation, questions, answers]);

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
        <div className="flex h-64 items-center justify-center text-slate-400 gap-2">
            <Loader2 className="animate-spin" size={20}/> Chargement…
        </div>
    );
    if (!evaluation) return (
        <div className="flex h-64 items-center justify-center text-slate-400">
            <AlertTriangle className="mr-2"/> Aucune évaluation pour ce concept.
        </div>
    );

    const q = questions[currentIdx];
    const isValidation = evaluation.typeEvaluation === 'VALIDATION';
    const isFormative = evaluation.typeEvaluation === 'FORMATIVE';
    const currentAnswer = answers[currentIdx];
    const answeredCount = Object.keys(answers).length;

    /* ─── RESULT SCREEN ─── */
    if (submitted && result) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4">
                <div className={`rounded-3xl p-10 text-center shadow-xl border-2 ${result.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    {result.passed ? <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4"/> : <XCircle size={64} className="text-red-500 mx-auto mb-4"/>}
                    <p className="text-5xl font-black mb-1" style={{ color: result.passed ? '#059669' : '#dc2626' }}>{result.scoreObtenu}%</p>
                    <p className="font-semibold text-slate-700 mb-1">{result.correct} / {result.total} correctes</p>
                    {isValidation && tabSwitchesRef.current > 0 && (
                        <p className="text-xs text-amber-600 mt-2 font-medium">⚠️ {tabSwitchesRef.current} changement(s) d'onglet détecté(s)</p>
                    )}
                    <p className="text-slate-500 text-sm mt-3 max-w-sm mx-auto">{result.feedbackGenere}</p>
                    {/* Banniere module validé automatiquement */}
                    {result.moduleValidated && (
                        <div className="mt-4 mx-auto max-w-sm px-4 py-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-700 text-sm font-semibold flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            Saut de niveau validé ! Tous les concepts de ce module sont marqués comme acquis.
                        </div>
                    )}
                    {!result.passed && evaluation.remediationResourceId && (
                        <a href={`/student/learn/${evaluation.remediationResourceId}`}
                            className="inline-block mt-4 px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition text-sm">
                            📚 Voir la ressource de remédiation
                        </a>
                    )}
                    <div className="flex justify-center gap-3 mt-6">
                        {!result.passed && !isValidation && (
                            <button onClick={() => { setSubmitted(false); setAnswers({}); setResult(null); setCurrentIdx(0); startTimeRef.current = Date.now(); if (evaluation.tempsImparti > 0) setTimeLeft(evaluation.tempsImparti * 60); }}
                                className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition text-sm">
                                Réessayer
                            </button>
                        )}
                        <button onClick={() => navigate(-1)} className="px-5 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-800 transition text-sm">
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
                            <div key={i} className={`p-4 rounded-xl border text-sm ${isRight ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
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
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="text-xs text-indigo-500 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                        <ClipboardList size={12}/> {evaluation.typeEvaluation}
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">Évaluation en cours</h1>
                </div>
                {/* Timer */}
                {timeLeft !== null && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg shadow ${timeLeft < 60 ? 'bg-red-50 text-red-600 border-2 border-red-300 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
                <div className="flex items-start justify-between mb-4">
                    <p className="font-semibold text-slate-800 text-base leading-snug flex-1">{q.text}</p>
                    {q.difficulty && (
                        <span className={`ml-3 text-xs px-2 py-0.5 rounded-full border font-bold shrink-0 ${
                            q.difficulty === 'EASY' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                            q.difficulty === 'MEDIUM' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                            'text-red-600 bg-red-50 border-red-200'}`}>
                            {q.difficulty}
                        </span>
                    )}
                </div>

                {/* Options */}
                <div className="space-y-2">
                    {(q.options || []).filter(o => o).map((opt, oIdx) => {
                        const isSelected = currentAnswer === opt;
                        const isCorrect = opt === q.correctAnswer;
                        let cls = 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300';
                        if (evaluation.showImmediateFeedback && currentAnswer) {
                            if (isCorrect) cls = 'border-emerald-400 bg-emerald-50 text-emerald-700 font-bold';
                            else if (isSelected) cls = 'border-red-400 bg-red-50 text-red-700';
                            else cls = 'border-slate-100 bg-slate-50 text-slate-400';
                        } else if (isSelected) { cls = 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'; }
                        return (
                            <button key={oIdx} onClick={() => selectAnswer(opt)}
                                className={`w-full text-left px-4 py-3 rounded-xl border transition text-sm ${cls}`}>
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
                        <div className="mt-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                            💡 {q.hintText}
                        </div>
                    )}
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={goPrev} disabled={currentIdx === 0 || !canGoBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={16}/> Précédent
                </button>

                {currentIdx < questions.length - 1 ? (
                    <button onClick={goNext}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition">
                        Suivant <ChevronRight size={16}/>
                    </button>
                ) : (
                    <button onClick={() => handleSubmit(false)} disabled={submitting}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-sm transition ${submitting ? 'bg-indigo-400 text-white cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                        {submitting ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}
                        {submitting ? 'Envoi…' : 'Soumettre mes réponses'}
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
