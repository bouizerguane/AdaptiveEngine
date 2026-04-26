import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/apiClient';
import { BookOpen, UserPlus, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomDialog from '../components/CustomDialog';

export default function Register() {
    const [formData, setFormData] = useState({ nom: '', prenom: '', email: '', password: '', role: 'STUDENT' });
    const [status, setStatus] = useState(null); // 'error', 'loading'
    const [message, setMessage] = useState('');
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        try {
            const res = await authApi.register(formData);
            setStatus(null);
            const successMsg = res.data.message || "Demande envoyée ! Un administrateur doit valider votre compte";
            setDialogConfig({
                isOpen: true,
                type: 'success',
                title: 'Inscription réussie',
                message: successMsg,
                onConfirm: () => navigate('/')
            });
        } catch (error) {
            setStatus('error');
            const errorMsg = error.response?.data?.message || error.response?.data?.errors?.[0]?.defaultMessage || "Erreur de validation. Verifiez vos champs.";
            setMessage(errorMsg);
            toast.error(errorMsg);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
                <div className="flex flex-col items-center justify-center mb-6">
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl mb-4">
                        <UserPlus size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-center text-white">Rejoindre AdaptiveEngine</h2>
                    <p className="text-slate-400 text-sm mt-1">Créez votre profil d'apprentissage</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                        {status === 'error' && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm text-center">
                                {message}
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Prénom</label>
                                <input required className="w-full p-2.5 bg-slate-900 rounded-lg text-white border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Nom</label>
                                <input required className="w-full p-2.5 bg-slate-900 rounded-lg text-white border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Email</label>
                            <input required type="email" className="w-full p-2.5 bg-slate-900 rounded-lg text-white border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Mot de passe</label>
                            <input required type="password" className="w-full p-2.5 bg-slate-900 rounded-lg text-white border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Quel est votre profil ?</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => setFormData({...formData, role: 'STUDENT'})} className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${formData.role === 'STUDENT' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500'}`}>
                                    <span className="font-semibold text-sm">Apprenant</span>
                                </button>
                                <button type="button" onClick={() => setFormData({...formData, role: 'TEACHER'})} className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${formData.role === 'TEACHER' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500'}`}>
                                    <span className="font-semibold text-sm">Enseignant</span>
                                </button>
                            </div>
                        </div>

                        <button disabled={status === 'loading'} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-3 rounded-lg font-bold transition shadow-lg shadow-indigo-500/20 mt-6 text-white">
                            {status === 'loading' ? 'Envoi...' : 'Demander l\'accès'}
                        </button>
                    </form>

                <div className="mt-6 text-center text-sm text-slate-400 border-t border-slate-700 pt-6">
                    Déjà un compte ? <Link to="/" className="text-indigo-400 hover:underline">Se connecter</Link>
                </div>
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
