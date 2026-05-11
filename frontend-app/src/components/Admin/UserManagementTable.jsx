import { useState, useEffect } from 'react';
import { User, Trash2, Edit, Search, CheckCircle, XCircle } from 'lucide-react';
import { adminApi } from '../../api/apiClient';
import toast from 'react-hot-toast';
import CustomDialog from '../CustomDialog';

const normalizeRole = (role) => (role || '').replace('ROLE_', '');

export default function UserManagementTable() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    
    // Modals state
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
    
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [editFormData, setEditFormData] = useState({ nom: '', prenom: '', role: '' });

    const fetchUsers = async () => {
        try {
            const res = await adminApi.getAllUsers();
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            toast.error("Impossible de charger les utilisateurs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter logic
    const filteredUsers = users.filter(u => {
        const role = normalizeRole(u.role);
        const query = searchTerm.toLowerCase();
        const matchesSearch = (`${u.nom || ''} ${u.prenom || ''}`).toLowerCase().includes(query)
            || (u.email || '').toLowerCase().includes(query);
        const matchesRole = roleFilter === 'ALL' || role === roleFilter;
        const matchesStatus = statusFilter === 'ALL'
            || (statusFilter === 'ACTIVE' && u.estApprouve)
            || (statusFilter === 'PENDING' && !u.estApprouve);
        return matchesSearch && matchesRole && matchesStatus;
    });

    // Delete handlers
    const confirmDelete = (user) => {
        setDialogConfig({
            isOpen: true,
            type: 'confirm',
            title: 'Confirmer la suppression',
            message: `Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur ${user.email} ? Cette action est irréversible.`,
            onConfirm: async () => {
                try {
                    await adminApi.deleteUser(user.id);
                    setUsers(prev => prev.filter(u => u.id !== user.id));
                    toast.success("Utilisateur supprimé avec succès");
                    setDialogConfig(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    toast.error("Erreur lors de la suppression");
                }
            }
        });
    };

    // Edit handlers
    const openEdit = (user) => {
        setUserToEdit(user);
        setEditFormData({ nom: user.nom, prenom: user.prenom, role: user.role });
        setEditModalOpen(true);
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        try {
            const res = await adminApi.updateUser(userToEdit.id, editFormData);
            // Update local state
            setUsers(users.map(u => u.id === userToEdit.id ? res.data : u));
            toast.success("Utilisateur mis à jour");
            setEditModalOpen(false);
            setUserToEdit(null);
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'ADMIN': return <span className="px-2 py-1 text-xs font-bold rounded bg-rose-100 text-rose-700">ADMIN</span>;
            case 'TEACHER': return <span className="px-2 py-1 text-xs font-bold rounded bg-indigo-100 text-indigo-700">TEACHER</span>;
            case 'STUDENT': return <span className="px-2 py-1 text-xs font-bold rounded bg-emerald-100 text-emerald-700">STUDENT</span>;
            default: return <span className="px-2 py-1 text-xs font-bold rounded bg-slate-100 text-slate-700">{role}</span>;
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50 gap-4">
                <div className="flex items-center gap-3">
                    <User className="text-indigo-600" size={24} />
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Registre des Utilisateurs</h2>
                        <p className="text-sm text-slate-500">Gérez l'ensemble des comptes de la plateforme</p>
                    </div>
                </div>
                
                <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="ALL">Tous roles</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="TEACHER">TEACHER</option>
                        <option value="STUDENT">STUDENT</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="ALL">Tous statuts</option>
                        <option value="ACTIVE">Actifs</option>
                        <option value="PENDING">En attente</option>
                    </select>
                </div>
            </div>

            <div className="p-0 overflow-x-auto">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Chargement...</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-sm font-semibold text-slate-600">Nom complet</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Email</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Rôle</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Statut</th>
                                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500">Aucun utilisateur trouvé.</td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                        <td className="p-4 text-slate-800 font-medium">{user.nom} {user.prenom}</td>
                                        <td className="p-4 text-slate-600 text-sm">{user.email}</td>
                                        <td className="p-4">{getRoleBadge(user.role)}</td>
                                        <td className="p-4">
                                            {user.estApprouve ? 
                                                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle size={14}/> Approuvé</span> : 
                                                <span className="flex items-center gap-1 text-xs font-semibold text-amber-500"><XCircle size={14}/> En attente</span>
                                            }
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button 
                                                onClick={() => openEdit(user)}
                                                className="p-1.5 bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                                title="Modifier"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => confirmDelete(user)}
                                                className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* CUSTOM DIALOG */}
            <CustomDialog 
                isOpen={dialogConfig.isOpen} 
                type={dialogConfig.type}
                title={dialogConfig.title}
                message={dialogConfig.message}
                onConfirm={dialogConfig.onConfirm}
                onClose={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
            />

            {/* EDIT MODAL */}
            {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Modifier l'utilisateur</h3>
                            <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleEditSave} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Prénom</label>
                                <input 
                                    type="text" required
                                    value={editFormData.prenom} 
                                    onChange={(e) => setEditFormData({...editFormData, prenom: e.target.value})}
                                    className="w-full bg-white text-slate-800 border border-slate-300 focus:border-indigo-500 rounded-lg p-2.5 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Nom</label>
                                <input 
                                    type="text" required
                                    value={editFormData.nom} 
                                    onChange={(e) => setEditFormData({...editFormData, nom: e.target.value})}
                                    className="w-full bg-white text-slate-800 border border-slate-300 focus:border-indigo-500 rounded-lg p-2.5 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Rôle</label>
                                <select 
                                    value={editFormData.role}
                                    onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}
                                    className="w-full bg-white text-slate-800 border border-slate-300 focus:border-indigo-500 rounded-lg p-2.5 outline-none transition"
                                >
                                    <option value="TEACHER">Enseignant</option>
                                    <option value="STUDENT">Apprenant</option>
                                    <option value="ADMIN">Administrateur</option>
                                </select>
                            </div>
                            
                            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button 
                                    type="button" onClick={() => setEditModalOpen(false)}
                                    className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                >
                                    Annuler
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-md"
                                >
                                    Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
