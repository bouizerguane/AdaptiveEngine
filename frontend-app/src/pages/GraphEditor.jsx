import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, { MiniMap, Controls, Background, addEdge, applyNodeChanges, applyEdgeChanges, MarkerType, BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';
import { useSearchParams, useNavigate } from 'react-router-dom';
import 'reactflow/dist/style.css';
import { graphApi, courseApi } from '../api/apiClient';
import { Loader2, ArrowLeft, Filter, AlertCircle, GraduationCap } from 'lucide-react';
import CustomDialog from '../components/CustomDialog';
import { useAuth } from '../context/AuthContext';
import { normalizeCourseTree } from '../utils/courseOrder';

// Composant de flèche (Arc DAG) avec bouton de suppression
function CustomDeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }) {
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }} className="nodrag nopan">
                    <button
                        className="w-5 h-5 flex items-center justify-center bg-white text-red-500 border border-slate-200 hover:bg-red-50 hover:border-red-500 rounded-full shadow-md text-xs font-bold transition-transform hover:scale-110 cursor-pointer z-50"
                        onClick={(e) => { e.stopPropagation(); if (data?.onDelete) data.onDelete(id, data.source, data.target); }}
                        title="Supprimer la dépendance"
                    >
                        ×
                    </button>
                </div>
            </EdgeLabelRenderer>
        </>
    );
}

const edgeTypes = {
    deletable: CustomDeletableEdge,
};

export default function GraphEditor() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    // Filtres tirés de l'URL
    const courseId = searchParams.get('courseId') || '';
    const moduleId = searchParams.get('moduleId') || '';
    const chapitreId = searchParams.get('chapitreId') || '';

    const [allCourses, setAllCourses] = useState([]); // List of courses
    const [activeTree, setActiveTree] = useState(null); // Full tree for selected course
    const [globalTrees, setGlobalTrees] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const saveTimer = useRef(null);
    const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

    const handleDeleteEdge = async (edgeId, sourceId, targetId) => {
        setDialogConfig({
            isOpen: true,
            type: 'confirm',
            title: 'Supprimer la dépendance',
            message: 'Êtes-vous sûr de retirer cette dépendance ?',
            onConfirm: async () => {
                try {
                    await graphApi.removeExigence(sourceId, targetId);
                    setEdges((eds) => eds.filter(e => e.id !== edgeId));
                    setDialogConfig(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    console.error("Erreur suppression edge", err);
                    setError("La suppression de l'arc DAG a échoué.");
                    setDialogConfig(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const fetchCourses = async () => {
        try {
            setLoading(true);
            if (!user?.email) return;
            const { data } = await graphApi.getTeacherCourses(user.email);
            setAllCourses(data);
        } catch (err) {
            setError("Impossible de charger les cours.");
        } finally {
            setLoading(false);
        }
    };

    const fetchActiveTree = async (id) => {
        if (!id) { setActiveTree(null); return; }
        try {
            const { data } = await courseApi.getCourseTree(id);
            setActiveTree(normalizeCourseTree(data));
        } catch (err) {
            setError("Impossible de charger l'arborescence du cours.");
        }
    };

    useEffect(() => {
        fetchCourses();
    }, [user?.email]);

    useEffect(() => {
        if (courseId) fetchActiveTree(courseId);
        else {
            setActiveTree(null);
            if (allCourses.length) {
                Promise.all(allCourses.map(course =>
                    courseApi.getCourseTree(course.id)
                        .then(response => normalizeCourseTree(response.data))
                        .catch(() => ({ ...course, modules: [] }))
                )).then(setGlobalTrees);
            } else {
                setGlobalTrees([]);
            }
        }
    }, [courseId, moduleId, chapitreId, allCourses]);

    // Calcul dynamique du graphe
    useEffect(() => {
        let conceptList = [];
        const globalView = !courseId;
        const coursePalette = ['#eef2ff', '#ecfdf5', '#fff7ed', '#f0f9ff', '#fdf2f8', '#f8fafc'];

        if (globalView) {
            conceptList = globalTrees.flatMap((course, courseIndex) =>
                (course.modules || []).flatMap(module =>
                    (module.chapitres || []).flatMap(chapitre =>
                        (chapitre.concepts || []).map(concept => ({
                            ...concept,
                            courseId: course.id,
                            courseTitle: course.title || 'Cours',
                            courseColor: coursePalette[courseIndex % coursePalette.length],
                        }))
                    )
                )
            );
        } else if (activeTree) {
            if (moduleId) {
                const mod = activeTree.modules?.find(m => m.id === moduleId);
                if (mod) {
                    if (chapitreId) {
                        const chap = mod.chapitres?.find(c => c.id === chapitreId);
                        if (chap && chap.concepts) conceptList = chap.concepts;
                    } else {
                        conceptList = mod.chapitres?.flatMap(ch => ch.concepts || []) || [];
                    }
                }
            } else {
                // Vue de tout le cours
                conceptList = activeTree.modules?.flatMap(m => m.chapitres?.flatMap(c => c.concepts || []) || []) || [];
            }
        }

        const validConceptIds = new Set(conceptList.map(c => c.id));
        const initialNodes = [];
        const initialEdges = [];
        const edgeIds = new Set();
        const nodeIds = new Set();

        conceptList.forEach((concept, index) => {
            if (nodeIds.has(concept.id)) return;
            nodeIds.add(concept.id);
            const defaultX = 150 + (index % 5) * 220;
            const defaultY = 80 + Math.floor(index / 5) * 160;
            
            const x = concept.posX !== null && concept.posX !== undefined ? concept.posX : defaultX;
            const y = concept.posY !== null && concept.posY !== undefined ? concept.posY : defaultY;

            initialNodes.push({
                id: concept.id,
                position: { x, y },
                data: { label: `${concept.labelPedagogique || concept.title} \n${globalView ? `[${concept.courseTitle}]` : `[Poids: ${concept.poidsCognitif || 0}]`}` },
                type: 'default',
                style: {
                    background: globalView ? concept.courseColor : '#f8fafc',
                    color: '#1e293b',
                    border: globalView ? '2px solid #818cf8' : '2px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '10px',
                    fontWeight: '600',
                    textAlign: 'center',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }
            });

            concept.exigences?.forEach(targetConcept => {
                const edgeId = `e-${concept.id}-${targetConcept.id}`;
                if (validConceptIds.has(targetConcept.id) && !edgeIds.has(edgeId)) {
                    edgeIds.add(edgeId);
                    initialEdges.push({
                        id: edgeId,
                        source: concept.id,
                        target: targetConcept.id,
                        type: 'deletable',
                        data: { source: concept.id, target: targetConcept.id, onDelete: handleDeleteEdge },
                        animated: true,
                        style: { stroke: '#6366f1', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
                    });
                }
            });
        });

        setNodes(initialNodes);
        setEdges(initialEdges);

    }, [activeTree, globalTrees, courseId, moduleId, chapitreId]);

    const savePositions = useCallback((updatedNodes) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setSaveStatus('saving');
        
        saveTimer.current = setTimeout(async () => {
            try {
                const positions = updatedNodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y }));
                await graphApi.updatePositions(positions);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus(''), 2000);
            } catch (err) {
                console.error("Erreur sauvegarde positions", err);
                setSaveStatus('error');
            }
        }, 2000);
    }, []);

    const onNodeDragStop = useCallback((event, node, nodesArray) => {
        savePositions(nodesArray);
    }, [savePositions]);

    const onConnect = useCallback(async (params) => {
        const edgeId = `e-${params.source}-${params.target}`;
        if (edges.some(edge => edge.id === edgeId)) return;

        try {
            await graphApi.addExigence(params.source, params.target);
            setEdges((eds) => addEdge({
                ...params,
                id: edgeId,
                type: 'deletable',
                data: { source: params.source, target: params.target, onDelete: handleDeleteEdge },
                animated: true,
                style: { stroke: '#10b981', strokeWidth: 3 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }
            }, eds));
            setError(null);
        } catch (err) {
            setError("Graphe Acyclique Dirigé Invalide : Cycle détecté !");
        }
    }, [edges, setEdges]);

    const getActiveTitle = () => {
        if (loading && !allCourses.length) return 'Chargement...';
        if (!courseId) return 'Vue globale - tous les cours';
        if (activeTree) {
            if (chapitreId) {
                const mod = activeTree.modules?.find(m => m.id === moduleId);
                const chap = mod?.chapitres?.find(c => c.id === chapitreId);
                return `Chapitre : ${chap?.title || chapitreId}`;
            }
            if (moduleId) {
                const mod = activeTree.modules?.find(m => m.id === moduleId);
                return `Module : ${mod?.title || moduleId}`;
            }
            return `Cours : ${activeTree.title}`;
        }
        return 'Arborescence...';
    };

    if (loading && !allCourses.length) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
    }

    return (
        <div className="h-full flex flex-col pt-2 px-2">
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4">
                    <button onClick={() => navigate('/courses')} className="p-2 h-fit bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <GraduationCap className="text-indigo-600" size={24} /> {getActiveTitle()}
                        </h1>
                        <p className="text-slate-500 text-xs mt-1">Établissez les prérequis (DAG) entre les concepts pédagogiques.</p>
                    </div>
                </div>

                <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                    <Filter className="text-slate-300 ml-1" size={16} />
                    
                    <select className="bg-slate-50 border border-slate-200 text-indigo-700 font-bold text-xs rounded-lg p-2 outline-none w-40"
                            value={courseId} onChange={(e) => navigate(e.target.value ? `/graph?courseId=${e.target.value}` : '/graph')}>
                        <option value="">Vue globale</option>
                        {allCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>

                    <select className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg p-2 outline-none w-40 disabled:opacity-40"
                            disabled={!courseId} value={moduleId} onChange={(e) => navigate(`/graph?courseId=${courseId}&moduleId=${e.target.value}`)}>
                        <option value="">Modules...</option>
                        {activeTree?.modules?.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>

                    <select className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg p-2 outline-none w-40 disabled:opacity-40"
                            disabled={!moduleId} value={chapitreId} 
                            onChange={(e) => navigate(`/graph?courseId=${courseId}&moduleId=${moduleId}&chapitreId=${e.target.value}`)}>
                        <option value="">Chapitres...</option>
                        {activeTree?.modules?.find(m => m.id === moduleId)?.chapitres?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4 text-xs font-bold border border-red-100 flex justify-between">
                {error} <button onClick={() => setError(null)}>×</button>
            </div>}

            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-inner relative overflow-hidden min-h-[500px]">
                {saveStatus && (
                    <div className={`absolute top-4 right-4 z-50 px-3 py-1.5 rounded-full shadow-md text-xs font-bold flex items-center gap-2 transition-all
                        ${saveStatus === 'saving' ? 'bg-amber-100 text-amber-700' : 
                          saveStatus === 'saved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {saveStatus === 'saving' && <Loader2 className="animate-spin" size={14} />}
                        {saveStatus === 'saving' ? 'Enregistrement...' : saveStatus === 'saved' ? 'Positions enregistrées' : 'Erreur de sauvegarde'}
                    </div>
                )}
                {nodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-10">
                        <AlertCircle className="text-slate-200 mb-4" size={64} />
                        <h2 className="text-xl font-bold text-slate-400">Aucun concept à afficher</h2>
                        <p className="text-slate-400 text-sm mt-2">{!courseId ? "Aucun concept trouve dans vos cours." : "Veuillez selectionner un cours ou un module contenant des concepts."}</p>
                    </div>
                ) : (
                    <ReactFlow nodes={nodes} edges={edges} edgeTypes={edgeTypes} 
                               onNodesChange={(c) => setNodes((n) => applyNodeChanges(c, n))}
                               onEdgesChange={(c) => setEdges((e) => applyEdgeChanges(c, e))}
                               onConnect={onConnect}
                               onNodeDragStop={onNodeDragStop}
                               fitView>
                        <Controls />
                        <MiniMap />
                        <Background gap={20} color="#f1f5f9" />
                    </ReactFlow>
                )}
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
