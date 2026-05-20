import { useState, useEffect } from 'react';
import { Users, Server, Cpu, CheckCircle, AlertTriangle, RefreshCw, GraduationCap, BookOpen, Layers, ClipboardList, Terminal, Activity, GaugeCircle, XCircle } from 'lucide-react';
import { adminApi, courseApi, graphApi, labApi, evaluationApi, API_BASE_URL } from '../api/apiClient';
import toast from 'react-hot-toast';

// --- Config: liste des microservices à surveiller ---
// Toutes les routes passent par la Gateway (port 8080).
// On utilise des routes GET existantes (401 = service UP mais non authentifié, 404 = route manquante mais service UP)
const SERVICES = [
    { name: 'IAM Service',       url: `${API_BASE_URL}/admin/users/pending`,     label: 'IAM' },
    { name: 'Knowledge Graph',   url: `${API_BASE_URL}/graph/concepts`,          label: 'Graph' },
    { name: 'Content Service',   url: `${API_BASE_URL}/content/concept/__ping__`, label: 'Content' },
    { name: 'Tracking Service',  url: `${API_BASE_URL}/traces/user/__ping__`,    label: 'Tracking' },
    { name: 'API Gateway',       url: `${API_BASE_URL}/graph/modules`,           label: 'Gateway' },
];

const normalizeRole = (role) => (role || '').replace('ROLE_', '');

async function pingService(svc) {
    const token = localStorage.getItem('token');
    const start = Date.now();
    try {
        const res = await fetch(svc.url, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: AbortSignal.timeout(4000)
        });
        const ms = Date.now() - start;
        // Any HTTP response (even 401/403/404) = service is reachable = UP
        // Only network errors / timeouts = DOWN
        return { ...svc, status: res.status < 600 ? 'UP' : 'DOWN', latency: ms };
    } catch {
        return { ...svc, status: 'DOWN', latency: null };
    }
}

export default function AdminDashboard() {
    const [pendingUsers, setPendingUsers]     = useState([]);
    const [allUsers, setAllUsers]             = useState([]);
    const [services, setServices]             = useState([]);
    const [stats, setStats]                   = useState({ teachers: 0, students: 0, courses: 0, concepts: 0, evaluations: 0, labs: 0 });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading]               = useState(true);
    const [fetchError, setFetchError]         = useState(null);
    const [refreshing, setRefreshing]         = useState(false);

    const fetchPendingUsers = async () => {
        setFetchError(null);
        try {
            const res = await adminApi.getPendingUsers();
            setPendingUsers(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            const status = error?.response?.status;
            const message = error?.response?.data?.message || error.message;
            setFetchError(`Erreur ${status ?? 'réseau'} : ${message}`);
            toast.error(`Impossible de charger les demandes (${status ?? 'erreur réseau'})`);
        }
    };

    const fetchStats = async () => {
        try {
            const [usersRes, coursesRes, conceptsRes] = await Promise.allSettled([
                adminApi.getAllUsers(),
                graphApi.getAdminCourses(),
                graphApi.getConcepts(),
            ]);
            const users    = usersRes.status === 'fulfilled'    ? (usersRes.value.data    || []) : [];
            const courses  = coursesRes.status === 'fulfilled'  ? (coursesRes.value.data  || []) : [];
            const concepts = conceptsRes.status === 'fulfilled' ? (conceptsRes.value.data || []) : [];
            const courseContent = await Promise.all((Array.isArray(courses) ? courses : []).map(async (course) => {
                const [evalRes, labRes] = await Promise.allSettled([
                    evaluationApi.getCourseEvaluations(course.id),
                    labApi.getLabsByCourse(course.id),
                ]);
                return {
                    evaluations: evalRes.status === 'fulfilled' && Array.isArray(evalRes.value.data) ? evalRes.value.data.length : 0,
                    labs: labRes.status === 'fulfilled' && Array.isArray(labRes.value.data) ? labRes.value.data.length : 0,
                };
            }));

            setAllUsers(users);
            setStats({
                teachers: users.filter(u => normalizeRole(u.role) === 'TEACHER').length,
                students: users.filter(u => ['STUDENT', 'LEARNER'].includes(normalizeRole(u.role))).length,
                courses:  courses.length,
                concepts: Array.isArray(concepts) ? concepts.length : 0,
                evaluations: courseContent.reduce((sum, item) => sum + item.evaluations, 0),
                labs: courseContent.reduce((sum, item) => sum + item.labs, 0),
            });
            setRecentActivity(buildRecentActivity(users, courses));
        } catch (e) {
            console.error('Error fetching stats', e);
        }
    };

    const fetchServiceHealth = async () => {
        const results = await Promise.all(SERVICES.map(pingService));
        setServices(results);
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([fetchPendingUsers(), fetchStats(), fetchServiceHealth()]);
        setLoading(false);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
        toast.success('Données actualisées');
    };

    useEffect(() => { loadAll(); }, []);

    const handleApprove = async (id) => {
        try {
            await adminApi.approveUser(id);
            setPendingUsers(pendingUsers.filter(u => u.id !== id));
            toast.success('Utilisateur approuvé avec succès !');
            fetchStats();
        } catch {
            toast.error("Erreur lors de l'approbation.");
        }
    };

    const upCount   = services.filter(s => s.status === 'UP').length;
    const downCount = services.filter(s => s.status === 'DOWN').length;
    const avgLatency = services.filter(s => s.latency !== null).reduce((acc, s, _, arr) => acc + s.latency / arr.length, 0);
    const systemAlerts = buildSystemAlerts(services);

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* EN-TÊTE */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Administration système</h1>
                    <p className="text-slate-500 mt-2 text-lg dark:text-slate-400">
                        Console d'administration globale. Gérez ici les accès, la sécurité et les paramètres de la plateforme.
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    Actualiser
                </button>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* CARTE 1 – Utilisateurs */}
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Utilisateurs actifs</h2>
                            {!loading && (
                                <span className="text-xs text-slate-400 font-medium">
                                    Total : {(stats.teachers + stats.students).toLocaleString('fr-FR')} comptes
                                </span>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />
                            <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {/* Enseignants */}
                            <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-100 rounded-xl p-4 gap-1">
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg mb-1">
                                    <GraduationCap size={18} />
                                </div>
                                <span className="text-2xl font-black text-amber-700">{stats.teachers}</span>
                                <span className="text-xs font-semibold text-amber-600">Enseignants</span>
                            </div>
                            {/* Apprenants */}
                            <div className="flex flex-col items-center justify-center bg-sky-50 border border-sky-100 rounded-xl p-4 gap-1">
                                <div className="p-2 bg-sky-100 text-sky-600 rounded-lg mb-1">
                                    <Users size={18} />
                                </div>
                                <span className="text-2xl font-black text-sky-700">{stats.students}</span>
                                <span className="text-xs font-semibold text-sky-600">Apprenants</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* CARTE 2 – Microservices */}
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Server size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">État des services</h2>
                    </div>
                    <p className="text-slate-500 text-sm flex-1 dark:text-slate-400">
                        Statut de chaque service principal via la gateway.
                    </p>
                    {loading ? (
                        <div className="h-6 w-28 bg-slate-100 animate-pulse rounded" />
                    ) : (
                        <div className="space-y-2">
                            <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-bold w-fit ${
                                downCount === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${downCount === 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                {upCount}/{SERVICES.length} Actifs
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {services.map(svc => (
                                    <span key={svc.label} title={`${svc.name}${svc.latency ? ` — ${svc.latency}ms` : ''}`}
                                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                            svc.status === 'UP' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                        }`}>
                                        {svc.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* CARTE 3 – Graphe de connaissances */}
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                            <Cpu size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Graphe pédagogique</h2>
                    </div>
                    <p className="text-slate-500 text-sm flex-1 dark:text-slate-400">
                        Cours, concepts et latence moyenne des services disponibles.
                    </p>
                    {loading ? (
                        <div className="h-6 w-32 bg-slate-100 animate-pulse rounded" />
                    ) : (
                        <div className="space-y-1.5">
                            <div className="flex gap-3">
                                <span className="flex items-center gap-1.5 text-xs bg-rose-50 text-rose-600 px-2.5 py-1.5 rounded-lg font-bold">
                                    <BookOpen size={12} /> {stats.courses} Cours
                                </span>
                                <span className="flex items-center gap-1.5 text-xs bg-violet-50 text-violet-600 px-2.5 py-1.5 rounded-lg font-bold">
                                    <Layers size={12} /> {stats.concepts} Concepts
                                </span>
                            </div>
                            {avgLatency > 0 && (
                                <p className="text-sm font-semibold text-slate-500">
                                    {Math.round(avgLatency)}ms latence moy. des services
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* STATISTIQUES GLOBALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniStat icon={<BookOpen size={18} />} label="Total cours" value={stats.courses} color="rose" />
                <MiniStat icon={<Layers size={18} />} label="Total concepts" value={stats.concepts} color="violet" />
                <MiniStat icon={<ClipboardList size={18} />} label="Évaluations" value={stats.evaluations} color="indigo" />
                <MiniStat icon={<Terminal size={18} />} label="TP" value={stats.labs} color="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                            <Activity size={18} className="text-slate-500" />
                            Activité récente
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {recentActivity.length > 0 ? recentActivity.map((item, idx) => (
                            <div key={idx} className="px-6 py-3">
                                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                                <p className="text-xs text-slate-500">{item.detail}</p>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-slate-400">Aucune activité récente.</div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                            <AlertTriangle size={18} className="text-slate-500" />
                            Alertes systeme
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {systemAlerts.length > 0 ? systemAlerts.map((alert, idx) => (
                            <div key={idx} className="px-6 py-3 flex items-start gap-3">
                                <AlertTriangle size={16} className={alert.level === 'error' ? 'text-red-500' : 'text-amber-500'} />
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">{alert.title}</p>
                                    <p className="text-xs text-slate-500">{alert.message}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-slate-400">Aucune alerte critique.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* SANTÉ DÉTAILLÉE DES SERVICES */}
            {services.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                            <Server size={18} className="text-slate-500" />
                            Santé des Services
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {services.map(svc => {
                            const health = serviceHealthMeta(svc);
                            return (
                            <div key={svc.name} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition">
                                <div className="flex items-center gap-3">
                                    {health.icon}
                                    <span className="font-medium text-slate-700 text-sm">{svc.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    {svc.latency !== null && (
                                        <span className="text-xs text-slate-400 font-mono">{svc.latency} ms</span>
                                    )}
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${health.className}`}>
                                        {health.label}
                                    </span>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            )}

            {/* DEMANDES D'INSCRIPTION EN ATTENTE */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Demandes d'inscription en attente</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Ces utilisateurs ne peuvent pas se connecter tant que vous ne les approuvez pas.</p>
                    </div>
                    <span className={`font-bold py-1 px-3 rounded-full text-sm ${
                        pendingUsers.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                        {pendingUsers.length} en attente
                    </span>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400">Chargement des données...</div>
                    ) : fetchError ? (
                        <div className="p-6 flex items-start gap-3 bg-red-50 text-red-700 border-t border-red-200">
                            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold">Impossible de charger les demandes</p>
                                <p className="text-sm mt-1 font-mono">{fetchError}</p>
                                <button onClick={fetchPendingUsers} className="mt-3 text-sm font-semibold underline hover:no-underline">
                                    Réessayer
                                </button>
                            </div>
                        </div>
                    ) : pendingUsers.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                            <CheckCircle size={48} className="text-slate-300 mb-4" />
                            <p>Aucune demande en attente. Tout est a jour.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-4 text-sm font-semibold text-slate-600">Nom</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600">Prénom</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600">Email</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600">Rôle demandé</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingUsers.map(user => (
                                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                        <td className="p-4 text-slate-800 font-medium">{user.nom}</td>
                                        <td className="p-4 text-slate-800">{user.prenom}</td>
                                        <td className="p-4 text-slate-600 text-sm">{user.email}</td>
                                        <td className="p-4">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                user.role === 'TEACHER' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                                            }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleApprove(user.id)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm shadow-sm"
                                            >
                                                Approuver l'accès
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function MiniStat({ icon, label, value, color }) {
    const classes = {
        rose: 'bg-rose-50 text-rose-600',
        violet: 'bg-violet-50 text-violet-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };
    return (
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3 dark:border-slate-700 dark:bg-slate-900">
            <div className={`p-2 rounded-lg ${classes[color] || classes.indigo}`}>{icon}</div>
            <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100">{value}</p>
            </div>
        </div>
    );
}

function buildRecentActivity(users, courses) {
    const pending = users.filter(user => !user.estApprouve).slice(0, 2).map(user => ({
        label: 'Inscription utilisateur',
        detail: `${user.email || 'Utilisateur'} est en attente de validation.`,
    }));
    const approved = users.filter(user => user.estApprouve).slice(0, 1).map(user => ({
        label: 'Validation compte',
        detail: `${user.email || 'Utilisateur'} est actif sur la plateforme.`,
    }));
    const createdCourses = courses.slice(0, 2).map(course => ({
        label: 'Creation cours',
        detail: course.title || course.titre || 'Cours sans titre',
    }));
    return [...pending, ...createdCourses, ...approved].slice(0, 5);
}

function buildSystemAlerts(services) {
    return services.flatMap(service => {
        if (service.status === 'DOWN') {
            return [{ level: 'error', title: `${service.name} DOWN`, message: 'Le service ne repond pas via la gateway.' }];
        }
        if (service.latency !== null && service.latency >= 1000) {
            return [{ level: 'warning', title: `${service.name} lent`, message: `Latence elevee : ${service.latency} ms.` }];
        }
        return [];
    });
}

function serviceHealthMeta(service) {
    if (service.status === 'DOWN') {
        return {
            label: 'DOWN',
            className: 'bg-red-100 text-red-700',
            icon: <XCircle size={16} className="text-red-500" />,
        };
    }
    if (service.latency !== null && service.latency >= 1000) {
        return {
            label: 'LENT',
            className: 'bg-amber-100 text-amber-700',
            icon: <GaugeCircle size={16} className="text-amber-500" />,
        };
    }
    return {
        label: 'UP',
        className: 'bg-emerald-100 text-emerald-700',
        icon: <CheckCircle size={16} className="text-emerald-500" />,
    };
}
