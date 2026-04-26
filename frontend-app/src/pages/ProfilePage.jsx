import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/apiClient';
import toast from 'react-hot-toast';
import { UserCircle, Save, Lock } from 'lucide-react';

export default function ProfilePage() {
    const { user, updateLocalUser } = useAuth();
    
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        currentPassword: '',
        newPassword: ''
    });
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                firstName: user.prenom || '',
                lastName: user.nom || ''
            }));
        }
    }, [user]);

    const hasChanges = () => {
        return (
            formData.firstName !== user?.prenom ||
            formData.lastName !== user?.nom ||
            (formData.currentPassword.length > 0 && formData.newPassword.length >= 6)
        );
    };

    const isFormValid = () => {
        if (formData.firstName.trim() === '' || formData.lastName.trim() === '') return false;
        if (formData.currentPassword || formData.newPassword) {
            if (!formData.currentPassword || formData.newPassword.length < 6) return false;
        }
        return true;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!isFormValid()) return;

        setLoading(true);
        try {
            const dataToUpdate = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword
            };

            const res = await userApi.updateProfile(dataToUpdate);
            
            // Mettre à jour le context local
            updateLocalUser({
                nom: res.data.nom || formData.lastName,
                prenom: res.data.prenom || formData.firstName
            });

            toast.success('Profil mis à jour avec succès !');
            
            // Vider les champs mot de passe
            setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
        } catch (error) {
            const message = error.response?.data?.message || 'Erreur lors de la mise à jour.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <UserCircle size={32} className="text-indigo-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Mon Profil</h1>
                    <p className="text-slate-500">Gérez vos informations personnelles et votre sécurité.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <form onSubmit={handleSave} className="p-6">
                    {/* Read-Only Section */}
                    <div className="mb-8">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Informations du Compte</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Email (Non modifiable)</label>
                                <input 
                                    type="email" 
                                    disabled 
                                    value={user?.email || ''} 
                                    className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-lg p-2.5 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Rôle</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={user?.role?.replace('ROLE_', '') || ''} 
                                    className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-lg p-2.5 cursor-not-allowed font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Editable Section */}
                    <div className="mb-8">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Informations Personnelles</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Prénom</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.firstName} 
                                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                                    className="w-full bg-white text-slate-800 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Nom</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.lastName} 
                                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                                    className="w-full bg-white text-slate-800 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 outline-none transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                            <Lock size={18} className="text-slate-400" />
                            <h2 className="text-lg font-bold text-slate-800">Sécurité</h2>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-sm text-slate-500 mb-4">Laissez vide si vous ne souhaitez pas modifier votre mot de passe.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Mot de passe actuel</label>
                                    <input 
                                        type="password" 
                                        value={formData.currentPassword} 
                                        onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
                                        className="w-full bg-white text-slate-800 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Nouveau mot de passe</label>
                                    <input 
                                        type="password" 
                                        value={formData.newPassword} 
                                        onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                                        className="w-full bg-white text-slate-800 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 outline-none transition"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button 
                            type="submit" 
                            disabled={!hasChanges() || !isFormValid() || loading}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-6 rounded-lg transition shadow-md flex items-center gap-2"
                        >
                            <Save size={18} />
                            {loading ? 'Enregistrement...' : 'Sauvegarder'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
