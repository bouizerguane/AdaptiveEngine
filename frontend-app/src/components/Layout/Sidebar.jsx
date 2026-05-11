import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Share2, Book, LogOut, Folder, Settings, Users, Server, FileText, Shield, UserCircle, ClipboardList, Terminal, Compass, Library, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function Sidebar({ collapsed = false, onToggleCollapsed, darkMode, onToggleTheme }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const userRole = user?.role || 'ROLE_TEACHER';

    const menuData = {
        'ROLE_TEACHER': {
            title: 'Espace Enseignant',
            links: [
                { to: '/teacher/dashboard', icon: <Home size={20} />, label: 'Tableau de bord' },
                { to: '/courses', icon: <Book size={20} />, label: 'Gestion des Cours' },
                { to: '/graph', icon: <Share2 size={20} />, label: 'Graphe de Competences' },
                { to: '/teacher/resources', icon: <Folder size={20} />, label: 'Gestion Ressources' },
                { to: '/teacher/quizzes', icon: <ClipboardList size={20} />, label: 'Gestion Evaluations' },
                { to: '/teacher/labs', icon: <Terminal size={20} />, label: 'Gestion TP' },
                { to: '/teacher/enrollments', icon: <Users size={20} />, label: 'Gestion des inscriptions' },
                { to: '/profile', icon: <UserCircle size={20} />, label: 'Mon Profil' }
            ]
        },
        'ROLE_STUDENT': {
            title: 'Espace Apprenant',
            links: [
                { to: '/learner/dashboard', icon: <Home size={20} />, label: 'Mon Parcours' },
                { to: '/learner/courses', icon: <Compass size={20} />, label: 'Cours disponibles' },
                { to: '/learner/my-courses', icon: <Library size={20} />, label: 'Mes cours' },
                { to: '/profile', icon: <UserCircle size={20} />, label: 'Mon Profil' }
            ]
        },
        'ROLE_ADMIN': {
            title: 'Administration Systeme',
            links: [
                { to: '/admin/dashboard', icon: <Server size={20} />, label: 'Dashboard Admin' },
                { to: '/admin/courses', icon: <Book size={20} />, label: 'Gestion des cours' },
                { to: '/admin/users', icon: <Users size={20} />, label: 'Gestion Utilisateurs' },
                { to: '/admin/settings', icon: <Settings size={20} />, label: 'Parametres Systeme' },
                { to: '/admin/logs', icon: <FileText size={20} />, label: 'Logs Systeme' },
                { to: '/admin/security', icon: <Shield size={20} />, label: 'Securite' },
                { to: '/profile', icon: <UserCircle size={20} />, label: 'Mon Profil' }
            ]
        }
    };

    const currentMenu = menuData[userRole] || menuData['ROLE_TEACHER'];
    const userName = user?.nom || user?.email || '';

    return (
        <aside className={`${collapsed ? 'w-20' : 'w-64'} hide-scrollbar bg-slate-900 text-slate-300 flex h-screen shrink-0 flex-col overflow-hidden border-r border-slate-700 transition-all duration-300 ease-in-out`}>
            <div className={`${collapsed ? 'p-4' : 'p-5'} border-b border-slate-800`}>
                <div className={`flex items-center ${collapsed ? 'flex-col justify-center gap-2' : 'justify-between gap-3'}`}>
                    <div className={`flex min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
                        <Book className="shrink-0 text-indigo-400" size={24} />
                        {!collapsed && (
                            <h2 className="truncate text-xl font-bold text-white">AdaptiveEngine</h2>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                        title={collapsed ? 'Agrandir le menu' : 'Reduire le menu'}
                        aria-label={collapsed ? 'Agrandir le menu' : 'Reduire le menu'}
                    >
                        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>
                {!collapsed && (
                    <span className="mt-3 inline-block max-w-full truncate rounded-full bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-300">
                        {currentMenu.title}{userName ? ` - ${userName}` : ''}
                    </span>
                )}
            </div>

            <nav className={`${collapsed ? 'p-3' : 'p-4'} hide-scrollbar flex-1 space-y-2 overflow-y-auto`}>
                {currentMenu.links.map((link, idx) => (
                    <NavLink
                        key={idx}
                        to={link.to}
                        title={collapsed ? link.label : undefined}
                        className={({isActive}) => `flex items-center rounded-lg p-3 transition-colors ${collapsed ? 'justify-center' : 'gap-3'} ${isActive ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 hover:text-white'}`}
                    >
                        {link.icon}
                        {!collapsed && <span className="font-medium">{link.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className={`${collapsed ? 'p-3' : 'p-4'} shrink-0 space-y-2 border-t border-slate-800 bg-slate-900`}>
                <ThemeToggle darkMode={darkMode} onToggleTheme={onToggleTheme} collapsed={collapsed} />
                <button
                    onClick={() => { logout(); navigate('/', { replace: true }); }}
                    className={`flex w-full items-center rounded-lg p-3 transition-colors hover:bg-red-500/10 hover:text-red-400 ${collapsed ? 'justify-center' : 'gap-3'}`}
                    title={collapsed ? 'Deconnexion' : undefined}
                >
                    <LogOut size={20} />
                    {!collapsed && <span className="font-medium">Deconnexion</span>}
                </button>
            </div>
        </aside>
    );
}
