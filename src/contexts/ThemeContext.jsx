import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Look for saved theme, default to dark
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    // Set the theme on the document root
    document.documentElement.setAttribute('data-theme', theme);
    // Save to local storage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
