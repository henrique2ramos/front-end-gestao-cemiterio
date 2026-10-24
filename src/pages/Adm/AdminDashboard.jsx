import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Users, Plus, Search, Map as MapIcon, MapPin, ChevronRight, ChevronDown, ArrowRight, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { createFalecido, fetchFalecidos, fetchLotes, fetchQuadras, resolveImageUrl } from '../../lib/api';
import { unwrapPage, isDataDesconhecida } from '../../data/adminPagination';
import personPlaceholder from '../../assets/person-placeholder.svg';
import FalecidoFormModal from '../../components/FalecidoFormModal';
import styles from './AdminDashboard.module.css';

const EMPTY_FORM = {
    nome: '', dataNascimento: '', dataMorte: '', setor: '', lote: '',
    descricao: '', biografia: '', tipo: 'historica',
};

const getToken = () => localStorage.getItem('memorialAdminToken') || '';
const isAbsoluteUrl = (src) => /^(https?:)?\/\//i.test(src) || src.startsWith('data:');
const resolveOnce = (src) => (!src || isAbsoluteUrl(src) ? src : resolveImageUrl(src));

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR') : '—');

function parseLocalizacao(texto = '') {
    const quadra = texto.match(/Quadra\s+(.+?)(?:,|$)/i)?.[1]?.trim() || '';
    const lote = texto.match(/Lote\s+(.+?)$/i)?.[1]?.trim() || '';
    return { quadra, lote };
}

function formatPeriodo(nascimento, morte) {
    const n = isDataDesconhecida(nascimento);
    const m = isDataDesconhecida(morte);
    if (n && m) return 'Datas não informadas';
    return `${n ? '—' : nascimento} — ${m ? '—' : morte}`;
}

export default function AdminDashboard({ onLogout }) {
    const navigate = useNavigate();
    const birthDatePickerRef = useRef(null);
    const deathDatePickerRef = useRef(null);
    const imageInputRef = useRef(null);
    const registrosParaBuscaRef = useRef(null);
    const [ultimos, setUltimos] = useState([]);
    const [totalFalecidos, setTotalFalecidos] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEstruturaLoading, setIsEstruturaLoading] = useState(true);
    const [estruturaError, setEstruturaError] = useState('');
    const [totaisEstrutura, setTotaisEstrutura] = useState(null);
    const [busca, setBusca] = useState('');
    const [resultadosBusca, setResultadosBusca] = useState(null);
    const [buscando, setBuscando] = useState(false);
    const [erroBusca, setErroBusca] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [quadrasDisponiveis, setQuadrasDisponiveis] = useState([]);
    const [lotesDisponiveis, setLotesDisponiveis] = useState([]);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [imageRemoved, setImageRemoved] = useState(false);
    const [selectedGalleryFiles, setSelectedGalleryFiles] = useState([]);

    const hoje = useMemo(() => {
        const texto = new Intl.DateTimeFormat('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long',
        }).format(new Date());
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }, []);

    useEffect(() => {
        let cancelado = false;
        fetchQuadras()
            .then((data) => {
                const items = Array.isArray(data) ? data : data?.items || [];
                if (!cancelado) setQuadrasDisponiveis(items);
            })
            .catch((error) => console.error('Erro ao buscar quadras para o cadastro:', error));
        return () => { cancelado = true; };
    }, []);

    useEffect(() => {
        let cancelado = false;
        const quadra = quadrasDisponiveis.find((item) => item.nome === formData.setor);
        if (!quadra) {
            setLotesDisponiveis([]);
            return undefined;
        }

        fetchLotes(quadra.id, { page: 1, limit: 1000 })
            .then((data) => {
                const items = Array.isArray(data) ? data : data?.items || [];
                if (!cancelado) setLotesDisponiveis(items);
            })
            .catch((error) => {
                console.error('Erro ao buscar lotes para o cadastro:', error);
                if (!cancelado) setLotesDisponiveis([]);
            });
        return () => { cancelado = true; };
    }, [formData.setor, quadrasDisponiveis]);

    useEffect(() => {
        let cancelado = false;
        async function loadMemoriais() {
            try {
                const res = await fetchFalecidos({ page: 1, limit: 5 });
                const page = unwrapPage(res, { page: 1, limit: 5 });
                if (cancelado) return;
                setUltimos(page.items);
                setTotalFalecidos(page.total);
            } catch (error) {
                console.error('Erro ao buscar memoriais no dashboard:', error);
                if (!cancelado) { setUltimos([]); setTotalFalecidos(null); }
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        }
        loadMemoriais();
        return () => { cancelado = true; };
    }, [reloadKey]);

    useEffect(() => {
        let cancelado = false;
        async function loadEstrutura() {
            try {
                const quadrasData = await fetchQuadras();
                const quadras = Array.isArray(quadrasData) ? quadrasData : quadrasData?.items;
                if (!Array.isArray(quadras)) throw new Error('Formato inválido para as quadras.');

                const totaisLotes = await Promise.all(
                    quadras.map(async (quadra) => {
                        const data = await fetchLotes(quadra.id);
                        if (!Array.isArray(data) && !Array.isArray(data?.items)) {
                            throw new Error(`Formato inválido: quadra ${quadra.nome}.`);
                        }
                        return Array.isArray(data) ? data.length : (data.total ?? data.items.length);
                    })
                );

                if (!cancelado) {
                    setTotaisEstrutura({
                        quadras: quadras.length,
                        lotes: totaisLotes.reduce((a, b) => a + b, 0),
                    });
                }
            } catch (error) {
                console.error('Erro ao buscar estrutura:', error);
                if (!cancelado) {
                    setTotaisEstrutura(null);
                    setEstruturaError('Não foi possível carregar os totais de quadras e lotes.');
                }
            } finally {
                if (!cancelado) setIsEstruturaLoading(false);
            }
        }
        loadEstrutura();
        return () => { cancelado = true; };
    }, []);

    useEffect(() => {
        const termo = busca.trim();
        if (!termo) {
            setResultadosBusca(null);
            setErroBusca('');
            setBuscando(false);
            return undefined;
        }

        setResultadosBusca([]);
        let cancelado = false;
        const timer = window.setTimeout(async () => {
            setBuscando(true);
            setErroBusca('');
            try {
                let registros = registrosParaBuscaRef.current;
                if (!registros) {
                    const resposta = await fetchFalecidos();
                    registros = Array.isArray(resposta)
                        ? resposta
                        : resposta?.items || resposta?.data || resposta?.falecidos || [];
                    if (!cancelado) registrosParaBuscaRef.current = registros;
                }

                if (cancelado) return;
                const normalizar = (valor) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
                const termoNormalizado = normalizar(termo);
                setResultadosBusca(registros.filter((registro) => normalizar(registro.nome).includes(termoNormalizado)));
            } catch (error) {
                console.error('Erro ao buscar falecidos no painel:', error);
                if (!cancelado) {
                    setErroBusca('Não foi possível realizar a busca. Tente novamente.');
                    setResultadosBusca([]);
                }
            } finally {
                if (!cancelado) setBuscando(false);
            }
        }, 250);

        return () => {
            cancelado = true;
            window.clearTimeout(timer);
        };
    }, [busca]);

    const openNewMemorialModal = () => {
        setFormData(EMPTY_FORM);
        setSelectedImageFile(null);
        setImagePreview('');
        setImageRemoved(false);
        setSelectedGalleryFiles([]);
        setLotesDisponiveis([]);
        setIsFormModalOpen(true);
    };

    const closeMemorialModal = () => {
        setIsFormModalOpen(false);
        setFormData(EMPTY_FORM);
        setSelectedImageFile(null);
        setImagePreview('');
        setImageRemoved(false);
        setSelectedGalleryFiles([]);
        setLotesDisponiveis([]);
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const formatDate = (value = '') => {
        const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
        const digits = value.replace(/\D/g, '').slice(0, 8);
        if (digits.length <= 2) return digits;
        if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    };

    const dateToInput = (value = '') => {
        const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoDate) return isoDate[1];
        const date = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return date ? `${date[3]}-${date[2]}-${date[1]}` : '';
    };

    const handleMemorialInput = (event) => {
        const { name, value } = event.target;
        const nextValue = name === 'dataNascimento' || name === 'dataMorte'
            ? formatDate(value)
            : name === 'setor' ? value.toUpperCase() : value;
        setFormData((current) => ({ ...current, [name]: nextValue }));
    };

    const handleProfileImage = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedImageFile(file);
        setImageRemoved(false);
        if (!file) {
            setImagePreview('');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsDataURL(file);
    };

    const removeProfileImage = () => {
        setSelectedImageFile(null);
        setImagePreview('');
        setImageRemoved(true);
        setFormData((current) => ({ ...current, imagem: '' }));
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const openDatePicker = (ref) => {
        const input = ref.current;
        if (!input) return;
        try {
            if (typeof input.showPicker === 'function') input.showPicker();
            else input.click();
        } catch {
            input.click();
        }
    };

    const saveMemorial = async (event) => {
        event.preventDefault();
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

            await createFalecido(payload, getToken());
            registrosParaBuscaRef.current = null;
            closeMemorialModal();
            setIsLoading(true);
            setReloadKey((key) => key + 1);
        } catch (error) {
            window.alert(error.message || 'Não foi possível salvar o falecido.');
        }
    };

    const buscar = (event) => {
        event.preventDefault();
        const termo = busca.trim();
        if (!termo) return;
        navigate('/admin/falecidos', { state: { search: termo } });
    };

    return (
        <div className={styles.adminLayout}>
            <AdminSidebar onLogout={onLogout} />

            <main className={styles.mainContent}>
                <div className={styles.container}>
                    <header className={styles.header}>
                        <div>
                            <p className={styles.date}>{hoje}</p>
                            <h1 className={styles.title}>Olá, Administrador</h1>
                        </div>
                        <div className={styles.userBadge}>
                            <div className={styles.userAvatar} aria-hidden="true">AD</div>
                            
                            <ChevronDown size={16} className={styles.userChevron} aria-hidden="true" />
                        </div>
                    </header>

                    <section className={styles.toolbar} aria-label="Buscar e cadastrar">
                        <div className={styles.searchContainer}>
                        <form className={styles.search} onSubmit={buscar} role="search">
                            <Search size={20} className={styles.searchIcon} aria-hidden="true" />
                            <input
                                type="text"
                                value={busca}
                                onChange={(e) => {
                                    setBusca(e.target.value);
                                }}
                                placeholder="Buscar falecido pelo nome..."
                                aria-label="Buscar falecido pelo nome"
                            />
                            {busca && (
                                <button type="button" className={styles.clearSearch} aria-label="Limpar busca" onClick={() => setBusca('')}>
                                    <X size={16} />
                                </button>
                            )}
                            <button type="submit" className={styles.searchSubmit}>Buscar</button>
                        </form>
                        {resultadosBusca !== null && (
                            <section className={styles.searchResults} aria-live="polite" aria-label="Resultados da busca">
                                <div className={styles.searchResultsHeader}>
                                    <h2>Resultados da busca</h2>
                                    <span>{buscando ? 'Buscando...' : `${resultadosBusca.length} ${resultadosBusca.length === 1 ? 'registro encontrado' : 'registros encontrados'}`}</span>
                                </div>
                                {erroBusca ? (
                                    <p className={styles.searchResultsEmpty} role="alert">{erroBusca}</p>
                                ) : buscando ? (
                                    <p className={styles.searchResultsEmpty}>Buscando falecidos...</p>
                                ) : resultadosBusca.length === 0 ? (
                                    <p className={styles.searchResultsEmpty}>Nenhum falecido encontrado com esse nome.</p>
                                ) : (
                                    <div className={styles.searchResultsList}>
                                        {resultadosBusca.slice(0, 5).map((falecido) => {
                                            const { quadra, lote } = parseLocalizacao(falecido.localizacao);
                                            const imagem = resolveOnce(falecido.imagem) || personPlaceholder;
                                            return (
                                                <article className={styles.searchResult} key={falecido.id}>
                                                    <img src={imagem} alt="" onError={(event) => { event.currentTarget.src = personPlaceholder; }} />
                                                    <div className={styles.searchResultInfo}>
                                                        <strong>{falecido.nome || 'Não identificado'}</strong>
                                                        <span>{quadra ? `Quadra ${quadra}` : 'Quadra não informada'}{lote ? ` · Lote ${lote}` : ''}</span>
                                                    </div>
                                                    <span className={styles.searchResultDates}>{formatPeriodo(falecido.dataNascimento, falecido.dataMorte)}</span>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                                {!buscando && !erroBusca && resultadosBusca.length > 0 && (
                                    <div className={styles.searchResultsFooter}>
                                        <Link to="/admin/falecidos" state={{ search: busca.trim() }}>
                                            {resultadosBusca.length > 5 ? `Ver mais resultados (${resultadosBusca.length - 5})` : 'Ver na página de falecidos'}
                                            <ArrowRight size={16} aria-hidden="true" />
                                        </Link>
                                    </div>
                                )}
                            </section>
                        )}
                        </div>
                        <button type="button" onClick={openNewMemorialModal} className={styles.primaryAction}>
                            <Plus size={18} aria-hidden="true" />
                            Novo falecido
                        </button>
                        <Link to="/mapa" target="_blank" rel="noreferrer" className={styles.secondaryAction}>
                            <MapIcon size={18} aria-hidden="true" />
                            Ver mapa
                        </Link>
                    </section>

                    <section className={styles.stats} aria-label="Totais do cemitério">
                        <Link to="/admin/falecidos" className={styles.stat}>
                            <div className={styles.statIconWrapper}>
                                <Users size={22} className={styles.statIcon} aria-hidden="true" />
                            </div>
                            <div className={styles.statInfo}>
                                <strong>{isLoading ? '…' : fmt(totalFalecidos)}</strong>
                                <span>falecidos cadastrados</span>
                            </div>
                        </Link>
                        <div className={styles.statDivider} />
                        <Link to="/admin/quadraslotes" className={styles.stat}>
                            <div className={styles.statIconWrapper}>
                                <MapIcon size={22} className={styles.statIcon} aria-hidden="true" />
                            </div>
                            <div className={styles.statInfo}>
                                <strong>{isEstruturaLoading ? '…' : fmt(totaisEstrutura?.quadras)}</strong>
                                <span>quadras mapeadas</span>
                            </div>
                        </Link>
                        <div className={styles.statDivider} />
                        <Link to="/admin/quadraslotes" className={styles.stat}>
                            <div className={styles.statIconWrapper}>
                                <MapPin size={22} className={styles.statIcon} aria-hidden="true" />
                            </div>
                            <div className={styles.statInfo}>
                                <strong>{isEstruturaLoading ? '…' : fmt(totaisEstrutura?.lotes)}</strong>
                                <span>lotes disponíveis</span>
                            </div>
                        </Link>
                    </section>
                    {estruturaError && <p className={styles.statsError} role="alert">{estruturaError}</p>}

                    <section className={styles.recent}>
                        <div className={styles.recentHeader}>
                            <h2>Últimos cadastros</h2>
                            <Link to="/admin/falecidos" className={styles.viewAll}>
                                Ver todos <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Falecido</th>
                                        <th>Quadra</th>
                                        <th>Lote</th>
                                        <th>Falecimento</th>
                                        <th aria-label="Ações" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan={5} className={styles.emptyState}>Carregando registros...</td></tr>
                                    ) : ultimos.length === 0 ? (
                                        <tr><td colSpan={5} className={styles.emptyState}>Nenhum cadastro encontrado.</td></tr>
                                    ) : ultimos.map((falecido) => {
                                        const imageUrl = resolveImageUrl(falecido.imagem);
                                        const { quadra, lote } = parseLocalizacao(falecido.localizacao);
                                        const semNome = /n[ãa]o identificado/i.test(falecido.nome || '');

                                        return (
                                            <tr
                                                key={falecido.id}
                                                className={styles.row}
                                                onClick={() => navigate('/admin/falecidos', {
                                                    state: { editFalecidoId: falecido.id, editFalecido: falecido },
                                                })}
                                                title="Clique para editar"
                                            >
                                                <td>
                                                    <div className={styles.person}>
                                                        <div className={styles.avatar}>
                                                            <img
                                                                src={imageUrl || personPlaceholder}
                                                                alt=""
                                                                onError={(event) => {
                                                                    event.currentTarget.onerror = null;
                                                                    event.currentTarget.src = personPlaceholder;
                                                                }}
                                                            />
                                                        </div>
                                                        <div className={styles.personText}>
                                                            <span className={semNome ? styles.nameUnknown : styles.name}>{falecido.nome || '—'}</span>
                                                            <span className={styles.period}>{formatPeriodo(falecido.dataNascimento, falecido.dataMorte)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{quadra ? <span className={styles.quadraChip}>{quadra}</span> : <span className={styles.muted}>—</span>}</td>
                                                <td className={styles.loteCell}>{lote || <span className={styles.muted}>—</span>}</td>
                                                <td className={isDataDesconhecida(falecido.dataMorte) ? styles.muted : styles.dateCell}>
                                                    {isDataDesconhecida(falecido.dataMorte) ? 'Não informada' : falecido.dataMorte}
                                                </td>
                                                <td className={styles.chevronCell}>
                                                    <div className={styles.actionIcon}>
                                                        <ChevronRight size={18} aria-hidden="true" />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>

            {isFormModalOpen && (
                <FalecidoFormModal
                    selectedFalecido={null}
                    requiredFields
                    formData={formData}
                    onClose={closeMemorialModal}
                    onSubmit={saveMemorial}
                    onInputChange={handleMemorialInput}
                    setFormData={setFormData}
                    datePickerRefs={{ birth: birthDatePickerRef, death: deathDatePickerRef }}
                    openCalendar={openDatePicker}
                    dateToInput={dateToInput}
                    formatDate={formatDate}
                    quadraOptions={quadrasDisponiveis.map((quadra) => quadra.nome)}
                    loteOptions={lotesDisponiveis.map((lote) => lote.numero || lote.nome || lote.id)}
                    onQuadraChange={(setor) => {
                        setLotesDisponiveis([]);
                        setFormData((current) => ({ ...current, setor: setor.toUpperCase(), lote: '' }));
                    }}
                    onLoteChange={(lote) => setFormData((current) => ({ ...current, lote }))}
                    imageInputRef={imageInputRef}
                    onImageUpload={handleProfileImage}
                    imagePreview={imagePreview}
                    resolveImage={resolveOnce}
                    imageRemoved={imageRemoved}
                    selectedImageFile={selectedImageFile}
                    onRemoveImage={removeProfileImage}
                    selectedGalleryFiles={selectedGalleryFiles}
                    onGalleryUpload={(files) => setSelectedGalleryFiles((current) => [...current, ...files].slice(0, 10))}
                    onRemoveGalleryImage={(index) => setSelectedGalleryFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}
                />
            )}
        </div>
    );
}
