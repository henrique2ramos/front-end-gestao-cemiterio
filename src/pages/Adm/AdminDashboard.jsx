import { useEffect, useState } from 'react';
import {
    Users, PlusCircle, Search, Map, ArrowRight,
    MapPin, ChevronRight, ChevronDown, Clock3, ClipboardList,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { fetchFalecidos, resolveImageUrl } from '../../lib/api';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard({ onLogout }) {
    const navigate = useNavigate();
    const [falecidos, setFalecidos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadMemoriais() {
            try {
                const data = await fetchFalecidos();
                setFalecidos(data);
            } catch (error) {
                console.error('Erro ao buscar memóriais no dashboard:', error);
                setFalecidos([]);
            } finally {
                setIsLoading(false);
            }
        }

        loadMemoriais();
    }, []);

    const ultimosCadastros = falecidos.slice(0, 3);
    const localizacoes = falecidos.map((falecido) => {
        const localizacao = falecido.localizacao || '';

        return {
            quadra: localizacao.match(/Quadra\s+([^,]+)/i)?.[1]?.trim().toUpperCase(),
            lote: localizacao.match(/Lote\s+([^,]+)/i)?.[1]?.trim(),
        };
    });
    const quadras = [...new Set(localizacoes.map(({ quadra }) => quadra).filter(Boolean))];
    const lotes = [...new Set(
        localizacoes
            .filter(({ lote }) => lote)
            .map(({ quadra, lote }) => quadra ? `${quadra}-${lote}` : lote)
    )];

    return (
        <div className={styles.adminLayout}>
            <AdminSidebar onLogout={onLogout} />

            <main className={styles.mainContent}>
                <div className={styles.container}>
                    <header className={styles.header}>
                        <div>
                            <h1 className={styles.title}>Olá, Administrador</h1>
                            <p className={styles.subtitle}>Bem-vindo ao sistema de gestão do Cemitério São Miguel.</p>
                        </div>
                        <div className={styles.userBadge}>
                            <div className={styles.userAvatar} aria-hidden="true">AD</div>
                            <div className={styles.userInfo}>
                                <strong>Administrador</strong>
                            </div>
                            <ChevronDown size={16} className={styles.userChevron} aria-hidden="true" />
                        </div>
                    </header>

                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
                                <Users size={28} />
                            </div>
                            <div className={styles.statInfo}>
                                <h3>{falecidos.length}</h3>
                                <p>Falecidos Cadastrados</p>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
                                <Map size={28} />
                            </div>
                            <div className={styles.statInfo}>
                                <h3>{quadras.length}</h3>
                                <p>Quadras Cadastradas</p>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statIcon} ${styles.statIconPurple}`}>
                                <MapPin size={28} />
                            </div>
                            <div className={styles.statInfo}>
                                <h3>{lotes.length}</h3>
                                <p>Lotes Cadastrados</p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.dashboardGrid}>
                        <section className={styles.quickActions}>
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>Ações Rápidas</h2>
                            </div>
                            <div className={styles.actionsGrid}>
                                <Link to="/admin/falecidos" className={`${styles.actionButton} ${styles.actionBlue}`}>
                                    <div className={styles.actionIcon}><PlusCircle size={21} /></div>
                                    <div className={styles.actionText}>
                                        <strong>Novo Falecido</strong>
                                        <span>Cadastrar um novo falecido</span>
                                    </div>
                                    <ChevronRight size={18} className={styles.actionChevron} aria-hidden="true" />
                                </Link>

                                <Link to="/admin/falecidos" className={`${styles.actionButton} ${styles.actionGreen}`}>
                                    <div className={styles.actionIcon}><Search size={21} /></div>
                                    <div className={styles.actionText}>
                                        <strong>Buscar Registro</strong>
                                        <span>Localizar setor e lote</span>
                                    </div>
                                    <ChevronRight size={18} className={styles.actionChevron} aria-hidden="true" />
                                </Link>

                                <Link to="/mapa" target="_blank" rel="noreferrer" className={`${styles.actionButton} ${styles.actionPurple}`}>
                                    <div className={styles.actionIcon}><Map size={21} /></div>
                                    <div className={styles.actionText}>
                                        <strong>Ver Mapa</strong>
                                        <span>Abrir mapa do cemitério</span>
                                    </div>
                                    <ChevronRight size={18} className={styles.actionChevron} aria-hidden="true" />
                                </Link>
                            </div>
                        </section>

                        <section className={styles.recentActivity}>
                            <div className={styles.recentHeader}>
                                <h2 className={styles.sectionTitle}>
                                    <ClipboardList size={19} aria-hidden="true" />
                                    Últimos Cadastros
                                </h2>
                                <Link to="/admin/falecidos" className={styles.viewAllLink}>
                                    Ver todos <ArrowRight size={16} />
                                </Link>
                            </div>

                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Nome do Falecido</th>
                                            <th>Localização</th>
                                            <th>Data</th>
                                            <th aria-label="Ações" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? (
                                            <tr><td colSpan={4} className={styles.emptyState}>Carregando registros...</td></tr>
                                        ) : ultimosCadastros.length === 0 ? (
                                            <tr><td colSpan={4} className={styles.emptyState}>Nenhum cadastro encontrado.</td></tr>
                                        ) : ultimosCadastros.map((falecido) => {
                                            const imageUrl = resolveImageUrl(falecido.imagem);

                                            return (
                                                <tr
                                                    key={falecido.id}
                                                    className={styles.clickableRow}
                                                    onClick={() => navigate('/admin/falecidos', { state: { editFalecidoId: falecido.id } })}
                                                    title="Clique para editar"
                                                >
                                                    <td className={styles.nameCell}>
                                                        <div className={styles.nameContent}>
                                                            <div className={styles.avatar}>
                                                                <span aria-hidden="true">{falecido.nome?.trim()?.charAt(0)?.toUpperCase() || '?'}</span>
                                                                {imageUrl && <img src={imageUrl} alt="" onError={(event) => event.currentTarget.remove()} />}
                                                            </div>
                                                            <div className={styles.nameInfo}>
                                                                <span className={styles.name}>{falecido.nome || '—'}</span>
                                                                <span className={styles.dates}>
                                                                    {falecido.dataNascimento || '—'} — {falecido.dataMorte || '—'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className={styles.locationCell}>
                                                        <span className={styles.locationContent}>
                                                            <MapPin size={16} className={styles.pinIcon} />
                                                            {falecido.localizacao || '—'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={styles.dateContent}>
                                                            <Clock3 size={16} className={styles.clockIcon} />
                                                            <span>{falecido.dataMorte || '—'}</span>
                                                        </span>
                                                    </td>
                                                    <td className={styles.rowActionCell}>
                                                        <ChevronRight size={18} aria-hidden="true" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
