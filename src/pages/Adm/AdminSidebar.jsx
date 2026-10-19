import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Map as MapIcon, Home, ChevronRight, ChevronLeft,
} from 'lucide-react';
import styles from './AdminSidebar.module.css';

const MENU = [
    {
        itens: [
            { to: '/admin', label: 'Inicio', icon: LayoutDashboard, end: true },
            { to: '/admin/falecidos', label: 'Falecidos', icon: Users },
            { to: '/admin/quadraslotes', label: 'Quadras e Lotes', icon: MapIcon },
        ],
    },
];

export default function AdminSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const toggleSidebar = () => setIsOpen(!isOpen);
    const closeOnMobile = () => setIsOpen(false);

    return (
        <>
            {isOpen && <div className={styles.overlay} onClick={toggleSidebar}></div>}

            <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>

                <button className={styles.trayToggle} onClick={toggleSidebar}>
                    {isOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                </button>

                <div className={styles.sidebarHeader}>
                    <h2>Adm Menu</h2>
                </div>

                <nav className={styles.sidebarNav}>
                    {MENU.map((grupo) => (
                        <div key={grupo.titulo} className={styles.navGroup}>
                            <span className={styles.navGroupTitle}>{grupo.titulo}</span>

                            {grupo.itens.map(({ to, label, icon: Icon, end, soon }) =>
                                soon ? (
                                    <span key={to} className={`${styles.navItem} ${styles.navItemSoon}`} aria-disabled="true">
                                        <Icon size={20} /> {label}
                                        <small className={styles.soonTag}>Em breve</small>
                                    </span>
                                ) : (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        end={end}
                                        onClick={closeOnMobile}
                                        className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}
                                    >
                                        <Icon size={20} /> {label}
                                    </NavLink>
                                )
                            )}
                        </div>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <button className={styles.navItem} onClick={() => navigate('/')}>
                        <Home size={20} /> Voltar ao início
                    </button>
                </div>
            </aside>
        </>
    );
}