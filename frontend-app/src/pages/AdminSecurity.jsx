import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Shield, Users } from 'lucide-react';
import { adminApi } from '../api/apiClient';

export default function AdminSecurity() {
    const [users, setUsers] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [usersRes, pendingRes] = await Promise.allSettled([
                    adminApi.getAllUsers(),
                    adminApi.getPendingUsers(),
                ]);
                setUsers(usersRes.status === 'fulfilled' && Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
                setPendingUsers(pendingRes.status === 'fulfilled' && Array.isArray(pendingRes.value.data) ? pendingRes.value.data : []);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const stats = useMemo(() => {
        const active = users.filter(user => user.estApprouve).length;
        return {
            total: users.length,
            pending: pendingUsers.length,
            active,
        };
    }, [users, pendingUsers]);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Securite</h1>
                <p className="text-slate-500 text-lg mt-2">Controle d'acces, comptes et recommandations de securite.</p>
            </div>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Shield size={20} className="text-indigo-600" />
                    Resume securite
                </h2>
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Chargement...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SecurityStat label="Utilisateurs" value={stats.total} icon={<Users size={18} />} />
                        <SecurityStat label="Comptes actifs" value={stats.active} icon={<CheckCircle size={18} />} />
                        <SecurityStat label="En attente" value={stats.pending} icon={<AlertTriangle size={18} />} />
                    </div>
                )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-3">Tentatives de connexion</h2>
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                    Aucune donnee disponible
                </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Recommandations simples</h2>
                <div className="space-y-3">
                    <Recommendation text="Changer le mot de passe admin par defaut apres la demonstration." />
                    <Recommendation text="Verifier regulierement les comptes en attente avant validation." />
                    <Recommendation text="Securiser les variables d'environnement et ne jamais commiter de secrets reels." />
                </div>
            </section>
        </div>
    );
}

function SecurityStat({ icon, label, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">{icon}</div>
            <div>
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="text-2xl font-black text-slate-800">{value}</p>
            </div>
        </div>
    );
}

function Recommendation({ text }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <CheckCircle size={17} className="mt-0.5 text-emerald-600" />
            <p className="text-sm text-slate-600">{text}</p>
        </div>
    );
}
