import { useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronLeft, AlertCircle, Printer } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useLocation, useNavigate } from 'react-router-dom';
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
import FalecidoFormModal from '../../components/FalecidoFormModal';
import FalecidoDetailsModal from '../../components/FalecidoDetailsModal';
import QrImageDownloadButtons from '../../components/QrImageDownloadButtons';
import { getPageItems } from './../../data/adminPagination';
import styles from './AdminQuadrasLotes.module.css';
import AdminQuadras from './AdminQuadras';
import AdminLotes from './AdminLotes';
import personPlaceholder from '../../assets/person-placeholder.svg';

const ITEMS_PER_PAGE = 10;
const LOTES_PER_PAGE = 100;
const MOBILE_LOTES_PER_PAGE = 35;

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

export default function AdminQuadrasLotes({ onLogout }) {
    const location = useLocation();
    const navigate = useNavigate();
    const editHandledRef = useRef(false);
    const modalHistoryRef = useRef(false);
    const nascimentoDatePickerRef = useRef(null);
    const morteDatePickerRef = useRef(null);
    const lotActionsMenuRef = useRef(null);
    const deceasedQrBoxRef = useRef(null);
    const lotQrBoxRef = useRef(null);
    const quadraQrBoxRef = useRef(null);
    const [falecidos, setFalecidos] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentLotePage, setCurrentLotePage] = useState(1);
    const [lotesPerPage, setLotesPerPage] = useState(() => (
        window.matchMedia('(max-width: 560px)').matches ? MOBILE_LOTES_PER_PAGE : LOTES_PER_PAGE
    ));
    const [lotSearchTerm, setLotSearchTerm] = useState('');
    const [lotOccupancyFilter, setLotOccupancyFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [imageRemoved, setImageRemoved] = useState(false);
    const [selectedGalleryFiles, setSelectedGalleryFiles] = useState([]);
    const imageInputRef = useRef(null);

    const [selectedQuadra, setSelectedQuadra] = useState(location.state?.__adminQuadra || null);
    const [selectedLote, setSelectedLote] = useState(location.state?.__adminLote || null);
    const [quadras, setQuadras] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [quantidadeLotesPorQuadra, setQuantidadeLotesPorQuadra] = useState({});
    const [ocupacaoLotesPorQuadra, setOcupacaoLotesPorQuadra] = useState({});
    const [carregandoQuadras, setCarregandoQuadras] = useState(true);
    const [quadraDosLotes, setQuadraDosLotes] = useState(null);

    const [isFormModalOpen, setIsFormModalOpen] = useState(Boolean(location.state?.novo));
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [selectedFalecido, setSelectedFalecido] = useState(null);
    const [viewFalecido, setViewFalecido] = useState(null);

    const pushAdminHistory = (stateUpdates) => {
        navigate(`${location.pathname}${location.search}${location.hash}`, {
            state: { ...(location.state || {}), ...stateUpdates },
        });
    };

    const replaceAdminHistory = (stateUpdates) => {
        navigate(`${location.pathname}${location.search}${location.hash}`, {
            replace: true,
            state: { ...(location.state || {}), ...stateUpdates },
        });
    };

    const pushModalHistory = () => {
        if (location.state?.__sgcModalHistory || modalHistoryRef.current) return;
        modalHistoryRef.current = true;
        navigate(`${location.pathname}${location.search}${location.hash}`, {
            state: { ...(location.state || {}), __sgcModalHistory: true },
        });
    };

    const closeModalHistory = () => {
        if (location.state?.__sgcModalHistory || modalHistoryRef.current) navigate(-1);
    };

    useEffect(() => {
        if (location.state?.__sgcModalHistory) {
            modalHistoryRef.current = true;
            return;
        }
        if (modalHistoryRef.current) {
            modalHistoryRef.current = false;
            setIsFormModalOpen(false);
            setViewFalecido(null);
        }

        setSelectedQuadra(location.state?.__adminQuadra || null);
        setSelectedLote(location.state?.__adminLote || null);
    }, [location.key, location.state]);

    useEffect(() => {
        setCurrentLotePage(1);
    }, [selectedQuadra]);

    useEffect(() => {
        const mobileQuery = window.matchMedia('(max-width: 560px)');
        const updateLotesPerPage = (event) => {
            const nextPageSize = event.matches ? MOBILE_LOTES_PER_PAGE : LOTES_PER_PAGE;
            setLotesPerPage(nextPageSize);
            setCurrentLotePage(1);
        };

        mobileQuery.addEventListener('change', updateLotesPerPage);
        return () => mobileQuery.removeEventListener('change', updateLotesPerPage);
    }, []);

    useEffect(() => {
        if ((isFormModalOpen || viewFalecido) && !location.state?.__sgcModalHistory) {
            pushModalHistory();
        }
    }, []);

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
    const [isBulkLotesModalOpen, setIsBulkLotesModalOpen] = useState(false);
    const [bulkLoteStart, setBulkLoteStart] = useState('1');
    const [bulkLoteQuantity, setBulkLoteQuantity] = useState('10');
    const [isCreatingBulkLotes, setIsCreatingBulkLotes] = useState(false);

    useEffect(() => {
        const closeLotActionsMenu = (event) => {
            const menu = lotActionsMenuRef.current;
            const quadraMenus = document.querySelectorAll('[data-quadra-actions-menu]');
            if (event.type === 'keydown' && event.key === 'Escape') {
                if (menu) menu.open = false;
                quadraMenus.forEach((quadraMenu) => { quadraMenu.open = false; });
                return;
            }
            if (event.type === 'pointerdown') {
                if (menu && !menu.contains(event.target)) menu.open = false;
                quadraMenus.forEach((quadraMenu) => {
                    if (!quadraMenu.contains(event.target)) quadraMenu.open = false;
                });
            }
        };
        document.addEventListener('pointerdown', closeLotActionsMenu);
        document.addEventListener('keydown', closeLotActionsMenu);
        return () => {
            document.removeEventListener('pointerdown', closeLotActionsMenu);
            document.removeEventListener('keydown', closeLotActionsMenu);
        };
    }, []);

    const [formData, setFormData] = useState({
        nome: '', dataNascimento: '', dataMorte: '',
        setor: '', lote: '',
        descricao: '', biografia: '', imagem: '', tipo: 'historica'
    });

    const normalizeFalecidosFromApi = (items) => items.map((item) => {
        const galeria = normalizeGallery(item);
        return {
            ...item,
            localizacao: item.localizacao || `Quadra A, Lote 1`,
            tipo: item.tipo || 'historica',
            imagem: resolveOnce(item.imagem) || galeria[0] || personPlaceholder,
            galeria,
            descricao: item.descricao || item.biografia || '',
            dataNascimento: item.dataNascimento || '',
            dataMorte: item.dataMorte || '',
        };
    });

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
                    const lotesDaQuadra = Array.isArray(data) ? data : [];
                    const ocupados = lotesDaQuadra.filter((lote) => falecidos.some((falecido) =>
                        (falecido.loteId != null && lote.id != null && String(falecido.loteId) === String(lote.id))
                        || falecido.localizacao === `Quadra ${quadra.nome}, Lote ${lote.numero}`
                    )).length;
                    return [quadra.id, { total: lotesDaQuadra.length, ocupados, vazios: lotesDaQuadra.length - ocupados }];
                } catch (error) {
                    console.error(`Erro ao contar lotes da quadra ${quadra.nome}:`, error);
                    return [quadra.id, { total: 0, ocupados: 0, vazios: 0 }];
                }
            }));

            if (!cancelado) {
                setQuantidadeLotesPorQuadra(Object.fromEntries(resultados.map(([id, resumo]) => [id, resumo.total])));
                setOcupacaoLotesPorQuadra(Object.fromEntries(resultados.map(([id, resumo]) => [id, resumo])));
            }
        }

        if (quadras.length > 0) carregarContagemLotes();

        return () => { cancelado = true; };
    }, [quadras, falecidos]);

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
        if (editHandledRef.current) return;
        const editId = location.state?.editFalecidoId;
        if (!editId || falecidos.length === 0) return;
        const found = falecidos.find((m) => m.id === editId);
        if (found) {
            editHandledRef.current = true;
            openEditModal(found);
        }
    }, [location.state?.editFalecidoId, falecidos]);

    // --- DADOS DERIVADOS ---
    const quadraSelecionada = quadras.find(q => q.nome === selectedQuadra) || null;
    const carregandoLotes = Boolean(quadraSelecionada) && quadraDosLotes !== quadraSelecionada.id;

    const ajustarContagemLotes = (quadraId, diferenca) => {
        setQuantidadeLotesPorQuadra((contagens) => {
            const contagemAtual = contagens[quadraId]
                ?? (quadraSelecionada?.id === quadraId ? lotes.length : 0);
            return {
                ...contagens,
                [quadraId]: Math.max(0, contagemAtual + diferenca),
            };
        });
    };

    const ajustarResumoLotes = (quadraId, total, ocupados, vazios) => {
        setOcupacaoLotesPorQuadra((resumos) => {
            const atual = resumos[quadraId] || { total: lotes.length, ocupados: 0, vazios: lotes.length };
            return {
                ...resumos,
                [quadraId]: {
                    total: Math.max(0, atual.total + total),
                    ocupados: Math.max(0, atual.ocupados + ocupados),
                    vazios: Math.max(0, atual.vazios + vazios),
                },
            };
        });
    };

    const quadrasComCount = quadras.map(q => ({
        id: q.id,
        nome: q.nome,
        count: quantidadeLotesPorQuadra[q.id] ?? 0,
        ocupados: ocupacaoLotesPorQuadra[q.id]?.ocupados ?? 0,
        vazios: ocupacaoLotesPorQuadra[q.id]?.vazios ?? 0,
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
        count: falecidos.filter((falecido) =>
            (falecido.loteId != null && lote.id != null && String(falecido.loteId) === String(lote.id))
            || falecido.localizacao === `Quadra ${selectedQuadra}, Lote ${lote.numero}`
        ).length
    }));

    const lotesVazios = lotesComCount.filter((lote) => lote.count === 0).length;
    const lotesComUmFalecido = lotesComCount.filter((lote) => lote.count === 1).length;
    const lotesComMultiplosFalecidos = lotesComCount.filter((lote) => lote.count > 1).length;
    const totalFalecidosNosLotes = lotesComCount.reduce((total, lote) => total + lote.count, 0);
    const lotesVisiveis = lotesComCount.filter((lote) => {
        const matchesOccupancy = lotOccupancyFilter === 'all'
            || (lotOccupancyFilter === 'one' && lote.count === 1)
            || (lotOccupancyFilter === 'multiple' && lote.count >= 2)
            || (lotOccupancyFilter === 'empty' && lote.count === 0);
        const matchesSearch = String(lote.nome).toLowerCase().includes(lotSearchTerm.trim().toLowerCase());
        return matchesOccupancy && matchesSearch;
    });
    const totalLotePages = Math.max(1, Math.ceil(lotesVisiveis.length / lotesPerPage));
    const paginaLoteAtual = Math.min(currentLotePage, totalLotePages);
    const startLoteIndex = (paginaLoteAtual - 1) * lotesPerPage;
    const lotesDaPagina = lotesVisiveis.slice(startLoteIndex, startLoteIndex + lotesPerPage);
    const primeiroLoteDaPagina = lotesDaPagina[0]?.nome;
    const ultimoLoteDaPagina = lotesDaPagina[lotesDaPagina.length - 1]?.nome;
    const loteSelecionado = lotesDaQuadra.find((lote) => String(lote.numero || lote.nome || lote.id) === String(selectedLote)) || null;
    const indiceLoteSelecionado = lotesDaQuadra.findIndex((lote) => String(lote.numero || lote.nome || lote.id) === String(selectedLote));

    const memoriaisDoLote = (selectedQuadra && selectedLote)
        ? falecidos.filter((falecido) =>
            (falecido.loteId != null && loteSelecionado?.id != null && String(falecido.loteId) === String(loteSelecionado.id))
            || falecido.localizacao === `Quadra ${selectedQuadra}, Lote ${selectedLote}`
        )
        : [];

    const filteredMemoriais = memoriaisDoLote;

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
            } else if (imageRemoved) {
                form.append('imagem', '');
            } else if (imagemAlterada) {
                form.append('imagem', formData.imagem.trim());
            }

            if (selectedGalleryFiles.length > 0) {
                selectedGalleryFiles.forEach((file) => {
                    form.append('galeria', file);
                });
            }

            const payload = selectedImageFile || selectedGalleryFiles.length > 0 || imageRemoved
                ? form
                : {
                    nome: formData.nome,
                    biografia: formData.biografia || '',
                    descricao: formData.descricao || '',
                    dataNascimento: formatarData(formData.dataNascimento),
                    dataMorte: formatarData(formData.dataMorte),
                    localizacao,
                    tipo: formData.tipo || 'historica',
                    ...(imageRemoved ? { imagem: '' } : imagemAlterada ? { imagem: formData.imagem.trim() } : {}),
                };

            if (selectedFalecido) {
                const updated = await apiUpdateFalecido(selectedFalecido.id, payload, token);
                setFalecidos((current) => normalizeFalecidosFromApi(
                    current.map((item) => item.id === selectedFalecido.id
                        ? { ...item, ...updated, ...(imageRemoved ? { imagem: '' } : {}), localizacao }
                        : item)
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

    const dataParaInput = (valor = '') => {
        const isoDate = valor.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoDate) return isoDate[1];
        const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let v = value;
        if (name === 'dataNascimento' || name === 'dataMorte') v = formatarData(value);
        else if (name === 'setor') v = value.toUpperCase();
        if (name === 'imagem') setSelectedImageFile(null);
        setFormData(prev => ({ ...prev, [name]: v }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        setImageRemoved(false);
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

    const handleGalleryUpload = (files) => {
        if (files.length > 0) setSelectedGalleryFiles((current) => [...current, ...files].slice(0, 10));
    };
    const removeGalleryImage = (index) => setSelectedGalleryFiles((files) => files.filter((_, fileIndex) => fileIndex !== index));

    // --- MODAL FALECIDO ---
    function openEditModal(falecido) {
        pushModalHistory();
        setSelectedFalecido(falecido);
        setImageRemoved(false);
        let setor = '', lote = '';
        if (falecido.localizacao) {
            const s = falecido.localizacao.match(/Quadra\s+(.+?),/i);
            const l = falecido.localizacao.match(/Lote\s+(.+?)$/i);
            if (s) setor = s[1].trim();
            if (l) lote = l[1].trim();
        }
        setSelectedQuadra(setor || null);
        setSelectedLote(lote || null);
        setFormData({ ...falecido, setor, lote });
        setSelectedImageFile(null);
        setImagePreview(falecido.imagem || '');
        setIsFormModalOpen(true);
    }

    const openNewFalecidoModal = () => {
        pushModalHistory();
        setFormData({ nome: '', dataNascimento: '', dataMorte: '', setor: selectedQuadra || '', lote: selectedLote || '', descricao: '', biografia: '', imagem: '', tipo: 'historica' });
        setSelectedFalecido(null);
        setSelectedImageFile(null);
        setImageRemoved(false);
        setSelectedGalleryFiles([]);
        setImagePreview('');
        setIsFormModalOpen(true);
    };

    const openFalecidoDetails = (falecido) => {
        pushModalHistory();
        setViewFalecido(falecido);
    };

    const closeFalecidoDetails = () => {
        setViewFalecido(null);
        closeModalHistory();
    };

    const closeFormModal = () => {
        setSelectedFalecido(null);
        setSelectedImageFile(null);
        setImageRemoved(false);
        setImagePreview('');
        setSelectedGalleryFiles([]);
        setFormData({
            nome: '', dataNascimento: '', dataMorte: '',
            setor: selectedQuadra || '', lote: '',
            descricao: '', biografia: '', imagem: '', tipo: 'historica'
        });
        setIsFormModalOpen(false);
        closeModalHistory();
    };

    const removeProfileImage = () => {
        setSelectedImageFile(null);
        setImagePreview('');
        setImageRemoved(Boolean(selectedFalecido?.imagem && selectedFalecido.imagem !== personPlaceholder) || Boolean(selectedImageFile));
        setFormData((current) => ({ ...current, imagem: '' }));
        if (imageInputRef.current) imageInputRef.current.value = '';
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

    const openBulkLotesModal = () => {
        const numerosExistentes = lotes
            .map((lote) => Number(lote.numero))
            .filter((numero) => Number.isSafeInteger(numero) && numero >= 0);
        const proximoNumero = Math.max(0, ...numerosExistentes) + 1;
        setBulkLoteStart(String(proximoNumero));
        setBulkLoteQuantity('10');
        setIsBulkLotesModalOpen(true);
    };

    const saveBulkLotes = async (event) => {
        event.preventDefault();
        const numeroInicial = Number(bulkLoteStart);
        const quantidade = Number(bulkLoteQuantity);
        if (!quadraSelecionada || !Number.isSafeInteger(numeroInicial) || numeroInicial < 1
            || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 1000) return;

        const numerosExistentes = new Set(lotes.map((lote) => String(lote.numero ?? lote.nome)));
        const sequencia = Array.from({ length: quantidade }, (_, index) => numeroInicial + index);
        const numerosParaCriar = sequencia.filter((numero) => !numerosExistentes.has(String(numero)));
        const existentesIgnorados = sequencia.length - numerosParaCriar.length;

        if (numerosParaCriar.length === 0) {
            window.alert('Todos os números dessa sequência já estão cadastrados nesta quadra.');
            return;
        }

        setIsCreatingBulkLotes(true);
        let lotesCriados = 0;
        try {
            for (let index = 0; index < numerosParaCriar.length; index += 10) {
                const grupo = numerosParaCriar.slice(index, index + 10);
                const resultados = await Promise.allSettled(
                    grupo.map((numero) => createLote(quadraSelecionada.id, String(numero), getToken()))
                );
                lotesCriados += resultados.filter((resultado) => resultado.status === 'fulfilled').length;
                const falha = resultados.find((resultado) => resultado.status === 'rejected');
                if (falha) {
                    const detalhe = falha.reason?.message || 'Não foi possível concluir a sequência.';
                    if (lotesCriados > 0) {
                        throw new Error(`Foram criados ${lotesCriados} lotes antes da falha: ${detalhe}`);
                    }
                    throw new Error(detalhe);
                }
            }

            setCurrentLotePage(1);
            setLotSearchTerm('');
            setLotOccupancyFilter('all');
            setIsBulkLotesModalOpen(false);
            ajustarContagemLotes(quadraSelecionada.id, lotesCriados);
            ajustarResumoLotes(quadraSelecionada.id, lotesCriados, 0, lotesCriados);
            await recarregarLotes();
            if (existentesIgnorados > 0) {
                window.alert(`${lotesCriados} lotes criados. ${existentesIgnorados} número(s) que já existiam foram ignorados.`);
            }
        } catch (error) {
            if (lotesCriados > 0) {
                ajustarContagemLotes(quadraSelecionada.id, lotesCriados);
                ajustarResumoLotes(quadraSelecionada.id, lotesCriados, 0, lotesCriados);
                await recarregarLotes();
            }
            window.alert(error.message || 'Não foi possível criar os lotes.');
        } finally {
            setIsCreatingBulkLotes(false);
        }
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
                ajustarContagemLotes(quadraSelecionada.id, 1);
                ajustarResumoLotes(quadraSelecionada.id, 1, 0, 1);
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
            <>Isso <strong className={styles.confirmEmphasis}>removerá o Lote {lote}</strong> da <strong className={styles.confirmEmphasis}>Quadra {selectedQuadra}</strong> e <strong className={styles.confirmEmphasis}>TODOS os falecidos</strong> dentro dele. Esta ação <strong className={styles.confirmEmphasis}>não pode ser desfeita</strong>.</>,
            async () => {
                const alvo = lotes.find(l => l.numero === lote);
                if (!alvo) return;
                const estavaOcupado = falecidos.some((falecido) =>
                    (falecido.loteId != null && alvo.id != null && String(falecido.loteId) === String(alvo.id))
                    || falecido.localizacao === `Quadra ${selectedQuadra}, Lote ${lote}`
                );

                try {
                    const resultado = await deleteLote(alvo.id, getToken());
                    ajustarContagemLotes(quadraSelecionada.id, -1);
                    ajustarResumoLotes(quadraSelecionada.id, -1, estavaOcupado ? -1 : 0, estavaOcupado ? 0 : -1);
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
        if (!selectedQuadra) return;
        replaceAdminHistory({ __adminQuadra: null, __adminLote: null });
        setSelectedQuadra(null);
        setSelectedLote(null);
    };

    const selecionarQuadra = (nome) => {
        if (String(selectedQuadra) === String(nome)) return;
        pushAdminHistory({ __adminQuadra: nome, __adminLote: null });
        setSelectedQuadra(nome);
        setSelectedLote(null);
        setLotOccupancyFilter('all');
        setLotSearchTerm('');
        setCurrentPage(1);
    };

    const selecionarLote = (numero) => {
        if (String(selectedLote) === String(numero)) return;
        const stateUpdates = { __adminQuadra: selectedQuadra, __adminLote: numero };
        replaceAdminHistory(stateUpdates);
        setSelectedLote(numero);
        setCurrentPage(1);
    };

    const limparLoteSelecionado = () => {
        if (location.state?.__adminLote != null) {
            replaceAdminHistory({ __adminQuadra: selectedQuadra, __adminLote: null });
        }
        setSelectedLote(null);
    };

    const nivelAtual = selectedQuadra ? 'quadra' : 'inicio';

    return (
        <div className={styles.adminLayout}>
            <AdminSidebar onLogout={onLogout} />
            <main className={styles.mainContent}>
                <div className={styles.container}>
                    {nivelAtual === 'inicio' ? (
                        <header className={styles.quadrasOverviewHeader}>
                            <div className={styles.overviewTitleRow}>
                                <div className={styles.overviewTitleInfo}>
                                    <h1>Quadras</h1>
                                    <p>Selecione uma quadra para ver os lotes.</p>
                                </div>
                                <button className={styles.addButton} onClick={() => openQuadraModal()}><Plus size={18} />Nova Quadra</button>
                            </div>
                        </header>
                    ) : (
                        <header className={styles.header}>
                            <div className={styles.quadraTitleGroup}>
                                <button className={styles.backBtn} onClick={goBack}><ChevronLeft size={16} />Todas as quadras</button>
                                <h1 className={styles.title}>Quadra {selectedQuadra}</h1>
                            </div>
                            <div className={styles.headerActions}>
                                <button className={styles.bulkCreateButton} onClick={openBulkLotesModal}><Plus size={18} />Criar v&aacute;rios lotes</button>
                                <button className={styles.addButton} onClick={() => openLoteModal()}><Plus size={18} />Novo Lote</button>
                            </div>
                        </header>
                    )}
                    {nivelAtual === 'inicio' && <AdminQuadras quadras={quadrasComCount} carregando={carregandoQuadras} onSelect={selecionarQuadra} onQrCode={openQuadraQrModal} onEdit={openQuadraModal} onDelete={handleDeleteQuadra} />}
                    {nivelAtual === 'quadra' && <AdminLotes
                        lotesComCount={lotesComCount} lotesVisiveis={lotesVisiveis} lotesDaPagina={lotesDaPagina} lotesDaQuadra={lotesDaQuadra} lotesPerPage={lotesPerPage} carregandoLotes={carregandoLotes}
                        lotesVazios={lotesVazios} lotesComUmFalecido={lotesComUmFalecido} lotesComMultiplosFalecidos={lotesComMultiplosFalecidos} totalFalecidosNosLotes={totalFalecidosNosLotes} totalLotePages={totalLotePages} paginaLoteAtual={paginaLoteAtual} setCurrentLotePage={setCurrentLotePage}
                        lotSearchTerm={lotSearchTerm} setLotSearchTerm={setLotSearchTerm} lotOccupancyFilter={lotOccupancyFilter} setLotOccupancyFilter={setLotOccupancyFilter} primeiroLoteDaPagina={primeiroLoteDaPagina} ultimoLoteDaPagina={ultimoLoteDaPagina}
                        onSelectLote={selecionarLote} selectedQuadra={selectedQuadra} selectedLote={selectedLote} setSelectedLote={limparLoteSelecionado} loteSelecionado={loteSelecionado} indiceLoteSelecionado={indiceLoteSelecionado} memoriaisDoLote={memoriaisDoLote}
                        lotActionsMenuRef={lotActionsMenuRef} onOpenLoteQrModal={openLoteQrModal} onOpenLoteModal={openLoteModal} onDeleteLote={handleDeleteLote}
                        onAddFalecido={openNewFalecidoModal}
                        isLoading={isLoading} currentMemoriais={currentMemoriais} viewFalecido={viewFalecido} onViewFalecido={openFalecidoDetails} onOpenQrModal={openQrModal} onOpenEditModal={openEditModal} onDeleteFalecido={deleteFalecido}
                        totalPages={totalPages} startIndex={startIndex} filteredMemoriais={filteredMemoriais} currentPage={currentPage} setCurrentPage={setCurrentPage} getPageItems={getPageItems} itemsPerPage={ITEMS_PER_PAGE}
                    />}
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

            {isBulkLotesModalOpen && (
                <div className={styles.modalOverlay} onClick={() => !isCreatingBulkLotes && setIsBulkLotesModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Criar v&aacute;rios lotes &mdash; Quadra {selectedQuadra}</h2>
                            <button type="button" className={styles.closeBtn} onClick={() => setIsBulkLotesModalOpen(false)} disabled={isCreatingBulkLotes} aria-label="Fechar"><X size={24} /></button>
                        </div>
                        <form onSubmit={saveBulkLotes} className={styles.form}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}><label htmlFor="bulk-lote-start">N&uacute;mero inicial *</label><input id="bulk-lote-start" type="number" min="1" required value={bulkLoteStart} onChange={(event) => setBulkLoteStart(event.target.value)} /></div>
                                <div className={styles.formGroup}><label htmlFor="bulk-lote-quantity">Quantidade *</label><input id="bulk-lote-quantity" type="number" min="1" max="1000" required value={bulkLoteQuantity} onChange={(event) => setBulkLoteQuantity(event.target.value)} /></div>
                            </div>
                            <div className={styles.modalActions}><button type="button" className={styles.cancelBtn} onClick={() => setIsBulkLotesModalOpen(false)} disabled={isCreatingBulkLotes}>Cancelar</button><button type="submit" className={styles.saveBtn} disabled={isCreatingBulkLotes}>{isCreatingBulkLotes ? 'Criando...' : 'Criar lotes'}</button></div>
                        </form>
                    </div>
                </div>
            )}

            {isFormModalOpen && <FalecidoFormModal
                selectedFalecido={selectedFalecido} requiredFields formData={formData} onClose={closeFormModal} onSubmit={saveFalecido} onInputChange={handleInputChange} setFormData={setFormData}
                datePickerRefs={{ birth: nascimentoDatePickerRef, death: morteDatePickerRef }} openCalendar={abrirCalendario} dateToInput={dataParaInput} formatDate={formatarData}
                quadraOptions={quadras.map((quadra) => quadra.nome)} loteOptions={lotes.map((lote) => lote.numero || lote.nome || lote.id)}
                onQuadraChange={(setor) => { setSelectedQuadra(setor || null); setSelectedLote(null); setFormData((current) => ({ ...current, setor: setor.toUpperCase(), lote: '' })); }}
                onLoteChange={(lote) => setFormData((current) => ({ ...current, lote }))}
                imageInputRef={imageInputRef} onImageUpload={handleImageUpload} imagePreview={imagePreview} resolveImage={resolveOnce}
                imageRemoved={imageRemoved} selectedImageFile={selectedImageFile} selectedGalleryFiles={selectedGalleryFiles} onRemoveImage={removeProfileImage} onGalleryUpload={handleGalleryUpload} onRemoveGalleryImage={removeGalleryImage}
            />}

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
                            <h2>{selectedFalecido.nome}</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p>Escaneie para acessar o falecido de <strong>{selectedFalecido.nome}</strong><br />{selectedFalecido.localizacao || `Quadra ${selectedQuadra}, Lote ${selectedLote}`}</p>
                            <div className={styles.qrCodeBox} ref={deceasedQrBoxRef}>
                                <QRCode value={qrCodeUrl} size={200} fgColor="#000000" />
                            </div>
                            <div className={styles.qrCopyLinkRow}><CopyLinkButton url={qrCodeUrl} /></div>
                            <div className={styles.qrExportActions}>
                                <QrImageDownloadButtons className={styles.qrExportButtonGroup} containerRef={deceasedQrBoxRef} fileName={`falecido-${selectedFalecido.nome}-${selectedFalecido.localizacao || `Quadra ${selectedQuadra}, Lote ${selectedLote}`}`} title={selectedFalecido.nome} subtitle={selectedFalecido.localizacao || `Quadra ${selectedQuadra}, Lote ${selectedLote}`} />
                                <button className={styles.saveBtn} onClick={() => window.print()}><Printer size={16} /> Imprimir Placa</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL QR CODE DO LOTE --- */}
            {isLoteQrModalOpen && loteQrData && (
                <div className={styles.modalOverlay} onClick={() => setIsLoteQrModalOpen(false)}>
                    <div className={styles.modalContentSmall} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.qrHeader}>
                            <h2>Lote {loteQrData.nome}</h2>
                            <button className={styles.closeBtn} onClick={() => setIsLoteQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p className={styles.loteQrCount}>
                                {loteQrData.people.length} {loteQrData.people.length === 1 ? 'falecido' : 'falecidos'} neste lote
                            </p>
                            <div className={styles.qrCodeBox} ref={lotQrBoxRef}>
                                <QRCode value={loteQrUrl} size={200} fgColor="#000000" />
                            </div>
                            <div className={`${styles.loteQrCopy} ${styles.qrCopyLinkRow}`}>
                                <CopyLinkButton url={loteQrUrl} />
                            </div>
                            <div className={styles.qrExportActions}>
                                <QrImageDownloadButtons
                                    className={styles.qrExportButtonGroup}
                                    containerRef={lotQrBoxRef}
                                    fileName={`quadra-${selectedQuadra}-lote-${loteQrData.nome}`}
                                    title={`Lote ${loteQrData.nome}`}
                                    subtitle={`Quadra ${selectedQuadra} · Lote ${loteQrData.nome}`}
                                />
                                <button className={styles.saveBtn} onClick={() => window.print()}><Printer size={16} /> Imprimir Placa</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL QR CODE DA QUADRA --- */}
            {isQuadraQrModalOpen && quadraQrData && (
                <div className={styles.modalOverlay} onClick={() => setIsQuadraQrModalOpen(false)}>
                    <div className={styles.modalContentSmall} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.qrHeader}>
                            <h2>Quadra {quadraQrData.nome}</h2>
                            <button className={styles.closeBtn} onClick={() => setIsQuadraQrModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className={styles.qrContainer}>
                            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '16px' }}>
                                {quadraQrData.loteCount} {quadraQrData.loteCount === 1 ? 'lote' : 'lotes'} nesta quadra
                            </p>
                            <div className={styles.qrCodeBox} ref={quadraQrBoxRef}>
                                <QRCode value={quadraQrUrl} size={200} fgColor="#000000" />
                            </div>
                            <div className={styles.qrCopyLinkRow}><CopyLinkButton url={quadraQrUrl} /></div>
                            <div className={styles.qrExportActions}>
                                <QrImageDownloadButtons
                                    className={styles.qrExportButtonGroup}
                                    containerRef={quadraQrBoxRef}
                                    fileName={`quadra-${quadraQrData.nome}`}
                                    title={`Quadra ${quadraQrData.nome}`}
                                />
                                <button className={styles.saveBtn} onClick={() => window.print()}><Printer size={16} /> Imprimir Placa</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <FalecidoDetailsModal falecido={viewFalecido} onClose={closeFalecidoDetails} />
        </div>
    );
}
