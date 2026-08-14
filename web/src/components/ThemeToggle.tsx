import { useTheme } from '../theme/useTheme';
import { MoonIcon, SunIcon } from '../icons';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      className={className ? `theme-toggle-btn ${className}` : 'theme-toggle-btn'}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
