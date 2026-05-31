import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { BookOpen, AlertCircle, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuthPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    const navigate = useNavigate();

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

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
            setError(err.response?.data?.message || 'Identifiants invalides ou serveur indisponible.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-slate-800 transition-colors dark:bg-slate-950 dark:text-white">
            <button
                type="button"
                onClick={() => setDarkMode(value => !value)}
                className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                title={darkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
            >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                <span>{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
            </button>

            <form
                onSubmit={handleLogin}
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/70 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
            >
                <div className="flex flex-col items-center justify-center mb-6 text-indigo-500 dark:text-indigo-400">
                    <BookOpen size={48} className="drop-shadow-lg" />
                    <h2 className="text-2xl font-bold mt-4 text-center text-slate-900 dark:text-white">AdaptiveEngine</h2>
                    <span className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold tracking-widest uppercase mt-1">Connexion</span>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 mb-6 rounded-lg text-sm flex items-start gap-2 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm text-slate-600 mb-2 dark:text-slate-300">Adresse Email</label>
                    <input
                        type="text"
                        required
                        className="w-full p-2.5 bg-white rounded-lg text-slate-900 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition dark:bg-slate-900 dark:text-white dark:border-slate-700"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-sm text-slate-600 mb-2 dark:text-slate-300">Mot de passe</label>
                    <input
                        type="password"
                        required
                        className="w-full p-2.5 bg-white rounded-lg text-slate-900 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition dark:bg-slate-900 dark:text-white dark:border-slate-700"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                </div>
                <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-3 rounded-lg font-bold transition shadow-lg shadow-indigo-500/20 text-white">
                    {loading ? 'Connexion en cours...' : 'Se connecter'}
                </button>

                <div className="mt-6 text-center text-sm text-slate-500 border-t border-slate-200 pt-6 dark:text-slate-400 dark:border-slate-700">
                    Pas encore de compte ? <Link to="/register" className="text-indigo-600 hover:underline dark:text-indigo-400">Demander un accès</Link>
                </div>
            </form>
        </div>
    );
}
