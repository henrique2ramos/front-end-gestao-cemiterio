import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Search, X, QrCode, ChevronLeft, ChevronRight, LayoutGrid, AlertCircle, CalendarDays } from 'lucide-react';
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
    createLotesEmSequencia,
    updateLote,
    deleteLote,
} from '../../lib/api';
import AdminSidebar from './AdminSidebar';
import CopyLinkButton from '../../components/CopyLinkButton';
import AutocompleteInput from '../../components/AutocompleteInput';
import Spinner from '../../components/Spinner';
import { getPageItems } from './../../data/adminPagination';
import styles from './AdminQuadrasLotes.module.css';

const ITEMS_PER_PAGE = 10;
const LOTES_PER_PAGE = 40;

const getToken = () => localStorage.getItem('memorialAdminToken') || '';

const isAbsoluteUrl = (src) => /^(https?:)?\/\//i.test(src) || src.startsWith('data:');
const resolveOnce = (src) => (!src || isAbsoluteUrl(src) ? src : resolveImageUrl(src));

export default function AdminQuadrasLotes({ onLogout }) {
    const location = useLocation();
    const editHandledRef = useRef(false);
    const [falecidos, setFalecidos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [currentLotePage, setCurrentLotePage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [selectedGalleryFiles, setSelectedGalleryFiles] = useState([]);

    const [selectedQuadra, setSelectedQuadra] = useState(null);
    const [selectedLote, setSelectedLote] = useState(null);
    const [quadras, setQuadras] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [quantidadeLotesPorQuadra, setQuantidadeLotesPorQuadra] = useState({});
    const [carregandoQuadras, setCarregandoQuadras] = useState(true);
    const [quadraDosLotes, setQuadraDosLotes] = useState(null);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [selectedFalecido, setSelectedFalecido] = useState(null);

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
    const [isLoteSequenciaModalOpen, setIsLoteSequenciaModalOpen] = useState(false);
    const [numeroInicialLotes, setNumeroInicialLotes] = useState('');
    const [quantidadeLotes, setQuantidadeLotes] = useState('');
    const [criandoLotes, setCriandoLotes] = useState(false);

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

    useEffect(() => {
        let cancelado = false;

        async function carregarContagemLotes() {
            const resultados = await Promise.all(quadras.map(async (quadra) => {
                try {
                    const data = await fetchLotes(quadra.id);
                    return [quadra.id, Array.isArray(data) ? data.length : 0];
                } catch (error) {
                    console.error(`Erro ao contar lotes da quadra ${quadra.nome}:`, error);
                    return [quadra.id, 0];
                }
            }));

            if (!cancelado) setQuantidadeLotesPorQuadra(Object.fromEntries(resultados));
        }

        if (quadras.length > 0) carregarContagemLotes();
        else setQuantidadeLotesPorQuadra({});

        return () => { cancelado = true; };
    }, [quadras, lotes]);

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

    useEffect(() => {
        if (!location.state?.novo) return;

        setSelectedFalecido(null);
        setSelectedImageFile(null);
        setSelectedGalleryFiles([]);
        setImagePreview('');
        setFormData({
            nome: '', dataNascimento: '', dataMorte: '',
            setor: '', lote: '',
            descricao: '', biografia: '', imagem: '', tipo: 'historica'
        });
        setIsFormModalOpen(true);
    }, [location.state?.novo]);

    useEffect(() => {
        if (editHandledRef.current) return;
        const editId = location.state?.editFalecidoId;
        if (!editId || falecidos.length === 0) return;
        const found = falecidos.find((m) => m.id === editId);
        if (found) {
            editHandledRef.current = true;
            const quadraMatch = found.localizacao?.match(/^Quadra\s+(.+?),/);
            const loteMatch = found.localizacao?.match(/Lote\s+(.+?)$/);
            if (quadraMatch) setSelectedQuadra(quadraMatch[1].trim());
            if (loteMatch) setSelectedLote(loteMatch[1].trim());
            openEditModal(found);
        }
    }, [location.state?.editFalecidoId, falecidos.length]);

    // --- DADOS DERIVADOS ---
    const quadraSelecionada = quadras.find(q => q.nome === selectedQuadra) || null;
    const carregandoLotes = Boolean(quadraSelecionada) && quadraDosLotes !== quadraSelecionada.id;

    const quadrasComCount = quadras.map(q => ({
        id: q.id,
        nome: q.nome,
        count: quantidadeLotesPorQuadra[q.id] ?? 0
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
        count: falecidos.filter(m => m.loteId === lote.id).length
    }));

    const termoLote = searchTerm.trim().toLowerCase();
    const lotesVisiveis = termoLote
        ? lotesComCount.filter(l => String(l.nome).toLowerCase().includes(termoLote))
        : lotesComCount;
    const totalLotePages = Math.max(1, Math.ceil(lotesVisiveis.length / LOTES_PER_PAGE));
    const startLoteIndex = (currentLotePage - 1) * LOTES_PER_PAGE;
    const lotesDaPagina = lotesVisiveis.slice(startLoteIndex, startLoteIndex + LOTES_PER_PAGE);

    useEffect(() => {
        if (currentLotePage > totalLotePages) setCurrentLotePage(totalLotePages);
    }, [currentLotePage, totalLotePages]);

    const memoriaisDoLote = (selectedQuadra && selectedLote)
        ? falecidos.filter(m => m.localizacao === `Quadra ${selectedQuadra}, Lote ${selectedLote}`)
        : [];

    const filteredMemoriais = memoriaisDoLote.filter(m =>
        typeof m.nome === 'string' && m.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        setCurrentPage(1);
        setCurrentLotePage(1);
    }, [searchTerm]);

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
            form.append('dataNascimento', formatarData(formData.dataNascimento));
            form.append('dataMorte', formatarData(formData.dataMorte));
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
                    dataNascimento: formatarData(formData.dataNascimento),
                    dataMorte: formatarData(formData.dataMorte),
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
            'Excluir registro',
            <>Tem certeza que deseja <strong className={styles.confirmEmphasis}>excluir permanentemente</strong> o registro de <strong className={styles.confirmEmphasis}>{nome}</strong>? Esta ação <strong className={styles.confirmEmphasis}>não pode ser desfeita</strong>.</>,
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
    const formatarData = (valor = '') => {
        const isoDate = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoDate) {
            const [, ano, mes, dia] = isoDate;
            return `${dia}/${mes}/${ano}`;
        }
        const digitos = valor.replace(/\D/g, '').slice(0, 8);
        if (digitos.length <= 2) return digitos;
        if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
        return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let v = value;
        if (name === 'dataNascimento' || name === 'dataMorte') v = formatarData(value);
        else if (name === 'setor') v = value.toUpperCase();
        if (name === 'imagem') setSelectedImageFile(null);
        setFormData(prev => ({ ...prev, [name]: v }));
    };

    const handleQuadraChange = (setor) => {
        setSelectedQuadra(setor || null);
        setSelectedLote(null);
        setFormData(prev => ({ ...prev, setor, lote: '' }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setSelectedImageFile(null);
            setImagePreview(selectedFalecido?.imagem || '');
            return;
        }

        setSelectedImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            const preview = typeof reader.result === 'string' ? reader.result : '';
            setImagePreview(preview);
            setFormData(prev => ({ ...prev, imagem: preview }));
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
        setImagePreview('');
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

                await updateQuadra(quadra.id, nome, getToken());
                await recarregarQuadras();
                await recarregarMemoriais();

                if (selectedQuadra === editingQuadra) setSelectedQuadra(nome);
            } else {
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
            <>Isso <strong className={styles.confirmEmphasis}>removerá a Quadra {nome}</strong> e <strong className={styles.confirmEmphasis}>TODOS os falecidos</strong> dentro dela. Esta ação <strong className={styles.confirmEmphasis}>não pode ser desfeita</strong>.</>,
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

    const saveLotesEmSequencia = async (e) => {
        e.preventDefault();
        if (!quadraSelecionada) return;

        const quantidade = Number(quantidadeLotes);
        if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 500) {
            window.alert('Informe uma quantidade entre 1 e 500 lotes.');
            return;
        }

        setCriandoLotes(true);
        try {
            const resultado = await createLotesEmSequencia(
                quadraSelecionada.id,
                numeroInicialLotes.trim(),
                quantidade,
                getToken(),
            );
            await recarregarLotes();
            setIsLoteSequenciaModalOpen(false);
            setNumeroInicialLotes('');
            setQuantidadeLotes('');
            window.alert(`${resultado.total} lotes cadastrados com sucesso.`);
        } catch (error) {
            window.alert(error.message || 'Não foi possível cadastrar os lotes.');
        } finally {
            setCriandoLotes(false);
        }
    };

    const handleDeleteLote = (lote) => {
        openConfirm(
            `Excluir Lote ${lote}`,
            <>Isso <strong className={styles.confirmEmphasis}>removerá o Lote {lote}</strong> da <strong className={styles.confirmEmphasis}>Quadra {selectedQuadra}</strong> e <strong className={styles.confirmEmphasis}>TODOS os falecidos</strong> dentro dele. Esta ação <strong className={styles.confirmEmphasis}>não pode ser desfeita</strong>.</>,
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
        setQuadraQrData({ id: quadra.id, nome: quadra.nome, people, loteCount: quadra.count });
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
                                {nivelAtual === 'quadra' && (termoLote
                                    ? `${lotesVisiveis.length} de ${lotesComCount.length} lotes.`
                                    : `${lotesComCount.length} lote${lotesComCount.length !== 1 ? 's' : ''} nesta quadra.`)}
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
                                <>
                                    <button className={styles.addButton} onClick={() => openLoteModal()}>
                                        <Plus size={20} /> Novo Lote
                                    </button>
                                </>
                            )}
                            {nivelAtual === 'lote' && (
                                <button className={styles.addButton} onClick={() => {
                                    setFormData({
                                        nome: '', dataNascimento: '', dataMorte: '',
                                        setor: selectedQuadra || '', lote: selectedLote || '',
                                        descricao: '', biografia: '', imagem: '', tipo: 'historica'
                                    });
                                    setSelectedFalecido(null);
                                    setSelectedImageFile(null);
                                    setSelectedGalleryFiles([]);
                                    setImagePreview('');
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
                                        <button className={styles.setorCardBtn} onClick={() => { setSelectedQuadra(q.nome); setSelectedLote(null); setSearchTerm(''); setCurrentLotePage(1); }}>
                                        <div className={styles.setorIcon}><LayoutGrid size={28} /></div>
                                        <div className={styles.setorInfo}>
                                            <h3>Quadra {q.nome}</h3>
                                            <p>{q.count} {q.count === 1 ? 'lote' : 'lotes'}</p>
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
                        <>
                            <div className={styles.loteSearch}>
                                <div className={styles.searchBox}>
                                    <Search size={18} className={styles.searchIcon} />
                                    <input
                                        type="text"
                                        placeholder="Buscar lote pelo número..."
                                        aria-label="Buscar lote"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button type="button" className={styles.clearSearchBtn} aria-label="Limpar busca" onClick={() => setSearchTerm('')}>
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className={`${styles.setoresGrid} ${styles.lotesGrid}`}>
                                {lotesDaPagina.map(l => (
                                    <div key={l.nome} className={styles.setorCard}>
                                        <button className={styles.setorCardBtn} onClick={() => { setSelectedLote(l.nome); setSearchTerm(''); setCurrentPage(1); }}>
                                            <div className={styles.setorIcon}>
                                                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M6 21v-9a6 6 0 0 1 12 0v9" />
                                                    <path d="M4 21h16" />
                                                    <path d="M12 8v5M10 10h4" />
                                                </svg>
                                            </div>
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
                                {!carregandoLotes && lotesComCount.length > 0 && lotesVisiveis.length === 0 && (
                                    <p className={styles.emptyState}>Nenhum lote com o número “{searchTerm.trim()}”.</p>
                                )}
                            </div>
                            {!carregandoLotes && lotesVisiveis.length > LOTES_PER_PAGE && (
                                <div className={styles.paginationContainer}>
                                    <p className={styles.paginationInfo}>
                                        Mostrando <strong>{startLoteIndex + 1}</strong> a <strong>{Math.min(startLoteIndex + LOTES_PER_PAGE, lotesVisiveis.length)}</strong> de <strong>{lotesVisiveis.length}</strong> lotes
                                    </p>
                                    <div className={styles.pagination}>
                                        <button className={styles.pageBtn} disabled={currentLotePage === 1} onClick={() => setCurrentLotePage(page => page - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button>
                                        {getPageItems(currentLotePage, totalLotePages).map((page, index) => (
                                            page === '…'
                                                ? <span key={`lotes-gap-${index}`} className={styles.pageEllipsis}>…</span>
                                                : <button key={page} className={`${styles.pageBtn} ${page === currentLotePage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentLotePage(page)}>{page}</button>
                                        ))}
                                        <button className={styles.pageBtn} disabled={currentLotePage === totalLotePages} onClick={() => setCurrentLotePage(page => page + 1)} aria-label="Próxima página"><ChevronRight size={18} /></button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* --- NÍVEL 3: FALECIDOS --- */}
                    {nivelAtual === 'lote' && (
                        <div className={styles.card}>
                            <div className={styles.toolbar}>
                                <div className={styles.searchBox}>
                                    <Search size={18} className={styles.searchIcon} />
                                    <input type="text" placeholder="Buscar falecido pelo nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    {searchTerm && (
                                        <button type="button" className={styles.clearSearchBtn} aria-label="Limpar busca" onClick={() => setSearchTerm('')}>
                                            <X size={16} />
                                        </button>
                                    )}
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
                                            <tr key={falecido.id} className={styles.tableRow}>
                                                <td className={styles.nameCell}>
                                                    <div className={styles.avatar}>
                                                        <img src={falecido.imagem} alt={falecido.nome} />
                                                    </div>
                                                    <div className={styles.personInfo}>
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
                                                    <div className={styles.actionButtonsGroup}>
                                                        <button className={styles.iconBtn} title="Gerar QR Code" onClick={() => openQrModal(falecido)}>
                                                            <QrCode size={18} />
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
                                        Mostrando <strong>{startIndex + 1}</strong> a <strong>{Math.min(startIndex + ITEMS_PER_PAGE, filteredMemoriais.length)}</strong> de <strong>{filteredMemoriais.length}</strong>
                                    </p>
                                    <div className={styles.pagination}>
                                        <button className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={18} /></button>
                                        {getPageItems(currentPage, totalPages).map((page, i) => (
                                            page === '…'
                                                ? <span key={`gap-${i}`} className={styles.pageEllipsis}>…</span>
                                                : <button key={page} className={`${styles.pageBtn} ${page === currentPage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
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
                                        <label>Nome Completo *</label>
                                        <input type="text" name="nome" placeholder="Ex: Maria Aparecida" required value={formData.nome} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Data Nascimento *</label>
                                            <input type="text" name="dataNascimento" required placeholder="DD/MM/AAAA" value={formData.dataNascimento} onChange={handleInputChange} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Data de Falecimento *</label>
                                            <input type="text" name="dataMorte" required placeholder="DD/MM/AAAA" value={formData.dataMorte} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Quadra *</label>
                                            <input 
                                                type="text" 
                                                name="setor" 
                                                list="quadras-list" 
                                                placeholder="Selecione ou cole..." 
                                                autoComplete="off"
                                                value={formData.setor} 
                                                onChange={handleInputChange} 
                                            />
                                            <datalist id="quadras-list">
                                                {quadras.map(q => (
                                                    <option key={q.id} value={q.nome} />
                                                ))}
                                            </datalist>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Lote *</label>
                                            <input 
                                                type="text" 
                                                name="lote" 
                                                list="lotes-list" 
                                                placeholder="Selecione ou cole..." 
                                                autoComplete="off"
                                                value={formData.lote} 
                                                onChange={handleInputChange} 
                                            />
                                            <datalist id="lotes-list">
                                                {lotesDaQuadra.map(l => (
                                                    <option key={l.id} value={l.numero || l.nome || l.id} />
                                                ))}
                                            </datalist>
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
                                        <div className={styles.fileInputWrapper}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} />
                                        </div>
                                        <small className={styles.inputHelp}>Escolha uma foto principal do computador.</small>
                                        {imagePreview && (
                                            <div className={styles.profileImagePreview}>
                                                <img
                                                    src={resolveOnce(imagePreview)}
                                                    alt="Prévia da imagem do memorial"
                                                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Fotos da Galeria</label>
                                        <div className={styles.fileInputWrapper}>
                                            <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} />
                                        </div>
                                        <small className={styles.inputHelp}>Você pode enviar até 10 imagens para a galeria do falecido.</small>
                                    </div>
                                </div>
                                <div className={styles.formCol}>
                                    <h3>Biografia e Textos</h3>
                                    <div className={styles.formGroup}>
                                        <label>Breve Descrição *</label>
                                        <textarea name="descricao" rows="2" placeholder="Uma frase curta que resuma a pessoa..." required value={formData.descricao} onChange={handleInputChange} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Biografia Completa</label>
                                        <textarea name="biografia" rows="8" placeholder="Escreva a história completa do falecido aqui..." value={formData.biografia} onChange={handleInputChange} />
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

            {/* --- MODAL QR CODE DO FALECIDO --- */}
            {isQrModalOpen && selectedFalecido && (
                <div className={styles.modalOverlay} onClick={() => setIsQrModalOpen(false)}>
                    <div className={styles.modalContentSmall} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.qrHeader}>
                            <h2>QR Code do Falecido</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Escaneie para acessar o falecido de <strong>{selectedFalecido.nome}</strong></p>
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

            {/* --- MODAL QR CODE DO LOTE --- */}
            {isLoteQrModalOpen && loteQrData && (
                <div className={styles.modalOverlay} onClick={() => setIsLoteQrModalOpen(false)}>
                    <div className={styles.modalContentSmall} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.qrHeader}>
                            <h2>QR Code do Lote</h2>
                            <button className={styles.closeBtn} onClick={() => setIsLoteQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Lote {loteQrData.nome}</p>
                            <p className={styles.loteQrCount}>
                                {loteQrData.people.length} {loteQrData.people.length === 1 ? 'falecido' : 'falecidos'} neste lote
                            </p>
                            <div className={styles.qrCodeBox}>
                                <QRCode value={loteQrUrl} size={200} fgColor="#0f172a" />
                            </div>
                            <div className={styles.loteQrCopy}>
                                <CopyLinkButton url={loteQrUrl} />
                            </div>
                            <button className={styles.saveBtn} style={{ marginTop: '16px', width: '100%' }} onClick={() => window.print()}>Imprimir Placa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL QR CODE DA QUADRA --- */}
            {isQuadraQrModalOpen && quadraQrData && (
                <div className={styles.modalOverlay} onClick={() => setIsQuadraQrModalOpen(false)}>
                    <div className={styles.modalContentSmall} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.qrHeader}>
                            <h2>QR Code da Quadra</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQuadraQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Quadra {quadraQrData.nome}</p>
                            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '16px' }}>
                                {quadraQrData.loteCount} {quadraQrData.loteCount === 1 ? 'lote' : 'lotes'} nesta quadra
                            </p>
                            <div className={styles.qrCodeBox}>
                                <QRCode value={quadraQrUrl} size={200} fgColor="#0f172a" />
                            </div>
                            <CopyLinkButton url={quadraQrUrl} />
                            <button className={styles.saveBtn} style={{ marginTop: '16px', width: '100%' }} onClick={() => window.print()}>Imprimir Placa</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
