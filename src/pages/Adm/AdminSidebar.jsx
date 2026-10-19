import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Map as MapIcon, LogOut, ChevronRight, ChevronLeft, Church,
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
                <button
                    type="button"
                    className={styles.trayToggle}
                    onClick={() => setIsOpen((current) => !current)}
                    aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
                    aria-expanded={isOpen}
                >
                    {isOpen ? <ChevronLeft size={21} /> : <ChevronRight size={21} />}
                </button>

                <NavLink to="/admin" className={styles.sidebarHeader} onClick={closeOnMobile}>
                    <span className={styles.brandMark} aria-hidden="true">
                        <Church size={35} strokeWidth={1.7} />
                    </span>
                    <span className={styles.brandText}>
                        <span>Painel Administrativo</span>
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
                            <Icon size={19} strokeWidth={1.9} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <button type="button" className={styles.navItem} onClick={handleLogout}>
                        <LogOut size={19} strokeWidth={1.9} />
                        <span>Sair</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
