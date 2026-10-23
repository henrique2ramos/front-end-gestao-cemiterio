import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Map as MapIcon, LogOut, ChevronRight, ChevronLeft, Home, ShieldCheck
} from 'lucide-react';
import styles from './AdminSidebar.module.css';

const MENU = [
    { to: '/admin', label: 'Início', icon: LayoutDashboard, end: true },
    { to: '/admin/falecidos', label: 'Falecidos', icon: Users },
    { to: '/admin/quadraslotes', label: 'Quadras e Lotes', icon: MapIcon },
];

export default function AdminSidebar({ onLogout }) {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const closeOnMobile = () => setIsOpen(false);
    
    const handleLogout = () => {
        onLogout();
        closeOnMobile();
        navigate('/login', { replace: true });
    };

    return (
        <>
            {isOpen && <button type="button" className={styles.overlay} onClick={closeOnMobile} aria-label="Fechar menu" />}

            <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
                <NavLink to="/admin" className={styles.sidebarHeader} onClick={closeOnMobile}>
                    <span className={styles.brandMark} aria-hidden="true">
                        <ShieldCheck size={21} strokeWidth={2.2} />
                    </span>
                    <span className={styles.brandText}>
                        <strong>Painel</strong>
                        <strong>Administrativo</strong>
                    </span>
                </NavLink>

                <div className={styles.navLabel}>Menu principal</div>
                
                <nav className={styles.sidebarNav} aria-label="Menu administrativo">
                    {MENU.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            onClick={closeOnMobile}
                            className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}
                        >
                            <Icon size={20} strokeWidth={2} className={styles.navIcon} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <button type="button" className={styles.navItem} onClick={() => navigate('/')}>
                        <Home size={20} strokeWidth={2} className={styles.navIcon} />
                        <span>Ir para o site</span>
                    </button>
                    <button type="button" className={styles.navItemLogout} onClick={handleLogout}>
                        <LogOut size={20} strokeWidth={2} className={styles.navIcon} />
                        <span>Sair do sistema</span>
                    </button>
                </div>
            </aside>

            <button
                type="button"
                className={`${styles.trayToggle} ${isOpen ? styles.trayToggleOpen : ''}`}
                onClick={() => setIsOpen((current) => !current)}
                aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={isOpen}
            >
                {isOpen ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
            </button>
        </>
    );
}
