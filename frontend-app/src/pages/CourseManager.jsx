import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ChevronDown, ChevronRight, Plus, Folder, FileText, Layers, Trash2, 
    Edit2, Loader2, X, GraduationCap, GripVertical
} from 'lucide-react';
import { 
    DndContext, 
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { graphApi, courseApi } from '../api/apiClient';
import CustomDialog from '../components/CustomDialog';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// --- COMPOSANT SORTABLE POUR MODULES ---
function SortableModule({ mod, courseId, expanded, onToggle, onEdit, onDelete, children }) {
    const navigate = useNavigate();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : 'auto' };

    return (
        <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden group">
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-indigo-50/30 transition" onClick={onToggle}>
                <div className="flex items-center gap-3">
                    <div {...attributes} {...listeners} className="cursor-grab p-1 text-slate-300 hover:text-indigo-500"><GripVertical size={18} /></div>
                    {expanded ? <ChevronDown className="text-indigo-300" size={18} /> : <ChevronRight className="text-slate-300" size={18} />}
                    <Folder className="text-sky-500 fill-sky-50" size={20} />
                    <span className="font-bold text-slate-700">{mod.title}</span>
                    <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/graph?moduleId=${mod.id}&modTitle=${encodeURIComponent(mod.title)}`); }} className="text-[10px] px-2 py-1 bg-sky-50 text-sky-600 rounded font-bold hover:bg-sky-500 hover:text-white transition">GRAPHE</button>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-slate-300 hover:text-indigo-500"><Edit2 size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onEdit('CHAPITRE_CREATE'); }} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-bold hover:bg-indigo-100 flex items-center gap-1"><Plus size={14}/> Chapitre</button>
            </div>
            {expanded && children}
        </div>
    );
}

// --- COMPOSANT SORTABLE POUR CHAPITRES ---
function SortableChapitre({ chap, onEdit, onDelete, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chap.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
        <div ref={setNodeRef} style={style} className="bg-white p-3 rounded-xl border border-slate-200 group">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div {...attributes} {...listeners} className="cursor-grab p-1 text-slate-200 hover:text-indigo-400"><GripVertical size={16} /></div>
                    <Layers className="text-emerald-500" size={16} />
                    <span className="font-bold text-slate-700 text-sm">{chap.title}</span>
                    <div className="flex gap-2 ml-2 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={onEdit} className="text-slate-300 hover:text-indigo-500"><Edit2 size={14}/></button>
                        <button onClick={onDelete} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                </div>
                <button onClick={() => onEdit('CONCEPT_CREATE')} className="text-[10px] uppercase tracking-wider bg-slate-800 text-white px-2 py-1 rounded hover:bg-slate-700 flex items-center gap-1"><Plus size={10}/> Concept</button>
            </div>
            {children}
        </div>
    );
}

// --- COMPOSANT SORTABLE POUR CONCEPTS ---
function SortableConcept({ concept, onEdit, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: concept.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
        <div ref={setNodeRef} style={style} className="group flex items-center gap-2 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-xs font-medium border border-indigo-100">
            <div {...attributes} {...listeners} className="cursor-grab p-1 text-indigo-200 hover:text-indigo-500"><GripVertical size={12} /></div>
            <FileText size={12} className="text-indigo-300" />
            <span className="truncate max-w-[120px]">{concept.labelPedagogique}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={onEdit} className="hover:text-indigo-900"><Edit2 size={10}/></button>
                <button onClick={onDelete} className="hover:text-red-600"><Trash2 size={10}/></button>
            </div>
        </div>
    );
}

export default function CourseManager() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [expandedCourse, setExpandedCourse] = useState(null);
    const [expandedModule, setExpandedModule] = useState(null);
    const [loading, setLoading] = useState(true);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const [panel, setPanel] = useState({ isOpen: false, type: '', action: '', parentId: null, currentData: null });
    const [formData, setFormData] = useState({ title: '', description: '', objectifs: '', prerequisTextuels: '', labelPedagogique: '', poidsCognitif: 1, estVerrouille: false });
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (!user?.email) return;
            const { data: coursesList } = await graphApi.getTeacherCourses(user.email);
            const fullTree = await Promise.all(coursesList.map(async (course) => {
                try {
                    const { data: tree } = await courseApi.getCourseTree(course.id);
                    return tree;
                } catch (e) { return { ...course, modules: [] }; }
            }));
            setCourses(fullTree);
        } catch (err) { toast.error('Impossible de charger les données'); } finally { setLoading(false); }
    }, [user?.email]);

    useEffect(() => { loadData(); }, [loadData]);

    const openPanel = (type, action, parentId = null, currentData = null) => {
        setPanel({ isOpen: true, type, action, parentId, currentData });
        if (action === 'EDIT' && currentData) {
            if (type === 'CONCEPT') {
                setFormData({ title: '', description: currentData.description || '', labelPedagogique: currentData.labelPedagogique || '', poidsCognitif: currentData.poidsCognitif || 1, estVerrouille: currentData.estVerrouille || false });
            } else { setFormData({ ...formData, title: currentData.title, description: currentData.description || '', objectifs: currentData.objectifs || '', prerequisTextuels: currentData.prerequisTextuels || '' }); }
        } else { setFormData({ title: '', description: '', objectifs: '', prerequisTextuels: '', labelPedagogique: '', poidsCognitif: 1, estVerrouille: false }); }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            const { type, action, parentId, currentData } = panel;
            if (type === 'COURSE') {
                if (action === 'CREATE') await courseApi.createCourse({
                    title: formData.title,
                    description: formData.description,
                    objectifs: formData.objectifs,
                    prerequisTextuels: formData.prerequisTextuels,
                    authorEmail: user.email,
                    authorName: [user.prenom, user.nom].filter(Boolean).join(' ')
                });
                else await courseApi.updateCourse(currentData.id, { title: formData.title, description: formData.description, objectifs: formData.objectifs, prerequisTextuels: formData.prerequisTextuels });
            } else if (type === 'MODULE') {
                if (action === 'CREATE') await graphApi.createModule(parentId, { title: formData.title, description: formData.description });
                else await graphApi.updateModule(currentData.id, { title: formData.title, description: formData.description });
            } else if (type === 'CHAPITRE') {
                if (action === 'CREATE') await graphApi.createChapitre(parentId, { title: formData.title, description: formData.description });
                else await graphApi.updateChapitre(currentData.id, { title: formData.title, description: formData.description });
            } else if (type === 'CONCEPT') {
                const payload = { labelPedagogique: formData.labelPedagogique, description: formData.description, poidsCognitif: parseFloat(formData.poidsCognitif), estVerrouille: formData.estVerrouille };
                if (action === 'CREATE') await graphApi.createConceptInChapitre(parentId, payload);
                else await graphApi.updateConcept(currentData.id, payload);
            }
            setPanel({ ...panel, isOpen: false }); loadData(); toast.success('Enregistré !');
        } catch (error) { toast.error('Erreur de sauvegarde'); }
    };

    const handleDragEnd = async (event, type, list, parentId) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = list.findIndex(item => item.id === active.id);
        const newIndex = list.findIndex(item => item.id === over.id);
        const newList = arrayMove(list, oldIndex, newIndex);

        // Optimistic UI Update
        const updatedCourses = courses.map(course => {
            if (type === 'MODULE' && course.id === parentId) return { ...course, modules: newList };
            if (type === 'CHAPITRE' || type === 'CONCEPT') {
                return { ...course, modules: course.modules?.map(mod => {
                    if (type === 'CHAPITRE' && mod.id === parentId) return { ...mod, chapitres: newList };
                    if (type === 'CONCEPT') return { ...mod, chapitres: mod.chapitres?.map(chap => {
                        if (chap.id === parentId) return { ...chap, concepts: newList };
                        return chap;
                    })};
                    return mod;
                })};
            }
            return course;
        });
        setCourses(updatedCourses);

        try {
            const ids = newList.map(item => item.id);
            if (type === 'MODULE') await graphApi.reorderModules(ids);
            else if (type === 'CHAPITRE') await graphApi.reorderChapitres(ids);
            else if (type === 'CONCEPT') await graphApi.reorderConcepts(ids);
            toast.success('Ordre mis à jour');
        } catch (e) { toast.error('Erreur de tri'); loadData(); }
    };

    return (
        <div className="max-w-5xl mx-auto relative px-4 pb-20">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mt-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><GraduationCap className="text-indigo-600" size={32} /> Gestion des Cours</h1>
                    <p className="text-slate-500 mt-1">Structurez votre offre pédagogique en 4 niveaux hiérarchiques.</p>
                </div>
                <button onClick={() => openPanel('COURSE', 'CREATE')} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition font-bold shadow-lg shadow-indigo-100"><Plus size={20} /> Nouveau Cours</button>
            </div>

            <div className="space-y-4">
                {courses.map((course) => (
                    <div key={course.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
                        <div className={`p-5 flex items-center justify-between cursor-pointer transition ${expandedCourse === course.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                             onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}>
                            <div className="flex items-center gap-4">
                                {expandedCourse === course.id ? <ChevronDown className="text-indigo-400" /> : <ChevronRight className="text-slate-400" />}
                                <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-100"><GraduationCap size={20} /></div>
                                <div>
                                    <span className="font-extrabold text-xl text-slate-800">{course.title}</span>
                                    <p className="text-xs text-slate-400 mt-0.5">{course.description || 'Apprenez les bases et maîtrisez les concepts.'}</p>
                                </div>
                                <div className="flex gap-2 ml-4 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={(e) => { e.stopPropagation(); openPanel('COURSE', 'EDIT', null, course); }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white transition"><Edit2 size={16}/></button>
                                    <button onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setDialogConfig({ 
                                            isOpen: true, 
                                            type: 'confirm', 
                                            title: 'Supprimer ce cours ?', 
                                            message: 'Attention, cette action est irréversible et supprimera tous les modules, chapitres et concepts associés.', 
                                            onConfirm: () => { 
                                                courseApi.deleteCourse(course.id).then(loadData); 
                                                setDialogConfig({ ...dialogConfig, isOpen: false }); 
                                            } 
                                        }); 
                                    }} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white transition"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-bold bg-white text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-full shadow-sm">{course.modules?.length || 0} Modules</span>
                                <button onClick={(e) => { e.stopPropagation(); openPanel('MODULE', 'CREATE', course.id); }} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"><Plus size={18} /></button>
                            </div>
                        </div>
                        {expandedCourse === course.id && (
                            <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-3">
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'MODULE', course.modules, course.id)}>
                                    <SortableContext items={course.modules?.map(m => m.id) || []} strategy={verticalListSortingStrategy}>
                                        {course.modules?.map((mod) => (
                                            <SortableModule key={mod.id} mod={mod} expanded={expandedModule === mod.id} 
                                                            onToggle={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                                                            onEdit={(sub) => sub === 'CHAPITRE_CREATE' ? openPanel('CHAPITRE', 'CREATE', mod.id) : openPanel('MODULE', 'EDIT', course.id, mod)}
                                                            onDelete={() => { 
                                                                setDialogConfig({ 
                                                                    isOpen: true, type: 'confirm', title: 'Supprimer ce module ?', message: 'Voulez-vous vraiment supprimer ce module ?', 
                                                                    onConfirm: () => { graphApi.deleteModule(mod.id).then(loadData); setDialogConfig({ ...dialogConfig, isOpen: false }); } 
                                                                }); 
                                                            }}>
                                                <div className="bg-slate-50/50 p-4 border-t border-indigo-50 space-y-3 pl-10">
                                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'CHAPITRE', mod.chapitres, mod.id)}>
                                                        <SortableContext items={mod.chapitres?.map(c => c.id) || []} strategy={verticalListSortingStrategy}>
                                                            {mod.chapitres?.map((chap) => (
                                                                <SortableChapitre key={chap.id} chap={chap} 
                                                                                  onEdit={(sub) => sub === 'CONCEPT_CREATE' ? openPanel('CONCEPT', 'CREATE', chap.id) : openPanel('CHAPITRE', 'EDIT', mod.id, chap)}
                                                                                  onDelete={() => { 
                                                                                      setDialogConfig({ 
                                                                                          isOpen: true, type: 'confirm', title: 'Supprimer ce chapitre ?', message: 'Voulez-vous vraiment supprimer ce chapitre ?', 
                                                                                          onConfirm: () => { graphApi.deleteChapitre(chap.id).then(loadData); setDialogConfig({ ...dialogConfig, isOpen: false }); } 
                                                                                      }); 
                                                                                  }}>
                                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'CONCEPT', chap.concepts, chap.id)}>
                                                                            <SortableContext items={chap.concepts?.map(c => c.id) || []} strategy={horizontalListSortingStrategy}>
                                                                                {chap.concepts?.map((c) => (
                                                                                    <SortableConcept key={c.id} concept={c} onEdit={() => openPanel('CONCEPT', 'EDIT', chap.id, c)} onDelete={() => { 
                                                                                        setDialogConfig({ 
                                                                                            isOpen: true, type: 'confirm', title: 'Supprimer ce concept ?', message: 'Voulez-vous vraiment supprimer ce concept ?', 
                                                                                            onConfirm: () => { graphApi.deleteConcept(c.id).then(loadData); setDialogConfig({ ...dialogConfig, isOpen: false }); } 
                                                                                        }); 
                                                                                    }} />
                                                                                ))}
                                                                            </SortableContext>
                                                                        </DndContext>
                                                                    </div>
                                                                </SortableChapitre>
                                                            ))}
                                                        </SortableContext>
                                                    </DndContext>
                                                </div>
                                            </SortableModule>
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* PANEL EDIT */}
            {panel.isOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPanel({...panel, isOpen: false})}></div>
                    <div className="w-full max-w-md bg-white h-screen relative shadow-2xl flex flex-col animate-slide-in">
                        <div className="shrink-0 flex justify-between items-center border-b border-slate-100 p-6">
                            <h2 className="text-2xl font-extrabold text-slate-800">{panel.action === 'CREATE' ? 'Nouveau' : 'Modifier'} {panel.type}</h2>
                            <button onClick={() => setPanel({...panel, isOpen: false})} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="min-h-0 flex-1 flex flex-col">
                            <div className="flex-1 space-y-6 overflow-y-auto p-6">
                            {panel.type !== 'CONCEPT' ? (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Titre</label>
                                    <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition"/>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Label Pédagogique</label>
                                    <input type="text" value={formData.labelPedagogique} onChange={e => setFormData({...formData, labelPedagogique: e.target.value})} required autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition"/>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none transition"/>
                            </div>
                            {panel.type === 'COURSE' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Objectifs pedagogiques</label>
                                        <textarea value={formData.objectifs} onChange={e => setFormData({...formData, objectifs: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none transition"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Prerequis textuels</label>
                                        <textarea value={formData.prerequisTextuels} onChange={e => setFormData({...formData, prerequisTextuels: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none transition"/>
                                    </div>
                                </>
                            )}
                            {panel.type === 'CONCEPT' && (
                                <div className="space-y-4 pt-2">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Difficulté : {formData.poidsCognitif}</label>
                                        <input type="range" min="1" max="5" value={formData.poidsCognitif} onChange={e => setFormData({...formData, poidsCognitif: e.target.value})} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-700">Verrouiller par défaut</span>
                                            <button type="button" onClick={() => setFormData({...formData, estVerrouille: !formData.estVerrouille})} className={`w-12 h-6 rounded-full transition-colors relative ${formData.estVerrouille ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.estVerrouille ? 'translate-x-6' : ''}`}></div>
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">Si activé, ce concept ne sera accessible à l'apprenant qu'une fois les prérequis validés.</p>
                                    </div>
                                </div>
                            )}
                            </div>
                            <div className="shrink-0 flex gap-3 border-t border-slate-100 bg-white p-6">
                                <button type="button" onClick={() => setPanel({...panel, isOpen: false})} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Annuler</button>
                                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition">Confirmer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style>{` @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } } .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0, 0, 0.2, 1); } `}</style>
            <CustomDialog 
                isOpen={dialogConfig.isOpen} 
                type={dialogConfig.type}
                title={dialogConfig.title}
                message={dialogConfig.message}
                onConfirm={dialogConfig.onConfirm}
                onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })}
            />
        </div>
    );
}
