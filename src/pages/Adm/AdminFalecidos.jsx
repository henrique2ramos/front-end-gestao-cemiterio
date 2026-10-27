import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Edit, Trash2, Search, X, QrCode, Eye, ChevronLeft, ChevronRight, AlertCircle, Printer } from 'lucide-react';
import QRCode from 'react-qr-code';
import {
    fetchFalecidos,
    createFalecido,
    updateFalecido as apiUpdateFalecido,
    deleteFalecido as apiDeleteFalecido,
    resolveImageUrl,
    fetchQuadras,
    fetchLotes
} from '../../lib/api';
import AdminSidebar from './AdminSidebar';
import CopyLinkButton from '../../components/CopyLinkButton';
import FalecidoFormModal from '../../components/FalecidoFormModal';
import FalecidoDetailsModal from '../../components/FalecidoDetailsModal';
import QrImageDownloadButtons from '../../components/QrImageDownloadButtons';
import { getPageItems } from './../../data/adminPagination';
import styles from './AdminFalecidos.module.css';
import personPlaceholder from '../../assets/person-placeholder.svg';

const EMPTY_FORM = {
    nome: '', dataNascimento: '', dataMorte: '',
    setor: '', lote: '',
    descricao: '', biografia: '', tipo: 'historica'
};

const getToken = () => localStorage.getItem('memorialAdminToken') || '';

const isAbsoluteUrl = (src) => /^(https?:)?\/\//i.test(src) || src.startsWith('data:');
const resolveOnce = (src) => (!src || isAbsoluteUrl(src) ? src : resolveImageUrl(src));
const normalizeGallery = (item) => {
    const raw = [item.galeria, item.fotosGaleria, item.imagensGaleria, item.photos, item.gallery]
        .find((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
    let entries = raw;
    if (typeof entries === 'string') {
        try {
            const parsed = JSON.parse(entries);
            entries = Array.isArray(parsed) ? parsed : [entries];
        } catch {
            entries = entries.trim() ? [entries] : [];
        }
    } else if (!Array.isArray(entries)) {
        entries = entries ? [entries] : [];
    }
    return entries.map((entry) => typeof entry === 'string' ? entry : entry?.url || entry?.src || entry?.path || entry?.imagem || entry?.image || '')
        .map(resolveOnce)
        .filter(Boolean);
};
const parseLocalizacao = (value = '') => ({
    quadra: value.match(/Quadra\s+(.+?)(?:,|$)/i)?.[1]?.trim() || '',
    lote: value.match(/Lote\s+(.+?)$/i)?.[1]?.trim() || '',
});

export default function AdminFalecidos({ onLogout }) {
    const location = useLocation();
    const [falecidos, setFalecidos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(location.state?.search || '');
    const [debouncedSearch, setDebouncedSearch] = useState(location.state?.search || '');
    const [filterQuadra, setFilterQuadra] = useState('');
    const [filterLote, setFilterLote] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [reloadKey, setReloadKey] = useState(0);
    const nascimentoDatePickerRef = useRef(null);
    const morteDatePickerRef = useRef(null);
    const imageInputRef = useRef(null);
    const qrCodeBoxRef = useRef(null);
    const [quadrasDisponiveis, setQuadrasDisponiveis] = useState([]);
    const [lotesDisponiveis, setLotesDisponiveis] = useState([]);
    const [falecidosPorQuadra, setFalecidosPorQuadra] = useState({});

    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [imageRemoved, setImageRemoved] = useState(false);
    const [selectedGalleryFiles, setSelectedGalleryFiles] = useState([]);

    const [isFormModalOpen, setIsFormModalOpen] = useState(Boolean(location.state?.novo));
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [selectedFalecido, setSelectedFalecido] = useState(null);
    const [viewFalecido, setViewFalecido] = useState(null);

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

    const openConfirm = (title, message, onConfirm) => setConfirmModal({ open: true, title, message, onConfirm });
    const closeConfirm = () => setConfirmModal({ open: false, title: '', message: '', onConfirm: null });

    const normalizeFalecidosFromApi = (items) => items.map((item) => {
        const galeria = normalizeGallery(item);
        return {
            ...item,
            localizacao: item.localizacao || '',
            tipo: item.tipo || 'historica',
            imagem: resolveOnce(item.imagem) || galeria[0] || personPlaceholder,
            galeria,
            descricao: item.descricao || '',
            dataNascimento: item.dataNascimento || '',
            dataMorte: item.dataMorte || '',
        };
    });
    useEffect(() => {
        fetchQuadras().then(res => {
            const arr = Array.isArray(res) ? res : res?.items || [];
            setQuadrasDisponiveis(arr);
        }).catch(e => console.error("Erro ao buscar quadras:", e));
    }, []);
    useEffect(() => {
        const quadraEncontrada = quadrasDisponiveis.find(q => q.nome === formData.setor);
        if (quadraEncontrada) {
            fetchLotes(quadraEncontrada.id, { page: 1, limit: 1000 }).then(res => {
                const arr = Array.isArray(res) ? res : res?.items || [];
                setLotesDisponiveis(arr);
            }).catch(e => console.error("Erro ao buscar lotes:", e));
        }
    }, [formData.setor, quadrasDisponiveis]);

    useEffect(() => {
        if (location.state?.search || location.state?.novo) window.history.replaceState({}, '');
    }, [location.state]);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => {
        let cancelado = false;

        async function loadPage() {
            try {
                const res = await fetchFalecidos();
                const term = debouncedSearch.trim().toLocaleLowerCase('pt-BR');
                const quadraTerm = filterQuadra.trim().toLocaleLowerCase('pt-BR');
                const loteTerm = filterLote.trim().toLocaleLowerCase('pt-BR');
                const counts = {};
                res.forEach((item) => {
                    const nome = String(item.nome || '').toLocaleLowerCase('pt-BR');
                    const { quadra, lote } = parseLocalizacao(item.localizacao || '');
                    if ((!term || nome.includes(term)) && (!loteTerm || lote.toLocaleLowerCase('pt-BR') === loteTerm) && quadra) {
                        const key = quadra.toLocaleLowerCase('pt-BR');
                        counts[key] = (counts[key] || 0) + 1;
                    }
                });
                const filtered = res.filter((item) => {
                    const nome = String(item.nome || '').toLocaleLowerCase('pt-BR');
                    const { quadra, lote } = parseLocalizacao(item.localizacao || '');
                    return (!term || nome.includes(term))
                        && (!quadraTerm || quadra.toLocaleLowerCase('pt-BR') === quadraTerm)
                        && (!loteTerm || lote.toLocaleLowerCase('pt-BR') === loteTerm);
                });
                const nextTotal = filtered.length;
                const nextTotalPages = Math.max(1, Math.ceil(nextTotal / itemsPerPage));
                const pageItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                if (cancelado) return;
                setFalecidosPorQuadra(counts);
                setFalecidos(normalizeFalecidosFromApi(pageItems));
                setTotal(nextTotal);
                setTotalPages(nextTotalPages);
                if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
            } catch (error) {
                console.error('Erro ao buscar falecidos:', error);
                if (!cancelado) { setFalecidos([]); setTotal(0); setTotalPages(1); }
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        }

        loadPage();
        return () => { cancelado = true; };
    }, [currentPage, debouncedSearch, filterQuadra, filterLote, itemsPerPage, reloadKey]);

    const reload = () => {
        setIsLoading(true);
        setReloadKey((k) => k + 1);
    };

    const handleSearchChange = (value) => {
        setIsLoading(true);
        setSearchTerm(value);
    };

    const handleQuadraFilterChange = (value) => {
        setIsLoading(true);
        setCurrentPage(1);
        setFilterQuadra(value);
        setFilterLote('');
    };

    const handleLoteFilterChange = (value) => {
        setIsLoading(true);
        setCurrentPage(1);
        setFilterLote(value);
    };

    const changePage = (page) => {
        setIsLoading(true);
        setCurrentPage(page);
    };

    const changeItemsPerPage = (value) => {
        setIsLoading(true);
        setCurrentPage(1);
        setItemsPerPage(Number(value));
    };

    const startIndex = (currentPage - 1) * itemsPerPage;

    const saveFalecido = async (e) => {
        e.preventDefault();
        const token = getToken();
        const setor = (formData.setor || '').trim();
        const lote = (formData.lote || '').trim();
        const localizacao = setor || lote ? `Quadra ${setor}, Lote ${lote}` : '';

        try {
            const form = new FormData();
            form.append('nome', formData.nome || '');
            form.append('biografia', formData.biografia || '');
            form.append('descricao', formData.descricao || '');
            form.append('dataNascimento', formData.dataNascimento || '');
            form.append('dataMorte', formData.dataMorte || '');
            form.append('localizacao', localizacao);
            form.append('tipo', formData.tipo || 'historica');

            if (selectedImageFile) form.append('imagem', selectedImageFile);
            else if (imageRemoved) form.append('imagem', '');
            selectedGalleryFiles.forEach((file) => form.append('galeria', file));

            const payload = selectedImageFile || selectedGalleryFiles.length > 0 || imageRemoved
                ? form
                : {
                    nome: formData.nome || '',
                    biografia: formData.biografia || '',
                    descricao: formData.descricao || '',
                    dataNascimento: formData.dataNascimento || '',
                    dataMorte: formData.dataMorte || '',
                    localizacao,
                    tipo: formData.tipo || 'historica',
                };

            if (selectedFalecido) {
                await apiUpdateFalecido(selectedFalecido.id, payload, token);
            } else {
                await createFalecido(payload, token);
            }

            closeFormModal();
            reload();
        } catch (error) {
            window.alert(error.message || 'Não foi possível salvar o falecido.');
        }
    };

    const deleteFalecido = (id, nome) => {
        openConfirm(
            'Excluir registro',
            <>Tem certeza que deseja <strong className={styles.confirmEmphasis}>excluir permanentemente</strong> o registro de <strong className={styles.confirmEmphasis}>{nome}</strong>? Esta ação <strong className={styles.confirmEmphasis}>não pode ser desfeita</strong>.</>,
            async () => {
                try {
                    await apiDeleteFalecido(id, getToken());
                    reload();
                } catch (error) {
                    window.alert(error.message || 'Não foi possível excluir o falecido.');
                }
            }
        );
    };
    const formatarData = (valor = '') => {
        const isoDate = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoDate) {
            const [, ano, mes, dia] = isoDate;
            return `${dia}/${mes}/${ano}`;
        }
        const n = valor.replace(/\D/g, '').slice(0, 8);
        if (n.length <= 2) return n;
        if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
        return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
    };

    const dataParaInput = (valor = '') => {
        const isoDate = valor.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoDate) return isoDate[1];
        const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let v = value;
        if (name === 'dataNascimento' || name === 'dataMorte') v = formatarData(value);
        else if (name === 'setor') v = value.toUpperCase();
        setFormData(prev => ({ ...prev, [name]: v }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0] || null;
        setSelectedImageFile(file);
        setImageRemoved(false);
        if (!file) {
            setImagePreview(selectedFalecido?.imagem || '');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsDataURL(file);
    };

    const abrirCalendario = (ref) => {
        const input = ref.current;
        if (!input) return;
        try {
            if (typeof input.showPicker === 'function') input.showPicker();
            else input.click();
        } catch {
            input.click();
        }
    };
    const handleGalleryUpload = (files) => setSelectedGalleryFiles((current) => [...current, ...files].slice(0, 10));
    const removeGalleryImage = (index) => setSelectedGalleryFiles((files) => files.filter((_, fileIndex) => fileIndex !== index));

    const openNewModal = () => {
        setSelectedFalecido(null);
        setSelectedImageFile(null);
        setImageRemoved(false);
        setSelectedGalleryFiles([]);
        setLotesDisponiveis([]);
        setImagePreview('');
        setFormData(EMPTY_FORM);
        setIsFormModalOpen(true);
    };

    const openEditModal = (falecido) => {
        setSelectedFalecido(falecido);
        setImageRemoved(false);
        setLotesDisponiveis([]);
        let setor = '', lote = '';
        if (falecido.localizacao) {
            const s = falecido.localizacao.match(/Quadra\s+(.+?),/i);
            const l = falecido.localizacao.match(/Lote\s+(.+?)$/i);
            if (s) setor = s[1].trim();
            if (l) lote = l[1].trim();
        }
        setFormData({ ...falecido, setor, lote });
        setSelectedImageFile(null);
        setImagePreview(falecido.imagem || '');
        setIsFormModalOpen(true);
    };

    const closeFormModal = () => {
        setSelectedFalecido(null);
        setSelectedImageFile(null);
        setImageRemoved(false);
        setSelectedGalleryFiles([]);
        setImagePreview('');
        setFormData(EMPTY_FORM);
        setIsFormModalOpen(false);
    };

    const removeProfileImage = () => {
        setSelectedImageFile(null);
        setImagePreview('');
        setImageRemoved(Boolean(selectedFalecido?.imagem && selectedFalecido.imagem !== personPlaceholder) || Boolean(selectedImageFile));
        setFormData((current) => ({ ...current, imagem: '' }));
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const openQrModal = (falecido) => {
        setSelectedFalecido(falecido);
        setIsQrModalOpen(true);
    };

    const qrCodeUrl = selectedFalecido ? `${window.location.origin}/falecidos/${selectedFalecido.id}` : '';

    return (
        <div className={styles.adminLayout}>
            <AdminSidebar onLogout={onLogout} />

            <main className={styles.mainContent}>
                <div className={styles.container}>
                    <header className={styles.header}>
                        <div>
                            <h1 className={styles.title}>Falecidos</h1>
                            <p className={styles.subtitle}>Gerencie registros, biografias e gere QR Codes.</p>
                        </div>
                        <button className={styles.addButton} onClick={openNewModal}>
                            <Plus size={20} />
                            Novo Falecido
                        </button>
                    </header>

                    <div className={styles.card}>
                        <div className={styles.toolbar}>
                            <div className={styles.searchFilters}>
                                <label className={styles.searchFilterField}>
                                    <span>Nome</span>
                                    <div className={styles.searchBox}>
                                        <Search size={18} className={styles.searchIcon} />
                                        <input
                                            type="text"
                                            placeholder="Buscar falecido pelo nome..."
                                            value={searchTerm}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                        />
                                        {searchTerm && (
                                            <button type="button" className={styles.clearSearchBtn} aria-label="Limpar busca" onClick={() => handleSearchChange('')}>
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </label>
                                <label className={styles.searchFilterField}>
                                    <span>Quadra</span>
                                    <select value={filterQuadra} onChange={(event) => handleQuadraFilterChange(event.target.value)}>
                                        <option value="">Todas as quadras</option>
                                        {quadrasDisponiveis.map((quadra) => <option key={quadra.id ?? quadra.nome} value={quadra.nome}>{`Quadra ${quadra.nome} (${falecidosPorQuadra[String(quadra.nome).toLocaleLowerCase('pt-BR')] || 0})`}</option>)}
                                    </select>
                                </label>
                                <label className={styles.searchFilterField}>
                                    <span>Lote</span>
                                    <input
                                        type="search"
                                        value={filterLote}
                                        onChange={(event) => handleLoteFilterChange(event.target.value)}
                                        placeholder={filterQuadra ? 'Digite o número do lote' : 'Selecione uma quadra primeiro'}
                                        disabled={!filterQuadra}
                                    />
                                </label>
                            </div>
                            {(searchTerm.trim() || filterQuadra || filterLote) && <div className={styles.filterChips} aria-label="Filtros ativos">
                                {searchTerm.trim() && <span className={styles.filterChip}>
                                    Nome: “{searchTerm.trim()}”
                                    <button type="button" aria-label="Remover filtro de nome" onClick={() => handleSearchChange('')}><X size={13} /></button>
                                </span>}
                                {filterQuadra && <span className={styles.filterChip}>
                                    Quadra {filterQuadra}
                                    <button type="button" aria-label="Remover filtro de quadra" onClick={() => handleQuadraFilterChange('')}><X size={13} /></button>
                                </span>}
                                {filterLote && <span className={styles.filterChip}>
                                    Lote {filterLote}
                                    <button type="button" aria-label="Remover filtro de lote" onClick={() => handleLoteFilterChange('')}><X size={13} /></button>
                                </span>}
                                {[searchTerm.trim(), filterQuadra, filterLote].filter(Boolean).length > 1 && <button type="button" className={styles.clearFilterChips} onClick={() => {
                                    handleSearchChange('');
                                    handleQuadraFilterChange('');
                                    handleLoteFilterChange('');
                                }}>Limpar tudo</button>}
                            </div>}
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <colgroup>
                                    <col className={styles.nameColumn} />
                                    <col className={styles.quadraColumn} />
                                    <col className={styles.loteColumn} />
                                    <col className={styles.typeColumn} />
                                    <col className={styles.actionsColumn} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Falecido</th>
                                        <th>Quadra</th>
                                        <th>Lote</th>
                                        <th>Tipo</th>
                                        <th className={styles.actionsColumn}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="5" className={styles.emptyState}>Carregando registros...</td>
                                        </tr>
                                    ) : (
                                        <>
                                            {falecidos.map(falecido => {
                                                const { quadra, lote } = parseLocalizacao(falecido.localizacao);
                                                return (
                                                <tr key={falecido.id} className={styles.tableRow}>
                                                    <td className={styles.nameCell}>
                                                        <div className={styles.nameCellContent}>
                                                        <div className={styles.avatar}>
                                                            <img src={falecido.imagem} alt={falecido.nome} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
                                                        </div>
                                                        <div className={styles.personInfo}>
                                                            <span className={styles.name}>{falecido.nome}</span>
                                                            <span className={styles.dateCell}>
                                                                {falecido.dataNascimento || '—'} — {falecido.dataMorte || '—'}
                                                            </span>
                                                        </div>
                                                        </div>
                                                    </td>
                                                    <td>{quadra ? <span className={styles.quadraValue}>{quadra}</span> : <span className={styles.emptyLocation}>—</span>}</td>
                                                    <td className={styles.loteValue}>{lote || <span className={styles.emptyLocation}>—</span>}</td>
                                                    <td>
                                                        <span className={`${styles.badge} ${falecido.tipo === 'historica' ? styles.badgeHist : styles.badgeRec}`}>
                                                            {falecido.tipo === 'historica' ? 'Histórico' : 'Recente'}
                                                        </span>
                                                    </td>
                                                    <td className={styles.actionsCell}>
                                                        <div className={styles.actionButtonsGroup}>
                                                            <button className={styles.iconBtn} title="Gerar QR Code" onClick={() => openQrModal(falecido)}>
                                                                <QrCode size={18} />
                                                            </button>
                                                        <button className={styles.iconBtn} title="Visualizar dados" aria-label={`Visualizar dados de ${falecido.nome}`} onClick={() => setViewFalecido(falecido)}>
                                                            <Eye size={18} />
                                                        </button>
                                                            <button className={styles.iconBtn} title="Editar" onClick={() => openEditModal(falecido)}>
                                                                <Edit size={18} />
                                                            </button>
                                                            <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Excluir" onClick={() => deleteFalecido(falecido.id, falecido.nome)}>
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                            {falecidos.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className={styles.emptyState}>Nenhum falecido encontrado.</td>
                                                </tr>
                                            )}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {!isLoading && total > 0 && (
                            <div className={styles.paginationContainer}>
                                <p className={styles.paginationInfo}>
                                    Mostrando <strong>{startIndex + 1}</strong> a <strong>{Math.min(startIndex + falecidos.length, total)}</strong> de <strong>{total}</strong> registros
                                </p>
                                <div className={styles.paginationControls}>
                                    <label className={styles.pageSizeControl}>
                                        <span>Por página</span>
                                        <select value={itemsPerPage} onChange={(event) => changeItemsPerPage(event.target.value)}>
                                            {[10, 25, 50, 100].map((size) => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                    </label>
                                    {totalPages > 1 && <div className={styles.pagination}>
                                    <button
                                        className={styles.pageBtn}
                                        disabled={currentPage === 1}
                                        onClick={() => changePage(currentPage - 1)}
                                    >
                                        <ChevronLeft size={18} />
                                    </button>

                                    {getPageItems(currentPage, totalPages).map((page, i) => (
                                        page === '…'
                                            ? <span key={`gap-${i}`} className={styles.pageEllipsis}>…</span>
                                            : (
                                                <button
                                                    key={page}
                                                    className={`${styles.pageBtn} ${page === currentPage ? styles.pageBtnActive : ''}`}
                                                    onClick={() => changePage(page)}
                                                >
                                                    {page}
                                                </button>
                                            )
                                    ))}

                                    <button
                                        className={styles.pageBtn}
                                        disabled={currentPage === totalPages}
                                        onClick={() => changePage(currentPage + 1)}
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                    </div>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {isFormModalOpen && (
                <FalecidoFormModal
                    selectedFalecido={selectedFalecido}
                    requiredFields
                    formData={formData}
                    onClose={closeFormModal}
                    onSubmit={saveFalecido}
                    onInputChange={handleInputChange}
                    setFormData={setFormData}
                    datePickerRefs={{ birth: nascimentoDatePickerRef, death: morteDatePickerRef }}
                    openCalendar={abrirCalendario}
                    dateToInput={dataParaInput}
                    formatDate={formatarData}
                    quadraOptions={quadrasDisponiveis.map((quadra) => quadra.nome)}
                    loteOptions={lotesDisponiveis.map((lote) => lote.numero || lote.nome || lote.id)}
                    onQuadraChange={(setor) => {
                        setLotesDisponiveis([]);
                        setFormData((current) => ({ ...current, setor: setor.toUpperCase(), lote: '' }));
                    }}
                    onLoteChange={(lote) => setFormData((current) => ({ ...current, lote }))}
                    imageInputRef={imageInputRef}
                    onImageUpload={handleImageUpload}
                    imagePreview={imagePreview}
                    resolveImage={resolveOnce}
                    imageRemoved={imageRemoved}
                    selectedImageFile={selectedImageFile}
                    selectedGalleryFiles={selectedGalleryFiles}
                    onRemoveImage={removeProfileImage}
                    onGalleryUpload={handleGalleryUpload}
                    onRemoveGalleryImage={removeGalleryImage}
                />
            )}

            {/* --- MODAL DE CONFIRMAÇÃO --- */}
            {confirmModal.open && (
                <div className={styles.modalOverlay} onClick={closeConfirm}>
                    <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.confirmIcon}>
                            <AlertCircle size={32} color="#dc2626" />
                        </div>
                        <h2 className={styles.confirmTitle}>{confirmModal.title}</h2>
                        <p className={styles.confirmMessage}>{confirmModal.message}</p>
                        <div className={styles.confirmActions}>
                            <button className={styles.cancelBtn} onClick={closeConfirm}>Cancelar</button>
                            <button
                                className={styles.deleteConfirmBtn}
                                onClick={() => { confirmModal.onConfirm?.(); closeConfirm(); }}
                            >
                                Excluir Permanentemente
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DO QR CODE --- */}
            {isQrModalOpen && selectedFalecido && (
                <div className={styles.modalOverlay} onClick={() => setIsQrModalOpen(false)}>
                    <div className={styles.modalContentSmall} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.qrHeader}>
                            <h2>{selectedFalecido.nome}</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Escaneie para acessar a página de <strong>{selectedFalecido.nome}</strong>{selectedFalecido.localizacao && <><br />{selectedFalecido.localizacao}</>}</p>
                            <div className={styles.qrCodeBox} ref={qrCodeBoxRef}>
                                <QRCode value={qrCodeUrl} size={200} fgColor="#000000" />
                            </div>
                            <div className={styles.qrCopyLinkRow}><CopyLinkButton url={qrCodeUrl} /></div>
                            <div className={styles.qrExportActions}>
                                <QrImageDownloadButtons className={styles.qrExportButtonGroup} containerRef={qrCodeBoxRef} fileName={`falecido-${selectedFalecido.nome}-${selectedFalecido.localizacao || ''}`} title={selectedFalecido.nome} subtitle={selectedFalecido.localizacao || ''} />
                                <button className={styles.saveBtn} onClick={() => window.print()}><Printer size={16} /> Imprimir Placa</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <FalecidoDetailsModal falecido={viewFalecido} onClose={() => setViewFalecido(null)} />
        </div>
    );
}
