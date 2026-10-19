import { useEffect, useState } from 'react';
import { Users, PlusCircle, Search, Map, Clock, ArrowRight, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { fetchFalecidos, resolveImageUrl } from '../../lib/api';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
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
    const quadras = [...new Set(
        falecidos
            .map((falecido) => falecido.localizacao?.match(/Quadra\s+([^,]+)/i)?.[1]?.trim().toUpperCase())
            .filter(Boolean)
    )];
    const lotes = [...new Set(
        falecidos
            .map((falecido) => falecido.localizacao?.match(/Lote\s+([^,]+)/i)?.[1]?.trim())
            .filter(Boolean)
            .map((lote, index) => {
                const quadra = falecidos[index]?.localizacao?.match(/Quadra\s+([^,]+)/i)?.[1]?.trim().toUpperCase();
                return quadra ? `${quadra}-${lote}` : lote;
            })
    )];

    return (
        <div className={styles.adminLayout}>
            <AdminSidebar />

            <main className={styles.mainContent}>
                <div className={styles.container}>
                    <header className={styles.header}>
                        <h1 className={styles.title}>Olá, Administrador </h1>
                        <p className={styles.subtitle}>Bem-vindo ao sistema de gestão do Cemitério São Miguel.</p>
                    </header>

                    {isLoading && (
                        <div className={styles.emptyState}>Carregando registros...</div>
                    )}

                    {/* --- CARDS DE RESUMO --- */}
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: '#e6f0ff', color: '#0066cc' }}>
                                <Users size={28} />
                            </div>
                            <div className={styles.statInfo}>
                                <h3>{falecidos.length}</h3>
                                <p>Falecidos Cadastrados</p>
                            </div>
                            
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: '#e6f0ff', color: '#0066cc' }}>
                                <Map size={28} />
                            </div>
                            <div className={styles.statInfo}>
                                <h3>{quadras.length}</h3>
                                <p>Quadras Cadastradas</p>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: '#e6f0ff', color: '#0066cc' }}>
                                <MapPin size={28} />
                            </div>
                            <div className={styles.statInfo}>
                                <h3>{lotes.length}</h3>
                                <p>Lotes Cadastrados</p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.dashboardGrid}>
                        {/* --- ATALHOS RÁPIDOS --- */}
                        <section className={styles.quickActions}>
                            <h1 className={styles.title}>Ações Rápidas</h1>
                            <div className={styles.actionsGrid}>
                                <Link to="/admin/falecidos" className={styles.actionButton}>
                                    <PlusCircle size={32} className={styles.actionIcon} />
                                    <span>Novo Falecido</span>
                                    <p>Cadastrar um novo falecido</p>
                                </Link>

                                <Link to="/admin/falecidos" className={styles.actionButton}>
                                    <Search size={32} className={styles.actionIcon} />
                                    <span>Buscar Registro</span>
                                    <p>Localizar setor e lote</p>
                                </Link>

                                <Link to="/mapa" target="_blank" className={styles.actionButton}>
                                    <Map size={32} className={styles.actionIcon} />
                                    <span>Ver Mapa</span>
                                    <p>Abrir mapa do cemitério</p>
                                </Link>
                            </div>
                        </section>

                        {/* --- ÚLTIMOS CADASTROS --- */}
                        <section className={styles.recentActivity}>
                            <div className={styles.recentHeader}>
                                <h2 className={styles.title}>Últimos Cadastros</h2>
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
                                            <th className={styles.registroHeader}>Data</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ultimosCadastros.map(falecido => (
                                            <tr
                                                key={falecido.id}
                                                className={styles.clickableRow}
                                                onClick={() => navigate('/admin/falecidos', { state: { editFalecidoId: falecido.id } })}
                                                title="Clique para editar"
                                            >
                                                <td className={styles.nameCell}>
                                                    <div className={styles.nameContent}>
                                                    <div className={styles.avatar}>
                                                        <img src={resolveImageUrl(falecido.imagem)} alt={falecido.nome} />
                                                    </div>
                                                    <div className={styles.nameInfo}>
                                                        <span className={styles.name}>{falecido.nome}</span>
                                                        <span className={styles.dates}>{falecido.dataNascimento || '—'} — {falecido.dataMorte || '—'}</span>
                                                    </div>
                                                    </div>
                                                </td>
                                                <td className={styles.locationCell}>
                                                    <span className={styles.locationContent}>
                                                        <MapPin size={16} className={styles.pinIcon} />
                                                        {falecido.localizacao}
                                                    </span>
                                                </td>
                                                <td className={styles.timeCell}>
                                                    <span className={styles.timeContent}>
                                                        <Clock size={16} className={styles.clockIcon} />
                                                        {falecido.dataMorte || '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
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
