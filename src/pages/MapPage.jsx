import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { fetchFalecidos, fetchLotes, fetchQuadras } from '../lib/api';
import styles from './MapPage.module.css';
import mapaImg from '../assets/mapaExemplo.jfif';

const MAX_ZOOM = 3;

const SECTORS = [
    { id: 'A', name: 'Quadra A', x: 73, y: 95 },
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
    const quadra = texto.match(/quadra\s*([a-z])/i);
    if (!quadra) return null;
    const lote = texto.match(/lote\s*(\d+)/i);
    return { quadra: quadra[1].toUpperCase(), lote: lote ? Number(lote[1]) : null };
}

function normalizeQuadraId(nome) {
    return typeof nome === 'string'
        ? nome.trim().replace(/^quadra\s*/i, '').toUpperCase()
        : '';
}

export default function MapPage() {
    const [selected, setSelected] = useState(null);
    const [falecidos, setFalecidos] = useState([]);
    const [lotesPorQuadra, setLotesPorQuadra] = useState({});
    const [lotesLoading, setLotesLoading] = useState(true);
    const [lotesError, setLotesError] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [ratio, setRatio] = useState(CONTAINER_RATIO);
    const [ponto, setPonto] = useState(null);
    const calibrar =
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('calibrar');
    const mapRef = useRef(null);
    const dragRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        fetchFalecidos()
            .then((data) => {
                if (isMounted) setFalecidos(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (isMounted) setFalecidos([]);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function loadLotes() {
            try {
                const quadras = await fetchQuadras();
                if (!Array.isArray(quadras)) {
                    throw new Error('Formato inválido ao carregar quadras.');
                }

                const lotes = await Promise.all(
                    SECTORS.map(async (sector) => {
                        const quadra = quadras.find(
                            (item) => normalizeQuadraId(item.nome) === sector.id
                        );
                        if (!quadra) return [sector.id, []];

                        const data = await fetchLotes(quadra.id);
                        if (!Array.isArray(data)) {
                            throw new Error(`Formato inválido ao carregar lotes da ${sector.name}.`);
                        }
                        return [sector.id, data];
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
        SECTORS.forEach((s) => {
            grupos[s.id] = [];
        });
        falecidos.forEach((falecido) => {
            const local = parseLocal(falecido.localizacao);
            if (local && grupos[local.quadra]) {
                grupos[local.quadra].push({ falecido, lote: local.lote });
            }
        });
        return grupos;
    }, [falecidos]);

    const pins = useMemo(
        () => SECTORS.map((item) => ({ ...item, ...pinPosition(item, ratio) })),
        [ratio]
    );

    function ocupados(sectorId) {
        const lotes = new Set(porQuadra[sectorId].filter((i) => i.lote).map((i) => i.lote));
        return lotes.size;
    }

    function totalLotes(sectorId) {
        if (lotesLoading) return '…';
        if (lotesError) return '—';
        return lotesPorQuadra[sectorId]?.length || 0;
    }

    const sector = SECTORS.find((s) => s.id === selected) || null;
    const itensSetor = sector
        ? porQuadra[sector.id]
        : [];
    const lotesSetor = sector
        ? [...(lotesPorQuadra[sector.id] || [])].sort(
            (a, b) => Number(a.numero) - Number(b.numero)
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

    function selectSector(item) {
        if (selected === item.id) {
            setSelected(null);
            return;
        }
        setSelected(item.id);

        const el = mapRef.current;
        const z = Math.max(zoom, 2);
        setZoom(z);
        if (el) {
            setOffset(
                clampOffset(
                    {
                        x: -(item.x / 100 - 0.5) * el.clientWidth * z,
                        y: -(item.y / 100 - 0.5) * el.clientHeight * z,
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
                                        <span>{item.id}</span>
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

                    
                    <aside className={styles.panel}>
                        {sector ? (
                            <>
                                <span className={styles.panelLabel}>Quadra selecionada</span>
                                <h2 className={styles.panelTitle}>{sector.name}</h2>

                                <h3 className={styles.groupTitle}>Lotes cadastrados</h3>
                                {lotesError ? (
                                    <p className={styles.emptyMsg} role="alert">Não foi possível carregar os lotes desta quadra.</p>
                                ) : lotesLoading ? (
                                    <p className={styles.emptyMsg}>Carregando lotes...</p>
                                ) : lotesSetor.length > 0 ? (
                                    <div className={styles.lots}>
                                        {lotesSetor.map((lote) => {
                                            const numero = Number(lote.numero);
                                            const memoriais = itensSetor.filter((item) => item.lote === numero);
                                            const title = memoriais.length
                                                ? `Lote ${numero}: ${memoriais.map((item) => item.falecido.nome).join(', ')}`
                                                : `Lote ${numero}`;

                                            return (
                                                <Link
                                                    key={lote.id}
                                                    to={memoriais.length
                                                        ? `/falecidos/${memoriais[0].falecido.id}`
                                                        : `/lote/${lote.id}`}
                                                    className={`${styles.lot} ${memoriais.length ? styles.lotTaken : ''}`}
                                                    title={title}
                                                >
                                                    {numero}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className={styles.emptyMsg}>Ainda não há lotes cadastrados nesta quadra.</p>
                                )}
                            </>
                        ) : (
                            <>
                                <span className={styles.panelLabel}>Como navegar</span>
                                <h2 className={styles.panelTitle}>Escolha uma quadra</h2>
                                <p className={styles.panelSub}>
                                    Toque numa quadra, no mapa ou na lista abaixo, para ver os lotes. Use + e − para
                                    aproximar e arraste para mover o mapa.
                                </p>

                                <h3 className={styles.groupTitle}>Quadras</h3>
                                <ul className={styles.sectorList}>
                                    {pins.map((item) => (
                                        <li key={item.id}>
                                            <button type="button" onClick={() => selectSector(item)}>
                                                <strong>{item.name}</strong>
                                                <span>
                                                    {ocupados(item.id)} de {totalLotes(item.id)} lotes
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </aside>
                </div>
            </main>
        </div>
    );
}
