import { useEffect, useMemo, useState } from 'react';
import {
    Users, Plus, Search, Map as MapIcon, MapPin, ChevronRight, ChevronDown, ArrowRight, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { fetchFalecidos, fetchLotes, fetchQuadras, resolveImageUrl } from '../../lib/api';
import { unwrapPage, isDataDesconhecida } from '../../data/adminPagination';
import styles from './AdminDashboard.module.css';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR') : '—');

function parseLocalizacao(texto = '') {
    const quadra = texto.match(/Quadra\s+(.+?)(?:,|$)/i)?.[1]?.trim() || '';
    const lote = texto.match(/Lote\s+(.+?)$/i)?.[1]?.trim() || '';
    return { quadra, lote };
}

function formatPeriodo(nascimento, morte) {
    const n = isDataDesconhecida(nascimento);
    const m = isDataDesconhecida(morte);
    if (n && m) return 'Datas não informadas';
    return `${n ? '—' : nascimento} — ${m ? '—' : morte}`;
}

export default function AdminDashboard({ onLogout }) {
    const navigate = useNavigate();
    const [ultimos, setUltimos] = useState([]);
    const [totalFalecidos, setTotalFalecidos] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEstruturaLoading, setIsEstruturaLoading] = useState(true);
    const [estruturaError, setEstruturaError] = useState('');
    const [totaisEstrutura, setTotaisEstrutura] = useState(null);
    const [busca, setBusca] = useState('');

    const hoje = useMemo(() => {
        const texto = new Intl.DateTimeFormat('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long',
        }).format(new Date());
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }, []);

    useEffect(() => {
        let cancelado = false;
        async function loadMemoriais() {
            try {
                const res = await fetchFalecidos({ page: 1, limit: 5 });
                const page = unwrapPage(res, { page: 1, limit: 5 });
                if (cancelado) return;
                setUltimos(page.items);
                setTotalFalecidos(page.total);
            } catch (error) {
                console.error('Erro ao buscar memoriais no dashboard:', error);
                if (!cancelado) { setUltimos([]); setTotalFalecidos(null); }
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        }
        loadMemoriais();
        return () => { cancelado = true; };
    }, []);

    useEffect(() => {
        let cancelado = false;
        async function loadEstrutura() {
            try {
                const quadrasData = await fetchQuadras();
                const quadras = Array.isArray(quadrasData) ? quadrasData : quadrasData?.items;
                if (!Array.isArray(quadras)) throw new Error('Formato inválido para as quadras.');

                const totaisLotes = await Promise.all(
                    quadras.map(async (quadra) => {
                        const data = await fetchLotes(quadra.id, { page: 1, limit: 1 });
                        if (!Array.isArray(data) && !Array.isArray(data?.items)) {
                            throw new Error(`Formato inválido: quadra ${quadra.nome}.`);
                        }
                        return Array.isArray(data) ? data.length : (data.total ?? data.items.length);
                    })
                );

                if (!cancelado) {
                    setTotaisEstrutura({
                        quadras: quadras.length,
                        lotes: totaisLotes.reduce((a, b) => a + b, 0),
                    });
                }
            } catch (error) {
                console.error('Erro ao buscar estrutura:', error);
                if (!cancelado) {
                    setTotaisEstrutura(null);
                    setEstruturaError('Não foi possível carregar os totais de quadras e lotes.');
                }
            } finally {
                if (!cancelado) setIsEstruturaLoading(false);
            }
        }
        loadEstrutura();
        return () => { cancelado = true; };
    }, []);

    const buscar = (event) => {
        event.preventDefault();
        navigate('/admin/falecidos', { state: { search: busca.trim() } });
    };

    return (
        <div className={styles.adminLayout}>
            <AdminSidebar onLogout={onLogout} />

            <main className={styles.mainContent}>
                <div className={styles.container}>
                    <header className={styles.header}>
                        <div>
                            <p className={styles.date}>{hoje}</p>
                            <h1 className={styles.title}>Olá, Administrador</h1>
                        </div>
                        <div className={styles.userBadge}>
                            <div className={styles.userAvatar} aria-hidden="true">AD</div>
                            
                            <ChevronDown size={16} className={styles.userChevron} aria-hidden="true" />
                        </div>
                    </header>

                    <section className={styles.toolbar} aria-label="Buscar e cadastrar">
                        <form className={styles.search} onSubmit={buscar} role="search">
                            <Search size={20} className={styles.searchIcon} aria-hidden="true" />
                            <input
                                type="search"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar falecido pelo nome..."
                                aria-label="Buscar falecido pelo nome"
                            />
                            {busca && (
                                <button type="button" className={styles.clearSearch} aria-label="Limpar busca" onClick={() => setBusca('')}>
                                    <X size={16} />
                                </button>
                            )}
                            <button type="submit" className={styles.searchSubmit}>Buscar</button>
                        </form>
                        <Link to="/admin/falecidos" state={{ novo: true }} className={styles.primaryAction}>
                            <Plus size={18} aria-hidden="true" />
                            Novo falecido
                        </Link>
                        <Link to="/mapa" target="_blank" rel="noreferrer" className={styles.secondaryAction}>
                            <MapIcon size={18} aria-hidden="true" />
                            Ver mapa
                        </Link>
                    </section>

                    <section className={styles.stats} aria-label="Totais do cemitério">
                        <Link to="/admin/falecidos" className={styles.stat}>
                            <div className={styles.statIconWrapper}>
                                <Users size={22} className={styles.statIcon} aria-hidden="true" />
                            </div>
                            <div className={styles.statInfo}>
                                <strong>{isLoading ? '…' : fmt(totalFalecidos)}</strong>
                                <span>falecidos cadastrados</span>
                            </div>
                        </Link>
                        <div className={styles.statDivider} />
                        <Link to="/admin/quadraslotes" className={styles.stat}>
                            <div className={styles.statIconWrapper}>
                                <MapIcon size={22} className={styles.statIcon} aria-hidden="true" />
                            </div>
                            <div className={styles.statInfo}>
                                <strong>{isEstruturaLoading ? '…' : fmt(totaisEstrutura?.quadras)}</strong>
                                <span>quadras mapeadas</span>
                            </div>
                        </Link>
                        <div className={styles.statDivider} />
                        <Link to="/admin/quadraslotes" className={styles.stat}>
                            <div className={styles.statIconWrapper}>
                                <MapPin size={22} className={styles.statIcon} aria-hidden="true" />
                            </div>
                            <div className={styles.statInfo}>
                                <strong>{isEstruturaLoading ? '…' : fmt(totaisEstrutura?.lotes)}</strong>
                                <span>lotes disponíveis</span>
                            </div>
                        </Link>
                    </section>
                    {estruturaError && <p className={styles.statsError} role="alert">{estruturaError}</p>}

                    <section className={styles.recent}>
                        <div className={styles.recentHeader}>
                            <h2>Últimos cadastros</h2>
                            <Link to="/admin/falecidos" className={styles.viewAll}>
                                Ver todos <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Falecido</th>
                                        <th>Quadra</th>
                                        <th>Lote</th>
                                        <th>Falecimento</th>
                                        <th aria-label="Ações" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan={5} className={styles.emptyState}>Carregando registros...</td></tr>
                                    ) : ultimos.length === 0 ? (
                                        <tr><td colSpan={5} className={styles.emptyState}>Nenhum cadastro encontrado.</td></tr>
                                    ) : ultimos.map((falecido) => {
                                        const imageUrl = resolveImageUrl(falecido.imagem);
                                        const { quadra, lote } = parseLocalizacao(falecido.localizacao);
                                        const semNome = /n[ãa]o identificado/i.test(falecido.nome || '');

                                        return (
                                            <tr
                                                key={falecido.id}
                                                className={styles.row}
                                                onClick={() => navigate('/admin/falecidos', {
                                                    state: { editFalecidoId: falecido.id, editFalecido: falecido },
                                                })}
                                                title="Clique para editar"
                                            >
                                                <td>
                                                    <div className={styles.person}>
                                                        <div className={styles.avatar}>
                                                            <span aria-hidden="true">{falecido.nome?.trim()?.charAt(0)?.toUpperCase() || '?'}</span>
                                                            {imageUrl && <img src={imageUrl} alt="" onError={(e) => e.currentTarget.remove()} />}
                                                        </div>
                                                        <div className={styles.personText}>
                                                            <span className={semNome ? styles.nameUnknown : styles.name}>{falecido.nome || '—'}</span>
                                                            <span className={styles.period}>{formatPeriodo(falecido.dataNascimento, falecido.dataMorte)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{quadra ? <span className={styles.quadraChip}>{quadra}</span> : <span className={styles.muted}>—</span>}</td>
                                                <td className={styles.loteCell}>{lote || <span className={styles.muted}>—</span>}</td>
                                                <td className={isDataDesconhecida(falecido.dataMorte) ? styles.muted : styles.dateCell}>
                                                    {isDataDesconhecida(falecido.dataMorte) ? 'Não informada' : falecido.dataMorte}
                                                </td>
                                                <td className={styles.chevronCell}>
                                                    <div className={styles.actionIcon}>
                                                        <ChevronRight size={18} aria-hidden="true" />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
