import { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext();

const THEMES = [
  { id: 'dark',     label: 'Dark',     icon: '🌑', accent: '#00d4ff' },
  { id: 'midnight', label: 'Midnight', icon: '🌌', accent: '#818cf8' },
  { id: 'forest',   label: 'Forest',   icon: '🌿', accent: '#00e5b3' },
  { id: 'light',    label: 'Light',    icon: '☀️',  accent: '#0284c7' },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('wm_theme') || 'dark');

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('wm_theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
