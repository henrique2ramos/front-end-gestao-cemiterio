import { AlertCircle, ChevronLeft, ChevronRight, Edit, Eye, MoreVertical, Plus, QrCode, Search, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import Spinner from '../../components/Spinner';
import personPlaceholder from '../../assets/person-placeholder.svg';
import styles from './AdminQuadrasLotes.module.css';

export default function AdminLotes({
    lotesComCount,
    lotesVisiveis,
    lotesDaPagina,
    lotesDaQuadra,
    lotesPerPage,
    carregandoLotes,
    lotesVazios,
    lotesComUmFalecido,
    lotesComMultiplosFalecidos,
    totalFalecidosNosLotes,
    totalLotePages,
    paginaLoteAtual,
    setCurrentLotePage,
    lotSearchTerm,
    setLotSearchTerm,
    lotOccupancyFilter,
    setLotOccupancyFilter,
    primeiroLoteDaPagina,
    ultimoLoteDaPagina,
    onSelectLote,
    selectedQuadra,
    selectedLote,
    setSelectedLote,
    loteSelecionado,
    indiceLoteSelecionado,
    memoriaisDoLote,
    lotActionsMenuRef,
    onOpenLoteQrModal,
    onOpenLoteModal,
    onDeleteLote,
    onAddFalecido,
    isLoading,
    currentMemoriais,
    viewFalecido,
    onViewFalecido,
    onOpenQrModal,
    onOpenEditModal,
    onDeleteFalecido,
    totalPages,
    startIndex,
    itemsPerPage = 10,
    filteredMemoriais,
    currentPage,
    setCurrentPage,
    getPageItems,
}) {
    const selectedLotPanelRef = useRef(null);

    useEffect(() => {
        if (!selectedLote) return;

        const frame = window.requestAnimationFrame(() => {
            selectedLotPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [selectedLote]);

    return (
        <>
            <section className={styles.lotExplorer}>
                <div className={styles.lotToolsCard}>
<div className={styles.lotControls}>
                    <label className={styles.rangeSelectLabel}>
                        <span className={styles.visuallyHidden}>Faixa de lotes</span>
                        <select value={paginaLoteAtual} onChange={(event) => setCurrentLotePage(Number(event.target.value))} disabled={carregandoLotes || totalLotePages <= 1}>
                            {lotesVisiveis.length === 0
                                ? <option value="1">Nenhum lote</option>
                                : Array.from({ length: totalLotePages }, (_, index) => {
                                    const first = lotesVisiveis[index * lotesPerPage]?.nome;
                                    const last = lotesVisiveis[Math.min((index + 1) * lotesPerPage, lotesVisiveis.length) - 1]?.nome;
                                    return <option key={index + 1} value={index + 1}>Lotes {first} a {last}</option>;
                                })}
                        </select>
                    </label>
                    <div className={styles.lotSearchField}>
                    <Search size={18} aria-hidden="true" />
                    <input type="text" placeholder="Buscar lote pelo número..." aria-label="Buscar lote pelo número" value={lotSearchTerm} onChange={(event) => { setLotSearchTerm(event.target.value); setCurrentLotePage(1); }} />
                    {lotSearchTerm && <button type="button" aria-label="Limpar busca de lotes" onClick={() => { setLotSearchTerm(''); setCurrentLotePage(1); }}><X size={16} /></button>}
                    </div>
                </div>

                <div className={styles.lotSummaryLegend}>
                    <button type="button" className={`${styles.lotLegendFilter} ${lotOccupancyFilter === 'all' ? styles.lotLegendFilterActive : ''}`} aria-pressed={lotOccupancyFilter === 'all'} onClick={() => { setLotOccupancyFilter('all'); setCurrentLotePage(1); }}>
                        Todos <strong>{lotesComCount.length}</strong>
                    </button>
                    <button type="button" className={`${styles.lotLegendFilter} ${lotOccupancyFilter === 'one' ? styles.lotLegendFilterActive : ''}`} aria-pressed={lotOccupancyFilter === 'one'} onClick={() => { setLotOccupancyFilter('one'); setCurrentLotePage(1); }}>
                        <i className={styles.legendOccupied} />1 falecido <strong>{lotesComUmFalecido}</strong>
                    </button>
                    <button type="button" className={`${styles.lotLegendFilter} ${lotOccupancyFilter === 'multiple' ? styles.lotLegendFilterActive : ''}`} aria-pressed={lotOccupancyFilter === 'multiple'} onClick={() => { setLotOccupancyFilter('multiple'); setCurrentLotePage(1); }}>
                        <i className={styles.legendMultiple} />2 ou mais falecidos <strong>{lotesComMultiplosFalecidos}</strong>
                    </button>
                    <button type="button" className={`${styles.lotLegendFilter} ${lotOccupancyFilter === 'empty' ? styles.lotLegendFilterActive : ''}`} aria-pressed={lotOccupancyFilter === 'empty'} onClick={() => { setLotOccupancyFilter('empty'); setCurrentLotePage(1); }}>
                        <i className={styles.legendEmpty} />Vazios <strong>{lotesVazios}</strong>
                    </button>
                    <div className={styles.lotSummaryTotals}>
                        <span>{totalFalecidosNosLotes} {totalFalecidosNosLotes === 1 ? 'falecido' : 'falecidos'} no total</span>
                    </div>

                </div>

                </div>

                <div className={styles.lotNumberGrid} aria-label="Mapa de lotes">
                    {lotesDaPagina.map((lote) => (
                        <button
                            key={lote.id}
                            type="button"
                            className={`${styles.lotNumberTile} ${lote.count === 0 ? styles.lotEmpty : lote.count > 1 ? styles.lotMultiple : styles.lotOccupied} ${String(selectedLote) === String(lote.nome) ? styles.lotSelected : ''}`}
                            aria-label={`Lote ${lote.nome}, ${lote.count} ${lote.count === 1 ? 'falecido' : 'falecidos'}`}
                            onClick={() => onSelectLote(lote.nome)}
                        >
                            {lote.nome}
                        </button>
                    ))}
                    {carregandoLotes && <div className={styles.lotGridState}><Spinner size={30} label="Carregando lotes da quadra..." /></div>}
                    {!carregandoLotes && lotesComCount.length === 0 && (
                        <div className={styles.lotGridState}>
                            <span className={styles.lotGridStateIcon}><AlertCircle size={20} /></span>
                            <span className={styles.lotGridStateText}><strong>Esta quadra ainda não tem lotes</strong><span>Cadastre um lote para começar.</span></span>
                        </div>
                    )}
                    {!carregandoLotes && lotesVisiveis.length === 0 && lotesComCount.length > 0 && (
                        <div className={styles.lotGridState}>
                            <span className={styles.lotGridStateIcon}><AlertCircle size={20} /></span>
                            <span className={styles.lotGridStateText}>
                                <strong>{lotOccupancyFilter === 'empty' && !lotSearchTerm.trim() ? 'Não há lotes vazios nesta quadra' : 'Nenhum lote corresponde à busca'}</strong>
                                <span>{lotOccupancyFilter === 'empty' && !lotSearchTerm.trim() ? 'Todos os lotes desta quadra já estão ocupados.' : 'Tente outro número ou limpe a busca.'}</span>
                            </span>
                        </div>
                    )}
                </div>

                {!carregandoLotes && lotesDaPagina.length > 0 && (
                    <div className={styles.lotPagination}>
                        <p className={styles.rangeCaption}>Exibindo lotes {primeiroLoteDaPagina} a {ultimoLoteDaPagina} de {lotesVisiveis.length}</p>
                        {totalLotePages > 1 && (
                            <div className={styles.pagination} aria-label="Paginação dos lotes">
                                <button className={styles.pageBtn} disabled={paginaLoteAtual === 1} onClick={() => setCurrentLotePage((page) => Math.max(1, page - 1))} aria-label="Página anterior"><ChevronLeft size={18} /></button>
                                {getPageItems(paginaLoteAtual, totalLotePages).map((page, index) => page === '…'
                                    ? <span key={`lot-page-gap-${index}`} className={styles.pageEllipsis}>…</span>
                                    : <button key={page} className={`${styles.pageBtn} ${page === paginaLoteAtual ? styles.pageBtnActive : ''}`} onClick={() => setCurrentLotePage(page)} aria-label={`Página ${page}`}>{page}</button>)}
                                <button className={styles.pageBtn} disabled={paginaLoteAtual === totalLotePages} onClick={() => setCurrentLotePage((page) => Math.min(totalLotePages, page + 1))} aria-label="Próxima página"><ChevronRight size={18} /></button>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <div className={styles.selectedLotInline}>
                <section ref={selectedLotPanelRef} className={`${styles.selectedLotPanel} ${!selectedLote ? styles.selectedLotEmpty : ''}`} aria-label="Detalhes do lote selecionado">
                    {!selectedLote ? (
                        <p className={styles.lotPanelHint}>Selecione um lote no mapa acima para ver os falecidos dele.</p>
                    ) : (
                        <>
                        <div className={styles.selectedLotHeader}>
                            <div className={styles.selectedLotIdentity}>
                                <span className={`${styles.selectedLotMarker} ${memoriaisDoLote.length > 1 ? styles.selectedLotMarkerMultiple : memoriaisDoLote.length === 1 ? styles.selectedLotMarkerOccupied : styles.selectedLotMarkerEmpty}`} aria-hidden="true">
                                    {selectedLote}
                                </span>
                                <div className={styles.selectedLotTitle}>
                                    <h2 id="selected-lot-title">Lote {selectedLote}</h2>
                                    <p className={styles.lotCountBadge}>{memoriaisDoLote.length} {memoriaisDoLote.length === 1 ? 'falecido' : 'falecidos'}</p>
                                </div>
                                <div className={styles.lotNavigationGroup}>
                                    <div className={styles.lotHeaderActions}>
                                        <button type="button" className={styles.addButton} aria-label="Adicionar falecido" onClick={onAddFalecido}><Plus size={17} /><span className={styles.lotAddLabel}>Adicionar falecido</span></button>
                                        <button type="button" title="Gerar QR Code" className={`${styles.lotActionButton} ${styles.lotQrButton}`} onClick={() => { if (loteSelecionado) onOpenLoteQrModal({ id: loteSelecionado.id, nome: selectedLote }); }}><QrCode size={17} /></button>
                                        <details className={styles.lotActionsMenu} ref={lotActionsMenuRef}>
                                            <summary className={styles.lotMenuTrigger} aria-label="Mais ações do lote" title="Mais ações"><MoreVertical size={19} /></summary>
                                            <div className={styles.lotMenuPanel}>
                                                <button type="button" className={styles.lotMenuQr} onClick={(event) => { event.currentTarget.closest('details').open = false; if (loteSelecionado) onOpenLoteQrModal({ id: loteSelecionado.id, nome: selectedLote }); }}><QrCode size={17} /><span>QR Code</span></button>
                                                <button type="button" onClick={(event) => { event.currentTarget.closest('details').open = false; onOpenLoteModal(selectedLote); }}><Edit size={17} /><span>Editar lote</span></button>
                                                <button type="button" className={styles.lotMenuDelete} onClick={(event) => { event.currentTarget.closest('details').open = false; onDeleteLote(selectedLote); }}><Trash2 size={17} /><span>Excluir lote</span></button>
                                            </div>
                                        </details>
                                    </div>
                                    <div className={styles.lotHeaderNavigation}>
                                        <button type="button" className={styles.lotNavBtn} aria-label="Lote anterior" title="Lote anterior" disabled={indiceLoteSelecionado <= 0} onClick={() => onSelectLote(lotesDaQuadra[indiceLoteSelecionado - 1]?.numero || lotesDaQuadra[indiceLoteSelecionado - 1]?.nome)}><ChevronLeft size={18} /></button>
                                        <button type="button" className={styles.lotNavBtn} aria-label="Próximo lote" title="Próximo lote" disabled={indiceLoteSelecionado < 0 || indiceLoteSelecionado >= lotesDaQuadra.length - 1} onClick={() => onSelectLote(lotesDaQuadra[indiceLoteSelecionado + 1]?.numero || lotesDaQuadra[indiceLoteSelecionado + 1]?.nome)}><ChevronRight size={18} /></button>
                                        <button type="button" className={styles.lotCloseButton} aria-label="Fechar detalhes do lote" onClick={() => setSelectedLote(null)}><X size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.lotPeopleList}>
                            {isLoading && <p className={styles.lotPersonEmpty}>Carregando falecidos...</p>}
                            {!isLoading && currentMemoriais.map((falecido) => (
                                <div key={falecido.id} className={styles.lotPersonRow}>
                                    <button type="button" className={styles.lotPersonDetails} onClick={() => onViewFalecido(falecido)}>
                                        <span className={styles.lotPersonAvatar}>
                                            <img src={falecido.imagem || personPlaceholder} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
                                        </span>
                                        <span className={styles.lotPersonText}>
                                            <strong>{falecido.nome}</strong>
                                            <span>{falecido.dataNascimento || '—'} — {falecido.dataMorte || '—'}</span>
                                        </span>
                                    </button>
                                    <div className={styles.lotPersonActions}>
                                        <button className={styles.iconBtn} title="Gerar QR Code" aria-label={`QR Code de ${falecido.nome}`} onClick={() => onOpenQrModal(falecido)}><QrCode size={17} /></button>
                                        <button className={styles.iconBtn} title="Visualizar dados" aria-label={`Visualizar dados de ${falecido.nome}`} onClick={() => onViewFalecido(falecido)}><Eye size={17} /></button>
                                        <button className={styles.iconBtn} title="Editar" aria-label={`Editar ${falecido.nome}`} onClick={() => onOpenEditModal(falecido)}><Edit size={17} /></button>
                                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Excluir" aria-label={`Excluir ${falecido.nome}`} onClick={() => onDeleteFalecido(falecido.id, falecido.nome)}><Trash2 size={17} /></button>
                                    </div>
                                </div>
                            ))}
                            {!isLoading && currentMemoriais.length === 0 && <p className={styles.lotPersonEmpty}>Nenhum falecido cadastrado neste lote.</p>}
                        </div>

                        {totalPages > 1 && (
                            <div className={styles.paginationContainer}>
                                <p className={styles.paginationInfo}>Mostrando <strong>{startIndex + 1}</strong> a <strong>{Math.min(startIndex + itemsPerPage, filteredMemoriais.length)}</strong> de <strong>{filteredMemoriais.length}</strong></p>
                                <div className={styles.pagination}>
                                    <button className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button>
                                    {getPageItems(currentPage, totalPages).map((page, index) => page === '…'
                                        ? <span key={`gap-${index}`} className={styles.pageEllipsis}>…</span>
                                        : <button key={page} className={`${styles.pageBtn} ${page === currentPage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>)}
                                    <button className={styles.pageBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)} aria-label="Próxima página"><ChevronRight size={18} /></button>
                                </div>
                            </div>
                        )}

                        </>
                    )}
                </section>
            </div>
        </>
    );
}


