import { getTheme, setTheme, subscribeTheme } from '../utils/theme';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import ProfileDropdown from './ProfileDropdown';
import './AppHeader.css';

export default function AppHeader({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () => document.documentElement.style.setProperty('--desk-header-height', header.getBoundingClientRect().height + 'px');
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--desk-header-height'); };
  }, []);
  return (<>
      {/* TOP HEADER - Fully Responsive */}
      <div className="service-desk-header" ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--gov-navy)',
        padding: 'clamp(8px, 2vw, 15px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'clamp(8px, 2vw, 12px)',
        minHeight: '52px',
        flexShrink: 0,
        flexWrap: 'nowrap',
      }}>
        <button className="header-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="desk-navigation" onClick={onToggleMenu}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        {/* LEFT: Logo + Title - Always visible */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 1.5vw, 10px)',
          flex: '1 1 0',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          <img
            src="/dswd_logo.png"
            alt="DSWD Logo"
            style={{
              height: 'clamp(28px, 5vw, 38px)',
              width: 'auto',
              objectFit: 'contain',
              filter: 'brightness(0) invert(1)',
              flexShrink: 0,
            }}
          />

          {/* Title - Responsive font size, always visible */}
          <div style={{
            color: '#fff',
            minWidth: 0,
          }}>
            <p className="service-desk-department" style={{
              fontSize: 'clamp(10px, 2vw, 14px)',
              fontWeight: 500,
              lineHeight: 1.2,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Department of Social Welfare and Development
            </p>
            <span className="service-desk-title" style={{
              fontSize: 'clamp(8px, 1.5vw, 11px)',
              color: 'rgba(255,255,255,0.7)',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              FO3 Service Desk
            </span>
          </div>
        </div>

        <button className="header-theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <ProfileDropdown />
      </div>
  </>);
}
