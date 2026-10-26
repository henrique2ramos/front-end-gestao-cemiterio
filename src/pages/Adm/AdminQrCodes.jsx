import { useCallback, useEffect, useState } from 'react';
import { fetchFalecidos, fetchLotes, fetchQuadras } from '../../lib/api';
import { buildFalecidoUrl, buildLoteUrl, buildQuadraUrl } from '../../lib/qrUrls';
import AdminSidebar from './AdminSidebar';
import QrCodeSelectionPanel from '../../components/QrCodeSelectionPanel';
import styles from './AdminQrCodes.module.css';

const PAGE_LIMIT = 100;

const getItems = (data, keys = []) => {
    if (Array.isArray(data)) return data;
    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
        if (Array.isArray(data?.data?.[key])) return data.data[key];
    }
    return Array.isArray(data?.data) ? data.data : [];
};

const getPageMetadata = (data) => {
    const candidates = [data, data?.pagination, data?.meta, data?.data, data?.data?.pagination, data?.data?.meta];
    const findNumber = (keys) => {
        for (const candidate of candidates) {
            for (const key of keys) {
                const rawValue = candidate?.[key];
                if (rawValue == null || rawValue === '') continue;
                const value = Number(rawValue);
                if (Number.isFinite(value) && value >= 0) return value;
            }
        }
        return null;
    };
    return {
        total: findNumber(['total', 'totalItems', 'totalRecords', 'count']),
        pages: findNumber(['pages', 'totalPages', 'lastPage']),
    };
};

async function fetchAllPages(fetchPage, limit = PAGE_LIMIT, itemKeys = ['items']) {
    const items = [];
    let total = null;
    let pages = null;
    let page = 1;
    let previousSignature = '';

    while (true) {
        const response = await fetchPage(page, limit);
        const currentItems = getItems(response, itemKeys);
        const metadata = getPageMetadata(response);
        if (total == null && metadata.total != null) total = metadata.total;
        if (pages == null && metadata.pages != null) pages = metadata.pages;
        if (currentItems.length === 0) break;

        const signature = `${currentItems.length}:${currentItems[0]?.id ?? ''}:${currentItems[currentItems.length - 1]?.id ?? ''}`;
        if (signature === previousSignature) break;
        previousSignature = signature;
        items.push(...currentItems);

        if (total != null && items.length >= total) break;
        if (pages != null && page >= pages) break;
        if (currentItems.length < limit) break;
        page += 1;
    }

    return { items, total, incomplete: total != null && items.length < total };
}

const parseLocation = (value = '') => ({
    quadra: value.match(/Quadra\s+(.+?)(?:,|$)/i)?.[1]?.trim() || '',
    lote: value.match(/Lote\s+(.+?)$/i)?.[1]?.trim() || '',
});

const relationName = (value, keys) => {
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    for (const key of keys) {
        const entry = value?.[key];
        if (entry != null && String(entry).trim()) return String(entry).trim();
    }
    return '';
};

const getPersonLocation = (person) => {
    const fallback = parseLocation(typeof person.localizacao === 'string' ? person.localizacao : '');
    return {
        quadra: relationName(person.quadra, ['nome', 'name']) || String(person.quadraNome || fallback.quadra).trim(),
        lote: relationName(person.lote, ['numero', 'nome', 'number']) || String(person.loteNumero || fallback.lote).trim(),
    };
};

const locationKey = (quadra, lote) => `${String(quadra).trim().toLocaleLowerCase('pt-BR')}|${String(lote).trim().toLocaleLowerCase('pt-BR')}`;

// Conta os falecidos de cada lote numa só passada (antes era um filtro completo para cada lote).
const countPeopleByLote = (people) => {
    const byId = new Map();
    const byLocation = new Map();
    people.forEach((person) => {
        const loteId = person.loteId ?? person.lote?.id;
        if (loteId != null) {
            const key = String(loteId);
            byId.set(key, (byId.get(key) || 0) + 1);
            return;
        }
        const { quadra, lote } = getPersonLocation(person);
        if (!quadra || !lote) return;
        const key = locationKey(quadra, lote);
        byLocation.set(key, (byLocation.get(key) || 0) + 1);
    });
    return (lote, quadra, numero) => (byId.get(String(lote.id)) || 0) + (byLocation.get(locationKey(quadra.nome, numero)) || 0);
};

const makeCountWarning = (loaded, total, label) => (
    total != null && loaded < total ? `Foram carregados ${loaded} de ${total} ${label}.` : ''
);

export default function AdminQrCodes({ onLogout }) {
    const [catalog, setCatalog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [warnings, setWarnings] = useState([]);
    const [reloadKey, setReloadKey] = useState(0);
    const [viewportScrollbarWidth, setViewportScrollbarWidth] = useState(() => (
        Math.max(0, window.innerWidth - document.documentElement.clientWidth)
    ));

    useEffect(() => {
        const updateViewportScrollbarWidth = () => {
            setViewportScrollbarWidth(Math.max(0, window.innerWidth - document.documentElement.clientWidth));
        };

        updateViewportScrollbarWidth();
        window.addEventListener('resize', updateViewportScrollbarWidth);
        return () => window.removeEventListener('resize', updateViewportScrollbarWidth);
    }, []);

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        setError('');
        setWarnings([]);
        try {
            // TODO: trocar pelo endpoint de catálogo com busca e paginação no servidor.
            const [peopleResult, quadrasData] = await Promise.all([
                fetchAllPages((page, limit) => fetchFalecidos({ page, limit }), PAGE_LIMIT, ['items', 'falecidos', 'data']),
                fetchQuadras(),
            ]);
            const people = peopleResult.items;
            const quadras = getItems(quadrasData, ['items', 'quadras']).filter((quadra) => quadra?.id != null);
            const lotResults = await Promise.all(quadras.map(async (quadra) => {
                try {
                    const result = await fetchAllPages(
                        (page, limit) => fetchLotes(quadra.id, { page, limit }),
                        PAGE_LIMIT,
                        ['items', 'lotes', 'data'],
                    );
                    return { quadra, ...result, error: '' };
                } catch (loadError) {
                    return { quadra, items: [], total: null, incomplete: false, error: loadError.message || 'Falha ao carregar lotes.' };
                }
            }));

            const nextWarnings = [];
            const peopleWarning = makeCountWarning(people.length, peopleResult.total, 'falecidos');
            if (peopleWarning) nextWarnings.push(peopleWarning);
            lotResults.forEach((result) => {
                if (result.error) {
                    nextWarnings.push(`Não foi possível carregar os lotes da Quadra ${result.quadra.nome}: ${result.error}`);
                    return;
                }
                const lotWarning = makeCountWarning(result.items.length, result.total, `lotes da Quadra ${result.quadra.nome}`);
                if (lotWarning) nextWarnings.push(lotWarning);
            });

            const countFalecidosNoLote = countPeopleByLote(people);
            const items = [
                ...people.filter((person) => person.id != null).map((person) => {
                    const { quadra, lote } = getPersonLocation(person);
                    const subtitle = [quadra && `Quadra ${quadra}`, lote && `Lote ${lote}`]
                        .filter(Boolean).join(' · ') || 'Sem localização';
                    return {
                        id: `falecido-${person.id}`,
                        type: 'falecido',
                        name: person.nome || 'Não identificado',
                        subtitle,
                        quadra,
                        lote,
                        url: buildFalecidoUrl(person.id),
                    };
                }),
                ...quadras.filter((quadra) => quadra.id != null).map((quadra) => ({
                    id: `quadra-${quadra.id}`,
                    type: 'quadra',
                    name: `Quadra ${quadra.nome}`,
                    quadra: String(quadra.nome),
                    subtitle: (() => {
                        const totalLotes = lotResults.find((result) => String(result.quadra.id) === String(quadra.id))?.items.length || 0;
                        return `${totalLotes} ${totalLotes === 1 ? 'lote' : 'lotes'}`;
                    })(),
                    url: buildQuadraUrl(quadra.id),
                })),
                ...lotResults.flatMap(({ quadra, items: lots }) => lots
                    .filter((lote) => lote.id != null)
                    .map((lote) => {
                        const numero = String(lote.numero ?? lote.nome ?? lote.id);
                        const falecidosNoLote = countFalecidosNoLote(lote, quadra, numero);
                        return {
                            id: `lote-${quadra.id}-${lote.id}`,
                            type: 'lote',
                            name: `Lote ${numero}`,
                            subtitle: `Quadra ${quadra.nome} · ${falecidosNoLote} ${falecidosNoLote === 1 ? 'falecido' : 'falecidos'}`,
                            quadra: String(quadra.nome),
                            lote: numero,
                            url: buildLoteUrl(lote.id),
                        };
                    })),
            ];
            setCatalog({ items, quadras });
            setWarnings(nextWarnings);
        } catch (loadError) {
            console.error('Erro ao carregar dados para QR Codes:', loadError);
            setError(loadError.message || 'Não foi possível carregar os registros.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCatalog(); }, [loadCatalog, reloadKey]);

    return (
        <div className={styles.layout} style={{ '--qr-admin-scrollbar-width': `${viewportScrollbarWidth}px` }}>
            <AdminSidebar onLogout={onLogout} />
            <main className={styles.main}>
                <div className={styles.content}>
                    <header className={styles.pageHeader}>
                        <div className={styles.pageHeaderInner}>
                            <h1 id="qr-codes-page-title">QR Codes</h1>
                            <p>Selecione falecidos, quadras ou lotes para gerar e imprimir os códigos.</p>
                        </div>
                    </header>
                    {loading ? (
                        <section className={styles.stateCard} aria-live="polite">
                            <span className={styles.spinner} aria-hidden="true" />
                            <h1>Carregando registros</h1>
                            <p>Estamos preparando falecidos, quadras e lotes para seleção.</p>
                        </section>
                    ) : error ? (
                        <section className={styles.stateCard} role="alert">
                            <h1>Não foi possível carregar os QR Codes</h1>
                            <p>{error}</p>
                            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Tentar novamente</button>
                        </section>
                    ) : (
                        <div className={styles.workspace}>
                            <div className={styles.workspaceInner}>
                                {warnings.length > 0 && <section className={styles.catalogWarnings} role="alert">
                                    <div>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
                                    <button type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Tentar novamente</button>
                                </section>}
                                <QrCodeSelectionPanel
                                    items={catalog.items}
                                    quadras={catalog.quadras}
                                    exportWarnings={warnings}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
