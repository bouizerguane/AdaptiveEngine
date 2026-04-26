import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { labApi, labTrackingApi, masteryApi } from '../api/apiClient';
import CustomDialog from '../components/CustomDialog';
import toast from 'react-hot-toast';
import { Github, ChevronRight, ChevronLeft, Clock, BarChart2, CheckCircle2, Lock, Terminal } from 'lucide-react';

const GITHUB_REGEX = /^https?:\/\/(www\.)?github\.com\/.+\/.+/i;
const DIFF_BADGE = {
    EASY:   'bg-emerald-100 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    HARD:   'bg-red-100 text-red-700 border-red-200',
};
const DIFF_LABELS = { EASY: 'Facile', MEDIUM: 'Moyen', HARD: 'Difficile' };

const SUBMISSION_STEP = {
    id: '__submission__',
    title: 'Soumission',
    content: '',
    orderIndex: 9999,
};

export default function StudentLab() {
    const { labId } = useParams();
    const { user }  = useAuth();
    const isTeacher = user?.role === 'ROLE_TEACHER';

    const [lab, setLab]           = useState(null);
    const [steps, setSteps]       = useState([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [githubUrl, setGithubUrl]   = useState('');
    const [urlError, setUrlError]     = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted]   = useState(null); // LabSubmission si déjà soumis
    const [loading, setLoading]       = useState(true);
    const [dialog, setDialog]         = useState({ isOpen: false, type: 'success', title: '', message: '' });

    // Temps par étape (secondes)
    const stepStartTime = useRef(Date.now());
    const timePerStep   = useRef({});

    const userId = user?.id || 'anonymous';

    // ── Load lab & check existing submission ──────────────────────────
    useEffect(() => {
        Promise.all([
            labApi.getLabByTarget(labId).catch(() => ({ data: null })),
            labTrackingApi.getByLabAndUser(labId, userId).catch(() => ({ data: null })),
        ]).then(([labRes, subRes]) => {
            if (!labRes.data) { toast.error('TP introuvable.'); setLoading(false); return; }
            const sortedSteps = [...(labRes.data.steps || [])].sort((a, b) => a.orderIndex - b.orderIndex);
            setLab(labRes.data);
            setSteps([...sortedSteps, SUBMISSION_STEP]);
            if (subRes.data?.status === 'COMPLETED') setSubmitted(subRes.data);
            setLoading(false);

            // Log STARTED (non-bloquant)
            if (!subRes.data && !isTeacher) {
                labTrackingApi.submit({
                    userId, labId, courseId: labRes.data.courseId,
                    conceptId: labRes.data.targetId, status: 'STARTED',
                }).catch(() => {});
            }
        });
    }, [labId, userId]);

    // ── Track time per step ──────────────────────────────────────────
    const recordStepTime = () => {
        const elapsed = Math.round((Date.now() - stepStartTime.current) / 1000);
        timePerStep.current[currentIdx] = (timePerStep.current[currentIdx] || 0) + elapsed;
        stepStartTime.current = Date.now();
    };

    const goTo = (idx) => {
        recordStepTime();
        setCurrentIdx(idx);
        
        // Persistance de la trace à chaque changement d'étape (Suivant/Précédent)
        // Cela permet de tracker l'avancement en temps réel (STARTED)
        if (!isTeacher) {
            labTrackingApi.submit({
                userId, labId, courseId: lab.courseId,
                conceptId: lab.targetId, status: 'STARTED',
                timeSpentPerStep: JSON.stringify(timePerStep.current)
            }).catch(() => {});
        }
    };

    const next = () => { if (currentIdx < steps.length - 1) goTo(currentIdx + 1); };
    const prev = () => { if (currentIdx > 0) goTo(currentIdx - 1); };

    // ── Submit ────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!GITHUB_REGEX.test(githubUrl)) {
            setUrlError('L\'URL doit être un lien GitHub valide (https://github.com/...)');
            return;
        }
        setUrlError('');
        recordStepTime();
        setSubmitting(true);

        try {
            // 1. Persister la soumission
            await labTrackingApi.submit({
                userId, labId, courseId: lab.courseId,
                conceptId: lab.targetId,
                githubRepoUrl: githubUrl,
                status: 'COMPLETED',
                timeSpentPerStep: JSON.stringify(timePerStep.current),
                isTeacherTest: isTeacher,
            });

            // 2. Marquer le concept comme ACQUIS dans Neo4j (basis='LAB')
            //    Sauf si c'est un test enseignant
            if (!isTeacher && lab.targetId) {
                masteryApi.validateConcept(lab.targetId, userId, 'LAB').catch(() => {});
            }

            const successMsg = isTeacher
                ? 'Test enseignant enregistré (non comptabilisé dans les statistiques).'
                : 'Félicitations ! Votre TP est validé et le concept est marqué comme maîtrisé.';

            setDialog({
                isOpen: true, type: 'success',
                title: isTeacher ? '✅ Test enseignant' : '🎉 TP Terminé !',
                message: successMsg,
            });
            setSubmitted({ githubRepoUrl: githubUrl, status: 'COMPLETED' });
        } catch {
            toast.error('Erreur lors de la soumission. Réessayez.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center h-64 text-slate-400">
            <div className="text-center"><Terminal size={36} className="mx-auto mb-3 text-slate-300 animate-pulse"/><p>Chargement du TP…</p></div>
        </div>
    );
    if (!lab) return <div className="p-8 text-center text-slate-500">TP introuvable.</div>;

    const progress = Math.round(((currentIdx) / (steps.length - 1)) * 100);
    const currentStep = steps[currentIdx];
    const isLastStep  = currentIdx === steps.length - 1;

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-5">
            {/* ── Header ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Terminal size={18} className="text-indigo-600 shrink-0"/>
                            <h1 className="text-xl font-bold text-slate-800">{lab.title}</h1>
                            {isTeacher && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 font-semibold">
                                    Mode Prévisualisation
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded-full border font-semibold ${DIFF_BADGE[lab.difficulty]||DIFF_BADGE.MEDIUM}`}>
                                {DIFF_LABELS[lab.difficulty] || lab.difficulty}
                            </span>
                            <span className="text-slate-400 flex items-center gap-1"><Clock size={11}/> {lab.estimatedTime} min estimés</span>
                        </div>
                    </div>
                    {submitted && (
                        <a href={submitted.githubRepoUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition">
                            <CheckCircle2 size={13}/> TP Complété — Voir le repo
                        </a>
                    )}
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Progression</span><span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}/>
                    </div>
                </div>
            </div>

            {/* ── Stepper tabs ── */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {steps.map((step, idx) => (
                    <button key={step.id} onClick={() => goTo(idx)}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition
                            ${idx === currentIdx
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                                : idx < currentIdx
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                        {idx < currentIdx
                            ? <CheckCircle2 size={11}/>
                            : step.id === SUBMISSION_STEP.id
                                ? <Github size={11}/>
                                : <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">{idx+1}</span>
                        }
                        <span className="max-w-[100px] truncate">{step.title}</span>
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                        {currentIdx + 1}
                    </span>
                    <h2 className="font-bold text-slate-700">{currentStep.title}</h2>
                </div>

                <div className="p-6">
                    {isLastStep ? (
                        submitted ? (
                            <div className="text-center py-8">
                                <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-500"/>
                                <p className="font-bold text-slate-700 text-lg">TP déjà soumis !</p>
                                <a href={submitted.githubRepoUrl} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 transition">
                                    <Github size={14}/> Voir votre repo
                                </a>
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-lg mx-auto">
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2">
                                    <Github size={16} className="mt-0.5 shrink-0"/>
                                    <div>
                                        <p className="font-bold">Soumettez votre dépôt GitHub</p>
                                        <p className="mt-0.5">Publiez votre travail sur GitHub et collez l'URL du dépôt ci-dessous.</p>
                                        {isTeacher && <p className="mt-1 font-semibold text-violet-600">⚠️ Mode enseignant — la soumission sera marquée comme test.</p>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">URL du dépôt GitHub</label>
                                    <input type="url" value={githubUrl} onChange={e=>{setGithubUrl(e.target.value);setUrlError('');}}
                                        placeholder="https://github.com/votre-nom/votre-repo"
                                        className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition
                                            ${urlError?'border-red-300 bg-red-50 focus:ring-red-200':'border-slate-200 focus:ring-2 focus:ring-indigo-200'}`}/>
                                    {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
                                </div>
                                <button onClick={handleSubmit} disabled={submitting || !githubUrl}
                                    className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition shadow
                                        ${submitting||!githubUrl?'bg-slate-300 cursor-not-allowed':'bg-indigo-600 hover:bg-indigo-700'}`}>
                                    <Github size={16}/>
                                    {submitting ? 'Validation en cours…' : isTeacher ? 'Soumettre (Test)' : 'Valider et Terminer le TP'}
                                </button>
                            </div>
                        )
                    ) : (
                        <div
                            className="prose prose-slate max-w-none [&_pre]:bg-slate-900 [&_pre]:text-emerald-300 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:text-indigo-700 [&_code]:bg-indigo-50 [&_code]:px-1 [&_code]:rounded"
                            dangerouslySetInnerHTML={{ __html: currentStep.content || '<p class="text-slate-400 italic">Contenu à venir…</p>' }}/>
                    )}
                </div>
            </div>

            {/* ── Navigation ── */}
            <div className="flex justify-between">
                <button onClick={prev} disabled={currentIdx === 0}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft size={16}/> Précédent
                </button>
                {!isLastStep && (
                    <button onClick={next}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow">
                        Suivant <ChevronRight size={16}/>
                    </button>
                )}
            </div>

            <CustomDialog isOpen={dialog.isOpen} type={dialog.type}
                title={dialog.title} message={dialog.message}
                onClose={() => setDialog(d => ({...d, isOpen: false}))}/>
        </div>
    );
}
