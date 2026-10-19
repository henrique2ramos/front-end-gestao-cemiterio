import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Search, X, QrCode, ChevronLeft, ChevronRight, LayoutGrid, SquareChartGantt } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useLocation } from 'react-router-dom';
import {
    fetchFalecidos,
    createFalecido,
    updateFalecido as apiUpdateFalecido,
    deleteFalecido as apiDeleteFalecido,
    resolveImageUrl,
    fetchQuadras,
    createQuadra,
    updateQuadra,
    deleteQuadra,
    fetchLotes,
    createLote,
    updateLote,
    deleteLote,
} from '../../lib/api';
import AdminSidebar from './AdminSidebar';
import CopyLinkButton from '../../components/CopyLinkButton';
import Spinner from '../../components/Spinner';
import styles from './AdminQuadrasLotes.module.css';

const ITEMS_PER_PAGE = 10;

const getToken = () => localStorage.getItem('memorialAdminToken') || '';

const isAbsoluteUrl = (src) => /^(https?:)?\/\//i.test(src) || src.startsWith('data:');
const resolveOnce = (src) => (!src || isAbsoluteUrl(src) ? src : resolveImageUrl(src));

export default function AdminFalecidos({ onLogout }) {
    const location = useLocation();
    const editHandledRef = useRef(false);
    const [falecidos, setFalecidos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [selectedGalleryFiles, setSelectedGalleryFiles] = useState([]);

    const [selectedQuadra, setSelectedQuadra] = useState(null);
    const [selectedLote, setSelectedLote] = useState(null);

    // quadras e lotes vêm da API; o banco é a fonte da verdade
    const [quadras, setQuadras] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [carregandoQuadras, setCarregandoQuadras] = useState(true);
    // id da quadra cujos lotes já foram buscados: permite derivar o loading
    // sem setState síncrono dentro do effect
    const [quadraDosLotes, setQuadraDosLotes] = useState(null);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [selectedFalecido, setSelectedFalecido] = useState(null);

    // Modal de confirmação genérico
    const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

    const openConfirm = (title, message, onConfirm) =>
        setConfirmModal({ open: true, title, message, onConfirm });
    const closeConfirm = () =>
        setConfirmModal({ open: false, title: '', message: '', onConfirm: null });

    const [isQuadraModalOpen, setIsQuadraModalOpen] = useState(false);
    const [editingQuadra, setEditingQuadra] = useState(null);
    const [quadraNome, setQuadraNome] = useState('');

    const [isLoteModalOpen, setIsLoteModalOpen] = useState(false);
    const [editingLote, setEditingLote] = useState(null);
    const [loteNome, setLoteNome] = useState('');

    const [formData, setFormData] = useState({
        nome: '', dataNascimento: '', dataMorte: '',
        setor: '', lote: '',
        descricao: '', biografia: '', imagem: '', tipo: 'historica'
    });

    const normalizeFalecidosFromApi = (items) => items.map((item) => ({
        ...item,
        localizacao: item.localizacao || `Quadra A, Lote 1`,
        tipo: item.tipo || 'historica',
        imagem: resolveOnce(item.imagem || item.galeria?.[0]) || 'https://placehold.co/400x400/png',
        galeria: Array.isArray(item.galeria) ? item.galeria.filter(Boolean).map((src) => resolveOnce(src)) : [],
        descricao: item.descricao || item.biografia || '',
        dataNascimento: item.dataNascimento || '',
        dataMorte: item.dataMorte || '',
    }));

    const recarregarQuadras = async () => {
        try {
            const data = await fetchQuadras();
            setQuadras(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Erro ao buscar quadras:', error);
            setQuadras([]);
        }
    };

    const recarregarLotes = async () => {
        if (!selectedQuadra) {
            setLotes([]);
            setQuadraDosLotes(null);
            return;
        }

        const quadra = quadras.find(q => q.nome === selectedQuadra);
        if (!quadra) {
            setLotes([]);
            setQuadraDosLotes(null);
            return;
        }

        setQuadraDosLotes(null);

        try {
            const data = await fetchLotes(quadra.id);
            setLotes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Erro ao buscar lotes:', error);
            setLotes([]);
        } finally {
            setQuadraDosLotes(quadra.id);
        }
    };

    const recarregarMemoriais = async () => {
        try {
            const data = await fetchFalecidos();
            setFalecidos(normalizeFalecidosFromApi(data));
        } catch (error) {
            console.error('Erro ao buscar falecidos:', error);
            setFalecidos([]);
        }
    };

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

    // Carrega as quadras do backend
    useEffect(() => {
        let cancelado = false;

        async function loadQuadras() {
            try {
                const data = await fetchQuadras();
                if (!cancelado) setQuadras(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Erro ao buscar quadras:', error);
                if (!cancelado) setQuadras([]);
            } finally {
                if (!cancelado) setCarregandoQuadras(false);
            }
        }

        loadQuadras();

        return () => { cancelado = true; };
    }, []);

    // Carrega os lotes da quadra selecionada
    useEffect(() => {
        const quadra = quadras.find(q => q.nome === selectedQuadra);

        if (!selectedQuadra || !quadra) {
            return;
        }

        let cancelado = false;

        async function loadLotes() {
            try {
                const data = await fetchLotes(quadra.id);
                if (!cancelado) setLotes(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Erro ao buscar lotes:', error);
                if (!cancelado) setLotes([]);
            } finally {
                if (!cancelado) setQuadraDosLotes(quadra.id);
            }
        }

        loadLotes();

        return () => { cancelado = true; };
    }, [selectedQuadra, quadras]);

    // Abre edição vinda do dashboard apenas uma vez; ref impede re-disparo ao salvar falecidos
    useEffect(() => {
        if (editHandledRef.current) return;
        const editId = location.state?.editFalecidoId;
        if (!editId || falecidos.length === 0) return;
        const found = falecidos.find((m) => m.id === editId);
        if (found) {
            editHandledRef.current = true;
            // Navega até o lote do falecido antes de abrir o modal
            const quadraMatch = found.localizacao?.match(/^Quadra\s+(.+?),/);
            const loteMatch = found.localizacao?.match(/Lote\s+(.+?)$/);
            if (quadraMatch) setSelectedQuadra(quadraMatch[1].trim());
            if (loteMatch) setSelectedLote(loteMatch[1].trim());
            openEditModal(found);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state?.editFalecidoId, falecidos.length]);

    // --- DADOS DERIVADOS ---
    const quadraSelecionada = quadras.find(q => q.nome === selectedQuadra) || null;

    // O loading dos lotes e derivado: enquanto os lotes da quadra atual nao
    // chegaram, a tela mostra spinner em vez de "nenhum lote encontrado"
    const carregandoLotes = Boolean(quadraSelecionada) && quadraDosLotes !== quadraSelecionada.id;

    const quadrasComCount = quadras.map(q => ({
        id: q.id,
        nome: q.nome,
        // contagem por UUID: comparacao exata, sem parse de texto
        count: falecidos.filter(m => m.quadraId === q.id).length
    }));

    const lotesDaQuadra = (quadraSelecionada && !carregandoLotes)
        ? lotes
            .filter(l => l.quadraId === quadraSelecionada.id)
            .sort((a, b) => {
                const numA = parseInt(a.numero) || 0;
                const numB = parseInt(b.numero) || 0;
                return numA - numB;
            })
        : [];

    const lotesComCount = lotesDaQuadra.map(lote => ({
        id: lote.id,
        nome: lote.numero,
        // contagem por UUID: comparacao exata, sem parse de texto
        count: falecidos.filter(m => m.loteId === lote.id).length
    }));

    const memoriaisDoLote = (selectedQuadra && selectedLote)
        ? falecidos.filter(m => m.localizacao === `Quadra ${selectedQuadra}, Lote ${selectedLote}`)
        : [];

    const filteredMemoriais = memoriaisDoLote.filter(m =>
        typeof m.nome === 'string' && m.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredMemoriais.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentMemoriais = filteredMemoriais.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // --- SALVAR FALECIDO ---
    const saveFalecido = async (e) => {
        e.preventDefault();
        const token = getToken();
        const setor = (formData.setor || '').trim();
        const lote = (formData.lote || '').trim();
        const localizacao = `Quadra ${setor}, Lote ${lote}`;
        const imagemAlterada = !!formData.imagem?.trim() && formData.imagem !== selectedFalecido?.imagem;

        try {
            const form = new FormData();
            form.append('nome', formData.nome);
            form.append('biografia', formData.biografia || '');
            form.append('descricao', formData.descricao || '');
            form.append('dataNascimento', formData.dataNascimento || '');
            form.append('dataMorte', formData.dataMorte || '');
            form.append('localizacao', localizacao);
            form.append('tipo', formData.tipo || 'historica');

            if (selectedImageFile) {
                form.append('imagem', selectedImageFile);
            } else if (imagemAlterada) {
                form.append('imagem', formData.imagem.trim());
            }

            if (selectedGalleryFiles.length > 0) {
                selectedGalleryFiles.forEach((file) => {
                    form.append('galeria', file);
                });
            }

            const payload = selectedImageFile || selectedGalleryFiles.length > 0
                ? form
                : {
                    nome: formData.nome,
                    biografia: formData.biografia || '',
                    descricao: formData.descricao || '',
                    dataNascimento: formData.dataNascimento || '',
                    dataMorte: formData.dataMorte || '',
                    localizacao,
                    tipo: formData.tipo || 'historica',
                    ...(imagemAlterada ? { imagem: formData.imagem.trim() } : {}),
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

    const deleteFalecido = async (id, nome) => {
        openConfirm(
            'Excluir falecido',
            `Tem certeza que deseja excluir o falecido de ${nome}? Esta ação não pode ser desfeita.`,
            async () => {
                try {
                    await apiDeleteFalecido(id, getToken());
                    setFalecidos((current) => current.filter((item) => item.id !== id));
                    if (currentMemoriais.length === 1 && currentPage > 1) setCurrentPage(p => p - 1);
                } catch (error) {
                    window.alert(error.message || 'Não foi possível excluir o falecido.');
                }
            }
        );
    };

    // --- FORMATAR DATA ---
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
        if (!file) {
            setSelectedImageFile(null);
            return;
        }

        setSelectedImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, imagem: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleGalleryUpload = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) {
            setSelectedGalleryFiles([]);
            return;
        }

        setSelectedGalleryFiles(files);
    };

    // --- MODAL FALECIDO ---
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
        setFormData({
            nome: '', dataNascimento: '', dataMorte: '',
            setor: selectedQuadra || '', lote: '',
            descricao: '', biografia: '', imagem: '', tipo: 'historica'
        });
        setIsFormModalOpen(false);
    };

    // --- MODAL QUADRA ---
    const openQuadraModal = (nome = null) => {
        setEditingQuadra(nome);
        setQuadraNome(nome || '');
        setIsQuadraModalOpen(true);
    };

    const saveQuadra = async (e) => {
        e.preventDefault();
        const nome = quadraNome.trim().toUpperCase();
        if (!nome) return;

        try {
            if (editingQuadra) {
                if (nome === editingQuadra) return;

                const quadra = quadras.find(q => q.nome === editingQuadra);
                if (!quadra) return;

                // O backend renomeia a quadra; a localizacao de cada falecido é
                // recalculada a partir das relações, não precisa ser reescrita.
                await updateQuadra(quadra.id, nome, getToken());
                await recarregarQuadras();
                await recarregarMemoriais();

                if (selectedQuadra === editingQuadra) setSelectedQuadra(nome);
            } else {
                // Navega direto para a nova quadra; o admin adiciona lotes/falecidos a partir daqui
                await createQuadra(nome, getToken());
                await recarregarQuadras();
                setSelectedQuadra(nome);
                setSelectedLote(null);
            }
        } catch (error) {
            window.alert(error.message || 'Não foi possível salvar a quadra.');
        }

        setIsQuadraModalOpen(false);
        setEditingQuadra(null);
        setQuadraNome('');
    };

    const handleDeleteQuadra = (nome) => {
        openConfirm(
            `Excluir Quadra ${nome}`,
            `Isso removerá a Quadra ${nome} e TODOS os falecidos dentro dela. Esta ação não pode ser desfeita.`,
            async () => {
                const quadra = quadras.find(q => q.nome === nome);
                if (!quadra) return;

                try {
                    const resultado = await deleteQuadra(quadra.id, getToken());
                    await recarregarQuadras();
                    await recarregarMemoriais();

                    if (selectedQuadra === nome) { setSelectedQuadra(null); setSelectedLote(null); }

                    if (resultado?.falecidosRemovidos > 0) {
                        window.alert(`${resultado.falecidosRemovidos} falecido(is) da quadra também foram removidos.`);
                    }
                } catch (error) {
                    window.alert(error.message || 'Não foi possível excluir a quadra.');
                }
            }
        );
    };

    // --- MODAL LOTE ---
    const openLoteModal = (nome = null) => {
        setEditingLote(nome);
        setLoteNome(nome || '');
        setIsLoteModalOpen(true);
    };

    const saveLote = async (e) => {
        e.preventDefault();
        const nome = loteNome.trim();
        if (!nome || !quadraSelecionada) return;

        try {
            if (editingLote) {
                if (nome === editingLote) return;

                const lote = lotes.find(l => l.numero === editingLote);
                if (!lote) return;

                await updateLote(lote.id, nome, getToken());
                await recarregarLotes();
                await recarregarMemoriais();

                if (selectedLote === editingLote) setSelectedLote(nome);
            } else {
                // Navega para o novo lote; o admin clica em "Novo Falecido" para adicionar
                await createLote(quadraSelecionada.id, nome, getToken());
                await recarregarLotes();
                setSelectedLote(nome);
            }
        } catch (error) {
            window.alert(error.message || 'Não foi possível salvar o lote.');
        }

        setIsLoteModalOpen(false);
        setEditingLote(null);
        setLoteNome('');
    };

    const handleDeleteLote = (lote) => {
        openConfirm(
            `Excluir Lote ${lote}`,
            `Isso removerá o Lote ${lote} da Quadra ${selectedQuadra} e TODOS os falecidos dentro dele. Esta ação não pode ser desfeita.`,
            async () => {
                const alvo = lotes.find(l => l.numero === lote);
                if (!alvo) return;

                try {
                    const resultado = await deleteLote(alvo.id, getToken());
                    await recarregarLotes();
                    await recarregarMemoriais();

                    if (selectedLote === lote) setSelectedLote(null);

                    if (resultado?.falecidosRemovidos > 0) {
                        window.alert(`${resultado.falecidosRemovidos} falecido(is) do lote também foram removidos.`);
                    }
                } catch (error) {
                    window.alert(error.message || 'Não foi possível excluir o lote.');
                }
            }
        );
    };

    // --- QR CODE DO FALECIDO ---
    const openQrModal = (falecido) => {
        setSelectedFalecido(falecido);
        setIsQrModalOpen(true);
    };
    const qrCodeUrl = selectedFalecido ? `${window.location.origin}/falecidos/${selectedFalecido.id}` : '';

    // --- QR CODE DO LOTE ---
    const [isLoteQrModalOpen, setIsLoteQrModalOpen] = useState(false);
    const [loteQrData, setLoteQrData] = useState(null);
    const openLoteQrModal = (lote) => {
        // O QR aponta para o UUID do lote: renomear o lote ou a quadra
        // nao invalida mais a placa impressa.
        const people = falecidos.filter(m => m.loteId === lote.id);
        setLoteQrData({ id: lote.id, nome: lote.nome, people });
        setIsLoteQrModalOpen(true);
    };
    const loteQrUrl = loteQrData ? `${window.location.origin}/lote/${loteQrData.id}` : '';

    // --- QR CODE DA QUADRA ---
    const [isQuadraQrModalOpen, setIsQuadraQrModalOpen] = useState(false);
    const [quadraQrData, setQuadraQrData] = useState(null);
    const openQuadraQrModal = (quadra) => {
        const people = falecidos.filter(m => m.quadraId === quadra.id);
        setQuadraQrData({ id: quadra.id, nome: quadra.nome, people });
        setIsQuadraQrModalOpen(true);
    };
    const quadraQrUrl = quadraQrData ? `${window.location.origin}/quadra/${quadraQrData.id}` : '';

    // --- NAVEGAÇÃO ---
    const goBack = () => {
        if (selectedLote) { setSelectedLote(null); setSearchTerm(''); setCurrentPage(1); }
        else if (selectedQuadra) { setSelectedQuadra(null); setSelectedLote(null); setSearchTerm(''); }
    };

    const nivelAtual = selectedLote ? 'lote' : selectedQuadra ? 'quadra' : 'inicio';

    return (
        <div className={styles.adminLayout}>
            <AdminSidebar onLogout={onLogout} />
            <main className={styles.mainContent}>
                <div className={styles.container}>

                    {/* --- HEADER --- */}
                    <header className={styles.header}>
                        <div>
                            {nivelAtual !== 'inicio' && (
                                <button className={styles.backBtn} onClick={goBack}>
                                    <ChevronLeft size={18} />
                                    {nivelAtual === 'lote' ? `Voltar para Lotes` : `Voltar para Quadras`}
                                </button>
                            )}
                            <h1 className={styles.title}>
                                {nivelAtual === 'inicio' && 'Quadras'}
                                {nivelAtual === 'quadra' && `Quadra ${selectedQuadra}`}
                                {nivelAtual === 'lote' && `Lote ${selectedLote}`}
                            </h1>
                            <p className={styles.subtitle}>
                                {nivelAtual === 'inicio' && 'Selecione uma quadra para ver os lotes.'}
                                {nivelAtual === 'quadra' && `${lotesComCount.length} lote${lotesComCount.length !== 1 ? 's' : ''} nesta quadra.`}
                                {nivelAtual === 'lote' && `${filteredMemoriais.length} ${filteredMemoriais.length === 1 ? 'falecido' : 'falecidos'} neste lote.`}
                            </p>
                        </div>
                        <div className={styles.headerActions}>
                            {nivelAtual === 'inicio' && (
                                <button className={styles.addButton} onClick={() => openQuadraModal()}>
                                    <Plus size={20} /> Nova Quadra
                                </button>
                            )}
                            {nivelAtual === 'quadra' && (
                                <button className={styles.addButton} onClick={() => openLoteModal()}>
                                    <Plus size={20} /> Novo Lote
                                </button>
                            )}
                            {nivelAtual === 'lote' && (
                                <button className={styles.addButton} onClick={() => {
                                    setFormData({
                                        nome: '', dataNascimento: '', dataMorte: '',
                                        setor: selectedQuadra || '', lote: selectedLote || '',
                                        descricao: '', biografia: '', imagem: '', tipo: 'historica'
                                    });
                                    setSelectedFalecido(null);
                                    setIsFormModalOpen(true);
                                }}>
                                    <Plus size={20} /> Novo Falecido
                                </button>
                            )}
                        </div>
                    </header>

                    {/* --- NÍVEL 1: QUADRAS --- */}
                    {nivelAtual === 'inicio' && (
                        <div className={styles.setoresGrid}>
                            {quadrasComCount.map(q => (
                                <div key={q.nome} className={styles.setorCard}>
                                    <button className={styles.setorCardBtn} onClick={() => { setSelectedQuadra(q.nome); setSelectedLote(null); setSearchTerm(''); }}>
                                        <div className={styles.setorIcon}><LayoutGrid size={28} /></div>
                                        <div className={styles.setorInfo}>
                                            <h3>Quadra {q.nome}</h3>
                                            <p>{q.count} {q.count === 1 ? 'falecido' : 'falecidos'}</p>
                                        </div>
                                    </button>
                                    <div className={styles.cardActions}>
                                        <button className={styles.iconBtn} title="QR Code da Quadra" onClick={() => openQuadraQrModal(q)}><QrCode size={16} /></button>
                                        <button className={styles.iconBtn} title="Editar Quadra" onClick={() => openQuadraModal(q.nome)}><Edit size={16} /></button>
                                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Excluir Quadra" onClick={() => handleDeleteQuadra(q.nome)}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                            {carregandoQuadras && (
                                <Spinner label="Carregando quadras..." />
                            )}
                            {!carregandoQuadras && quadrasComCount.length === 0 && (
                                <p className={styles.emptyState}>Nenhuma quadra encontrada. Crie uma para começar.</p>
                            )}
                        </div>
                    )}

                    {/* --- NÍVEL 2: LOTES --- */}
                    {nivelAtual === 'quadra' && (
                        <div className={styles.setoresGrid}>
                            {lotesComCount.map(l => (
                                <div key={l.nome} className={styles.setorCard}>
                                    <button className={styles.setorCardBtn} onClick={() => { setSelectedLote(l.nome); setSearchTerm(''); setCurrentPage(1); }}>
                                        <div className={styles.setorIcon}><SquareChartGantt size={28} /></div>
                                        <div className={styles.setorInfo}>
                                            <h3>Lote {l.nome}</h3>
                                            <p>{l.count} {l.count === 1 ? 'falecido' : 'falecidos'}</p>
                                        </div>
                                    </button>
                                    <div className={styles.cardActions}>
                                        <button className={styles.iconBtn} title="QR Code do Lote" onClick={() => openLoteQrModal(l)}><QrCode size={16} /></button>
                                        <button className={styles.iconBtn} title="Editar Lote" onClick={() => openLoteModal(l.nome)}><Edit size={16} /></button>
                                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Excluir Lote" onClick={() => handleDeleteLote(l.nome)}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                            {carregandoLotes && (
                                <Spinner label="Carregando lotes..." />
                            )}
                            {!carregandoLotes && lotesComCount.length === 0 && (
                                <p className={styles.emptyState}>Nenhum lote encontrado. Crie um para começar.</p>
                            )}
                        </div>
                    )}

                    {/* --- NÍVEL 3: FALECIDOS --- */}
                    {nivelAtual === 'lote' && (
                        <div className={styles.card}>
                            <div className={styles.toolbar}>
                                <div className={styles.searchBox}>
                                    <Search size={18} className={styles.searchIcon} />
                                    <input type="text" placeholder="Buscar falecido..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Nome do Falecido</th>
                                            <th>Tipo</th>
                                            <th className={styles.actionsColumn}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentMemoriais.map(falecido => (
                                            <tr key={falecido.id}>
                                                <td className={styles.nameCell}>
                                                    <div className={styles.avatar}>
                                                        <img src={falecido.imagem} alt={falecido.nome} />
                                                    </div>
                                                    <div>
                                                        <span className={styles.name}>{falecido.nome}</span>
                                                        <span className={styles.dateCell}>{falecido.dataNascimento || '—'} — {falecido.dataMorte || '—'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`${styles.badge} ${falecido.tipo === 'historica' ? styles.badgeHist : styles.badgeRec}`}>
                                                        {falecido.tipo === 'historica' ? 'Histórico' : 'Recente'}
                                                    </span>
                                                </td>
                                                <td className={styles.actionsCell}>
                                                    <button className={styles.iconBtn} title="QR Code" onClick={() => openQrModal(falecido)}><QrCode size={18} /></button>
                                                    <button className={styles.iconBtn} title="Editar" onClick={() => openEditModal(falecido)}><Edit size={18} /></button>
                                                    <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Excluir" onClick={() => deleteFalecido(falecido.id, falecido.nome)}><Trash2 size={18} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {isLoading && (
                                            <tr><td colSpan="3" className={styles.emptyState}>Carregando falecidos...</td></tr>
                                        )}
                                        {!isLoading && currentMemoriais.length === 0 && (
                                            <tr><td colSpan="3" className={styles.emptyState}>Nenhum falecido neste lote.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 1 && (
                                <div className={styles.paginationContainer}>
                                    <p className={styles.paginationInfo}>
                                        Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, filteredMemoriais.length)} de {filteredMemoriais.length}
                                    </p>
                                    <div className={styles.pagination}>
                                        <button className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={18} /></button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button key={page} className={`${styles.pageBtn} ${page === currentPage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                                        ))}
                                        <button className={styles.pageBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={18} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* --- MODAL QUADRA --- */}
            {isQuadraModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2>{editingQuadra ? 'Editar Quadra' : 'Nova Quadra'}</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQuadraModalOpen(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={saveQuadra} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>Nome da Quadra *</label>
                                <input type="text" required value={quadraNome} onChange={(e) => setQuadraNome(e.target.value.toUpperCase())} placeholder="Ex: A" autoFocus />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsQuadraModalOpen(false)}>Cancelar</button>
                                <button type="submit" className={styles.saveBtn}>Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL LOTE --- */}
            {isLoteModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2>{editingLote ? 'Editar Lote' : 'Novo Lote'} — Quadra {selectedQuadra}</h2>
                            <button className={styles.closeBtn} onClick={() => setIsLoteModalOpen(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={saveLote} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>Número do Lote *</label>
                                <input type="text" required value={loteNome} onChange={(e) => setLoteNome(e.target.value)} placeholder="Ex: 42" autoFocus />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsLoteModalOpen(false)}>Cancelar</button>
                                <button type="submit" className={styles.saveBtn}>Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL FALECIDO --- */}
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
                                        <label>Nome Completo *</label>
                                        <input type="text" name="nome" required value={formData.nome} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Data Nascimento *</label>
                                            <input type="text" name="dataNascimento" required placeholder="Ex: 12/03/1823" value={formData.dataNascimento} onChange={handleInputChange} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Data de Falecimento *</label>
                                            <input type="text" name="dataMorte" required placeholder="Ex: 04/11/1912" value={formData.dataMorte} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Quadra *</label>
                                            <input type="text" name="setor" required value={formData.setor} onChange={handleInputChange} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Lote *</label>
                                            <input type="text" name="lote" required value={formData.lote} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Categoria (Tipo) *</label>
                                        <select name="tipo" value={formData.tipo} onChange={handleInputChange}>
                                            <option value="historica">Personalidade Histórica</option>
                                            <option value="recente">Falecido Recente</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Imagem de Perfil</label>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} />
                                        <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
                                            Você pode escolher uma foto do computador ou usar um URL abaixo.
                                        </small>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>URL da Imagem (opcional)</label>
                                        <input type="url" name="imagem" placeholder="https://..." value={formData.imagem} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Fotos da Galeria (opcional)</label>
                                        <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} />
                                        <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
                                            Você pode enviar até 10 imagens para a galeria do falecido.
                                        </small>
                                    </div>
                                </div>
                                <div className={styles.formCol}>
                                    <h3>Biografia e Textos</h3>
                                    <div className={styles.formGroup}>
                                        <label>Breve Descrição *</label>
                                        <textarea name="descricao" rows="2" required value={formData.descricao} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Biografia Completa {formData.tipo === 'historica' ? '*' : '(Opcional)'}</label>
                                        <textarea name="biografia" rows="6" required={formData.tipo === 'historica'} value={formData.biografia} onChange={handleInputChange} />
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

            {/* --- MODAL QR CODE DO FALECIDO --- */}
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

            {/* --- MODAL QR CODE DO LOTE --- */}
            {isLoteQrModalOpen && loteQrData && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContentSmall}>
                        <div className={styles.qrHeader}>
                            <h2>QR Code do Lote</h2>
                            <button className={styles.closeBtn} onClick={() => setIsLoteQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Lote {loteQrData.nome}</p>
                            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '16px' }}>
                                {loteQrData.people.length} {loteQrData.people.length === 1 ? 'falecido' : 'falecidos'} neste lote
                            </p>
                            <div className={styles.qrCodeBox}>
                                <QRCode value={loteQrUrl} size={200} fgColor="#003366" />
                            </div>
                            <CopyLinkButton url={loteQrUrl} />
                            <button className={styles.saveBtn} onClick={() => window.print()}>Imprimir Placa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL QR CODE DA QUADRA --- */}
            {isQuadraQrModalOpen && quadraQrData && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContentSmall}>
                        <div className={styles.qrHeader}>
                            <h2>QR Code da Quadra</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQuadraQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Quadra {quadraQrData.nome}</p>
                            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '16px' }}>
                                {quadraQrData.people.length} {quadraQrData.people.length === 1 ? 'falecido' : 'falecidos'} nesta quadra
                            </p>
                            <div className={styles.qrCodeBox}>
                                <QRCode value={quadraQrUrl} size={200} fgColor="#003366" />
                            </div>
                            <CopyLinkButton url={quadraQrUrl} />
                            <button className={styles.saveBtn} onClick={() => window.print()}>Imprimir Placa</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}