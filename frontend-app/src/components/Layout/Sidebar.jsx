import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Share2, Book, LogOut, Target, Folder, Settings, Users, Server, FileText, Shield, UserCircle, ClipboardList, Terminal, Compass, Library } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const userRole = user?.role || 'ROLE_TEACHER';

    const menuData = {
        'ROLE_TEACHER': {
            title: 'Espace Enseignant',
            links: [
                { to: '/teacher/dashboard', icon: <Home size={20} />, label: 'Tableau de bord' },
                { to: '/courses', icon: <Book size={20} />, label: 'Gestion des Cours' },
                { to: '/graph', icon: <Share2 size={20} />, label: 'Graphe de Compétences' },
                { to: '/teacher/resources', icon: <Folder size={20} />, label: 'Gestion Ressources' },
                { to: '/teacher/quizzes', icon: <ClipboardList size={20} />, label: 'Gestion Évaluations' },
                { to: '/teacher/labs', icon: <Terminal size={20} />, label: 'Gestion TP' },
                { to: '/profile', icon: <UserCircle size={20} />, label: 'Mon Profil' }
            ]
        },
        'ROLE_STUDENT': {
            title: 'Espace Apprenant',
            links: [
                { to: '/learner/dashboard', icon: <Home size={20} />, label: 'Mon Parcours' },
                { to: '/learner/courses', icon: <Compass size={20} />, label: 'Cours disponibles' },
                { to: '/learner/my-courses', icon: <Library size={20} />, label: 'Mes cours' },
                { to: '/learner/skills', icon: <Target size={20} />, label: 'Mes Compétences' },
                { to: '/learner/resources', icon: <Folder size={20} />, label: 'Ressources' },
                { to: '/profile', icon: <UserCircle size={20} />, label: 'Mon Profil' },
                { to: '/learner/settings', icon: <Settings size={20} />, label: 'Paramètres' }
            ]
        },
        'ROLE_ADMIN': {
            title: 'Administration Système',
            links: [
                { to: '/admin/dashboard', icon: <Server size={20} />, label: 'Dashboard Admin' },
                { to: '/admin/users', icon: <Users size={20} />, label: 'Gestion Utilisateurs' },
                { to: '/admin/settings', icon: <Settings size={20} />, label: 'Paramètres Système' },
                { to: '/admin/logs', icon: <FileText size={20} />, label: 'Logs Système' },
                { to: '/admin/security', icon: <Shield size={20} />, label: 'Sécurité' },
                { to: '/profile', icon: <UserCircle size={20} />, label: 'Mon Profil' }
            ]
        }
    };

    const currentMenu = menuData[userRole] || menuData['ROLE_TEACHER'];

    return (
        <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-700">
            <div className="p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Book className="text-indigo-400" />
                    AdaptiveEngine
                </h2>
                <span className="text-xs font-semibold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-full mt-2 inline-block">
                    {currentMenu.title} - {user?.nom}
                </span>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
                {currentMenu.links.map((link, idx) => (
                    <NavLink key={idx} to={link.to} className={({isActive}) => `flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 hover:text-white'}`}>
                        {link.icon}
                        <span className="font-medium">{link.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <button onClick={() => { logout(); navigate('/', { replace: true }); }} className="flex items-center gap-3 p-3 w-full rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors">
                    <LogOut size={20} />
                    <span className="font-medium">Déconnexion</span>
                </button>
            </div>
        </div>
    );
}
