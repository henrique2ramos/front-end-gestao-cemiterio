import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchFalecidos } from '../lib/api';
import FalecidoCard from '../components/FalecidoCard';
import styles from './AllFalecidosPage.module.css';

const DEFAULT_PER_PAGE = 8;
const PER_PAGE_OPTIONS = [8, 16, 32, 50];

export default function FalecidosPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const perPageParam = Number(searchParams.get('perPage'));
    const perPage = PER_PAGE_OPTIONS.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;
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

    function updateParams({
        search = searchQuery,
        filter = activeFilter,
        page = 1,
        perPage: nextPerPage = perPage
    }, options = {}) {
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
        if (nextPerPage === DEFAULT_PER_PAGE) {
            params.delete('perPage');
        } else {
            params.set('perPage', nextPerPage);
        }
        setSearchParams(params, options);
    }

    // --- EFEITO DE DEBOUNCE ---
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== searchQuery) {
                updateParams({ search: localSearch, page: 1 }, { replace: true });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [localSearch]);

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

    const todosMemoriais = Array.isArray(falecidos) ? falecidos : [];
    const personalidadesImportantes = todosMemoriais.filter(m => m.tipo === 'historica');
    const memoriaisRecentes = todosMemoriais.filter(m => m.tipo === 'recente');

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
        Math.ceil(filtered.length / perPage)
    );

    const currentPage = Math.max(1, Math.min(page, totalPages));
    const paginationPages = totalPages <= 7
        ? Array.from({ length: totalPages }, (_, index) => index + 1)
        : currentPage <= 4
            ? [1, 2, 3, 4, 5, 'ellipsis-end', totalPages]
            : currentPage >= totalPages - 3
                ? [1, 'ellipsis-start', ...Array.from({ length: 5 }, (_, index) => totalPages - 4 + index)]
                : [1, 'ellipsis-start', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-end', totalPages];

    const memoriaisPagina = filtered.slice(
        (currentPage - 1) * perPage,
        currentPage * perPage
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
                    <div className={styles.resultsToolbar}>
                        <p className={styles.resultsCount}>
                            {filtered.length === 0
                                ? 'Nenhum falecido encontrado.'
                                : `${filtered.length} falecido${filtered.length > 1 ? 's' : ''} encontrado${filtered.length > 1 ? 's' : ''}.`}
                        </p>
                        <label className={styles.pageSizeControl}>
                            <span>Exibir por página</span>
                            <select
                                value={perPage}
                                onChange={(event) => updateParams({
                                    perPage: Number(event.target.value),
                                    page: 1
                                })}
                            >
                                {PER_PAGE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                    </div>

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
                                        type="button"
                                        className={styles.pageBtn}
                                        aria-label="Página anterior"
                                        disabled={currentPage === 1}
                                        onClick={() => updateParams({ page: currentPage - 1 })}
                                    >
                                        <ChevronLeft size={18} />
                                    </button>

                                    {paginationPages.map((number) => (
                                        typeof number === 'number' ? (
                                            <button
                                                key={number}
                                                type="button"
                                                aria-label={`Página ${number}`}
                                                aria-current={number === currentPage ? 'page' : undefined}
                                                className={`${styles.pageBtn} ${number === currentPage ? styles.pageBtnActive : ''}`}
                                                onClick={() => updateParams({ page: number })}
                                            >
                                                {number}
                                            </button>
                                        ) : (
                                            <span key={number} className={styles.pageEllipsis} aria-hidden="true">…</span>
                                        )
                                    ))}

                                    <button
                                        type="button"
                                        className={styles.pageBtn}
                                        aria-label="Próxima página"
                                        disabled={currentPage === totalPages}
                                        onClick={() => updateParams({ page: currentPage + 1 })}
                                    >
                                        <ChevronRight size={18} />
                                    </button>
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
