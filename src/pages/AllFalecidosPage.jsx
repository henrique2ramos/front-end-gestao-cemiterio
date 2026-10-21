import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchFalecidos } from '../lib/api';
import { getPageItems } from '../data/adminPagination';
import FalecidoCard from '../components/FalecidoCard';
import styles from './AllFalecidosPage.module.css';

const PER_PAGE = 12;

export default function FalecidosPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const [localSearch, setLocalSearch] = useState(searchQuery);
    const [falecidos, setFalecidos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const activeFilter =
        searchParams.get('type') === 'historical'
            ? 'historicos'
            : searchParams.get('type') === 'recent'
                ? 'recentes'
                : 'todos';

    const page = Number(searchParams.get('page')) || 1;

    const updateParams = useCallback(({ 
        search = searchQuery,
        filter = activeFilter,
        page = 1
    }, options = {}) => {
        const params = new URLSearchParams(searchParams);

        if (search.trim()) {
            params.set('search', search);
        } else {
            params.delete('search');
        }

        if (filter === 'historicos') {
            params.set('type', 'historical');
        } else if (filter === 'recentes') {
            params.set('type', 'recent');
        } else {
            params.delete('type');
        }

        if (page > 1) {
            params.set('page', page);
        } else {
            params.delete('page');
        }
        setSearchParams(params, options);
    }, [activeFilter, searchParams, searchQuery, setSearchParams]);
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== searchQuery) {
                updateParams({ search: localSearch, page: 1 }, { replace: true });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [localSearch, searchQuery, updateParams]);

    useEffect(() => {
        let isMounted = true;

        async function loadMemoriais() {
            try {
                const data = await fetchFalecidos();
                if (isMounted) {
                    setFalecidos(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error('Erro ao carregar falecidos:', error);
                if (isMounted) {
                    setFalecidos([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        loadMemoriais();

        return () => {
            isMounted = false;
        };
    }, []);

    const todosMemoriais = falecidos;
    const personalidadesImportantes = useMemo(
        () => todosMemoriais.filter(m => m.tipo === 'historica'),
        [todosMemoriais]
    );
    const memoriaisRecentes = useMemo(
        () => todosMemoriais.filter(m => m.tipo === 'recente'),
        [todosMemoriais]
    );

    const filtered = useMemo(() => {
        let list = todosMemoriais;

        if (activeFilter === 'historicos') {
            list = personalidadesImportantes;
        } else if (activeFilter === 'recentes') {
            list = memoriaisRecentes;
        }

        const query = searchQuery.trim().toLowerCase();

        if (!query) return list;

        return list.filter(falecido =>
            typeof falecido.nome === 'string' && falecido.nome.toLowerCase().includes(query)
        );
    }, [searchQuery, activeFilter, personalidadesImportantes, memoriaisRecentes, todosMemoriais]);

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / PER_PAGE)
    );

    const currentPage = Math.min(page, totalPages);

    const memoriaisPagina = filtered.slice(
        (currentPage - 1) * PER_PAGE,
        currentPage * PER_PAGE
    );

    function handleFilter(filter) {
        updateParams({
            filter,
            page: 1
        });
    }

    function clearFilters() {
        setLocalSearch(''); 
        setSearchParams({});
    }

    if (isLoading) {
        return (
            <div className={styles.page}>
                <section className={styles.heroBanner}>
                    <div className={styles.container}>
                        <h1>Falecidos</h1>
                        <p>Carregando falecidos do servidor...</p>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <section className={styles.heroBanner}>
                <div className={styles.container}>
                    <h1>Falecidos</h1>

                    <p>
                        Explore a história e as homenagens de pessoas que
                        construíram o legado de nossa cidade.
                    </p>

                    <div className={styles.searchWrapper}>
                        <Search
                            size={22}
                            className={styles.searchIcon}
                        />

                        <input
                            type="text"
                            placeholder="Buscar pelo nome..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                        />

                        {localSearch && (
                            <button
                                className={styles.clearSearch}
                                onClick={() => {
                                    setLocalSearch('');
                                    updateParams({ search: '', page: 1 }, { replace: true });
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </section>

            <section className={styles.filterSection}>
                <div className={styles.container}>
                    <div className={styles.filters}>
                        <button
                            className={`${styles.filterBtn} ${activeFilter === 'todos'
                                ? styles.active
                                : ''
                                }`}
                            onClick={() => handleFilter('todos')}
                        >
                            Todos ({todosMemoriais.length})
                        </button>

                        <button
                            className={`${styles.filterBtn} ${activeFilter === 'historicos'
                                ? styles.active
                                : ''
                                }`}
                            onClick={() => handleFilter('historicos')}
                        >
                            Históricos ({personalidadesImportantes.length})
                        </button>

                        <button
                            className={`${styles.filterBtn} ${activeFilter === 'recentes'
                                ? styles.active
                                : ''
                                }`}
                            onClick={() => handleFilter('recentes')}
                        >
                            Recentes ({memoriaisRecentes.length})
                        </button>
                    </div>
                </div>
            </section>

            <section className={styles.results}>
                <div className={styles.container}>
                    <p className={styles.resultsCount}>
                        {filtered.length === 0
                            ? 'Nenhum falecido encontrado.'
                            : `${filtered.length} falecido${filtered.length > 1 ? 's' : ''} encontrado${filtered.length > 1 ? 's' : ''}.`}
                    </p>

                    {memoriaisPagina.length > 0 ? (
                        <>
                            <div className={styles.grid}>
                                {memoriaisPagina.map((falecido) => (
                                    <FalecidoCard
                                        key={falecido.id}
                                        falecido={falecido}
                                    />
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className={styles.pagination}>
                                    <button
                                        className={`${styles.pageBtn} ${styles.pageNavBtn}`}
                                        disabled={currentPage === 1}
                                        onClick={() => updateParams({ page: currentPage - 1 })}
                                        aria-label="Página anterior"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>

                                    {getPageItems(currentPage, totalPages).map((item, index) => item === '…' ? (
                                        <span key={`ellipsis-${index}`} className={styles.pageEllipsis} aria-hidden="true">…</span>
                                    ) : (
                                        <button
                                            key={item}
                                            className={`${styles.pageBtn} ${styles.pageNumberBtn} ${item === currentPage ? styles.pageBtnActive : ''}`}
                                            onClick={() => updateParams({ page: item })}
                                            aria-label={`Página ${item}`}
                                            aria-current={item === currentPage ? 'page' : undefined}
                                        >
                                            {item}
                                        </button>
                                    ))}

                                    <button
                                        className={`${styles.pageBtn} ${styles.pageNavBtn}`}
                                        disabled={currentPage === totalPages}
                                        onClick={() => updateParams({ page: currentPage + 1 })}
                                        aria-label="Próxima página"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                    <span className={styles.mobilePageCount} aria-live="polite">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.empty}>
                            <Search size={48} />

                            <h3>Nenhum falecido encontrado</h3>

                            <p>
                                Tente pesquisar utilizando outros termos ou sobrenomes.
                            </p>

                            <button
                                className={styles.clearBtn}
                                onClick={clearFilters}
                            >
                                Limpar filtros
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
