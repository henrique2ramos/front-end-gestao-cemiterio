import { ChevronRight, Edit, LayoutGrid, MoreVertical, QrCode, Trash2 } from 'lucide-react';
import Spinner from '../../components/Spinner';
import styles from './AdminQuadrasLotes.module.css';

export default function AdminQuadras({ quadras, carregando, onSelect, onQrCode, onEdit, onDelete }) {
    return (
        <div className={styles.setoresGrid}>
            {quadras.map((quadra) => (
                <div key={quadra.nome} className={styles.setorCard}>
                    <button
                        type="button"
                        className={styles.setorCardBtn}
                        aria-label={`Abrir Quadra ${quadra.nome}, ${quadra.count} ${quadra.count === 1 ? 'lote' : 'lotes'}`}
                        onClick={() => onSelect(quadra.nome)}
                    >
                        <span className={styles.setorIcon}><LayoutGrid size={25} /></span>
                        <span className={styles.setorInfo}>
                            <h3>Quadra {quadra.nome}</h3>
                            <span className={styles.setorLotCount}>{quadra.count} {quadra.count === 1 ? 'lote cadastrado' : 'lotes cadastrados'}</span>
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
        </div>
    );
}
