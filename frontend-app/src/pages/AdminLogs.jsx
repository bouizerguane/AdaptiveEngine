import { useMemo, useState } from 'react';
import { Download, RefreshCw, Search, FileText } from 'lucide-react';

const MOCK_LOGS = [
    { time: '09:12:04', level: 'INFO', service: 'Gateway', message: 'Route /api/graph/** forwarded to knowledge-graph-service.' },
    { time: '09:13:21', level: 'INFO', service: 'IAM', message: 'Admin session validated.' },
    { time: '09:17:45', level: 'WARN', service: 'Content', message: 'MongoDB volume credentials should be checked after .env changes.' },
    { time: '09:20:10', level: 'INFO', service: 'Graph', message: 'Course tree loaded successfully.' },
    { time: '09:24:37', level: 'ERROR', service: 'Tracking', message: 'No recent error from backend logs endpoint. Demonstration row only.' },
];

const levels = ['ALL', 'INFO', 'WARN', 'ERROR'];
const services = ['ALL', 'IAM', 'Gateway', 'Graph', 'Content', 'Tracking'];

export default function AdminLogs() {
    const [query, setQuery] = useState('');
    const [level, setLevel] = useState('ALL');
    const [service, setService] = useState('ALL');
    const [refreshing, setRefreshing] = useState(false);

    const logs = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return MOCK_LOGS.filter(log => {
            const matchQuery = !normalized
                || log.message.toLowerCase().includes(normalized)
                || log.service.toLowerCase().includes(normalized);
            const matchLevel = level === 'ALL' || log.level === level;
            const matchService = service === 'ALL' || log.service === service;
            return matchQuery && matchLevel && matchService;
        });
    }, [query, level, service]);

    const refresh = () => {
        setRefreshing(true);
        window.setTimeout(() => setRefreshing(false), 400);
    };

    const exportJson = () => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'adaptiveengine-logs-demo.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Logs Systeme</h1>
                    <p className="text-slate-500 text-lg mt-2 dark:text-slate-400">Journaux d'activite et traces des microservices.</p>
                </div>
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                    Donnees de demonstration
                </span>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <div className="relative lg:col-span-2">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Rechercher dans les logs"
                            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>
                    <select
                        value={level}
                        onChange={(event) => setLevel(event.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                        {levels.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select
                        value={service}
                        onChange={(event) => setService(event.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                        {services.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                    <button
                        onClick={refresh}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                        Actualiser
                    </button>
                    <button
                        onClick={exportJson}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                    >
                        <Download size={15} />
                        Export JSON
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
                <div className="p-5 border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                        <FileText size={18} className="text-slate-500" />
                        Liste des logs
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <tr>
                                <th className="p-4 font-semibold">Heure</th>
                                <th className="p-4 font-semibold">Niveau</th>
                                <th className="p-4 font-semibold">Service</th>
                                <th className="p-4 font-semibold">Message</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {logs.length > 0 ? logs.map((log, index) => (
                                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <td className="p-4 font-mono text-xs text-slate-500">{log.time}</td>
                                    <td className="p-4"><LogLevelBadge level={log.level} /></td>
                                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">{log.service}</td>
                                    <td className="p-4 text-slate-600 dark:text-slate-300">{log.message}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400">Aucun log ne correspond aux filtres.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function LogLevelBadge({ level }) {
    const className = level === 'ERROR'
        ? 'bg-red-100 text-red-700'
        : level === 'WARN'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700';
    return <span className={`rounded px-2 py-1 text-xs font-bold ${className}`}>{level}</span>;
}
