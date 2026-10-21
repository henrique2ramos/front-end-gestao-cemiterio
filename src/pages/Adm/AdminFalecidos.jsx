import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, MapPin, X, QrCode, ChevronLeft, ChevronRight } from 'lucide-react';
import QRCode from 'react-qr-code';
import {
    fetchFalecidos,
    createFalecido,
    updateFalecido as apiUpdateFalecido,
    deleteFalecido as apiDeleteFalecido,
    resolveImageUrl,
} from '../../lib/api';
import AdminSidebar from './AdminSidebar';
import CopyLinkButton from '../../components/CopyLinkButton';
import styles from './AdminQuadrasLotes.module.css';

const ITEMS_PER_PAGE = 10;

const EMPTY_FORM = {
    nome: '', dataNascimento: '', dataMorte: '',
    setor: '', lote: '',
    descricao: '', biografia: '', tipo: 'historica'
};

const getToken = () => localStorage.getItem('memorialAdminToken') || '';

// Só resolve a URL se ainda não for absoluta, para não prefixar o domínio duas vezes
const isAbsoluteUrl = (src) => /^(https?:)?\/\//i.test(src) || src.startsWith('data:');
const resolveOnce = (src) => (!src || isAbsoluteUrl(src) ? src : resolveImageUrl(src));
const getCategory = (tipo) => {
    const normalizedType = tipo?.toLowerCase();
    if (['historica', 'historico', 'historical'].includes(normalizedType)) return 'historicos';
    if (['recente', 'recent'].includes(normalizedType)) return 'recentes';
    return 'outros';
};

export default function AdminFalecidos({ onLogout }) {
    const [falecidos, setFalecidos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('todos');
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [selectedGalleryFiles, setSelectedGalleryFiles] = useState([]);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [selectedFalecido, setSelectedFalecido] = useState(null);

    const [formData, setFormData] = useState(EMPTY_FORM);

    // Modal de confirmação genérico
    const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

    const openConfirm = (title, message, onConfirm) =>
        setConfirmModal({ open: true, title, message, onConfirm });
    const closeConfirm = () =>
        setConfirmModal({ open: false, title: '', message: '', onConfirm: null });

    // --- NORMALIZAÇÃO DOS DADOS DA API ---
    const normalizeFalecidosFromApi = (items) => items.map((item) => ({
        ...item,
        localizacao: item.localizacao || '',
        tipo: item.tipo || 'historica',
        imagem: resolveOnce(item.imagem || item.galeria?.[0]) || 'https://placehold.co/400x400/png',
        galeria: Array.isArray(item.galeria) ? item.galeria.filter(Boolean).map((src) => resolveOnce(src)) : [],
        descricao: item.descricao || item.biografia || '',
        dataNascimento: item.dataNascimento || '',
        dataMorte: item.dataMorte || '',
    }));

    // --- CARREGAR DO BANCO ---
    useEffect(() => {
        async function loadMemoriais() {
            try {
                const data = await fetchFalecidos();
                setFalecidos(normalizeFalecidosFromApi(data));
            } catch (error) {
                console.error('Erro ao buscar falecidos:', error);
                setFalecidos([]);
            } finally {
                setIsLoading(false);
            }
        }

        loadMemoriais();
    }, []);

    // --- FILTRAGEM ---
    const categoryCounts = {
        todos: falecidos.length,
        recentes: falecidos.filter((falecido) => getCategory(falecido.tipo) === 'recentes').length,
        historicos: falecidos.filter((falecido) => getCategory(falecido.tipo) === 'historicos').length,
    };
    const filteredMemoriais = falecidos.filter((falecido) => {
        const matchesCategory = activeCategory === 'todos'
            || getCategory(falecido.tipo) === activeCategory;
        const matchesSearch = typeof falecido.nome === 'string'
            && falecido.nome.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // --- PAGINAÇÃO ---
    const totalPages = Math.max(1, Math.ceil(filteredMemoriais.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentMemoriais = filteredMemoriais.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // --- SALVAR ---
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

            if (selectedImageFile) {
                form.append('imagem', selectedImageFile);
            }

            selectedGalleryFiles.forEach((file) => form.append('galeria', file));

            const payload = selectedImageFile || selectedGalleryFiles.length > 0
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
                const updated = await apiUpdateFalecido(selectedFalecido.id, payload, token);
                setFalecidos((current) => normalizeFalecidosFromApi(
                    current.map((item) => item.id === selectedFalecido.id ? { ...item, ...updated, localizacao } : item)
                ));
            } else {
                const created = await createFalecido(payload, token);
                setFalecidos((current) => normalizeFalecidosFromApi([{ ...created, localizacao }, ...current]));
            }

            closeFormModal();
        } catch (error) {
            window.alert(error.message || 'Não foi possível salvar o falecido.');
        }
    };

    // --- EXCLUIR ---
    const deleteFalecido = (id, nome) => {
        openConfirm(
            'Excluir falecido',
            `Tem certeza que deseja excluir o falecido de ${nome}? Esta ação não pode ser desfeita.`,
            async () => {
                try {
                    await apiDeleteFalecido(id, getToken());
                    setFalecidos((current) => current.filter((item) => item.id !== id));

                    if (currentMemoriais.length === 1 && currentPage > 1) {
                        setCurrentPage((p) => p - 1);
                    }
                } catch (error) {
                    window.alert(error.message || 'Não foi possível excluir o falecido.');
                }
            }
        );
    };

    // --- FORMATAÇÃO / INPUTS ---
    const formatarData = (valor) => {
        const n = valor.replace(/\D/g, '').slice(0, 8);
        if (n.length <= 2) return n;
        if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
        return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let v = value;
        if (name === 'dataNascimento' || name === 'dataMorte') v = formatarData(value);
        else if (name === 'setor') v = value.toUpperCase();
        setFormData(prev => ({ ...prev, [name]: v }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        setSelectedImageFile(file || null);
    };

    const handleGalleryUpload = (e) => {
        setSelectedGalleryFiles(Array.from(e.target.files || []));
    };

    // --- CONTROLES DE MODAL ---
    const openNewModal = () => {
        setSelectedFalecido(null);
        setFormData(EMPTY_FORM);
        setIsFormModalOpen(true);
    };

    const openEditModal = (falecido) => {
        setSelectedFalecido(falecido);
        let setor = '', lote = '';
        if (falecido.localizacao) {
            const s = falecido.localizacao.match(/Quadra\s+(.+?),/);
            const l = falecido.localizacao.match(/Lote\s+(.+?)$/);
            if (s) setor = s[1].trim();
            if (l) lote = l[1].trim();
        }
        setFormData({ ...falecido, setor, lote });
        setIsFormModalOpen(true);
    };

    const closeFormModal = () => {
        setSelectedFalecido(null);
        setSelectedImageFile(null);
        setSelectedGalleryFiles([]);
        setFormData(EMPTY_FORM);
        setIsFormModalOpen(false);
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
                        <div className={`${styles.toolbar} ${styles.memorialToolbar}`}>
                            <div className={styles.searchBox}>
                                <Search size={18} className={styles.searchIcon} />
                                <input
                                    type="text"
                                    placeholder="Buscar falecido..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <div className={styles.categoryFilters} role="group" aria-label="Filtrar por categoria">
                                {[
                                    { id: 'todos', label: 'Todos' },
                                    { id: 'recentes', label: 'Recentes' },
                                    { id: 'historicos', label: 'Históricos' },
                                ].map(({ id, label }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`${styles.categoryFilter} ${activeCategory === id ? styles.categoryFilterActive : ''}`}
                                        aria-pressed={activeCategory === id}
                                        onClick={() => {
                                            setActiveCategory(id);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        {label} ({categoryCounts[id]})
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
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
                                            <td colSpan="4" className={styles.emptyState}>Carregando falecidos...</td>
                                        </tr>
                                    ) : (
                                        <>
                                            {currentMemoriais.map(falecido => (
                                                <tr key={falecido.id}>
                                                    <td className={styles.nameCell}>
                                                        <div className={styles.avatar}>
                                                            <img src={falecido.imagem} alt={falecido.nome} />
                                                        </div>
                                                        <div>
                                                            <span className={styles.name}>{falecido.nome}</span>
                                                            <span className={styles.dateCell}>
                                                                {falecido.dataNascimento || '—'} — {falecido.dataMorte || '—'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className={styles.locationCell}>
                                                        <span className={styles.locationContent}>
                                                            <MapPin size={16} className={styles.pinIcon} />
                                                            {falecido.localizacao || '—'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`${styles.badge} ${getCategory(falecido.tipo) === 'historicos' ? styles.badgeHist : styles.badgeRec}`}>
                                                            {getCategory(falecido.tipo) === 'historicos' ? 'Histórico' : 'Recente'}
                                                        </span>
                                                    </td>
                                                    <td className={styles.actionsCell}>
                                                        <button className={styles.iconBtn} title="Gerar QR Code" onClick={() => openQrModal(falecido)}>
                                                            <QrCode size={18} />
                                                        </button>
                                                        <button className={styles.iconBtn} title="Editar" onClick={() => openEditModal(falecido)}>
                                                            <Edit size={18} />
                                                        </button>
                                                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Excluir" onClick={() => deleteFalecido(falecido.id, falecido.nome)}>
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {currentMemoriais.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className={styles.emptyState}>Nenhum falecido encontrado.</td>
                                                </tr>
                                            )}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* --- PAGINAÇÃO --- */}
                        {!isLoading && totalPages > 1 && (
                            <div className={styles.paginationContainer}>
                                <p className={styles.paginationInfo}>
                                    Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, filteredMemoriais.length)} de {filteredMemoriais.length} registros
                                </p>
                                <div className={styles.pagination}>
                                    <button
                                        className={styles.pageBtn}
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                    >
                                        <ChevronLeft size={18} />
                                    </button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            className={`${styles.pageBtn} ${page === currentPage ? styles.pageBtnActive : ''}`}
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </button>
                                    ))}

                                    <button
                                        className={styles.pageBtn}
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* --- MODAL DE FORMULÁRIO (Criar/Editar) --- */}
            {isFormModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContentLarge}>
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
                                        <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Data Nascimento</label>
                                            <input type="text" name="dataNascimento" placeholder="Ex: 12/03/1823" value={formData.dataNascimento} onChange={handleInputChange} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Data de Falecimento</label>
                                            <input type="text" name="dataMorte" placeholder="Ex: 04/11/1912" value={formData.dataMorte} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Quadra</label>
                                            <input type="text" name="setor" value={formData.setor} onChange={handleInputChange} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Lote</label>
                                            <input type="text" name="lote" value={formData.lote} onChange={handleInputChange} />
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
                                        <input type="file" accept="image/*" onChange={handleImageUpload} />
                                        <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
                                            Escolha uma foto do computador.
                                        </small>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Fotos da Galeria</label>
                                        <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} />
                                        <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
                                            Você pode enviar até 10 imagens para a galeria do falecido.
                                        </small>
                                    </div>
                                </div>

                                <div className={styles.formCol}>
                                    <h3>Biografia e Textos</h3>
                                    <div className={styles.formGroup}>
                                        <label>Breve Descrição</label>
                                        <textarea name="descricao" rows="2" value={formData.descricao} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Biografia Completa</label>
                                        <textarea name="biografia" rows="6" value={formData.biografia} onChange={handleInputChange} />
                                    </div>
                                </div>

                                <div className={styles.modalActionsFull}>
                                    <button type="button" className={styles.cancelBtn} onClick={closeFormModal}>Cancelar</button>
                                    <button type="submit" className={styles.saveBtn}>Salvar</button>
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
                            <Trash2 size={28} color="#cc2200" />
                        </div>
                        <h2 className={styles.confirmTitle}>{confirmModal.title}</h2>
                        <p className={styles.confirmMessage}>{confirmModal.message}</p>
                        <div className={styles.confirmActions}>
                            <button className={styles.cancelBtn} onClick={closeConfirm}>Cancelar</button>
                            <button
                                className={styles.deleteConfirmBtn}
                                onClick={() => { confirmModal.onConfirm?.(); closeConfirm(); }}
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DO QR CODE --- */}
            {isQrModalOpen && selectedFalecido && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContentSmall}>
                        <div className={styles.qrHeader}>
                            <h2>QR Code do Falecido</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Escaneie para acessar o falecido de <strong>{selectedFalecido.nome}</strong></p>
<div className={styles.qrCodeBox}>
                                   <QRCode value={qrCodeUrl} size={200} fgColor="#003366" />
                               </div>
                               <CopyLinkButton url={qrCodeUrl} />
                               <button className={styles.saveBtn} onClick={() => window.print()}>
                                   Imprimir Placa
                               </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}