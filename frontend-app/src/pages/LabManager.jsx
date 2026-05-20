import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { FontFamily } from '@tiptap/extension-font-family';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Link as LinkExtension } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Subscript as TiptapSubscript } from '@tiptap/extension-subscript';
import { Superscript as TiptapSuperscript } from '@tiptap/extension-superscript';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
    useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Plus, Save, Trash2, GripVertical, Lock, ChevronRight,
    Terminal, Settings, Clock, Eraser, Bold, Italic, Strikethrough,
    List, ListOrdered, Code, Underline as UnderlineIcon, Link as LinkIcon,
    AlignLeft, AlignCenter, AlignRight, Table as TableIcon, Github,
    Eye, Layout, Palette, Highlighter, Quote, Minus, Combine, PanelTop,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon
} from 'lucide-react';
import { labApi, courseApi, graphApi } from '../api/apiClient';
import CustomDialog from '../components/CustomDialog';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { normalizeCourseTree } from '../utils/courseOrder';

const lowlight = createLowlight(common);
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const DIFF_LABELS = { EASY: 'Facile', MEDIUM: 'Moyen', HARD: 'Difficile' };
const DIFF_COLORS = { EASY: 'text-emerald-700 bg-emerald-50 border-emerald-300', MEDIUM: 'text-amber-700 bg-amber-50 border-amber-300', HARD: 'text-red-700 bg-red-50 border-red-300' };

const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() { return { types: ['textStyle'] } },
    addGlobalAttributes() {
        return [{ types: this.options.types, attributes: { fontSize: { default: null, parseHTML: element => (element.style.fontSize || '').replace(/['"]+/g, ''), renderHTML: attributes => { if (!attributes.fontSize) return {}; return { style: `font-size: ${attributes.fontSize}` } } } } }]
    },
    addCommands() { return { setFontSize: fontSize => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(), unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run() } }
});

const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                parseHTML: element => element.getAttribute('data-background-color'),
                renderHTML: attributes => {
                    if (!attributes.backgroundColor) return {}
                    return { 'data-background-color': attributes.backgroundColor, style: `background-color: ${attributes.backgroundColor}` }
                },
            },
        }
    },
});

const SUBMISSION_STEP = {
    id: '__submission__',
    title: '🔒 Soumission GitHub',
    content: '<p>Pour valider ce TP, soumettez le lien de votre dépôt GitHub contenant votre travail.</p>',
    orderIndex: 9999,
    locked: true,
};

const newStep = (idx) => ({ id: crypto.randomUUID(), title: `Étape ${idx + 1}`, content: '', orderIndex: idx });

/* ─── Sortable Step Item ──────────────────────────────────────────── */
function SortableStep({ step, isActive, onSelect, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: step.id, disabled: !!step.locked });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
        <div ref={setNodeRef} style={style}
            onClick={() => onSelect(step.id)}
            className={`group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border transition-all text-sm
                ${isActive ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                ${step.locked ? 'border-amber-200 bg-amber-50 text-amber-700 italic' : ''}`}>
            {!step.locked && (
                <button {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-indigo-400 shrink-0" onClick={e => e.stopPropagation()}>
                    <GripVertical size={16} />
                </button>
            )}
            {step.locked && <Github size={16} className="text-amber-500 shrink-0" />}
            <span className="truncate flex-1">{step.title}</span>
            {!step.locked && (
                <button onClick={e => { e.stopPropagation(); onDelete(step.id); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition shrink-0">
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    );
}

/* ─── Tiptap MenuBar ─────────────────────────────────────────────── */
const MenuBar = ({ editor }) => {
    const [showChars, setShowChars] = useState(false);
    const [inlineInput, setInlineInput] = useState(null);
    const SPECIAL_CHARS = ['≤', '≥', '≠', '±', '×', '÷', '√', '∑', '∫', 'π', 'α', 'β', 'γ', 'Δ', '∞', '→', '←', '↔', '∈', '∉', '∅', '∧', '∨', '∀', '∃', '²', '³'];

    if (!editor) return null;

    const addLink = () => {
        setInlineInput({
            type: 'link',
            title: 'Insérer un lien',
            placeholder: 'https://example.com',
            value: editor.getAttributes('link').href || '',
        });
    };

    const submitInlineInput = () => {
        const value = inlineInput?.value?.trim();
        if (!value) return;
        if (inlineInput.type === 'link') {
            editor.chain().focus().setLink({ href: value, target: '_blank' }).run();
        }
        setInlineInput(null);
    };

    const btnClass = (isActive = false) => isActive ? "p-1.5 rounded transition-all bg-indigo-100 text-indigo-700" : "p-1.5 rounded transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-600";

    return (
        <div className="flex flex-col border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex gap-2 flex-wrap p-2 items-center border-b border-slate-100">
                <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center gap-1">
                    <select onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()} value={editor.getAttributes('textStyle').fontFamily || ''} className="p-1 cursor-pointer outline-none text-[11px] text-slate-700 bg-transparent font-medium max-w-[80px]">
                        <option value="">Police</option><option value="Arial">Arial</option><option value="Courier New">Courier New</option><option value="Georgia">Georgia</option><option value="Trebuchet MS">Trebuchet MS</option><option value="Verdana">Verdana</option>
                    </select>
                    <select onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()} value={editor.getAttributes('textStyle').fontSize || ''} className="p-1 cursor-pointer outline-none text-[11px] text-slate-700 bg-transparent font-medium">
                        <option value="">Taille</option><option value="10pt">10</option><option value="12pt">12</option><option value="14pt">14</option><option value="18pt">18</option><option value="24pt">24</option>
                    </select>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <label className="p-1 hover:bg-slate-100 rounded cursor-pointer relative" title="Couleur de texte"><Palette size={14} className="text-slate-600" /><input type="color" onInput={e => editor.chain().focus().setColor(e.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} className="absolute opacity-0 inset-0 w-full h-full cursor-pointer" /></label>
                    <label className="p-1 hover:bg-slate-100 rounded cursor-pointer relative" title="Couleur de surlignage"><Highlighter size={14} className="text-slate-600" /><input type="color" onInput={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} className="absolute opacity-0 inset-0 w-full h-full cursor-pointer" /></label>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))}><Bold size={14} /></button>
                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))}><Italic size={14} /></button>
                    <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))}><UnderlineIcon size={14} /></button>
                    <button onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))}><Strikethrough size={14} /></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => editor.chain().focus().unsetAllMarks().run()} className={btnClass(false)} title="Nettoyer le formatage"><Eraser size={14} /></button>
                </div>

                <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center relative">
                    <button onClick={() => editor.chain().focus().toggleSuperscript().run()} className={btnClass(editor.isActive('superscript'))} title="Exposant"><SuperscriptIcon size={14} /></button>
                    <button onClick={() => editor.chain().focus().toggleSubscript().run()} className={btnClass(editor.isActive('subscript'))} title="Indice"><SubscriptIcon size={14} /></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <div className="relative">
                        <button onClick={() => setShowChars(!showChars)} className={btnClass()} title="Caractères Spéciaux">Ω</button>
                        {showChars && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg p-2 w-64 z-50 grid grid-cols-5 gap-1">
                                {SPECIAL_CHARS.map(char => (
                                    <button key={char} onClick={() => { editor.chain().focus().insertContent(char).run(); setShowChars(false); }} className="p-1.5 hover:bg-indigo-50 rounded text-slate-700 font-medium text-center">{char}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center">
                    <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Puces"><List size={14} /></button>
                    <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Numéros"><ListOrdered size={14} /></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="Aligner à gauche"><AlignLeft size={14} /></button>
                    <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="Centrer"><AlignCenter size={14} /></button>
                    <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="Aligner à droite"><AlignRight size={14} /></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="Citation"><Quote size={14} /></button>
                    <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnClass()} title="Ligne Séparatrice"><Minus size={14} /></button>
                    <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive('codeBlock'))} title="Bloc de code"><Code size={14} /></button>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap p-2 items-center">
                <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center gap-1">
                    <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Insérer Tableau"><TableIcon size={14} /></button>
                    <button onClick={() => editor.chain().focus().deleteTable().run()} className="p-1 hover:bg-red-50 rounded text-red-500" title="Supprimer Tableau"><Trash2 size={14} /></button>
                    <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-1 text-[10px] font-bold text-red-400 hover:text-red-600" title="Supprimer Colonne">C-</button>
                    <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600" title="Ajouter Colonne">C+</button>
                    <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-1 text-[10px] font-bold text-red-400 hover:text-red-600" title="Supprimer Ligne">L-</button>
                    <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600" title="Ajouter Ligne">L+</button>
                    <button onClick={() => editor.chain().focus().mergeCells().run()} className="p-1 hover:bg-slate-100 rounded text-indigo-600" title="Fusionner"><Combine size={14} /></button>
                    <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="p-1 hover:bg-slate-100 rounded text-indigo-600" title="Transformer ligne en En-tête"><PanelTop size={14} /></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <label className="p-1 hover:bg-slate-100 rounded cursor-pointer relative" title="Couleur de fond cellule"><Palette size={14} className="text-emerald-600" /><input type="color" onInput={e => editor.chain().focus().setCellAttribute('backgroundColor', e.target.value).run()} className="absolute opacity-0 inset-0 w-full h-full cursor-pointer" /></label>
                </div>
                <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center gap-1">
                    <button onClick={addLink} className={btnClass(editor.isActive('link'))} title="Lien Hypertexte"><LinkIcon size={14} /></button>
                </div>
            </div>
            {inlineInput && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
                    <label className="text-xs font-semibold text-slate-600">{inlineInput.title}</label>
                    <input
                        type="text"
                        value={inlineInput.value}
                        onChange={(event) => setInlineInput({ ...inlineInput, value: event.target.value })}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') submitInlineInput();
                            if (event.key === 'Escape') setInlineInput(null);
                        }}
                        placeholder={inlineInput.placeholder}
                        className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                        type="button"
                        onClick={submitInlineInput}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                        Insérer
                    </button>
                    <button
                        type="button"
                        onClick={() => setInlineInput(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Annuler
                    </button>
                </div>
            )}
        </div>
    );
};

/* ─── Main Component ──────────────────────────────────────────────── */
export default function LabManager() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [modules, setModules] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [concepts, setConcepts] = useState([]);

    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedModule, setSelectedModule] = useState('');
    const [selectedChapter, setSelectedChapter] = useState('');
    const [selectedConcept, setSelectedConcept] = useState('');

    const [labId, setLabId] = useState(null);
    const [title, setTitle] = useState('');
    const [difficulty, setDifficulty] = useState('MEDIUM');
    const [estimatedTime, setEstimatedTime] = useState(60);
    const [steps, setSteps] = useState([newStep(0)]);
    const [activeStepId, setActiveStepId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [dialog, setDialog] = useState({ isOpen: false, type: 'confirm', title: '', message: '', onConfirm: null });

    const stepsWithSubmission = [...steps.sort((a, b) => a.orderIndex - b.orderIndex), SUBMISSION_STEP];
    const activeStep = stepsWithSubmission.find(s => s.id === activeStepId) || stepsWithSubmission[0];

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ codeBlock: false }),
            FontFamily, FontSize, Underline, TextStyle, Color,
            Highlight.configure({ multicolor: true }),
            LinkExtension.configure({ openOnClick: false }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({ resizable: true }), TableRow, CustomTableCell, TableHeader,
            TiptapSubscript, TiptapSuperscript,
            CodeBlockLowlight.configure({ lowlight }),
        ],
        content: activeStep?.content || '',
        onUpdate: ({ editor }) => {
            if (activeStep && !activeStep.locked) {
                setSteps(prev => prev.map(s => s.id === activeStep.id ? { ...s, content: editor.getHTML() } : s));
            }
        },
        editorProps: { attributes: { class: 'prose prose-indigo max-w-none focus:outline-none p-8 outline-none min-h-full ProseMirror' } },
    });

    useEffect(() => {
        if (editor && activeStep && editor.getHTML() !== (activeStep.content || '')) {
            editor.commands.setContent(activeStep.content || '', false);
        }
    }, [activeStepId, editor]);

    useEffect(() => {
        if (!user?.email) return;
        graphApi.getTeacherCourses(user.email).then(r => setCourses(r.data)).catch(() => { });
    }, [user?.email]);

    useEffect(() => {
        if (!selectedCourse) { setModules([]); setSelectedModule(''); return; }
        courseApi.getCourseTree(selectedCourse).then(r => setModules(normalizeCourseTree(r.data)?.modules || [])).catch(() => { });
    }, [selectedCourse]);

    useEffect(() => {
        if (!selectedModule) { setChapters([]); setSelectedChapter(''); return; }
        const mod = modules.find(m => m.id === selectedModule);
        setChapters(mod?.chapitres || []);
    }, [selectedModule, modules]);

    useEffect(() => {
        if (!selectedChapter) { setConcepts([]); setSelectedConcept(''); return; }
        const chap = chapters.find(c => c.id === selectedChapter);
        setConcepts(chap?.concepts || []);
    }, [selectedChapter, chapters]);

    useEffect(() => {
        if (!selectedConcept) return;
        labApi.getLabByTarget(selectedConcept)
            .then(r => {
                const lab = r.data;
                setLabId(lab.id); setTitle(lab.title || ''); setDifficulty(lab.difficulty || 'MEDIUM');
                setEstimatedTime(lab.estimatedTime || 60);
                setSteps(lab.steps?.filter(s => s.id !== '__submission__') || [newStep(0)]);
                setActiveStepId(lab.steps?.[0]?.id || null);
            })
            .catch(err => {
                if (err.response?.status === 404) {
                    setLabId(null); setTitle(''); setDifficulty('MEDIUM'); setEstimatedTime(60);
                    const s = newStep(0); setSteps([s]); setActiveStepId(s.id);
                }
            });
    }, [selectedConcept]);

    const handleDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        setSteps(prev => {
            const ids = prev.map(s => s.id);
            const oldIdx = ids.indexOf(active.id);
            const newIdx = ids.indexOf(over.id);
            return arrayMove(prev, oldIdx, newIdx).map((s, i) => ({ ...s, orderIndex: i }));
        });
    };

    const handleSave = async () => {
        if (!selectedConcept || !title.trim()) {
            setDialog({ isOpen: true, type: 'error', title: 'Données manquantes', message: 'Le titre du TP est requis.' });
            return;
        }
        if (!difficulty) {
            setDialog({ isOpen: true, type: 'error', title: 'Données manquantes', message: 'Veuillez sélectionner un niveau de difficulté.' });
            return;
        }

        setSaving(true);
        try {
            const labData = {
                id: labId,
                targetId: selectedConcept,
                courseId: selectedCourse,
                title: title.trim(),
                difficulty,
                estimatedTime,
                requireGithub: true,
                steps: steps.map((s, i) => ({
                    id: s.id,
                    title: s.title,
                    content: s.content,
                    orderIndex: i
                })),
            };

            const r = await labApi.saveLab(labData);
            setLabId(r.data.id);
            toast.success('TP sauvegardé avec succès !');
        } catch (err) {
            console.error('[LabManager] Save Error:', err);
            toast.error(`Échec de la sauvegarde : ${err.response?.data?.message || 'Erreur serveur.'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-8 max-w-7xl mx-auto py-8 px-4">
            {/* 1. Header & Save */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Terminal className="text-indigo-600" size={32} /> Gestion des TP
                    </h1>
                    <p className="text-slate-500 mt-1">Créez et configurez vos travaux pratiques techniques.</p>
                </div>
                {selectedConcept && (
                    <button onClick={handleSave} disabled={saving}
                        className={`flex items-center gap-2 px-8 py-3 font-bold text-white rounded-xl shadow-lg transition-all
                            ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'}`}>
                        <Save size={20} /> {saving ? 'Sauvegarde…' : 'Sauvegarder le TP'}
                    </button>
                )}
            </div>

            {/* 2. Hierarchy Selectors */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 shrink-0">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                    <span className="text-xs font-black text-indigo-600">1</span>
                    <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedModule(''); setSelectedChapter(''); setSelectedConcept(''); }}
                        className="bg-transparent text-slate-700 font-bold text-sm outline-none w-44">
                        <option value="">Choisir le Cours</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </div>
                <ChevronRight className="text-slate-300" size={20} />
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                    <span className="text-xs font-black text-slate-400">2</span>
                    <select value={selectedModule} onChange={e => { setSelectedModule(e.target.value); setSelectedChapter(''); setSelectedConcept(''); }} disabled={!selectedCourse}
                        className="bg-transparent text-slate-700 text-sm outline-none w-44 disabled:opacity-50">
                        <option value="">Choisir le Module</option>
                        {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                </div>
                <ChevronRight className="text-slate-300" size={20} />
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                    <span className="text-xs font-black text-slate-400">3</span>
                    <select value={selectedChapter} onChange={e => { setSelectedChapter(e.target.value); setSelectedConcept(''); }} disabled={!selectedModule}
                        className="bg-transparent text-slate-700 text-sm outline-none w-44 disabled:opacity-50">
                        <option value="">Choisir le Chapitre</option>
                        {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </div>
                <ChevronRight className="text-slate-300" size={20} />
                <div className={`flex items-center gap-3 border-2 rounded-xl px-4 py-2 transition-all
                    ${selectedConcept ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                    <span className={`text-xs font-black ${selectedConcept ? 'text-emerald-600' : 'text-slate-400'}`}>4</span>
                    <select value={selectedConcept} onChange={e => setSelectedConcept(e.target.value)} disabled={!selectedChapter}
                        className="bg-transparent text-slate-800 font-bold text-sm outline-none w-44 disabled:opacity-50">
                        <option value="">Choisir le Concept</option>
                        {concepts.map(c => <option key={c.id} value={c.id}>{c.labelPedagogique || c.id}</option>)}
                    </select>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {!selectedConcept ? (
                    <motion.div key="placeholder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6">
                            <Terminal size={40} className="text-slate-300" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-500 mb-2">Sélectionnez un concept pédagogique pour éditer le contenu.</h2>
                    </motion.div>
                ) : (
                    <motion.div key="editor-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8 min-h-0">

                        {/* 3. Configuration Section */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 border-t-4 border-t-indigo-500 space-y-8">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                <Settings size={22} className="text-indigo-600" /> Configuration du TP
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-black text-slate-400 mb-2 uppercase tracking-widest text-[10px]">Titre du TP</label>
                                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Manipulation des Hooks React"
                                        className="w-full text-2xl font-bold text-slate-800 border-b-2 border-slate-100 py-2 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-200" />
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-400 mb-2 uppercase tracking-widest text-[10px]">Temps Estimé (min)</label>
                                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <Clock className="text-slate-400" size={20} />
                                        <input type="number" value={estimatedTime} onChange={e => setEstimatedTime(Number(e.target.value))}
                                            className="bg-transparent text-xl font-bold text-slate-700 w-full outline-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-slate-50">
                                <div className="space-y-3">
                                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest text-[10px]">Niveau de Difficulté</label>
                                    <div className="flex gap-2">
                                        {DIFFICULTIES.map(d => (
                                            <button key={d} onClick={() => setDifficulty(d)}
                                                className={`px-6 py-2.5 rounded-xl text-xs font-black border transition-all
                                                    ${difficulty === d ? DIFF_COLORS[d] + ' shadow-sm border-2' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                                                {DIFF_LABELS[d]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="max-w-md p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                                    <Github className="text-amber-500 shrink-0" size={20} />
                                    <p className="text-xs text-amber-700 leading-relaxed font-bold">
                                        Note : La validation par dépôt GitHub est obligatoire pour ce type de TP technique.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 4. Steps & Editor Area */}
                        <div className="flex gap-6 min-h-[600px]">
                            {/* Sidebar Steps */}
                            <div className="w-80 shrink-0 flex flex-col gap-4">
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden border-t-4 border-t-indigo-500">
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                            <List size={14} /> Étapes du parcours
                                        </h3>
                                        <button onClick={() => { const s = newStep(steps.length); setSteps([...steps, s]); setActiveStepId(s.id); }}
                                            className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/30">
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                                {steps.sort((a, b) => a.orderIndex - b.orderIndex).map(step => (
                                                    <SortableStep key={step.id} step={step} isActive={activeStepId === step.id} onSelect={setActiveStepId}
                                                        onDelete={(id) => {
                                                            setDialog({
                                                                isOpen: true, type: 'confirm', title: 'Supprimer l\'étape ?', message: 'Cette action est irréversible et le contenu sera perdu.', onConfirm: () => {
                                                                    const next = steps.filter(s => s.id !== id).map((s, i) => ({ ...s, orderIndex: i }));
                                                                    setSteps(next); setActiveStepId(next[0]?.id || null); setDialog(d => ({ ...d, isOpen: false }));
                                                                }
                                                            });
                                                        }} />
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                        <SortableStep step={SUBMISSION_STEP} isActive={activeStepId === SUBMISSION_STEP.id} onSelect={setActiveStepId} onDelete={() => { }} />
                                    </div>
                                </div>
                            </div>

                            {/* Main Editor Section */}
                            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden border-t-4 border-t-indigo-500">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                    {activeStep?.locked ? (
                                        <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest"><Lock size={14} /> Étape de Validation Finale</div>
                                    ) : (
                                        <input value={activeStep?.title || ''} onChange={e => setSteps(prev => prev.map(s => s.id === activeStep.id ? { ...s, title: e.target.value } : s))}
                                            className="text-lg font-bold text-slate-700 outline-none bg-transparent w-full focus:text-indigo-600 transition-colors" />
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col overflow-hidden relative">
                                    {!activeStep?.locked ? (
                                        <>
                                            <MenuBar editor={editor} />
                                            <div className="flex-1 overflow-y-auto w-full bg-slate-100/30">
                                                <div className="max-w-4xl mx-auto bg-white min-h-full shadow-sm border-x border-slate-100">
                                                    <EditorContent editor={editor} />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center p-12 text-center bg-slate-50/20">
                                            <div className="max-w-md">
                                                <Github size={64} className="mx-auto mb-6 text-slate-300" />
                                                <h3 className="text-xl font-bold text-slate-800 mb-3">Validation par Dépôt GitHub</h3>
                                                <p className="text-slate-500 text-sm leading-relaxed">
                                                    Cette étape est générée automatiquement. L'étudiant devra obligatoirement soumettre l'URL de son dépôt public pour que le TP soit considéré comme terminé et que le concept soit validé dans son profil de maîtrise.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CustomDialog isOpen={dialog.isOpen} type={dialog.type} title={dialog.title} message={dialog.message} onClose={() => setDialog(d => ({ ...d, isOpen: false }))} onConfirm={dialog.onConfirm} />
            <style dangerouslySetInnerHTML={{
                __html: ` 
                .ProseMirror { min-height: 100%; padding: 40px; outline: none; } 
                .ProseMirror blockquote { border-left: 4px solid #818cf8; padding-left: 1rem; color: #475569; font-style: italic; background: #f8fafc; padding: 1rem; border-radius: 0 0.5rem 0.5rem 0; margin-left: 0; }
                .ProseMirror pre { background: #0f172a; color: #f8fafc; padding: 1.5rem; border-radius: 1rem; font-family: 'JetBrains Mono', monospace; font-size: 14px; margin: 1rem 0; }
                .ProseMirror hr { border: none; border-top: 2px solid #e2e8f0; margin: 2rem 0; }
                .ProseMirror ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                .ProseMirror ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                .ProseMirror li { display: list-item !important; margin-bottom: 0.25rem; }
                .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 1.5rem 0; overflow: hidden; border-radius: 0.5rem; border: 1px solid #e2e8f0; } 
                .ProseMirror td, .ProseMirror th { border: 1px solid #cbd5e1 !important; min-width: 1em; padding: 12px; position: relative; vertical-align: top; } 
                .ProseMirror th { background-color: #f8fafc !important; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #64748b; } 
                .ProseMirror .selectedCell:after { z-index: 2; position: absolute; content: ""; left: 0; right: 0; top: 0; bottom: 0; background: rgba(99, 102, 241, 0.1); pointer-events: none; }
                .ProseMirror .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: -2px; width: 4px; background-color: #6366f1; cursor: col-resize; z-index: 20; }
                .hljs-keyword, .hljs-built_in { color: #f472b6; }
                .hljs-string { color: #a3e635; }
                .hljs-number { color: #fbbf24; }
                .hljs-title { color: #60a5fa; font-weight: bold; }
                .hljs-comment { color: #94a3b8; font-style: italic; }
            `}} />
        </div>
    );
}
