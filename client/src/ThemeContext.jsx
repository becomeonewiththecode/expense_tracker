import { createContext, useContext, useEffect, useState } from "react";
import { getTheme, setTheme as persistTheme } from "./themePreferences.js";

const ThemeContext = createContext({ theme: "midnight", setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => {
    const onChange = () => setThemeState(getTheme());
    window.addEventListener("theme-changed", onChange);
    return () => window.removeEventListener("theme-changed", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
  }, [theme]);

  function setTheme(next) {
    persistTheme(next);
    setThemeState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
