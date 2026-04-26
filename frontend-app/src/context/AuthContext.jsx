import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    const login = (token, email, nom, prenom, role) => {
        localStorage.setItem('token', token);
        let normalizedRole = role.startsWith('ROLE_') ? role : `ROLE_${role}`;
        const userData = { email, nom, prenom, role: normalizedRole };
        setUser(userData);
        setIsAuthenticated(true);
        console.log('[AuthContext] login() → utilisateur connecté :', userData);
    };

    const logout = () => {
        console.log('[AuthContext] logout() → session supprimée');
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
    };

    const updateLocalUser = (updatedData) => {
        setUser(prevUser => ({
            ...prevUser,
            nom: updatedData.nom || prevUser.nom,
            prenom: updatedData.prenom || prevUser.prenom
        }));
    };

    // Restauration de la session au démarrage (ou rechargement de page)
    useEffect(() => {
        console.log('[AuthContext] useEffect → tentative de restauration du token localStorage...');
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                // Vérification de l'expiration
                if (decoded.exp * 1000 < Date.now()) {
                    console.warn('[AuthContext] Token expiré → déconnexion automatique');
                    logout();
                } else {
                    // Normalisation du rôle
                    let role = decoded.role || (decoded.roles ? decoded.roles[0] : 'TEACHER');
                    if (!role.startsWith('ROLE_')) {
                        role = `ROLE_${role}`;
                    }
                    // FIX: restaurer aussi nom et prenom pour que la Sidebar les affiche correctement
                    const restoredUser = {
                        email: decoded.sub,
                        nom:   decoded.nom   || decoded.firstName || '',
                        prenom: decoded.prenom || decoded.lastName  || '',
                        role,
                    };
                    setUser(restoredUser);
                    setIsAuthenticated(true);
                    console.log('[AuthContext] Session restaurée depuis token :', restoredUser);
                }
            } catch (err) {
                console.error('[AuthContext] Erreur de décodage JWT → déconnexion :', err);
                logout();
            }
        } else {
            console.log('[AuthContext] Aucun token trouvé → utilisateur non authentifié');
        }
        setLoading(false);
    }, []);

    // Log de chaque changement d'état utilisateur (utile pour tracer les clics de menu)
    useEffect(() => {
        console.log('[AuthContext] État mis à jour → isAuthenticated:', isAuthenticated, '| user:', user);
    }, [user, isAuthenticated]);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateLocalUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
