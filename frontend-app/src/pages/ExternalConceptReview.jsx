import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { contentApi, evaluationApi, graphApi, labApi } from '../api/apiClient';
import { normalizeResourceHtml } from '../utils/resourceHtml';

export default function ExternalConceptReview() {
    const { conceptId } = useParams();
    const [searchParams] = useSearchParams();
    const sourceCourseId = searchParams.get('sourceCourseId') || '';
    const [context, setContext] = useState(null);
    const [content, setContent] = useState(null);
    const [lab, setLab] = useState(null);
    const [evaluation, setEvaluation] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            graphApi.getConceptContext(conceptId, sourceCourseId).then(response => response.data).catch(() => null),
            contentApi.getConceptContent(conceptId).then(response => response.data).catch(() => null),
            labApi.getLabByTarget(conceptId).then(response => response.data).catch(() => null),
            evaluationApi.getEvaluation(conceptId, 'FORMATIVE').then(response => response.data).catch(() => null),
        ])
            .then(([contextData, contentData, labData, evaluationData]) => {
                setContext(contextData);
                setContent(contentData);
                setLab(labData);
                setEvaluation(evaluationData?.typeEvaluation === 'FORMATIVE' ? evaluationData : null);
            })
            .finally(() => setLoading(false));
    }, [conceptId, sourceCourseId]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center gap-2 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                Chargement du prerequis externe...
            </div>
        );
    }

    if (!context) {
        return (
            <div className="max-w-3xl mx-auto rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
                <AlertTriangle className="inline mr-2" size={18} />
                Concept externe introuvable.
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <Link to={sourceCourseId ? `/learner/courses/${sourceCourseId}` : '/learner/my-courses'} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                    Retour au cours
                </Link>
                <h1 className="mt-2 text-3xl font-bold text-slate-800">Revision d'un prerequis externe</h1>
                <p className="mt-2 text-slate-500">
                    {context.conceptName || conceptId} - cours source : {context.courseTitle || 'Non renseigné'}
                </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                {content?.htmlContent ? (
                    <div
                        className="prose prose-slate max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-emerald-300"
                        dangerouslySetInnerHTML={{ __html: normalizeResourceHtml(content.htmlContent) }}
                    />
                ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                        Aucune ressource n'est encore disponible pour ce prerequis externe.
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-3">
                {lab?.id && (
                    <Link
                        to={`/student/lab/${lab.id}?sourceCourseId=${encodeURIComponent(sourceCourseId || context.courseId || '')}&conceptId=${encodeURIComponent(conceptId)}`}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                        Realiser le TP
                    </Link>
                )}
                {evaluation?.id && (
                    <Link to={`/student/quiz/${conceptId}`} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                        <ClipboardList size={16} />
                        Passer l'évaluation formative
                    </Link>
                )}
                {!lab?.id && !evaluation?.id && (
                    <span className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                        Aucun TP ou quiz formatif disponible.
                    </span>
                )}
            </div>
        </div>
    );
}
