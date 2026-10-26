import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit, MoreVertical, QrCode, Trash2 } from 'lucide-react';
import Spinner from '../../components/Spinner';
import styles from './AdminQuadrasLotes.module.css';

const QUADRAS_PER_PAGE = 8;

export default function AdminQuadras({ quadras, carregando, onSelect, onQrCode, onEdit, onDelete }) {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(quadras.length / QUADRAS_PER_PAGE));
    const quadrasDaPagina = quadras.slice((currentPage - 1) * QUADRAS_PER_PAGE, currentPage * QUADRAS_PER_PAGE);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    return (
        <div className={styles.setoresGrid}>
            {quadrasDaPagina.map((quadra) => (
                <div key={quadra.nome} className={styles.setorCard}>
                    <button
                        type="button"
                        className={styles.setorCardBtn}
                        aria-label={`Abrir Quadra ${quadra.nome}: ${quadra.count} ${quadra.count === 1 ? 'lote' : 'lotes'}, ${quadra.ocupados} ocupados e ${quadra.vazios} vazios`}
                        onClick={() => onSelect(quadra.nome)}
                    >
                        <span className={styles.setorIcon} aria-hidden="true">{String(quadra.nome).replace(/^Quadra\s*/i, '').trim().charAt(0).toUpperCase()}</span>
                        <span className={styles.setorInfo}>
                            <span className={styles.setorInfoHeader}>
                                <h3>Quadra {quadra.nome}</h3>
                                <span className={styles.setorLotCount}>{quadra.count} {quadra.count === 1 ? 'lote' : 'lotes'}</span>
                            </span>
                            <span className={styles.setorOccupancy}>
                                <span className={styles.setorOccupancyBarRow}>
                                    <span
                                    className={styles.setorOccupancyBar}
                                    role="meter"
                                    aria-label={`Ocupação da Quadra ${quadra.nome}`}
                                    aria-valuemin={0}
                                    aria-valuemax={Math.max(quadra.count, 1)}
                                    aria-valuenow={quadra.ocupados}
                                >
                                    <span style={{ width: `${quadra.count ? Math.min(100, Math.round((quadra.ocupados / quadra.count) * 100)) : 0}%` }} />
                                    </span>
                                    <strong className={styles.setorOccupancyPercent}>{quadra.count ? Math.round((quadra.ocupados / quadra.count) * 100) : 0}%</strong>
                                </span>
                                <span className={styles.setorLotStats}>
                                    <span><i className={styles.lotStatsOccupied} /><strong>{quadra.ocupados}</strong> ocupados</span>
                                    <span><i className={styles.lotStatsEmpty} /><strong>{quadra.vazios}</strong> vazios</span>
                                </span>
                            </span>
                        </span>
                        <ChevronRight className={styles.setorOpenIcon} size={19} aria-hidden="true" />
                    </button>
                    <details className={styles.cardActions} data-quadra-actions-menu>
                        <summary className={styles.lotMenuTrigger} aria-label={`Ações da Quadra ${quadra.nome}`} title="Ações da quadra"><MoreVertical size={19} /></summary>
                        <div className={styles.lotMenuPanel}>
                            <button type="button" onClick={(event) => { event.currentTarget.closest('details').open = false; onQrCode(quadra); }}><QrCode size={17} /><span>QR Code</span></button>
                            <button type="button" onClick={(event) => { event.currentTarget.closest('details').open = false; onEdit(quadra.nome); }}><Edit size={17} /><span>Editar quadra</span></button>
                            <button type="button" className={styles.lotMenuDelete} onClick={(event) => { event.currentTarget.closest('details').open = false; onDelete(quadra.nome); }}><Trash2 size={17} /><span>Excluir quadra</span></button>
                        </div>
                    </details>
                </div>
            ))}
            {carregando && <Spinner label="Carregando quadras..." />}
            {!carregando && quadras.length === 0 && (
                <p className={styles.emptyState}>Nenhuma quadra encontrada. Crie uma para começar.</p>
            )}
            {totalPages > 1 && <div className={styles.quadrasPagination} aria-label="Paginação das quadras">
                <span>{quadras.length} quadras · Página {currentPage} de {totalPages}</span>
                <div className={styles.pagination}>
                    <button type="button" className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} aria-label="Página anterior"><ChevronLeft size={18} /></button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                        <button type="button" key={page} className={`${styles.pageBtn} ${page === currentPage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentPage(page)} aria-current={page === currentPage ? 'page' : undefined}>{page}</button>
                    ))}
                    <button type="button" className={styles.pageBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} aria-label="Próxima página"><ChevronRight size={18} /></button>
                </div>
            </div>}
        </div>
    );
}
