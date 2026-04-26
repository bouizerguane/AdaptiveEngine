import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Image as ImageExtension } from '@tiptap/extension-image';
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
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import Youtube from '@tiptap/extension-youtube';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { 
    Book, ChevronRight, Save, Image as ImageIcon, Video, UploadCloud, Link as LinkIcon, 
    Maximize2, Minimize2, Loader2, AlertCircle, Eye, X, Bold, Italic, Strikethrough, 
    List, ListOrdered, Quote, Code, Underline as UnderlineIcon, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify, Palette, Highlighter, 
    Table as TableIcon, CheckSquare, Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    Trash2, Plus, Minus, GraduationCap, Youtube as YoutubeIcon, FileText, Type, Combine, PanelTop,
    Eraser, Sigma
} from 'lucide-react';
import { contentApi, courseApi, adminApi } from '../api/apiClient';
import CustomDialog from '../components/CustomDialog';
import toast from 'react-hot-toast';

const lowlight = createLowlight(common);

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { fontSize: { default: null, parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''), renderHTML: attributes => { if (!attributes.fontSize) return {}; return { style: `font-size: ${attributes.fontSize}` } } } } }]
  },
  addCommands() { return { setFontSize: fontSize => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(), unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run() } }
});

const CustomImage = ImageExtension.extend({
  addAttributes() { return { ...this.parent?.(), width: { default: '100%', parseHTML: element => element.getAttribute('width') || element.style.width, renderHTML: attributes => ({ width: attributes.width, style: `width: ${attributes.width}; max-width: 100%; height: auto; transition: width 0.3s ease;` }) } } }
});

const VideoExtension = Node.create({
  name: 'video', group: 'block', selectable: true, draggable: true,
  addAttributes() { return { src: { default: null }, width: { default: '100%' } } },
  parseHTML() { return [{ tag: 'video' }] },
  renderHTML({ HTMLAttributes }) { return ['video', { ...HTMLAttributes, controls: 'true', style: `width: ${HTMLAttributes.width}; max-width: 100%; border-radius: 0.5rem; transition: width 0.3s ease;` }] },
  addCommands() { return { setVideo: options => ({ commands }) => commands.insertContent({ type: this.name, attrs: options }) } }
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

const PdfExtension = Node.create({
  name: 'pdf', group: 'block', selectable: true, draggable: true,
  addAttributes() { return { href: { default: null }, filename: { default: 'Document PDF' } } },
  parseHTML() { return [{ tag: 'iframe[data-type="pdf"]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['iframe', { src: HTMLAttributes.href, 'data-type': 'pdf', width: '100%', height: '500px', class: 'w-full h-[500px] border border-slate-200 rounded-xl my-4 shadow-sm' }]
  },
  addCommands() { return { setPdf: options => ({ commands }) => commands.insertContent({ type: this.name, attrs: options }) } }
});

const MenuBar = ({ editor, isFullscreen, setIsFullscreen }) => {
    if (!editor) return null;

    const [showChars, setShowChars] = useState(false);
    const SPECIAL_CHARS = ['α', 'β', 'γ', '∞', '∑', 'Δ', '≈', '≠', 'π', 'θ', 'μ', 'Ω', '±', '≤', '≥', '√'];

    const addYoutubeVideo = () => {
        const url = prompt('URL de la vidéo YouTube :');
        if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
    };

    const addImageUrl = () => {
        const url = prompt('URL de l\'image :');
        if (url) editor.chain().focus().setImage({ src: url }).run();
    };

    const addLink = () => {
        const url = prompt('URL du lien (ex: https://...) :');
        if (url) editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
    };

    const insertEquation = () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, ' ');
        if (text) {
            editor.chain().focus().insertContent(`$${text}$`).run();
        } else {
            const eq = prompt("Saisissez l'équation :");
            if (eq) editor.chain().focus().insertContent(`$${eq}$`).run();
        }
    };

    const setSelectionWidth = (width) => {
        if (editor.isActive('image')) editor.chain().focus().updateAttributes('image', { width }).run();
        else if (editor.isActive('video')) editor.chain().focus().updateAttributes('video', { width }).run();
    };

    const btnClass = (isActive = false) => isActive ? "p-1.5 rounded transition-all bg-indigo-100 text-indigo-700" : "p-1.5 rounded transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-600";

    return (
        <div className="flex flex-col border-b border-slate-200 bg-slate-50 shrink-0">
            {/* ROW 1: FORMATTING, SCIENTIFIC, STRUCTURE */}
            <div className="flex gap-2 flex-wrap p-2 items-center border-b border-slate-100">
                {/* Style Group */}
                <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center gap-1">
                    <select onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()} value={editor.getAttributes('textStyle').fontFamily || ''} className="p-1 cursor-pointer outline-none text-[11px] text-slate-700 bg-transparent font-medium max-w-[80px]">
                        <option value="">Police</option><option value="Arial">Arial</option><option value="Courier New">Courier New</option><option value="Georgia">Georgia</option><option value="Trebuchet MS">Trebuchet MS</option><option value="Verdana">Verdana</option>
                    </select>
                    <select onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()} value={editor.getAttributes('textStyle').fontSize || ''} className="p-1 cursor-pointer outline-none text-[11px] text-slate-700 bg-transparent font-medium">
                        <option value="">Taille</option><option value="10pt">10</option><option value="12pt">12</option><option value="14pt">14</option><option value="18pt">18</option><option value="24pt">24</option>
                    </select>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <label className="p-1 hover:bg-slate-100 rounded cursor-pointer relative" title="Couleur de texte"><Palette size={14} className="text-slate-600"/><input type="color" onInput={e => editor.chain().focus().setColor(e.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"/></label>
                    <label className="p-1 hover:bg-slate-100 rounded cursor-pointer relative" title="Couleur de surlignage"><Highlighter size={14} className="text-slate-600"/><input type="color" onInput={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"/></label>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))}><Bold size={14}/></button>
                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))}><Italic size={14}/></button>
                    <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))}><UnderlineIcon size={14}/></button>
                    <button onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))}><Strikethrough size={14}/></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => editor.chain().focus().unsetAllMarks().run()} className={btnClass(false)} title="Nettoyer le formatage (Gomme)"><Eraser size={14}/></button>
                </div>

                {/* Scientifique Group */}
                <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center relative">
                    <button onClick={() => editor.chain().focus().toggleSuperscript().run()} className={btnClass(editor.isActive('superscript'))} title="Exposant"><SuperscriptIcon size={14}/></button>
                    <button onClick={() => editor.chain().focus().toggleSubscript().run()} className={btnClass(editor.isActive('subscript'))} title="Indice"><SubscriptIcon size={14}/></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={insertEquation} className={btnClass()} title="Insérer une Équation"><Sigma size={14}/></button>
                    <div className="relative">
                        <button onClick={() => setShowChars(!showChars)} className={btnClass()} title="Caractères Spéciaux">Ω</button>
                        {showChars && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg p-2 w-48 z-50 grid grid-cols-4 gap-1">
                                {SPECIAL_CHARS.map(char => (
                                    <button key={char} onClick={() => { editor.chain().focus().insertContent(char).run(); setShowChars(false); }} className="p-1.5 hover:bg-indigo-50 rounded text-slate-700 font-medium text-center">{char}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Structure Group */}
                <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center">
                    <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Puces"><List size={14}/></button>
                    <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Numéros"><ListOrdered size={14}/></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="Aligner à gauche"><AlignLeft size={14}/></button>
                    <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="Centrer"><AlignCenter size={14}/></button>
                    <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="Aligner à droite"><AlignRight size={14}/></button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="Citation"><Quote size={14}/></button>
                    <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnClass()} title="Ligne Séparatrice"><Minus size={14}/></button>
                    <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive('codeBlock'))} title="Bloc de code"><Code size={14}/></button>
                </div>
            </div>

            {/* ROW 2: INSERTION & TABLES */}
            <div className="flex gap-2 flex-wrap p-2 items-center justify-between">
                <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center gap-1">
                        <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Insérer Tableau"><TableIcon size={14}/></button>
                        <button onClick={() => editor.chain().focus().deleteTable().run()} className="p-1 hover:bg-red-50 rounded text-red-500" title="Supprimer Tableau"><Trash2 size={14}/></button>
                        <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-1 text-[10px] font-bold text-red-400 hover:text-red-600" title="Supprimer Colonne">C-</button>
                        <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600" title="Ajouter Colonne">C+</button>
                        <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-1 text-[10px] font-bold text-red-400 hover:text-red-600" title="Supprimer Ligne">L-</button>
                        <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600" title="Ajouter Ligne">L+</button>
                        <button onClick={() => editor.chain().focus().mergeCells().run()} className="p-1 hover:bg-slate-100 rounded text-indigo-600" title="Fusionner"><Combine size={14}/></button>
                        <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="p-1 hover:bg-slate-100 rounded text-indigo-600" title="Transformer ligne en En-tête"><PanelTop size={14}/></button>
                        <div className="w-px h-4 bg-slate-200 mx-1"></div>
                        <label className="p-1 hover:bg-slate-100 rounded cursor-pointer relative" title="Couleur de fond cellule"><Palette size={14} className="text-emerald-600"/><input type="color" onInput={e => editor.chain().focus().setCellAttribute('backgroundColor', e.target.value).run()} className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"/></label>
                    </div>

                    <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm items-center gap-1">
                        <button onClick={addImageUrl} className={btnClass()} title="Image par URL"><ImageIcon size={14}/></button>
                        <button onClick={addYoutubeVideo} className={btnClass()} title="YouTube"><YoutubeIcon size={14}/></button>
                        <button onClick={addLink} className={btnClass(editor.isActive('link'))} title="Lien Hypertexte"><LinkIcon size={14}/></button>
                    </div>

                    {(editor.isActive('image') || editor.isActive('video')) && (
                        <div className="flex bg-indigo-600 border border-indigo-700 rounded-lg p-1 shadow-sm items-center gap-1 animate-in fade-in zoom-in">
                            <button onClick={() => setSelectionWidth('25%')} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white hover:bg-white/40">25%</button>
                            <button onClick={() => setSelectionWidth('50%')} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white hover:bg-white/40">50%</button>
                            <button onClick={() => setSelectionWidth('100%')} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white hover:bg-white/40">100%</button>
                        </div>
                    )}
                </div>
                
                <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shadow-sm text-slate-600 flex items-center justify-center transition-all" title="Plein Écran">
                    {isFullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                </button>
            </div>
        </div>
    );
};





export default function TeacherResources() {
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [modules, setModules] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [concepts, setConcepts] = useState([]);

    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedModule, setSelectedModule] = useState('');
    const [selectedChapter, setSelectedChapter] = useState('');
    const [selectedConcept, setSelectedConcept] = useState('');
    
    const [loadingHierarchy, setLoadingHierarchy] = useState(true);
    const [editorHtml, setEditorHtml] = useState('');
    const [loadingContent, setLoadingContent] = useState(false);

    const [isFullscreen, setIsFullscreen] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit, CustomImage, VideoExtension, PdfExtension, FontFamily, FontSize, Underline, 
            TextAlign.configure({ types: ['heading', 'paragraph'] }), TextStyle, Color, 
            Highlight.configure({ multicolor: true }), LinkExtension.configure({ openOnClick: false }), 
            Table.configure({ resizable: true }), TableRow, TableHeader, CustomTableCell, 
            TaskList, TaskItem.configure({ nested: true }), Subscript, Superscript, 
            Youtube.configure({ controls: true, nocookie: true }),
            CodeBlockLowlight.configure({ lowlight })
        ],
        content: editorHtml,
        onUpdate: ({ editor }) => setEditorHtml(editor.getHTML()),
        editorProps: { attributes: { class: 'prose prose-slate prose-lg max-w-none focus:outline-none p-8 outline-none min-h-full' } },
    });

    const [mediaFile, setMediaFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        courseApi.getCourses().then(r => setCourses(r.data)).catch(() => {}).finally(() => setLoadingHierarchy(false));
    }, []);

    useEffect(() => {
        if (!selectedCourse) { setModules([]); setSelectedModule(''); return; }
        courseApi.getCourseTree(selectedCourse).then(r => {
            setModules(r.data.modules || []);
            setSelectedModule(''); setChapters([]); setSelectedChapter(''); setConcepts([]); setSelectedConcept('');
        });
    }, [selectedCourse]);

    useEffect(() => {
        if (!selectedModule) { setChapters([]); setSelectedChapter(''); return; }
        const mod = modules.find(m => m.id === selectedModule);
        setChapters(mod?.chapitres || []);
        setSelectedChapter(''); setConcepts([]); setSelectedConcept('');
    }, [selectedModule, modules]);

    useEffect(() => {
        if (!selectedChapter) { setConcepts([]); setSelectedConcept(''); return; }
        const chap = chapters.find(c => c.id === selectedChapter);
        setConcepts(chap?.concepts || []);
        setSelectedConcept('');
    }, [selectedChapter, chapters]);



    useEffect(() => {
        if (selectedConcept) loadContent(selectedConcept);
        else { setEditorHtml(''); if (editor) editor.commands.setContent(''); }
    }, [selectedConcept]);

    // Check for unsaved changes before navigating
    const [pendingNavigate, setPendingNavigate] = useState(null);
    const initialContent = useRef('');
    
    // Set initial content when loaded
    useEffect(() => {
        if (!loadingContent) initialContent.current = editorHtml;
    }, [loadingContent]);

    const handleToolNavigate = (navFn) => {
        navFn();
    };

    const loadContent = async (conceptId) => {
        setLoadingContent(true);
        try {
            const response = await contentApi.getConceptContent(conceptId);
            const content = response.data.htmlContent || '';
            setEditorHtml(content);
            if (editor) editor.commands.setContent(content);
        } catch (error) { setEditorHtml(''); if (editor) editor.commands.setContent(''); } finally { setLoadingContent(false); }
    };

    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const handleSaveContent = async () => {
        if (!selectedConcept) {
            toast.error('Veuillez sélectionner un concept pédagogique avant de sauvegarder.');
            return;
        }
        try {
            await contentApi.saveContent({ conceptId: selectedConcept, htmlContent: editorHtml });
            toast.success('Contenu de la ressource enregistré avec succès !');
        } catch (error) {
            toast.error('Une erreur est survenue lors de la sauvegarde du contenu.');
        }
    };

    const insertIntoEditor = (url, type, filename) => {
        if (!editor) return;
        if (type === 'image') editor.chain().focus().setImage({ src: url }).run();
        else if (type === 'video') editor.chain().focus().setVideo({ src: url }).run();
        else if (type === 'pdf') editor.chain().focus().setPdf({ href: url, filename }).run();
        else editor.chain().focus().setLink({ href: url, target: '_blank' }).insertContent(filename).run();
    };

    const handleMediaUpload = async (e) => {
        e.preventDefault();
        if (!mediaFile) return;
        setUploading(true);

        try {
            // Check MAX_UPLOAD_SIZE
            let maxSizeBytes = 10485760; // 10MB default
            try {
                const sizeRes = await adminApi.getSettingByKey('MAX_UPLOAD_SIZE');
                if (sizeRes.data && sizeRes.data.settingValue) {
                    const mbValue = parseFloat(sizeRes.data.settingValue);
                    if (!isNaN(mbValue)) maxSizeBytes = mbValue * 1024 * 1024;
                }
            } catch (err) {
                console.warn("Could not fetch MAX_UPLOAD_SIZE, using default 10MB");
            }

            if (mediaFile.size > maxSizeBytes) {
                setDialogConfig({ isOpen: true, type: 'error', title: 'Fichier trop volumineux', message: `Le fichier dépasse la limite autorisée (${Math.round(maxSizeBytes / 1024 / 1024)} MB).` });
                setUploading(false);
                return;
            }

            const formData = new FormData();
            formData.append("file", mediaFile);

            const res = await contentApi.uploadMedia(formData);
            const hostUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:8080';
            const absoluteUrl = `${hostUrl}${res.data.url}`;
            let mediaType = 'file';
            if (mediaFile.type.startsWith('video')) mediaType = 'video';
            else if (mediaFile.type.startsWith('image')) mediaType = 'image';
            else if (mediaFile.type === 'application/pdf') mediaType = 'pdf';
            insertIntoEditor(absoluteUrl, mediaType, mediaFile.name);
            toast.success('Fichier inséré avec succès !');
            setMediaFile(null);
            e.target.reset();
        } catch (error) { 
            toast.error('Échec du téléversement du fichier.'); 
        } finally { 
            setUploading(false); 
        }
    };

    if (loadingHierarchy) return <div className="flex h-64 items-center justify-center text-slate-400 font-medium">Initialisation du Graphe...</div>;

    return (
        <div className={isFullscreen ? "fixed inset-0 z-50 bg-slate-100 flex flex-col p-4 overflow-hidden" : "max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)]"}>
            <div className={`mb-6 flex justify-between items-end shrink-0 mt-4 px-4 ${isFullscreen ? 'hidden' : ''}`}>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><Book className="text-indigo-600" size={32} /> Éditeur de Ressources</h1>
                    <p className="text-slate-500 mt-2 text-lg">Liez des contenus riches interactifs à votre Knowledge Graph.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowPreview(true)} disabled={!editorHtml} className={`flex items-center gap-2 px-6 py-2.5 font-bold text-slate-700 bg-white border border-slate-300 rounded-xl shadow-sm transition-all ${!editorHtml ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}><Eye size={18} /> Aperçu</button>
                    <button onClick={handleSaveContent} disabled={!selectedConcept} className={`flex items-center gap-2 px-6 py-2.5 font-bold text-white rounded-xl shadow transition-all ${!selectedConcept ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}><Save size={18} /> Sauvegarder</button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0 px-4">
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2 shrink-0 ${isFullscreen ? 'hidden' : ''}`}>
                        <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="bg-slate-50 border border-indigo-200 text-indigo-700 font-bold text-sm rounded-lg p-2 outline-none w-48">
                            <option value="">1. Choisir le Cours</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        <ChevronRight className="text-slate-300" size={16} />
                        <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} disabled={!selectedCourse} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-2 outline-none w-48 disabled:opacity-50">
                            <option value="">2. Choisir le Module</option>
                            {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </select>
                        <ChevronRight className="text-slate-300" size={16} />
                        <select value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} disabled={!selectedModule} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-2 outline-none w-48 disabled:opacity-50">
                            <option value="">3. Choisir le Chapitre</option>
                            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        <ChevronRight className="text-slate-300" size={16} />
                        <select value={selectedConcept} onChange={(e) => setSelectedConcept(e.target.value)} disabled={!selectedChapter} className="bg-white border-2 border-emerald-500 text-emerald-800 font-bold text-sm rounded-lg p-2 outline-none w-48 disabled:opacity-50">
                            <option value="">4. Choisir le Concept</option>
                            {concepts.map(c => <option key={c.id} value={c.id}>{c.labelPedagogique}</option>)}
                        </select>
                    </div>

                    <AnimatePresence mode="wait">
                        {!selectedConcept ? (
                            <motion.div key="placeholder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex-1 flex items-center justify-center">
                                <p className="text-slate-400 font-medium text-lg flex items-center gap-2 italic">
                                    <Book size={24}/> Sélectionnez un concept pédagogique pour éditer le contenu.
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div key="editor" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}
                                className="bg-white rounded-2xl border border-slate-200 shadow-xl flex-1 flex flex-col overflow-hidden relative border-t-4 border-t-indigo-500">
                                {loadingContent && <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-indigo-600 mr-2" size={24}/><span className="font-bold text-slate-600">Chargement...</span></div>}
                                <div className="flex-1 overflow-hidden relative flex flex-col bg-white">
                                    <MenuBar editor={editor} isFullscreen={isFullscreen} setIsFullscreen={setIsFullscreen} />
                                    <div className="flex-1 overflow-y-auto w-full p-2 bg-slate-100/30">
                                        <div className={`bg-white min-h-full mx-auto shadow-sm border-x border-slate-100 ${isFullscreen ? 'max-w-6xl' : 'max-w-4xl'}`}>
                                            <EditorContent editor={editor} className="min-h-full" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className={`w-80 shrink-0 flex flex-col gap-4 ${isFullscreen ? 'hidden' : ''}`}>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><UploadCloud className="text-indigo-500" size={20} /> Insertion Médias</h3>
                        <p className="text-xs text-slate-400 mb-4 font-medium">Téléversez un fichier local (Image, Vidéo MP4 ou PDF) pour l'insérer au point d'insertion.</p>
                        <form onSubmit={handleMediaUpload} className="flex flex-col gap-4 border-t border-slate-100 pt-4">
                            <input type="file" accept="image/*,video/mp4,.pdf" onChange={(e) => setMediaFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 outline-none cursor-pointer" />
                            <button type="submit" disabled={!mediaFile || uploading} className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition shadow ${!mediaFile ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : uploading ? 'bg-indigo-400 text-white cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}><UploadCloud size={18}/> {uploading ? "Envoi..." : "Insérer au curseur"}</button>
                        </form>
                    </div>
                </div>
            </div>

            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Eye className="text-indigo-600" /> Aperçu Apprenant</h3></div>
                            <button onClick={() => setShowPreview(false)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg"><X size={24} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 bg-white preview-container"><div className="prose prose-slate prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: editorHtml }} /></div>
                    </div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{__html: ` 
                .ProseMirror { min-height: 100%; padding: 40px; outline: none; } 
                .ProseMirror blockquote { border-left: 4px solid #818cf8; padding-left: 1rem; color: #475569; font-style: italic; background: #f8fafc; padding: 1rem; border-radius: 0 0.5rem 0.5rem 0; margin-left: 0; }
                .ProseMirror pre { background: #0f172a; color: #f8fafc; padding: 1rem; border-radius: 0.5rem; font-family: monospace; }
                .ProseMirror hr { border: none; border-top: 2px solid #e2e8f0; margin: 2rem 0; }
                .ProseMirror ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                .ProseMirror ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                .ProseMirror li { display: list-item !important; }
                .ProseMirror table, .preview-container table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 1rem 0; overflow: hidden; } 
                .ProseMirror td, .ProseMirror th, .preview-container td, .preview-container th { border: 1px solid #cbd5e1 !important; min-width: 1em; padding: 12px; position: relative; vertical-align: top; } 
                .ProseMirror th, .preview-container th { background-color: #f8fafc !important; font-weight: bold; } 
                .ProseMirror .selectedCell:after { z-index: 2; position: absolute; content: ""; left: 0; right: 0; top: 0; bottom: 0; background: rgba(99, 102, 241, 0.1); pointer-events: none; }
                .ProseMirror .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: -2px; width: 4px; background-color: #6366f1; cursor: col-resize; z-index: 20; }
                .ProseMirror video, .ProseMirror img { border: 2px solid transparent; }
                .ProseMirror .ProseMirror-selectednode { outline: 3px solid #6366f1; border-radius: 4px; }
                .hljs-keyword, .hljs-built_in { color: #f472b6; }
                .hljs-string { color: #a3e635; }
                .hljs-number { color: #fbbf24; }
                .hljs-title { color: #60a5fa; font-weight: bold; }
                .hljs-comment { color: #94a3b8; font-style: italic; }
            `}} />
            <CustomDialog 
                isOpen={dialogConfig.isOpen} 
                type={dialogConfig.type}
                title={dialogConfig.title}
                message={dialogConfig.message}
                onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
                onConfirm={dialogConfig.onConfirm}
            />
        </div>
    );
}
