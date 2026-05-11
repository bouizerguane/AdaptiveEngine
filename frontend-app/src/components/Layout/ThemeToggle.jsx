import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ darkMode, onToggleTheme, collapsed = false }) {
    return (
        <button
            onClick={onToggleTheme}
            className={`flex w-full items-center rounded-lg p-3 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white ${collapsed ? 'justify-center' : 'gap-3'}`}
            title={darkMode ? 'Mode clair' : 'Mode sombre'}
        >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            {!collapsed && (
                <span className="font-medium">{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
            )}
        </button>
    );
}
