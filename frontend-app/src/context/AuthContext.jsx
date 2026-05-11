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
        const normalizedRole = role.startsWith('ROLE_') ? role : `ROLE_${role}`;
        setUser({ email, nom, prenom, role: normalizedRole });
        setIsAuthenticated(true);
    };

    const logout = () => {
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

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                if (decoded.exp * 1000 < Date.now()) {
                    console.warn('[AuthContext] Token expire, deconnexion automatique');
                    logout();
                } else {
                    let role = decoded.role || (decoded.roles ? decoded.roles[0] : 'TEACHER');
                    if (!role.startsWith('ROLE_')) {
                        role = `ROLE_${role}`;
                    }
                    setUser({
                        email: decoded.sub,
                        nom: decoded.nom || decoded.firstName || '',
                        prenom: decoded.prenom || decoded.lastName || '',
                        role,
                    });
                    setIsAuthenticated(true);
                }
            } catch (err) {
                console.error('[AuthContext] Erreur de decodage JWT, deconnexion', err);
                logout();
            }
        }
        setLoading(false);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateLocalUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
