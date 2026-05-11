import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { BookOpen, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuthPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await authApi.login({ email, password });
            
            const { token, email: userEmail, nom, prenom, role } = res.data;
            
            login(token, userEmail, nom, prenom, role);
            toast.success(`Bienvenue ${prenom} !`);
            
            const normalizedRole = role.startsWith('ROLE_') ? role : `ROLE_${role}`;
            if (normalizedRole === 'ROLE_ADMIN') navigate('/admin/dashboard');
            else if (normalizedRole === 'ROLE_STUDENT') navigate('/learner/dashboard');
            else navigate('/teacher/dashboard');
            
        } catch (err) {
            setError(err.response?.data?.message || "Identifiants invalides ou serveur indisponible.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
            <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
                <div className="flex flex-col items-center justify-center mb-6 text-indigo-400">
                    <BookOpen size={48} className="drop-shadow-lg" />
                    <h2 className="text-2xl font-bold mt-4 text-center text-white">AdaptiveEngine</h2>
                    <span className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mt-1">Connexion</span>
                </div>
                
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 mb-6 rounded-lg text-sm flex items-start gap-2">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm text-slate-400 mb-2">Adresse Email</label>
                    <input type="text" required className="w-full p-2.5 bg-slate-900 rounded-lg text-white border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="mb-6">
                    <label className="block text-sm text-slate-400 mb-2">Mot de passe</label>
                    <input type="password" required className="w-full p-2.5 bg-slate-900 rounded-lg text-white border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-3 rounded-lg font-bold transition shadow-lg shadow-indigo-500/20 text-white">
                    {loading ? 'Connexion en cours...' : 'Se Connecter'}
                </button>

                <div className="mt-6 text-center text-sm text-slate-400 border-t border-slate-700 pt-6">
                    Pas encore de compte ? <Link to="/register" className="text-indigo-400 hover:underline">Demander un accès</Link>
                </div>
            </form>
        </div>
    );
}
