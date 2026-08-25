import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for user session on mount
    const storedUser = localStorage.getItem('aria_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUser(data.user);
        localStorage.setItem('aria_user', JSON.stringify(data.user));
        return { success: true };
      } else {
        return { success: false, message: data.detail };
      }
    } catch (e) {
      return { success: false, message: 'Error de conexión con el servidor' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('aria_user');
  };

  // Helper function to check if the user has access to a specific module based on role and department
  const hasAccess = (moduleName) => {
    if (!user) return false;
    if (user.role === 'Administrador') return true; // Admin has full access

    // General access to dashboard
    if (moduleName === 'dashboard') return true;
    if (moduleName === 'archivos') return true; // Everyone can see files

    // Finance can access finance
    if (user.department === 'Finanzas' && moduleName === 'finanzas') return true;
    
    // Cybersecurity can access security modules and vault
    if (user.department === 'Ciberseguridad' && ['auditoria', 'amenazas', 'boveda'].includes(moduleName)) return true;

    // IAM is restricted to Admin
    if (moduleName === 'iam') return false; 
    
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasAccess, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
