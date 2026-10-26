import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Map as MapIcon, LogOut, ChevronRight, ChevronLeft, Home, QrCode
} from 'lucide-react';
import styles from './AdminSidebar.module.css';

const MENU = [
    { to: '/admin', label: 'Início', icon: LayoutDashboard, end: true },
    { to: '/admin/falecidos', label: 'Falecidos', icon: Users },
    { to: '/admin/quadraslotes', label: 'Quadras e Lotes', icon: MapIcon },
    { to: '/admin/qrcodes', label: 'QR Codes', icon: QrCode },
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
                        <svg viewBox="0 0 24 24" width="30" height="40" fill="none" aria-hidden="true">
                            <path d="M5 21V9a7 7 0 0 1 14 0v12H5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                            <path d="M12 7v7M9.5 9.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            <path d="M9 21v-2h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                    </span>
                    <span className={styles.brandText}>
                        <strong>SGC</strong>
                        <span>Sistema de Gestão<br />de Cemitério</span>
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
