import { useState, useEffect } from 'react';
import { Settings, Save, HardDrive } from 'lucide-react';
import { adminApi } from '../api/apiClient';
import toast from 'react-hot-toast';

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        MAX_UPLOAD_SIZE: '5' // default
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await adminApi.getSettings();
                // Map array of {settingKey, settingValue} to an object
                const settingsObj = {};
                res.data.forEach(item => {
                    settingsObj[item.settingKey] = item.settingValue;
                });
                
                // Merge with default state safely
                setSettings(prev => ({...prev, ...settingsObj}));
            } catch (error) {
                toast.error("Impossible de charger les paramètres.");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await adminApi.updateSettings(settings);
            toast.success("Configuration sauvegardée avec succès !");
        } catch (error) {
            toast.error("Erreur lors de la sauvegarde.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement de la configuration...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <Settings className="text-indigo-600" size={32} />
                    Paramètres Système
                </h1>
                <p className="text-slate-500 mt-2 text-lg">
                    Configuration globale du moteur adaptatif et contraintes de l'infrastructure.
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <HardDrive size={20} className="text-slate-500"/>
                        Stockage et Médias
                    </h2>
                </div>
                
                <div className="p-6">
                    <form onSubmit={handleSave}>
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Taille maximale d'upload par fichier (Mégaoctets)
                            </label>
                            <input 
                                type="number" 
                                min="1" max="500"
                                required
                                value={settings.MAX_UPLOAD_SIZE || ''}
                                onChange={(e) => setSettings({...settings, MAX_UPLOAD_SIZE: e.target.value})}
                                className="w-full sm:w-64 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                Cette limite sera appliquée en temps réel par le Content-Service lors de l'envoi de ressources par les enseignants.
                            </p>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex justify-end">
                            <button 
                                type="submit" 
                                disabled={saving}
                                className={`flex items-center gap-2 px-6 py-2.5 font-bold text-white rounded-xl shadow focus:ring focus:ring-indigo-300 transition-all ${saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                <Save size={18} />
                                {saving ? "Sauvegarde..." : "Sauvegarder la configuration"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
