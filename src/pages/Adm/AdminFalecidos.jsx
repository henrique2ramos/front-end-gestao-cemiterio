import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Edit, Trash2, Search, MapPin, X, QrCode, Eye, ChevronLeft, ChevronRight, AlertCircle, CalendarDays } from 'lucide-react';
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
import AutocompleteInput from '../../components/AutocompleteInput';
import FalecidoDetailsModal from '../../components/FalecidoDetailsModal';
import { unwrapPage, getPageItems } from './../../data/adminPagination';
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

export default function AdminFalecidos({ onLogout }) {
    const location = useLocation();
    const [falecidos, setFalecidos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(location.state?.search || '');
    const [debouncedSearch, setDebouncedSearch] = useState(location.state?.search || '');
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [reloadKey, setReloadKey] = useState(0);
    const nascimentoDatePickerRef = useRef(null);
    const morteDatePickerRef = useRef(null);
    const imageInputRef = useRef(null);
    const [quadrasDisponiveis, setQuadrasDisponiveis] = useState([]);
    const [lotesDisponiveis, setLotesDisponiveis] = useState([]);

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

    const normalizeFalecidosFromApi = (items) => items.map((item) => ({
        ...item,
        localizacao: item.localizacao || '',
        tipo: item.tipo || 'historica',
        imagem: resolveOnce(item.imagem || item.galeria?.[0]) || personPlaceholder,
        galeria: Array.isArray(item.galeria) ? item.galeria.filter(Boolean).map((src) => resolveOnce(src)) : [],
        descricao: item.descricao || item.biografia || '',
        dataNascimento: item.dataNascimento || '',
        dataMorte: item.dataMorte || '',
    }));
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
                const page = unwrapPage(res, { page: currentPage, limit: itemsPerPage, search: debouncedSearch });
                if (cancelado) return;
                setFalecidos(normalizeFalecidosFromApi(page.items));
                setTotal(page.total);
                setTotalPages(page.totalPages);
                if (currentPage > page.totalPages && page.totalPages > 0) setCurrentPage(page.totalPages);
            } catch (error) {
                console.error('Erro ao buscar falecidos:', error);
                if (!cancelado) { setFalecidos([]); setTotal(0); setTotalPages(1); }
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        }

        loadPage();
        return () => { cancelado = true; };
    }, [currentPage, debouncedSearch, itemsPerPage, reloadKey]);

    const reload = () => {
        setIsLoading(true);
        setReloadKey((k) => k + 1);
    };

    const handleSearchChange = (value) => {
        setIsLoading(true);
        setSearchTerm(value);
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
    const handleGalleryUpload = (e) => setSelectedGalleryFiles(Array.from(e.target.files || []));

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
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <colgroup>
                                    <col className={styles.nameColumn} />
                                    <col className={styles.locationColumn} />
                                    <col className={styles.typeColumn} />
                                    <col className={styles.actionsColumn} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Nome do Falecido</th>
                                        <th>Localização</th>
                                        <th>Tipo</th>
                                        <th className={styles.actionsColumn}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="4" className={styles.emptyState}>Carregando registros...</td>
                                        </tr>
                                    ) : (
                                        <>
                                            {falecidos.map(falecido => (
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
                                                    <td className={styles.locationCell}>
                                                        <span className={styles.locationContent}>
                                                            <MapPin size={16} className={styles.pinIcon} />
                                                            {falecido.localizacao || '—'}
                                                        </span>
                                                    </td>
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
                                            ))}
                                            {falecidos.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className={styles.emptyState}>Nenhum falecido encontrado.</td>
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

            {/* --- MODAL DE FORMULÁRIO (Criar/Editar) --- */}
            {isFormModalOpen && (
                <div className={styles.modalOverlay} onClick={closeFormModal}>
                    <div className={styles.modalContentLarge} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{selectedFalecido ? 'Editar Falecido' : 'Novo Falecido'}</h2>
                            <button className={styles.closeBtn} onClick={closeFormModal}><X size={24} /></button>
                        </div>

                        <div className={styles.modalBody}>
                            <form onSubmit={saveFalecido} className={styles.formGrid}>
                                <div className={styles.formCol}>
                                    <h3>Dados Pessoais e Localização</h3>
                                    <div className={styles.formGroup}>
                                        <label>Nome Completo</label>
                                        <input type="text" name="nome" placeholder="Ex: Maria Aparecida" value={formData.nome} onChange={handleInputChange} required />
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Data de Nascimento</label>
                                            <div className={styles.dateInputWrap}>
                                                <input type="text" name="dataNascimento" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" title="Use o formato dd/mm/aaaa" placeholder="dd/mm/aaaa" inputMode="numeric" value={formData.dataNascimento} onChange={handleInputChange} />
                                                <button type="button" className={styles.datePickerButton} aria-label="Abrir calendário para data de nascimento" onClick={() => abrirCalendario(nascimentoDatePickerRef)}><CalendarDays size={18} /></button>
                                                <input ref={nascimentoDatePickerRef} className={styles.nativeDatePicker} type="date" aria-label="Selecionar data de nascimento no calendário" tabIndex={-1} value={dataParaInput(formData.dataNascimento)} onChange={(e) => setFormData(prev => ({ ...prev, dataNascimento: formatarData(e.target.value) }))} />
                                            </div>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Data de Falecimento</label>
                                            <div className={styles.dateInputWrap}>
                                                <input type="text" name="dataMorte" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" title="Use o formato dd/mm/aaaa" placeholder="dd/mm/aaaa" inputMode="numeric" value={formData.dataMorte} onChange={handleInputChange} />
                                                <button type="button" className={styles.datePickerButton} aria-label="Abrir calendário para data de falecimento" onClick={() => abrirCalendario(morteDatePickerRef)}><CalendarDays size={18} /></button>
                                                <input ref={morteDatePickerRef} className={styles.nativeDatePicker} type="date" aria-label="Selecionar data de falecimento no calendário" tabIndex={-1} value={dataParaInput(formData.dataMorte)} onChange={(e) => setFormData(prev => ({ ...prev, dataMorte: formatarData(e.target.value) }))} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Quadra</label>
                                            <AutocompleteInput
                                                name="setor"
                                                value={formData.setor}
                                                options={quadrasDisponiveis.map(quadra => quadra.nome)}
                                                placeholder="Digite ou selecione a quadra"
                                                ariaLabel="Quadra"
                                                onChange={(setor) => {
                                                    setLotesDisponiveis([]);
                                                    setFormData(prev => ({ ...prev, setor: setor.toUpperCase(), lote: '' }));
                                                }}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Lote</label>
                                            <AutocompleteInput
                                                name="lote"
                                                value={formData.lote}
                                                options={lotesDisponiveis.map(lote => lote.numero || lote.nome || lote.id)}
                                                placeholder="Digite ou selecione o lote"
                                                ariaLabel="Lote"
                                                onChange={(lote) => setFormData(prev => ({ ...prev, lote }))}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Categoria (Tipo)</label>
                                        <select name="tipo" value={formData.tipo} onChange={handleInputChange}>
                                            <option value="historica">Personalidade Histórica</option>
                                            <option value="recente">Falecido Recente</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Imagem de Perfil</label>
                                        <div className={styles.fileInputWrapper}>
                                            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} />
                                        </div>
                                        <small className={styles.inputHelp}>Escolha uma foto principal do computador.</small>
                                            <div className={styles.profileImagePreview}>
                                                <img
                                                    src={resolveOnce(imagePreview) || personPlaceholder}
                                                    alt={imagePreview ? 'Prévia da imagem do memorial' : 'Imagem padrão enquanto nenhuma foto for selecionada'}
                                                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                                                />
                                                {!imageRemoved && (selectedImageFile || (selectedFalecido?.imagem && selectedFalecido.imagem !== personPlaceholder)) && (
                                                    <button type="button" className={styles.removeImageBtn} aria-label="Remover imagem de perfil" title="Remover imagem" onClick={removeProfileImage}>
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Fotos da Galeria</label>
                                        <div className={styles.fileInputWrapper}>
                                            <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} />
                                        </div>
                                        <small className={styles.inputHelp}>Você pode enviar até 10 imagens para a galeria.</small>
                                    </div>
                                </div>

                                <div className={styles.formCol}>
                                    <h3>Biografia e Detalhes</h3>
                                    <div className={styles.formGroup}>
                                        <label>Breve Descrição</label>
                                        <textarea name="descricao" rows="2" placeholder="Uma frase curta que resuma a pessoa..." value={formData.descricao} onChange={handleInputChange} />
                                        <small className={styles.inputHelp}>Opcional. Se ficar em branco, a descrição não será exibida.</small>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Biografia Completa</label>
                                        <textarea name="biografia" rows="8" placeholder="Escreva a história completa do falecido aqui..." value={formData.biografia} onChange={handleInputChange} />
                                        <small className={styles.inputHelp}>Opcional. Se não houver informação, o memorial mostrará “Biografia não informada”.</small>
                                    </div>
                                </div>

                                <div className={styles.modalActionsFull}>
                                    <button type="button" className={styles.cancelBtn} onClick={closeFormModal}>Cancelar</button>
                                    <button type="submit" className={styles.saveBtn}>Salvar Registro</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
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
                            <h2>QR Code do Falecido</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Escaneie para acessar a página de <strong>{selectedFalecido.nome}</strong></p>
                            <div className={styles.qrCodeBox}>
                                <QRCode value={qrCodeUrl} size={200} fgColor="#0f172a" />
                            </div>
                            <CopyLinkButton url={qrCodeUrl} />
                            <button className={styles.saveBtn} style={{ marginTop: '16px', width: '100%' }} onClick={() => window.print()}>
                                Imprimir Placa
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <FalecidoDetailsModal falecido={viewFalecido} onClose={() => setViewFalecido(null)} />
        </div>
    );
}
