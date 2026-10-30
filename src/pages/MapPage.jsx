import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Search, ArrowLeft } from 'lucide-react';
import { fetchFalecidos, fetchLotes, fetchQuadras, resolveImageUrl } from '../lib/api';
import styles from './MapPage.module.css';
import mapaImg from '../assets/mapaExemplo.png';
import personPlaceholder from '../assets/person-placeholder.svg';

const MAX_ZOOM = 3;
const LOTS_PER_PAGE = 48;
const lotNumberCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

const SECTORS = [
    { id: 'A', name: 'Quadra A', x: 70, y: 92 },
    { id: 'B', name: 'Quadra B', x: 62, y: 75 },
    { id: 'C', name: 'Quadra C', x: 55, y: 60 },
    { id: 'D', name: 'Quadra D', x: 49, y: 48 },
    { id: 'E', name: 'Quadra E', x: 42, y: 30 },
    { id: 'F', name: 'Quadra F', x: 35, y: 10 },
];

const CONTAINER_RATIO = 1.6;

function pinPosition(sector, ratio) {
    if (sector.ix != null && sector.iy != null) return { x: sector.ix, y: sector.iy };
    if (ratio < CONTAINER_RATIO) {
        return { x: sector.x, y: 50 + (sector.y - 50) * (ratio / CONTAINER_RATIO) };
    }
    return { x: 50 + (sector.x - 50) * (CONTAINER_RATIO / ratio), y: sector.y };
}

function parseLocal(texto) {
    if (typeof texto !== 'string') return null;
    const quadra = texto.match(/quadra\s*([a-z0-9-]+)/i);
    if (!quadra) return null;
    const lote = texto.match(/lote\s*[:#]?\s*([^,\s]+)/i);
    return { quadra: quadra[1].toUpperCase(), lote: lote?.[1] ?? null };
}

function normalizeQuadraId(nome) {
    return typeof nome === 'string'
        ? nome.trim().replace(/^quadra\s*/i, '').toUpperCase()
        : '';
}

function nomeQuadra(quadra) {
    const nome = String(quadra?.nome ?? '');
    return /^quadra\s/i.test(nome) ? nome : `Quadra ${nome}`;
}

function normalizarNumeroLote(value) {
    const numero = String(value ?? '').trim();
    return /^\d+$/.test(numero) ? String(Number(numero)) : numero.toLocaleLowerCase('pt-BR');
}

export default function MapPage() {
    const location = useLocation();
    const requestedFalecidoId = new URLSearchParams(location.search).get('falecido');
    const falecidoFromNavigation = location.state?.falecido;
    const handledTargetRef = useRef(null);
    const [selected, setSelected] = useState(null);
    const [selectedLoteId, setSelectedLoteId] = useState(null);
    const [quadras, setQuadras] = useState([]);
    const [falecidos, setFalecidos] = useState([]);
    const [falecidosLoading, setFalecidosLoading] = useState(true);
    const [lotesPorQuadra, setLotesPorQuadra] = useState({});
    const [lotesLoading, setLotesLoading] = useState(true);
    const [lotesError, setLotesError] = useState(false);
    const [buscaLote, setBuscaLote] = useState('');
    const [paginaLotes, setPaginaLotes] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [ratio, setRatio] = useState(CONTAINER_RATIO);
    const [ponto, setPonto] = useState(null);
    const calibrar =
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('calibrar');
    const mapRef = useRef(null);
    const panelRef = useRef(null);
    const dragRef = useRef(null);

    useEffect(() => {
        if (!requestedFalecidoId && !falecidoFromNavigation) return undefined;
        const timeout = window.setTimeout(() => {
            const map = mapRef.current;
            if (!map) return;
            const rect = map.getBoundingClientRect();
            const top = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }, 350);
        return () => window.clearTimeout(timeout);
    }, [requestedFalecidoId, falecidoFromNavigation]);

    useEffect(() => {
        let isMounted = true;
        fetchFalecidos()
            .then((data) => {
                if (isMounted) setFalecidos(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (isMounted) setFalecidos([]);
            })
            .finally(() => {
                if (isMounted) setFalecidosLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if ((!requestedFalecidoId && !falecidoFromNavigation) || (!falecidoFromNavigation && falecidosLoading) || lotesLoading || !quadras.length) return;
        const targetKey = requestedFalecidoId || String(falecidoFromNavigation.id);
        if (handledTargetRef.current === targetKey) return;

        const falecido = falecidoFromNavigation
            || falecidos.find((item) => String(item.id) === String(requestedFalecidoId));
        if (!falecido) return;

        const local = parseLocal(falecido.localizacao);
        const quadraRef = falecido.quadraId ?? falecido.quadra?.id;
        const quadraNome = typeof falecido.quadra === 'string'
            ? falecido.quadra
            : falecido.quadra?.nome ?? falecido.setor ?? local?.quadra;
        const quadra = quadras.find((item) =>
            (quadraRef != null && String(item.id) === String(quadraRef))
            || (quadraNome && normalizeQuadraId(item.nome) === normalizeQuadraId(quadraNome))
        );
        if (!quadra) {
            handledTargetRef.current = targetKey;
            return;
        }

        const lotes = lotesPorQuadra[quadra.id] || [];
        const loteRef = falecido.loteId ?? falecido.lote?.id;
        const loteNumero = typeof falecido.lote === 'object'
            ? falecido.lote?.numero
            : falecido.lote ?? local?.lote;
        const lote = lotes.find((item) =>
            (loteRef != null && String(item.id) === String(loteRef))
            || (loteNumero != null && normalizarNumeroLote(item.numero) === normalizarNumeroLote(loteNumero))
        );

        handledTargetRef.current = targetKey;
        selectSector(quadra, false);
        setSelectedLoteId(lote?.id ?? null);
        setBuscaLote('');
        setPaginaLotes(1);
    }, [requestedFalecidoId, falecidoFromNavigation, falecidosLoading, lotesLoading, falecidos, quadras, lotesPorQuadra]);

    useEffect(() => {
        let isMounted = true;

        async function loadLotes() {
            try {
                const respostaQuadras = await fetchQuadras();
                const quadras = Array.isArray(respostaQuadras)
                    ? respostaQuadras
                    : respostaQuadras?.items ?? respostaQuadras?.quadras ?? [];
                if (!Array.isArray(quadras)) {
                    throw new Error('Formato inválido ao carregar quadras.');
                }

                if (isMounted) setQuadras(quadras);
                const lotes = await Promise.all(
                    quadras.map(async (quadra) => {
                        const sector = { name: quadra.nome };

                        const response = await fetchLotes(quadra.id, { page: 1, limit: 1000 });
                        const data = Array.isArray(response)
                            ? response
                            : response?.items ?? response?.lotes ?? response?.data;
                        if (!Array.isArray(data)) {
                            throw new Error(`Formato inválido ao carregar lotes da ${sector.name}.`);
                        }
                        const pageSize = Number(response?.limit ?? response?.perPage ?? 1000);
                        const totalPages = response?.totalPages
                            ?? Math.max(1, Math.ceil((response?.total ?? data.length) / pageSize));
                        if (totalPages <= 1) return [quadra.id, data];

                        const otherPages = await Promise.all(
                            Array.from({ length: totalPages - 1 }, (_, index) =>
                                fetchLotes(quadra.id, { page: index + 2, limit: 1000 })
                            )
                        );
                        const otherItems = otherPages.flatMap((page) => Array.isArray(page)
                            ? page
                            : page?.items ?? page?.lotes ?? page?.data ?? []);
                        return [quadra.id, [...data, ...otherItems]];
                    })
                );

                if (isMounted) setLotesPorQuadra(Object.fromEntries(lotes));
            } catch (error) {
                console.error('Erro ao carregar lotes do mapa:', error);
                if (isMounted) setLotesError(true);
            } finally {
                if (isMounted) setLotesLoading(false);
            }
        }

        loadLotes();
        return () => { isMounted = false; };
    }, []);

    const porQuadra = useMemo(() => {
        const grupos = {};
        quadras.forEach((quadra) => {
            grupos[quadra.id] = [];
        });
        falecidos.forEach((falecido) => {
            const local = parseLocal(falecido.localizacao);
            const quadra = local && quadras.find(
                (item) => normalizeQuadraId(item.nome) === local.quadra
            );
            if (quadra) grupos[quadra.id].push({ falecido, lote: local.lote });
        });
        return grupos;
    }, [falecidos, quadras]);

    const pins = useMemo(
        () => quadras.flatMap((quadra) => {
            const position = SECTORS.find(
                (item) => item.id === normalizeQuadraId(quadra.nome)
            );
            return position ? [{
                ...position,
                ...quadra,
                id: quadra.id,
                code: normalizeQuadraId(quadra.nome),
                name: nomeQuadra(quadra),
                ...pinPosition(position, ratio),
            }] : [];
        }),
        [quadras, ratio]
    );

    function ocupados(sectorId) {
        const lotes = new Set((porQuadra[sectorId] || []).filter((i) => i.lote).map((i) => i.lote));
        return lotes.size;
    }

    function totalLotes(sectorId) {
        if (lotesLoading) return '…';
        if (lotesError) return '—';
        return lotesPorQuadra[sectorId]?.length || 0;
    }

    const sector = quadras.find((item) => item.id === selected) || null;
    const itensSetor = sector
        ? porQuadra[sector.id] || []
        : [];
    const lotesSetor = sector
        ? [...(lotesPorQuadra[sector.id] || [])].sort(
            (a, b) => lotNumberCollator.compare(String(a.numero ?? ''), String(b.numero ?? ''))
        )
        : [];
    const lotesVazios = lotesSetor.filter((lote) => !itensSetor.some((item) =>
        item.falecido.loteId === lote.id
        || normalizarNumeroLote(item.lote) === normalizarNumeroLote(lote.numero)
    )).length;
    const lotesFiltrados = lotesSetor.filter((lote) =>
        String(lote.numero ?? '').toLocaleLowerCase('pt-BR').includes(buscaLote.trim().toLocaleLowerCase('pt-BR'))
    );
    const totalPaginasLotes = Math.max(1, Math.ceil(lotesFiltrados.length / LOTS_PER_PAGE));
    const paginaLotesAtual = Math.min(paginaLotes, totalPaginasLotes);
    const lotesVisiveis = lotesFiltrados.slice(
        (paginaLotesAtual - 1) * LOTS_PER_PAGE,
        paginaLotesAtual * LOTS_PER_PAGE
    );
    const loteSelecionado = lotesSetor.find((lote) => String(lote.id) === String(selectedLoteId)) || null;
    const pessoasDoLote = loteSelecionado
        ? itensSetor.filter((item) =>
            item.falecido.loteId === loteSelecionado.id
            || normalizarNumeroLote(item.lote) === normalizarNumeroLote(loteSelecionado.numero)
        )
        : [];

    function clampOffset(off, z) {
        const el = mapRef.current;
        if (!el) return off;
        const maxX = (el.clientWidth * (z - 1)) / 2;
        const maxY = (el.clientHeight * (z - 1)) / 2;
        return {
            x: Math.max(-maxX, Math.min(maxX, off.x)),
            y: Math.max(-maxY, Math.min(maxY, off.y)),
        };
    }

    function changeZoom(delta) {
        const z = Math.min(MAX_ZOOM, Math.max(1, Number((zoom + delta).toFixed(2))));
        setZoom(z);
        setOffset((atual) => clampOffset(atual, z));
    }

    function resetView() {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    }

    function selectSector(item, scrollToPanel = true) {
        if (selected === item.id) {
            setSelected(null);
            setSelectedLoteId(null);
            resetView();
            return;
        }
        setSelected(item.id);
        setSelectedLoteId(null);
        setBuscaLote('');
        setPaginaLotes(1);

        if (scrollToPanel) {
            window.requestAnimationFrame(() => {
                panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        const el = mapRef.current;
        const position = pins.find((pin) => String(pin.id) === String(item.id))
            || pins.find((pin) => pin.code === normalizeQuadraId(item.nome));
        if (!position) return;
        const z = Math.max(zoom, 2);
        setZoom(z);
        if (el) {
            setOffset(
                clampOffset(
                    {
                        x: -(position.x / 100 - 0.5) * el.clientWidth * z,
                        y: -(position.y / 100 - 0.5) * el.clientHeight * z,
                    },
                    z
                )
            );
        }
    }

    function onLayerClick(event) {
        if (!calibrar || event.target.closest('button')) return;
        const r = event.currentTarget.getBoundingClientRect();
        setPonto({
            x: Number((((event.clientX - r.left) / r.width) * 100).toFixed(1)),
            y: Number((((event.clientY - r.top) / r.height) * 100).toFixed(1)),
        });
    }

    function onPointerDown(event) {
        if (zoom <= 1 || event.target.closest('button')) return;
        dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event) {
        const d = dragRef.current;
        if (!d) return;
        setOffset(
            clampOffset({ x: d.ox + event.clientX - d.x, y: d.oy + event.clientY - d.y }, zoom)
        );
    }

    function endDrag(event) {
        if (!dragRef.current) return;
        dragRef.current = null;
        setDragging(false);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    return (
        <div className={styles.page}>
            <header className={styles.heroBanner}>
                <div className={styles.heroContent}>
                    <span className={styles.heroLabel}>Localização</span>
                    <h1>Mapa do Cemitério</h1>
                    <p>Explore as quadras e encontre o lote que você procura.</p>
                </div>
            </header>

            <main className={styles.main}>
                <div className={styles.layout}>
                    
                    <div className={styles.mapWrapper} style={{ '--ratio': ratio }}>
                        <div
                            ref={mapRef}
                            className={`${styles.map} ${zoom > 1 ? styles.zoomed : ''} ${dragging ? styles.grabbing : ''}`}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                        >
                            <div
                                className={`${styles.layer} ${dragging ? styles.noTransition : ''}`}
                                style={{
                                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                    '--inv': 1 / zoom,
                                }}
                                onClick={onLayerClick}
                            >
                                <img
                                    src={mapaImg}
                                    alt="Vista aérea do Cemitério"
                                    draggable="false"
                                    onLoad={(event) => {
                                        const { naturalWidth, naturalHeight } = event.currentTarget;
                                        if (naturalWidth && naturalHeight) setRatio(naturalWidth / naturalHeight);
                                    }}
                                />
                                <div className={styles.mapOverlay} />

                                {pins.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        aria-label={`${item.name}: ${ocupados(item.id)} de ${totalLotes(item.id)} lotes cadastrados`}
                                        aria-pressed={selected === item.id}
                                        className={`${styles.sectorPin} ${selected === item.id ? styles.sectorActive : ''}`}
                                        style={{ left: `${item.x}%`, top: `${item.y}%` }}
                                        onClick={() => selectSector(item)}
                                    >
                                        <span>{item.code}</span>
                                        <div className={styles.sectorTooltip}>
                                            <strong>{item.name}</strong>
                                            <span>
                                                {ocupados(item.id)} de {totalLotes(item.id)} lotes
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {calibrar && (
                                <div className={styles.calibrar}>
                                    {ponto
                                        ? `ix: ${ponto.x}, iy: ${ponto.y}`
                                        : 'Modo calibrar: clique no mapa (com zoom 1x) para ver as coordenadas'}
                                </div>
                            )}

                            <div className={styles.mapControls}>
                                <button type="button" title="Ampliar" onClick={() => changeZoom(0.5)} disabled={zoom >= MAX_ZOOM}>
                                    <ZoomIn size={20} />
                                </button>
                                <button type="button" title="Diminuir" onClick={() => changeZoom(-0.5)} disabled={zoom <= 1}>
                                    <ZoomOut size={20} />
                                </button>
                                <button type="button" title="Ver mapa inteiro" onClick={resetView} disabled={zoom === 1}>
                                    <RotateCcw size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    
                    <aside ref={panelRef} className={styles.panel}>
                        {sector ? (
                            <>
                                <nav className={styles.panelBreadcrumb} aria-label="Navegação do mapa">
                                    <button
                                        type="button"
                                        className={styles.breadcrumbBack}
                                    onClick={() => {
                                        if (loteSelecionado) {
                                            setSelectedLoteId(null);
                                            return;
                                        }
                                        setSelected(null);
                                        setBuscaLote('');
                                        setPaginaLotes(1);
                                        resetView();
                                    }}
                                    >
                                        <ArrowLeft size={16} />
                                        {loteSelecionado ? nomeQuadra(sector) : 'Todas as quadras'}
                                    </button>
                                    <ChevronRight size={15} className={styles.breadcrumbSeparator} aria-hidden="true" />
                                    <span>{loteSelecionado ? `Lote ${loteSelecionado.numero}` : nomeQuadra(sector)}</span>
                                </nav>
                                
                                {loteSelecionado ? (
                                    <>
                                        <div className={styles.lotPanelHeader}>
                                            <div className={styles.lotPanelHeading}>
                                                <h2 className={styles.selectedLotTitle}>
                                                    Lote <span className={styles.selectedLotNumber}>{loteSelecionado.numero}</span>
                                                </h2>
                                                <span className={styles.lotCount}>
                                                    {pessoasDoLote.length} {pessoasDoLote.length === 1 ? 'pessoa sepultada' : 'pessoas sepultadas'}
                                                </span>
                                            </div>
                                        </div>
                                        {pessoasDoLote.length > 0 ? (
                                            <ul className={styles.deceasedList}>
                                                {pessoasDoLote.map(({ falecido }) => (
                                                    <li key={falecido.id}>
                                                        <Link to={`/falecidos/${falecido.id}`} className={styles.deceasedLink}>
                                                            <img
                                                                className={styles.deceasedPhoto}
                                                                src={resolveImageUrl(falecido.imagem) || personPlaceholder}
                                                                alt=""
                                                                onError={(event) => { event.currentTarget.src = personPlaceholder; }}
                                                            />
                                                            <span className={styles.deceasedInfo}>
                                                                <strong>{falecido.nome}</strong>
                                                                <small>
                                                                    Nascimento: {falecido.dataNascimento || falecido.anoNascimento || '—'}
                                                                    {' · Falecimento: '}{falecido.dataMorte || falecido.anoMorte || '—'}
                                                                </small>
                                                            </span>
                                                            <ChevronRight size={17} aria-hidden="true" />
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className={styles.emptyMsg}>Não há pessoas cadastradas neste lote.</p>
                                        )}
                                    </>
                                ) : (
                                <>
                                <div className={styles.lotPanelHeader}>
                                    <div className={styles.lotPanelHeading}>
                                        <h3>Lotes</h3>
                                        <span className={styles.lotCount}>
                                            {lotesLoading
                                                ? 'Carregando lotes...'
                                                : lotesError
                                                    ? 'Lotes indisponíveis'
                                                    : `${lotesSetor.length - lotesVazios} / ${lotesSetor.length}`}
                                        </span>
                                    </div>
                                </div>
                                {lotesError ? (
                                    <p className={styles.emptyMsg} role="alert">Não foi possível carregar os lotes desta quadra.</p>
                                ) : lotesLoading ? (
                                    <p className={styles.emptyMsg}>Carregando lotes...</p>
                                ) : lotesSetor.length > 0 ? (
                                    <>
                                        <label className={styles.lotSearch}>
                                            <Search size={17} aria-hidden="true" />
                                            <input
                                                type="search"
                                                value={buscaLote}
                                                onChange={(event) => {
                                                    setBuscaLote(event.target.value);
                                                    setPaginaLotes(1);
                                                }}
                                                placeholder="Buscar lote..."
                                                aria-label="Buscar lote nesta quadra"
                                            />
                                        </label>
                                        {lotesFiltrados.length > 0 ? (
                                            <div className={styles.lots}>
                                        {lotesVisiveis.map((lote) => {
                                            const numero = String(lote.numero ?? '');
                                            const memoriais = itensSetor.filter((item) =>
                                                normalizarNumeroLote(item.lote) === normalizarNumeroLote(numero)
                                            );
                                            const title = memoriais.length
                                                ? `Lote ${numero}: ${memoriais.map((item) => item.falecido.nome).join(', ')}`
                                                : `Lote ${numero}`;

                                            return (
                                                <button
                                                    type="button"
                                                    key={lote.id}
                                                    className={`${styles.lot} ${memoriais.length === 1 ? styles.lotSingle : memoriais.length > 1 ? styles.lotMultiple : ''}`}
                                                    title={title}
                                                    aria-label={`Abrir lote ${numero}${memoriais.length ? `, ${memoriais.length} falecido${memoriais.length === 1 ? '' : 's'}` : ', vazio'}`}
                                                    aria-pressed={String(selectedLoteId) === String(lote.id)}
                                                    onClick={() => setSelectedLoteId(lote.id)}
                                                >
                                                    {numero}
                                                </button>
                                            );
                                        })}
                                            </div>
                                        ) : (
                                            <p className={styles.emptyMsg}>Nenhum lote corresponde à busca.</p>
                                        )}
                                        {totalPaginasLotes > 1 && (
                                            <div className={styles.lotPagination}>
                                                <button
                                                    type="button"
                                                    onClick={() => setPaginaLotes((page) => Math.max(1, page - 1))}
                                                    disabled={paginaLotesAtual === 1}
                                                    aria-label="Página anterior de lotes"
                                                >
                                                    <ChevronLeft size={17} />
                                                </button>
                                                <span>{paginaLotesAtual} / {totalPaginasLotes}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPaginaLotes((page) => Math.min(totalPaginasLotes, page + 1))}
                                                    disabled={paginaLotesAtual === totalPaginasLotes}
                                                    aria-label="Próxima página de lotes"
                                                >
                                                    <ChevronRight size={17} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className={styles.emptyMsg}>Ainda não há lotes cadastrados nesta quadra.</p>
                                )}
                                </>
                                )}
                            </>
                        ) : (
                            <>
                                <span className={styles.panelLabel}>Como navegar</span>
                                <h2 className={styles.panelTitle}>Escolha uma quadra</h2>
                                <p className={styles.panelSub}>
                                    Toque em uma quadra, no mapa ou na lista abaixo, para ver os lotes. Use + e − para
                                    aproximar e arraste para mover o mapa.
                                </p>

                                <h3 className={styles.groupTitle}>Quadras</h3>
                                <ul className={styles.sectorList}>
                                    {quadras.map((quadra) => (
                                        <li key={quadra.id}>
                                            <button type="button" onClick={() => selectSector(quadra)}>
                                                <strong>{nomeQuadra(quadra)}</strong>
                                                <span>
                                                    {ocupados(quadra.id)} de {totalLotes(quadra.id)} lotes
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                        {!loteSelecionado && (
                            <div className={styles.mapLegend} aria-label="Legenda do mapa">
                                <span><i className={styles.legendQuadra} /> Quadra no mapa</span>
                                <span><i className={styles.legendOccupied} /> Lote com 1 falecido</span>
                                <span><i className={styles.legendMultiple} /> Lote com 2 ou mais</span>
                                <span><i className={styles.legendEmpty} /> Lote sem pessoas</span>
                            </div>
                        )}
                    </aside>
                </div>
            </main>
        </div>
    );
}
