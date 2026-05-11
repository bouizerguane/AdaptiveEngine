import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { graphApi, evaluationApi, courseApi } from '../api/apiClient';
import CustomDialog from '../components/CustomDialog';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { flattenConcepts, normalizeCourseTree } from '../utils/courseOrder';
import {
    ChevronRight, Plus, Trash2, Save, HelpCircle,
    ClipboardList, Settings, Zap, BookOpen, Shield,
    ToggleLeft, ToggleRight, AlertTriangle, Timer, Star, GraduationCap,
    Terminal
} from 'lucide-react';

const QUESTION_TYPES = ['QCM', 'TRUE_FALSE'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

const DIFFICULTY_COLORS = { EASY: 'text-emerald-600 bg-emerald-50 border-emerald-200', MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200', HARD: 'text-red-600 bg-red-50 border-red-200' };
const DIFFICULTY_LABELS = { EASY: 'Facile', MEDIUM: 'Moyen', HARD: 'Difficile' };

const TYPES_BY_LEVEL = {
    COURSE:   ['DIAGNOSTIC_ENTREE', 'VALIDATION'],
    MODULE:   ['DIAGNOSTIC_POSITIONNEMENT'],
    CONCEPT:  ['FORMATIVE', 'VALIDATION'],
    '':       [],
};

const TYPE_META = {
    DIAGNOSTIC_ENTREE:         { color: 'violet',  icon: <GraduationCap size={16}/>, label: 'Diagnostic d\'Entrée (Cours)',  desc: 'Prérequis globaux du cours entier. Détermine si l\'étudiant est prêt à débuter.' },
    DIAGNOSTIC_POSITIONNEMENT: { color: 'sky',     icon: <Zap size={16}/>,           label: 'Positionnement (Module)',       desc: 'Si réussi, valide automatiquement tous les concepts du module (saut de niveau).' },
    FORMATIVE:                 { color: 'emerald', icon: <BookOpen size={16}/>,       label: 'Formative',                    desc: 'Accompagne l\'apprentissage avec indices, feedback immédiat et remédiation.' },
    VALIDATION:                { color: 'red',     icon: <Shield size={16}/>,         label: 'Validation (Examen)',           desc: 'Évaluation stricte : chronomètre, tentatives limitées et anti-triche actif.' },
};

const emptyQuestion = () => ({ conceptId: '', associationType: 'COURSE_CONCEPT', externalPrerequisiteLabel: '', generalQuestion: false, text: '', type: 'QCM', options: ['', '', '', ''], correctAnswer: '', difficulty: 'MEDIUM', hintText: '' });

const defaultEval = (type = 'FORMATIVE') => {
    const base = {
        typeEvaluation: type, seuilReussite: 70, nbrTentativesMax: 3, tempsImparti: 0,
        allowBacktrack: true, shuffleQuestions: false, showImmediateFeedback: false,
        retryDelayHours: 0, remediationResourceId: '', coefficient: 1,
        nbQuestionsATirer: 0,       // 0 = toutes les questions
        equilibrerDifficulte: false, // tirage stratifié par niveau
        seuilDeSaut: 80,             // % requis pour valider le saut de niveau (MODULE)
        questions: [emptyQuestion()]
    };
    if (type === 'DIAGNOSTIC_POSITIONNEMENT' || type === 'DIAGNOSTIC_ENTREE')
        return { ...base, shuffleQuestions: true, allowBacktrack: false, showImmediateFeedback: false, nbrTentativesMax: 1 };
    if (type === 'VALIDATION') return { ...base, allowBacktrack: false, showImmediateFeedback: false, tempsImparti: 30, nbrTentativesMax: 1, coefficient: 1 };
    return base;
};

const Toggle = ({ value, onChange, label, disabled }) => (
    <button type="button" onClick={() => !disabled && onChange(!value)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition ${disabled ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : value ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
        {value ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
        {label}
    </button>
);



export default function TeacherQuizzes() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [modules, setModules] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [concepts, setConcepts] = useState([]);
    const [externalPrerequisiteConcepts, setExternalPrerequisiteConcepts] = useState([]);

    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedModule, setSelectedModule] = useState('');
    const [selectedChapter, setSelectedChapter] = useState('');
    const [selectedConcept, setSelectedConcept] = useState('');

    const [evaluation, setEvaluation] = useState(defaultEval('FORMATIVE'));
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const activeTargetId   = selectedConcept || selectedModule || selectedCourse || '';
    const activeTargetType = selectedConcept ? 'CONCEPT' : selectedModule ? 'MODULE' : selectedCourse ? 'COURSE' : '';

    useEffect(() => {
        if (!user?.email) return;
        graphApi.getTeacherCourses(user.email).then(r => setCourses(r.data)).catch(() => {});
    }, [user?.email]);



    useEffect(() => {
        if (!selectedCourse) { setModules([]); setExternalPrerequisiteConcepts([]); setSelectedModule(''); return; }
        courseApi.getCourseTree(selectedCourse).then(r => {
            setModules(normalizeCourseTree(r.data)?.modules || []);
            setSelectedModule(''); setChapters([]); setSelectedChapter(''); setConcepts([]); setSelectedConcept('');
        }).catch(error => {
            console.error('[TeacherQuizzes] Impossible de charger le plan du cours:', error);
            setModules([]); setSelectedModule(''); setChapters([]); setSelectedChapter(''); setConcepts([]); setSelectedConcept('');
            toast.error("Impossible de charger le plan du cours.");
        });
        graphApi.getCoursePrerequisiteConcepts(selectedCourse)
            .then(r => setExternalPrerequisiteConcepts(r.data || []))
            .catch(() => setExternalPrerequisiteConcepts([]));
    }, [selectedCourse]);

    useEffect(() => {
        if (!selectedModule) { setChapters([]); setSelectedChapter(''); return; }
        const mod = modules.find(m => m.id === selectedModule);
        setChapters(mod?.chapitres || []);
        setSelectedChapter('');
    }, [selectedModule, modules]);

    useEffect(() => {
        if (!selectedChapter) { setConcepts([]); setSelectedConcept(''); return; }
        const chap = chapters.find(c => c.id === selectedChapter);
        setConcepts(chap?.concepts || []);
        setSelectedConcept('');
    }, [selectedChapter, chapters]);

    useEffect(() => {
        if (!activeTargetId) return;
        const defaultType = activeTargetType === 'MODULE' ? 'DIAGNOSTIC_POSITIONNEMENT'
                          : activeTargetType === 'COURSE'  ? 'DIAGNOSTIC_ENTREE'
                          : 'FORMATIVE';
        evaluationApi.getEvaluation(activeTargetId)
            .then(r => {
                setEvaluation({
                    ...defaultEval(r.data.typeEvaluation),
                    ...r.data,
                    questions: r.data.questions?.length ? r.data.questions : [emptyQuestion()]
                });
                setIsDirty(false);
            })
            .catch(err => {
                if (err.response?.status !== 404) toast.error('Erreur chargement quiz.');
                else setEvaluation(defaultEval(defaultType));
                setIsDirty(false);
            });
    }, [activeTargetId]);

    useEffect(() => {
        const availableTypes = TYPES_BY_LEVEL[activeTargetType] || [];
        if (!activeTargetType || availableTypes.length === 0) return;
        if (!availableTypes.includes(evaluation.typeEvaluation)) {
            setEvaluation(defaultEval(availableTypes[0]));
            setIsDirty(false);
        }
    }, [activeTargetType, evaluation.typeEvaluation]);

    const setField = (field, value) => { setEvaluation(p => ({ ...p, [field]: value })); setIsDirty(true); };
    const changeType = (type) => { setEvaluation(prev => ({ ...defaultEval(type), id: prev.id, questions: prev.questions })); setIsDirty(true); };

    const addQuestion = () => { setEvaluation(p => ({ ...p, questions: [...p.questions, emptyQuestion()] })); setIsDirty(true); };
    const removeQuestion = (idx) => { setEvaluation(p => ({ ...p, questions: p.questions.filter((_, i) => i !== idx) })); setIsDirty(true); };
    
    const updateQuestion = (idx, field, value) => setEvaluation(p => {
        setIsDirty(true);
        const qs = [...p.questions];
        qs[idx] = { ...qs[idx], [field]: value };
        if (field === 'type' && value === 'TRUE_FALSE') { 
            qs[idx].options = ['Vrai', 'Faux']; 
            qs[idx].correctAnswer = 'Vrai'; 
        }
        return { ...p, questions: qs };
    });

    const inferAssociationType = (question) => {
        if (question.associationType) return question.associationType;
        if (question.generalQuestion) return 'GENERAL';
        if (question.externalPrerequisiteLabel?.trim()) return 'FREE_EXTERNAL';
        if (question.conceptId && externalPrerequisiteConcepts.some(concept => concept.id === question.conceptId)) return 'EXTERNAL_CONCEPT';
        return 'COURSE_CONCEPT';
    };

    const updateQuestionAssociationType = (idx, associationType) => setEvaluation(p => {
        setIsDirty(true);
        const qs = [...p.questions];
        qs[idx] = {
            ...qs[idx],
            associationType,
            conceptId: '',
            externalPrerequisiteLabel: '',
            generalQuestion: associationType === 'GENERAL',
        };
        return { ...p, questions: qs };
    });

    const updateOption = (qIdx, oIdx, value) => setEvaluation(p => {
        setIsDirty(true);
        const qs = [...p.questions]; 
        const opts = [...qs[qIdx].options]; 
        opts[oIdx] = value; 
        const previousAnswer = qs[qIdx].correctAnswer;
        qs[qIdx] = {
            ...qs[qIdx],
            options: opts,
            correctAnswer: opts.includes(previousAnswer) ? previousAnswer : ''
        };
        return { ...p, questions: qs };
    });

    const handleSave = async () => {
        if (!activeTargetId) return;
        if (evaluation.questions.some(q => !q.text || !q.correctAnswer || !q.difficulty || !(q.options || []).includes(q.correctAnswer))) {
            toast.error('Chaque question doit posséder un énoncé, une réponse correcte et un niveau de difficulté défini.');
            return;
        }
        if (evaluation.typeEvaluation === 'DIAGNOSTIC_POSITIONNEMENT'
            && evaluation.questions.some(q => !q.conceptId)) {
            toast.error('Chaque question doit etre associee a un concept.');
            return;
        }
        if (evaluation.typeEvaluation === 'DIAGNOSTIC_ENTREE'
            && evaluation.questions.some(q => !q.conceptId && !q.externalPrerequisiteLabel?.trim() && !q.generalQuestion)) {
            toast.error("Chaque question de diagnostic d'entree doit avoir un concept, un prerequis libre ou etre marquee comme generale.");
            return;
        }
        setSaving(true);
        try {
            const questions = evaluation.questions.map(question => ({
                ...question,
                conceptId: activeTargetType === 'CONCEPT' && evaluation.typeEvaluation === 'FORMATIVE'
                    ? selectedConcept
                    : question.generalQuestion || question.externalPrerequisiteLabel?.trim()
                        ? ''
                        : question.conceptId || '',
                externalPrerequisiteLabel: question.generalQuestion ? '' : question.externalPrerequisiteLabel || '',
                generalQuestion: !!question.generalQuestion,
            }));
            await evaluationApi.saveEvaluation({
                ...evaluation,
                questions,
                targetId: activeTargetId,
                targetType: activeTargetType,
                courseId: selectedCourse,
            });
            toast.success('L\'évaluation a été enregistrée avec succès !');
            setIsDirty(false);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Une erreur est survenue lors de la sauvegarde.');
        } finally {
            setSaving(false);
        }
    };

    const handleToolNavigate = (navFn) => {
        navFn();
    };

    const type = evaluation.typeEvaluation;
    const meta = TYPE_META[type] || TYPE_META['FORMATIVE'];
    const textMap = { indigo: 'text-indigo-700', emerald: 'text-emerald-700', red: 'text-red-700', violet: 'text-violet-700', sky: 'text-sky-700' };
    const activeBorderMap = { violet: 'border-violet-400 bg-violet-50', sky: 'border-sky-400 bg-sky-50', emerald: 'border-emerald-400 bg-emerald-50', red: 'border-red-400 bg-red-50' };
    const canSave = !!activeTargetId;
    const availableTypes = TYPES_BY_LEVEL[activeTargetType] || [];
    const allCourseConcepts = flattenConcepts(modules);
    const courseQuestionConcepts = allCourseConcepts.map(concept => ({ ...concept, sourceLabel: 'Concept du cours' }));
    const externalQuestionConcepts = externalPrerequisiteConcepts.map(concept => ({ ...concept, sourceLabel: 'Prerequis conceptuel existant', moduleTitle: 'Autre cours', chapitreTitle: '' }));
    const selectableQuestionConcepts = type === 'DIAGNOSTIC_ENTREE'
        ? [...courseQuestionConcepts, ...externalQuestionConcepts]
        : courseQuestionConcepts;
    const requiresQuestionConcept = type === 'DIAGNOSTIC_POSITIONNEMENT';
    const allowsQuestionConcept = requiresQuestionConcept || type === 'VALIDATION';

    const qs = evaluation.questions;
    const bankTotal = qs.length;

    const activeName = selectedConcept
        ? concepts.find(c => c.id === selectedConcept)?.labelPedagogique || 'Concept'
        : selectedModule
            ? modules.find(m => m.id === selectedModule)?.title || 'Module'
            : selectedCourse
                ? courses.find(c => c.id === selectedCourse)?.title || 'Cours'
                : '';

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <ClipboardList className="text-indigo-600" size={32} /> Constructeur d'Évaluation
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Créez des évaluations adaptatives liées aux nœuds du Knowledge Graph.</p>
                </div>
                <div className="flex items-center gap-3 mb-1">
                    <button onClick={handleSave} disabled={!canSave || saving}
                        className={`flex items-center gap-2 px-6 py-2.5 font-bold text-white rounded-xl shadow transition-all
                            ${!canSave ? 'bg-slate-300 cursor-not-allowed' : saving ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        <Save size={18} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
                <select value={selectedCourse} onChange={(e) => { setSelectedCourse(e.target.value); setSelectedModule(''); setSelectedChapter(''); setSelectedConcept(''); }}
                    className="bg-slate-50 border border-indigo-200 text-indigo-700 font-bold text-sm rounded-lg p-2 outline-none w-48">
                    <option value="">1. Choisir le Cours</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <ChevronRight className="text-slate-300" size={16} />
                <select value={selectedModule} onChange={(e) => { setSelectedModule(e.target.value); setSelectedChapter(''); setSelectedConcept(''); }} disabled={!selectedCourse}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-2 outline-none w-48 disabled:opacity-50">
                    <option value="">2. Choisir le Module</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                <ChevronRight className="text-slate-300" size={16} />
                <select value={selectedChapter} onChange={(e) => { setSelectedChapter(e.target.value); setSelectedConcept(''); }} disabled={!selectedModule}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-2 outline-none w-48 disabled:opacity-50">
                    <option value="">3. Choisir le Chapitre</option>
                    {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <ChevronRight className="text-slate-300" size={16} />
                <select value={selectedConcept} onChange={(e) => setSelectedConcept(e.target.value)} disabled={!selectedChapter}
                    className={`bg-white border-2 text-sm rounded-lg p-2 outline-none w-48 disabled:opacity-50 font-bold
                        ${selectedConcept ? 'border-emerald-500 text-emerald-800' : 'border-slate-200 text-slate-700'}`}>
                    <option value="">4. Choisir le Concept</option>
                    {concepts.map(c => <option key={c.id} value={c.id}>{c.labelPedagogique || c.id}</option>)}
                </select>
            </div>

            {selectedCourse && modules.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Aucun module/chapitre/concept disponible pour ce cours.
                </div>
            )}
            {selectedModule && chapters.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Aucun chapitre/concept disponible pour ce module.
                </div>
            )}
            {selectedChapter && concepts.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Aucun concept disponible pour ce chapitre.
                </div>
            )}

            <AnimatePresence mode="wait">
                {!activeTargetId ? (
                    <motion.div key="placeholder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                        <ClipboardList size={48} className="mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-400 font-medium italic">Sélectionnez une cible pédagogique pour configurer l'évaluation.</p>
                    </motion.div>
                ) : (
                    <motion.div key="editor" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}
                        className="space-y-6">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border shadow-sm ${
                            activeTargetType === 'COURSE'  ? 'bg-violet-50 text-violet-700 border-violet-200' :
                            activeTargetType === 'MODULE'  ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                                             'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                            {activeTargetType === 'COURSE'  && <Shield size={14}/>}
                            {activeTargetType === 'MODULE'  && <Zap size={14}/>}
                            {activeTargetType === 'CONCEPT' && <BookOpen size={14}/>}
                            {activeTargetType} — <span className="font-bold">{activeName}</span>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <h2 className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-xs uppercase tracking-widest">
                                <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> Type d'Évaluation
                            </h2>
                            {activeTargetType !== 'CONCEPT' && availableTypes.length === 1 ? (
                                <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
                                    activeTargetType === 'COURSE' ? 'border-violet-400 bg-violet-50' : 'border-sky-400 bg-sky-50'
                                }`}>
                                    <div className={activeTargetType === 'COURSE' ? 'text-violet-600' : 'text-sky-600'}>{meta.icon}</div>
                                    <div>
                                        <p className={`font-bold text-sm ${activeTargetType === 'COURSE' ? 'text-violet-700' : 'text-sky-700'}`}>{meta.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{meta.desc}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {availableTypes.map(t => {
                                        const m = TYPE_META[t];
                                        const isActive = type === t;
                                        return (
                                            <button key={t} onClick={() => changeType(t)}
                                                className={`p-4 rounded-xl border-2 text-left transition ${isActive ? activeBorderMap[m.color] : 'border-slate-200 hover:border-slate-300'}`}>
                                                <div className={`flex items-center gap-2 font-bold text-sm mb-1 ${isActive ? textMap[m.color] : 'text-slate-700'}`}>
                                                    {m.icon} {m.label}
                                                </div>
                                                <p className="text-xs text-slate-500">{m.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
                                <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
                                <Settings size={13}/> Paramètres — <span className={`${textMap[meta.color]} font-bold`}>{meta.label}</span>
                            </h2>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Seuil de réussite (%)</label>
                                    <input type="number" min={0} max={100} value={evaluation.seuilReussite} onChange={e => setField('seuilReussite', Number(e.target.value))}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tentatives max</label>
                                    <input type="number" min={1} value={evaluation.nbrTentativesMax}
                                        disabled={type === 'DIAGNOSTIC_POSITIONNEMENT' || type === 'DIAGNOSTIC_ENTREE'}
                                        onChange={e => setField('nbrTentativesMax', Number(e.target.value))}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none disabled:opacity-50 disabled:bg-slate-50" />
                                </div>
                                {type === 'DIAGNOSTIC_POSITIONNEMENT' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-sky-600 mb-1 flex items-center gap-1"><Zap size={11}/> Seuil de saut (%)</label>
                                        <input type="number" min={0} max={100} value={evaluation.seuilDeSaut ?? 80} onChange={e => setField('seuilDeSaut', Number(e.target.value))}
                                            className="w-full border border-sky-300 bg-sky-50 rounded-lg p-2 text-sm outline-none text-sky-800" />
                                    </div>
                                )}
                                {type === 'VALIDATION' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Timer size={11}/> Temps imparti (min)</label>
                                            <input type="number" min={0} value={evaluation.tempsImparti} onChange={e => setField('tempsImparti', Number(e.target.value))}
                                                className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Star size={11}/> Coefficient</label>
                                            <input type="number" min={0.1} step={0.1} value={evaluation.coefficient} onChange={e => setField('coefficient', Number(e.target.value))}
                                                className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                                <Toggle value={evaluation.shuffleQuestions} onChange={v => setField('shuffleQuestions', v)} label="Mélanger questions" disabled={type === 'DIAGNOSTIC_POSITIONNEMENT' || type === 'DIAGNOSTIC_ENTREE'} />
                                <Toggle value={evaluation.allowBacktrack} onChange={v => setField('allowBacktrack', v)} label="Navigation arrière" disabled={type === 'DIAGNOSTIC_POSITIONNEMENT' || type === 'DIAGNOSTIC_ENTREE' || type === 'VALIDATION'} />
                                {type === 'FORMATIVE' && <Toggle value={evaluation.showImmediateFeedback} onChange={v => setField('showImmediateFeedback', v)} label="Feedback immédiat" />}
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-1.5"><HelpCircle size={12}/> Tirage Aléatoire</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Questions à tirer <span className="text-slate-400 font-normal">(0 = toutes)</span></label>
                                        <input type="number" min={0} max={bankTotal} value={evaluation.nbQuestionsATirer || 0} onChange={e => setField('nbQuestionsATirer', Number(e.target.value))}
                                            className={`w-full border rounded-lg p-2 text-sm outline-none ${(evaluation.nbQuestionsATirer || 0) > bankTotal && bankTotal > 0 ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200'}`} />
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <Toggle value={evaluation.equilibrerDifficulte} onChange={v => setField('equilibrerDifficulte', v)} label="Tirage équilibré F/M/D" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-widest">
                                    <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">4</span> Questions
                                </h2>
                                <button onClick={addQuestion} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow">
                                    <Plus size={14}/> Ajouter une question
                                </button>
                            </div>
                            <div className="space-y-4">
                                {evaluation.questions.map((q, qIdx) => (
                                    <div key={qIdx} className="p-4 border border-slate-200 rounded-xl relative group hover:border-indigo-300 transition-colors">
                                        <div className="flex justify-between mb-3">
                                            <span className="text-xs font-bold text-slate-400"># {qIdx + 1}</span>
                                            <button onClick={() => removeQuestion(qIdx)} className="text-slate-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                                        </div>
                                        <div className="space-y-4">
                                            {type === 'DIAGNOSTIC_ENTREE' && (
                                                <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                                                    <label className="block text-xs font-bold text-violet-700">Type d'association</label>
                                                    <select
                                                        value={inferAssociationType(q)}
                                                        onChange={e => updateQuestionAssociationType(qIdx, e.target.value)}
                                                        className="w-full border border-violet-200 bg-white text-slate-700 rounded-lg p-2 text-sm outline-none focus:border-violet-400"
                                                    >
                                                        <option value="COURSE_CONCEPT">Concept du cours</option>
                                                        <option value="EXTERNAL_CONCEPT">Prerequis conceptuel existant</option>
                                                        <option value="FREE_EXTERNAL">Prerequis externe libre</option>
                                                        <option value="GENERAL">Question generale sans concept</option>
                                                    </select>

                                                    {inferAssociationType(q) === 'COURSE_CONCEPT' && (
                                                        <select
                                                            value={q.conceptId || ''}
                                                            onChange={e => updateQuestion(qIdx, 'conceptId', e.target.value)}
                                                            className="w-full border border-slate-200 bg-white text-slate-700 rounded-lg p-2 text-sm outline-none focus:border-indigo-300"
                                                        >
                                                            <option value="">Selectionner un concept du cours</option>
                                                            {courseQuestionConcepts.map(concept => (
                                                                <option key={concept.id} value={concept.id}>
                                                                    {concept.moduleTitle}{concept.chapitreTitle ? ` / ${concept.chapitreTitle}` : ''} / {concept.labelPedagogique || concept.title || concept.id}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {inferAssociationType(q) === 'EXTERNAL_CONCEPT' && (
                                                        <select
                                                            value={q.conceptId || ''}
                                                            onChange={e => updateQuestion(qIdx, 'conceptId', e.target.value)}
                                                            className="w-full border border-slate-200 bg-white text-slate-700 rounded-lg p-2 text-sm outline-none focus:border-indigo-300"
                                                        >
                                                            <option value="">Selectionner un prerequis existant</option>
                                                            {externalQuestionConcepts.map(concept => (
                                                                <option key={concept.id} value={concept.id}>
                                                                    {concept.labelPedagogique || concept.title || concept.label || concept.id}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {inferAssociationType(q) === 'FREE_EXTERNAL' && (
                                                        <input
                                                            value={q.externalPrerequisiteLabel || ''}
                                                            onChange={e => updateQuestion(qIdx, 'externalPrerequisiteLabel', e.target.value)}
                                                            placeholder="Exemple : logique mathematique"
                                                            className="w-full border border-slate-200 bg-white text-slate-700 rounded-lg p-2 text-sm outline-none focus:border-indigo-300"
                                                        />
                                                    )}

                                                    {inferAssociationType(q) === 'GENERAL' && (
                                                        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                                            Cette question restera generale : aucun conceptId ni prerequis libre ne sera envoye.
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {allowsQuestionConcept && type !== 'DIAGNOSTIC_ENTREE' && (
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">
                                                        Concept associe {requiresQuestionConcept && <span className="text-red-500">*</span>}
                                                    </label>
                                                    <select
                                                        value={q.conceptId || ''}
                                                        onChange={e => updateQuestion(qIdx, 'conceptId', e.target.value)}
                                                        className="w-full border border-slate-200 bg-white text-slate-700 rounded-lg p-2 text-sm outline-none focus:border-indigo-300"
                                                    >
                                                        <option value="">Selectionner un concept</option>
                                                        {selectableQuestionConcepts.map(concept => (
                                                            <option key={concept.id} value={concept.id}>
                                                                {concept.sourceLabel} / {concept.moduleTitle}{concept.chapitreTitle ? ` / ${concept.chapitreTitle}` : ''} / {concept.labelPedagogique || concept.id}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <input value={q.text} onChange={e => updateQuestion(qIdx, 'text', e.target.value)} placeholder="Intitulé de la question..." className="w-full text-lg font-bold border-b border-transparent focus:border-indigo-500 outline-none p-1" />
                                            <div className="grid grid-cols-2 gap-4">
                                                {q.options.map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex items-center gap-2">
                                                        <input value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} className="flex-1 border border-slate-100 rounded-lg p-2 text-sm outline-none focus:border-indigo-300" />
                                                    </div>
                                                ))}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Bonne reponse</label>
                                                <select
                                                    value={q.correctAnswer || ''}
                                                    onChange={e => updateQuestion(qIdx, 'correctAnswer', e.target.value)}
                                                    className="w-full border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg p-2 text-sm font-semibold outline-none focus:border-emerald-400"
                                                >
                                                    <option value="">Selectionner la bonne reponse</option>
                                                    {(q.options || []).filter(Boolean).map((opt, optIdx) => (
                                                        <option key={`${optIdx}-${opt}`} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                                                <select value={q.difficulty} onChange={e => updateQuestion(qIdx, 'difficulty', e.target.value)} className={`text-xs font-bold px-2 py-1 rounded-full border outline-none ${DIFFICULTY_COLORS[q.difficulty]}`}>
                                                    {DIFFICULTIES.map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                                                </select>
                                                <input value={q.hintText || ''} onChange={e => updateQuestion(qIdx, 'hintText', e.target.value)} placeholder="Indice (optionnel)..." className="flex-1 text-xs text-slate-500 bg-slate-50 rounded-lg p-2 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CustomDialog isOpen={dialogConfig.isOpen} type={dialogConfig.type} title={dialogConfig.title} message={dialogConfig.message} onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })} onConfirm={dialogConfig.onConfirm} />
        </div>
    );
}
