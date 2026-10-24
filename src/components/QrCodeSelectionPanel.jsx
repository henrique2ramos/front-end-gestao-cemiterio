import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Download, Eye, Minus, Printer, Search, X } from 'lucide-react';
import QRCode from 'react-qr-code';
import {
    createQrSheetBlob,
    createZipBlob,
    downloadBlob,
    qrFileName,
    svgToLabeledRasterBlob,
} from '../lib/qrImageExport';
import styles from './QrCodeSelectionPanel.module.css';

const PAGE_SIZE = 6;
const naturalCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const TYPE_OPTIONS = [
    { id: 'falecido', label: 'Falecidos' },
    { id: 'quadra', label: 'Quadras' },
    { id: 'lote', label: 'Lotes' },
];
const TYPE_ORDER = { falecido: 0, quadra: 1, lote: 2 };
const compareText = (left, right) => naturalCollator.compare(String(left || ''), String(right || ''));
const norm = (value) => String(value ?? '').trim().toLocaleLowerCase('pt-BR');
const matchesFilters = (item, { name, quadra, lote }) => {
    if (name && !norm(item.name).includes(name)) return false;
    if (quadra && norm(item.quadra) !== quadra) return false;
    if (lote && norm(item.lote) !== lote) return false;
    return true;
};
const compareCatalogItems = (left, right) => {
    const typeDifference = (TYPE_ORDER[left.type] ?? 99) - (TYPE_ORDER[right.type] ?? 99);
    if (typeDifference) return typeDifference;
    if (left.type === 'falecido') {
        return compareText(left.quadra, right.quadra)
            || compareText(left.lote, right.lote)
            || compareText(left.name, right.name);
    }
    if (left.type === 'quadra') return compareText(left.quadra || left.name, right.quadra || right.name);
    return compareText(left.lote, right.lote);
};

export default function QrCodeSelectionPanel({ items = [], quadras = [] }) {
    useEffect(() => {
        document.body.classList.add('qr-batch-print-mode');
        return () => document.body.classList.remove('qr-batch-print-mode');
    }, []);

    const normalizedItems = useMemo(() => items.filter((item) => item?.url).map((item, index) => ({
        ...item,
        id: String(item.id ?? index),
        name: item.name || item.title || 'Falecido',
        type: item.type || 'falecido',
    })), [items]);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [busyAction, setBusyAction] = useState('');
    const [error, setError] = useState('');
    const [exportProgress, setExportProgress] = useState('');
    const [exportNotice, setExportNotice] = useState('');
    const [largeExportRequest, setLargeExportRequest] = useState(null);
    const [qrRenderItems, setQrRenderItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedQuadra, setSelectedQuadra] = useState('');
    const [selectedLote, setSelectedLote] = useState('');
    const [selectedType, setSelectedType] = useState('falecido');
    const [selectionPage, setSelectionPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [showSelectedOnly, setShowSelectedOnly] = useState(false);
    const [hoveredItemId, setHoveredItemId] = useState(null);
    const [suppressedHoverId, setSuppressedHoverId] = useState(null);
    const printRef = useRef(null);
    const listRef = useRef(null);
    const exportControllerRef = useRef(null);
    const printFramesRef = useRef([]);
    const printCleanupRef = useRef(null);

    const selectedItems = useMemo(() => normalizedItems
        .filter((item) => selectedIds.has(item.id))
        .sort(compareCatalogItems), [normalizedItems, selectedIds]);
    const normalizedSearch = debouncedSearchTerm.trim().toLocaleLowerCase('pt-BR');
    const quadraOptions = useMemo(() => [...new Set([
        ...quadras.map((quadra) => String(quadra?.nome ?? quadra ?? '').trim()),
        ...normalizedItems.map((item) => String(item.quadra || '').trim()),
    ].filter(Boolean))]
        .sort(compareText), [quadras, normalizedItems]);
    const typeItems = useMemo(() => normalizedItems.filter((item) => item.type === selectedType), [normalizedItems, selectedType]);
    const quadraCounts = useMemo(() => {
        const counts = new Map();
        typeItems.forEach((item) => {
            if (!matchesFilters(item, { name: normalizedSearch, quadra: '', lote: norm(selectedLote) })) return;
            const quadra = String(item.quadra || '').trim();
            if (quadra) counts.set(quadra, (counts.get(quadra) || 0) + 1);
        });
        return counts;
    }, [typeItems, normalizedSearch, selectedLote]);
    const foraDoLote = useMemo(() => (
        selectedType === 'falecido' && selectedLote
            ? typeItems.filter((item) => matchesFilters(item, { name: normalizedSearch, quadra: norm(selectedQuadra), lote: '' })).length
            : 0
    ), [typeItems, selectedType, selectedLote, normalizedSearch, selectedQuadra]);
    const activeFilters = selectedType === 'falecido' ? [
        searchTerm.trim() && { key: 'name', label: `Nome: “${searchTerm.trim()}”`, clear: () => { setSearchTerm(''); setDebouncedSearchTerm(''); } },
        selectedQuadra && { key: 'quadra', label: `Quadra ${selectedQuadra}`, clear: () => changeQuadra('') },
        selectedLote && { key: 'lote', label: `Lote ${selectedLote}`, clear: () => changeLote('') },
    ].filter(Boolean) : [];
    const clearAllFilters = () => {
        setSearchTerm('');
        setDebouncedSearchTerm('');
        setSelectedQuadra('');
        setSelectedLote('');
    };
    const filteredItems = useMemo(() => typeItems.filter((item) => {
        if (selectedType === 'falecido') {
            return matchesFilters(item, {
                name: normalizedSearch,
                quadra: norm(selectedQuadra),
                lote: norm(selectedLote),
            });
        }
        const matchesName = !normalizedSearch || (selectedType === 'lote'
            ? String(item.lote || '').trim().toLocaleLowerCase('pt-BR') === normalizedSearch
            : String(item.name).toLocaleLowerCase('pt-BR').includes(normalizedSearch));
        const matchesQuadra = selectedType === 'quadra'
            ? true
            : selectedType === 'lote'
                ? Boolean(selectedQuadra) && String(item.quadra || '').trim() === selectedQuadra
                : !selectedQuadra || String(item.quadra || '').trim() === selectedQuadra
                    || (!item.quadra && !selectedLote);
        const matchesLote = !selectedLote || (item.type !== 'quadra' && String(item.lote || '').trim().toLocaleLowerCase('pt-BR') === selectedLote.trim().toLocaleLowerCase('pt-BR'));
        return matchesName && matchesQuadra && matchesLote;
    }).sort(compareCatalogItems), [typeItems, normalizedSearch, selectedType, selectedQuadra, selectedLote]);
    const displayItems = useMemo(() => showSelectedOnly ? selectedItems : filteredItems, [showSelectedOnly, selectedItems, filteredItems]);
    const selectedCountLabel = `${selectedItems.length} ${selectedItems.length === 1 ? 'selecionado' : 'selecionados'}`;
    const selectionPages = Math.max(1, Math.ceil(displayItems.length / itemsPerPage));
    const visibleItems = displayItems.slice((selectionPage - 1) * itemsPerPage, selectionPage * itemsPerPage);
    const filteredSelectedCount = useMemo(() => filteredItems.reduce((count, item) => count + Number(selectedIds.has(item.id)), 0), [filteredItems, selectedIds]);
    const allFilteredSelected = filteredItems.length > 0 && filteredSelectedCount === filteredItems.length;

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
        return () => window.clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => setSelectionPage(1), [normalizedSearch, selectedQuadra, selectedLote, selectedType, showSelectedOnly]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: 0 });
    }, [selectionPage]);

    useEffect(() => {
        if (selectionPage > selectionPages) setSelectionPage(selectionPages);
    }, [selectionPage, selectionPages]);

    const toggleItem = (id) => setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    function changeQuadra(quadra) {
        setSelectedQuadra(quadra);
        setSelectedLote('');
    }

    function changeLote(lote) {
        setSelectedLote(lote);
    }

    const toggleAll = () => setSelectedIds((current) => {
        const next = new Set(current);
        filteredItems.forEach((item) => {
            if (allFilteredSelected) next.delete(item.id);
            else next.add(item.id);
        });
        return next;
    });

    const getSelectedSvgs = () => {
        const allCards = Array.from(printRef.current?.querySelectorAll('[data-qr-id]') || []);
        const byId = new Map(allCards.map((card) => [card.dataset.qrId, card.querySelector('svg')]));
        return selectedItems.map((item) => byId.get(item.id));
    };

    const runExport = async (action, callback) => {
        if (!selectedItems.length) return;
        const controller = new AbortController();
        exportControllerRef.current = controller;
        setBusyAction(action);
        setError('');
        setExportNotice('');
        setExportProgress('Preparando os QR Codes...');
        setQrRenderItems(selectedItems);
        try {
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            if (controller.signal.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
            await callback(controller.signal);
        } catch (exportError) {
            if (exportError.name === 'AbortError') {
                setExportNotice(action === 'print'
                    ? 'Impressão cancelada.'
                    : 'Download cancelado. Nenhum arquivo foi baixado.');
            }
            else setError(exportError.message || 'Não foi possível preparar os QR Codes.');
        } finally {
            if (exportControllerRef.current === controller) exportControllerRef.current = null;
            setBusyAction('');
            setQrRenderItems([]);
            setExportProgress('');
        }
    };

    const requestExport = (action, callback = null) => {
        if (!selectedItems.length) return;
        setError('');
        if (selectedItems.length > 150) {
            setLargeExportRequest({ action, callback, count: selectedItems.length });
            return;
        }
        if (action === 'print') startPrint();
        else runExport(action, callback);
    };

    const continueLargeExport = () => {
        const request = largeExportRequest;
        setLargeExportRequest(null);
        if (!request) return;
        if (request.action === 'print') startPrint();
        else runExport(request.action, request.callback);
    };

    const downloadSheets = () => requestExport('png', async (signal) => {
        const svgs = getSelectedSvgs();
        if (svgs.some((svg) => !svg)) throw new Error('Não foi possível carregar todos os QR Codes.');
        const pages = [];
        for (let start = 0; start < selectedItems.length; start += PAGE_SIZE) {
            if (signal.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
            const pageItems = selectedItems.slice(start, start + PAGE_SIZE);
            const pageSvgs = svgs.slice(start, start + PAGE_SIZE);
            const blob = await createQrSheetBlob(pageItems, pageSvgs, 'png', (done) => {
                setExportProgress(`Gerando ${start + done} de ${selectedItems.length}...`);
            }, signal);
            pages.push({ name: `folha-${String(pages.length + 1).padStart(2, '0')}.png`, blob });
        }
        if (signal.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
        setExportProgress('Preparando o arquivo ZIP...');
        if (pages.length === 1) downloadBlob(pages[0].blob, pages[0].name);
        else downloadBlob(await createZipBlob(pages, signal), 'qr-codes-folhas-png.zip');
    });

    const downloadIndividualPngs = () => requestExport('zip', async (signal) => {
        const svgs = getSelectedSvgs();
        if (svgs.some((svg) => !svg)) throw new Error('Não foi possível carregar todos os QR Codes.');
        const files = [];
        for (let index = 0; index < selectedItems.length; index += 1) {
            if (signal.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
            const item = selectedItems[index];
            setExportProgress(`Gerando ${index + 1} de ${selectedItems.length}...`);
            const blob = await svgToLabeledRasterBlob(svgs[index], item.name, item.subtitle, 720, signal);
            const locationParts = [
                item.quadra && `quadra-${item.quadra}`,
                item.lote && `lote-${item.lote}`,
            ].filter(Boolean).map(qrFileName);
            const nameParts = [qrFileName(item.name), ...locationParts];
            files.push({ name: `${nameParts.join('-')}.png`, blob });
        }
        if (signal.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
        setExportProgress('Preparando o arquivo ZIP...');
        downloadBlob(await createZipBlob(files, signal), 'qr-codes-individuais.zip');
    });

    const startPrint = () => {
        if (!selectedItems.length) return;
        setBusyAction('print');
        setError('');
        setExportNotice('');
        setExportProgress('Preparando a impressão...');
        setQrRenderItems(selectedItems);
        const cleanup = () => {
            printFramesRef.current.forEach((frame) => cancelAnimationFrame(frame));
            printFramesRef.current = [];
            setQrRenderItems([]);
            setBusyAction('');
            setExportProgress('');
            window.removeEventListener('afterprint', cleanup);
            if (printCleanupRef.current === cleanup) printCleanupRef.current = null;
        };
        printCleanupRef.current = cleanup;
        window.addEventListener('afterprint', cleanup);
        const firstFrame = requestAnimationFrame(() => {
            const secondFrame = requestAnimationFrame(() => {
                printFramesRef.current = [];
                if (printCleanupRef.current === cleanup) window.print();
            });
            printFramesRef.current.push(secondFrame);
        });
        printFramesRef.current = [firstFrame];
    };

    const cancelGeneration = () => {
        if (exportControllerRef.current) {
            exportControllerRef.current.abort();
            setExportProgress('Cancelando após a etapa atual...');
            return;
        }
        if (printCleanupRef.current) {
            printCleanupRef.current();
            setExportNotice('Preparação da impressão cancelada.');
        }
    };

    return (
        <div className={styles.workspaceRoot}>
            <section className={styles.panel} aria-label="Seleção e exportação de QR Codes">

                <div className={styles.typeTabsHeader}>
                <nav className={styles.typeTabs} aria-label={showSelectedOnly ? 'Voltar para busca' : 'Tipo de QR Code'}>
                    {showSelectedOnly ? <button type="button" className={styles.backToSearchTab} onClick={() => setShowSelectedOnly(false)} disabled={Boolean(busyAction)}>
                        <ChevronLeft size={16} aria-hidden="true" /> Voltar para busca
                    </button> : TYPE_OPTIONS.map((option) => <button
                        type="button"
                        key={option.id}
                        className={selectedType === option.id ? styles.typeTabActive : ''}
                        aria-pressed={selectedType === option.id}
                        onClick={() => {
                            setSelectedType(option.id);
                            setSelectedLote('');
                            setSearchTerm('');
                            setDebouncedSearchTerm('');
                            setShowSelectedOnly(false);
                        }}
                        disabled={Boolean(busyAction)}
                    >{option.label}</button>)}
                </nav>
                </div>

                <div className={showSelectedOnly ? styles.hiddenFilters : ''} aria-hidden={showSelectedOnly} inert={showSelectedOnly}>
                <div className={`${styles.filtersRow} ${selectedType === 'falecido' ? styles.deceasedFiltersRow : ''}`}>
                {selectedType !== 'lote' && <div className={styles.filterTools}>
                    {selectedType === 'falecido' && <span className={styles.filterFieldLabel}>Nome</span>}
                    <label className={styles.filterSearch}>
                        <Search size={17} aria-hidden="true" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder={selectedType === 'quadra' ? 'Buscar quadra...' : 'Buscar falecido pelo nome...'}
                            aria-label="Buscar registros para selecionar"
                            disabled={Boolean(busyAction)}
                        />
                        {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpar busca"><X size={16} /></button>}
                    </label>
                </div>}

                {selectedType !== 'quadra' && <div className={`${styles.locationFilters} ${selectedType === 'lote' ? styles.loteFilters : ''}`}>
                    <label>
                        <span>Quadra</span>
                        <select value={selectedQuadra} onChange={(event) => changeQuadra(event.target.value)} disabled={Boolean(busyAction)}>
                            <option value="">{selectedType === 'lote' ? 'Selecione uma quadra' : 'Todas as quadras'}</option>
                            {quadraOptions.map((quadra) => <option key={quadra} value={quadra}>
                                {selectedType === 'falecido' || selectedType === 'lote'
                                    ? `Quadra ${quadra} (${quadraCounts.get(quadra) || 0})`
                                    : `Quadra ${quadra}`}
                            </option>)}
                        </select>
                    </label>
                    {selectedType === 'lote' && <label>
                        <span>Lote</span>
                        <div className={styles.loteSearchControl}>
                            <Search size={16} aria-hidden="true" />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Número exato do lote"
                                aria-label="Buscar lote pelo número"
                                disabled={!selectedQuadra || Boolean(busyAction)}
                            />
                            {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpar busca de lote"><X size={15} /></button>}
                        </div>
                    </label>}
                    {selectedType !== 'lote' && <label>
                        <span>Lote</span>
                        <div className={styles.loteSearchControl}>
                        <input
                            type="text"
                            value={selectedLote}
                            onChange={(event) => changeLote(event.target.value)}
                            placeholder={selectedQuadra ? 'Digite o número do lote' : 'Selecione uma quadra primeiro'}
                            aria-label="Filtrar por número do lote"
                            disabled={!selectedQuadra || Boolean(busyAction)}
                        />
                        {selectedType === 'falecido' && selectedQuadra && selectedLote && <button type="button" onClick={() => changeLote('')} aria-label="Limpar filtro de lote" disabled={Boolean(busyAction)}><X size={15} /></button>}
                        </div>
                    </label>}
                </div>}
                </div>
                {selectedType === 'falecido' && activeFilters.length > 0 && <div className={styles.activeFilters} aria-label="Filtros ativos">
                    {activeFilters.map((filter) => <span className={styles.chip} key={filter.key}>
                        {filter.label}
                        <button type="button" onClick={filter.clear} aria-label={`Remover filtro ${filter.label}`} disabled={Boolean(busyAction)}><X size={11} aria-hidden="true" /></button>
                    </span>)}
                    {activeFilters.length > 1 && <button type="button" className={styles.clearAll} onClick={clearAllFilters} disabled={Boolean(busyAction)}>Limpar tudo</button>}
                </div>}
                </div>

                {(showSelectedOnly || selectedType !== 'lote' || selectedQuadra) && <div className={`${styles.selectionBar} ${showSelectedOnly ? styles.selectionBarSelected : ''}`}>
                    {showSelectedOnly ? <div className={styles.selectedListStart}>
                        <span className={styles.reviewLabel}>{selectedCountLabel}</span>
                        {selectedItems.length > 0 && <button
                            type="button"
                            className={styles.clearSelectionButton}
                            onClick={() => setSelectedIds(new Set())}
                            disabled={Boolean(busyAction)}
                            aria-label="Desmarcar todos os QR Codes selecionados"
                        >
                            <span className={styles.clearSelectionIcon}><Minus size={12} strokeWidth={3} aria-hidden="true" /></span>
                            Desmarcar todos
                        </button>}
                    </div> : (
                        <label className={`${styles.selectAll} ${allFilteredSelected ? styles.selectAllDanger : ''}`}>
                            <input
                                type="checkbox"
                                className={allFilteredSelected ? styles.selectAllInputHidden : ''}
                                checked={allFilteredSelected}
                                onChange={toggleAll}
                                disabled={!filteredItems.length || Boolean(busyAction)}
                            />
                            {allFilteredSelected && <span className={styles.clearSelectionIcon}><Minus size={12} strokeWidth={3} aria-hidden="true" /></span>}
                            <span>{allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}</span>
                        </label>
                    )}
                    {!showSelectedOnly && <div className={styles.selectionControls}>
                        <span>{selectedCountLabel} · {filteredItems.length} {filteredItems.length === 1 ? 'resultado' : 'resultados'}</span>
                    </div>}
                </div>}

                <div
                    className={`${styles.list} ${showSelectedOnly ? styles.listSelected : ''} ${busyAction ? styles.listBusy : ''}`}
                    ref={listRef}
                    aria-busy={Boolean(busyAction)}
                    onClickCapture={(event) => {
                        if (!busyAction) return;
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                >
                    {visibleItems.map((item) => (
                        <label
                            className={`${styles.item} ${hoveredItemId === item.id && suppressedHoverId !== item.id ? styles.itemUnselectHover : ''}`}
                            key={item.id}
                            onMouseEnter={() => setHoveredItemId(item.id)}
                            onMouseLeave={() => {
                                setHoveredItemId(null);
                                setSuppressedHoverId(null);
                            }}
                        >
                            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => {
                                if (!selectedIds.has(item.id)) setSuppressedHoverId(item.id);
                                else setSuppressedHoverId(null);
                                toggleItem(item.id);
                            }} disabled={Boolean(busyAction)} />
                            <span className={`${styles.itemCheckbox} ${selectedIds.has(item.id) ? styles.itemCheckboxSelected : ''}`} aria-hidden="true">
                                {selectedIds.has(item.id) && <>
                                    <Check className={styles.checkboxCheck} size={13} strokeWidth={3} />
                                    <Minus className={styles.checkboxMinus} size={13} strokeWidth={3} />
                                </>}
                            </span>
                            <span className={styles.itemText}><strong>{item.name}</strong>{item.subtitle && <small>{item.subtitle}</small>}</span>
                        </label>
                    ))}
                    {showSelectedOnly && selectedItems.length === 0 && <p className={styles.empty}>Você ainda não selecionou nenhum QR Code.</p>}
                    {!showSelectedOnly && normalizedItems.length === 0 && <p className={styles.empty}>Não há registros com QR Code disponível.</p>}
                    {!showSelectedOnly && selectedType === 'lote' && !selectedQuadra && <p className={styles.empty}>Selecione uma quadra para listar os lotes dela.</p>}
                    {!showSelectedOnly && selectedType === 'falecido' && typeItems.length > 0 && filteredItems.length === 0 && <div className={styles.empty}>
                        <p>{activeFilters.length > 1 ? 'Nenhum registro encontrado com esses filtros juntos.' : 'Nenhum registro encontrado com esse filtro.'}</p>
                        {foraDoLote > 0 && selectedLote && <>
                            <p>Há {foraDoLote} {foraDoLote === 1 ? 'resultado' : 'resultados'} fora do lote {selectedLote}.</p>
                            <button type="button" className={styles.linkButton} onClick={() => changeLote('')} disabled={Boolean(busyAction)}>Ver em todos os lotes</button>
                        </>}
                        {activeFilters.length > 0 && <button type="button" className={styles.linkButton} onClick={clearAllFilters} disabled={Boolean(busyAction)}>Limpar filtros</button>}
                    </div>}
                    {!showSelectedOnly && selectedType !== 'falecido' && normalizedItems.length > 0 && filteredItems.length === 0 && !(selectedType === 'lote' && !selectedQuadra) && <p className={styles.empty}>Nenhum registro corresponde à busca.</p>}
                </div>
                {displayItems.length > itemsPerPage && <div className={styles.paginationControls}><label className={styles.pageSizeControl}>
                    <span>Por página</span>
                    <select value={itemsPerPage} onChange={(event) => { setItemsPerPage(Number(event.target.value)); setSelectionPage(1); }} disabled={Boolean(busyAction)} aria-label="Quantidade de registros por página">
                        {[10, 20, 30, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                </label>
                <div className={styles.listPagination}>
                    <button type="button" onClick={() => setSelectionPage((page) => Math.max(1, page - 1))} disabled={selectionPage === 1 || Boolean(busyAction)} aria-label="Página anterior"><ChevronLeft size={17} /></button>
                    <span>Página {selectionPage} de {selectionPages}</span>
                    <button type="button" onClick={() => setSelectionPage((page) => Math.min(selectionPages, page + 1))} disabled={selectionPage === selectionPages || Boolean(busyAction)} aria-label="Próxima página"><ChevronRight size={17} /></button>
                </div></div>}
                <div className={styles.actions}>
                    {!showSelectedOnly && selectedItems.length > 0 && <button type="button" onClick={() => setShowSelectedOnly(true)} disabled={Boolean(busyAction)}>
                        <Eye size={16} aria-hidden="true" /> Ver selecionados ({selectedItems.length})
                    </button>}
                    <button type="button" onClick={() => requestExport('print')} disabled={!selectedItems.length || Boolean(busyAction)}><Printer size={17} />{busyAction === 'print' ? 'Preparando...' : 'Imprimir / PDF'}</button>
                    <button type="button" onClick={downloadSheets} disabled={!selectedItems.length || Boolean(busyAction)}><Download size={17} />{busyAction === 'png' ? 'Gerando...' : 'Folhas PNG'}</button>
                    <button type="button" onClick={downloadIndividualPngs} disabled={!selectedItems.length || Boolean(busyAction)}><Download size={17} />{busyAction === 'zip' ? 'Gerando ZIP...' : 'PNG individuais (ZIP)'}</button>
                    {exportProgress && <button type="button" onClick={cancelGeneration} disabled={exportProgress.startsWith('Cancelando')}>
                        {exportProgress.startsWith('Cancelando')
                            ? 'Cancelando...'
                            : busyAction === 'print' ? 'Cancelar impressão' : 'Cancelar download'}
                    </button>}
                </div>
                {exportProgress && <div className={styles.exportProgressRow}>
                    <p className={styles.exportProgress} role="status" aria-live="polite">
                        {exportProgress} <span>Não atualize nem feche a página durante a geração.</span>
                    </p>
                </div>}
                {exportNotice && <p className={styles.exportNotice} role="status">{exportNotice}</p>}
                <p className={styles.exportHint}>As folhas comportam {PAGE_SIZE} QR Codes; com mais registros, o download reúne as folhas em um ZIP.</p>
                {error && <p className={styles.error} role="alert">{error}</p>}
            </section>

            {largeExportRequest && <div className={styles.exportModalOverlay} onClick={() => setLargeExportRequest(null)}>
                <section
                    className={styles.exportModal}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="large-export-title"
                    onClick={(event) => event.stopPropagation()}
                >
                    <span className={styles.exportModalIcon}><AlertCircle size={23} aria-hidden="true" /></span>
                    <div className={styles.exportModalCopy}>
                        <h2 id="large-export-title">Gerar {largeExportRequest.count} QR Codes?</h2>
                        <p>Preparar muitos códigos pode deixar a página lenta. A geração pode levar alguns minutos; você poderá cancelá-la antes do download.</p>
                    </div>
                    <div className={styles.exportModalActions}>
                        <button type="button" onClick={() => setLargeExportRequest(null)}>Cancelar</button>
                        <button type="button" className={styles.exportModalContinue} onClick={continueLargeExport}>Continuar</button>
                    </div>
                </section>
            </div>}

            <div className={styles.printDocument} ref={printRef} aria-hidden="true">
                {Array.from({ length: Math.ceil(qrRenderItems.length / PAGE_SIZE) }, (_, pageIndex) => (
                    <section className={styles.printPage} key={`page-${pageIndex}`}>
                        {qrRenderItems.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE).map((item) => (
                            <article className={styles.printCard} data-qr-id={item.id} key={item.id}>
                                <h2>{item.name}</h2>
                                {item.subtitle && <p>{item.subtitle}</p>}
                                <div><QRCode value={item.url} size={180} fgColor="#000000" /></div>
                            </article>
                        ))}
                    </section>
                ))}
            </div>
        </div>
    );
}
