import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Search, Users, X } from 'lucide-react';
import {
  fetchLotes,
  fetchFalecidosPorQuadra,
  fetchQuadra,
  resolveImageUrl,
} from '../lib/api';
import Spinner from '../components/Spinner';
import styles from './QuadraPage.module.css';
import personPlaceholder from '../assets/person-placeholder.svg';

const LOTES_POR_PAGINA_DESKTOP = 48;
const LOTES_POR_PAGINA_CELULAR = 12;
const lotNumberCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function getLoteNumero(lote) {
  return lote.numero ?? lote.nome ?? lote.id;
}

export default function QuadraPage() {
  const { id } = useParams();
  const [quadra, setQuadra] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState(null);
  const loteDetalhesRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 680px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 680px)');
    const atualizarLayout = () => {
      setIsMobile(media.matches);
      setPagina(1);
      setLoteSelecionadoId(null);
    };

    media.addEventListener('change', atualizarLayout);
    return () => media.removeEventListener('change', atualizarLayout);
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setIsLoading(true);
      setErro(null);
      setLoteSelecionadoId(null);

      try {
        const [dadosQuadra, dadosLotes, dadosMemoriais] = await Promise.all([
          fetchQuadra(id),
          fetchLotes(id),
          fetchFalecidosPorQuadra(id),
        ]);

        if (cancelado) return;
        setQuadra(dadosQuadra?.quadra || dadosQuadra?.item || dadosQuadra);
        setLotes(getItems(dadosLotes));
        setPessoas(getItems(dadosMemoriais));
      } catch (error) {
        if (cancelado) return;
        console.error('Erro ao carregar a quadra:', error);
        setQuadra(null);
        setLotes([]);
        setPessoas([]);
        setErro(error.message || 'Não foi possível carregar esta quadra.');
      } finally {
        if (!cancelado) setIsLoading(false);
      }
    }

    carregar();
    return () => { cancelado = true; };
  }, [id]);

  const porLote = useMemo(() => lotes
    .map((lote) => ({
      ...lote,
      numero: getLoteNumero(lote),
      pessoas: pessoas.filter((pessoa) => String(pessoa.loteId) === String(lote.id)),
    }))
    .sort((a, b) => lotNumberCollator.compare(String(a.numero), String(b.numero))), [lotes, pessoas]);

  const lotesFiltrados = useMemo(() => porLote.filter((lote) => {
    const correspondeBusca = String(lote.numero).toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'));
    const correspondeFiltro = filtro === 'todos'
      || (filtro === 'vazios' && lote.pessoas.length === 0)
      || (filtro === 'ocupados' && lote.pessoas.length > 0);
    return correspondeBusca && correspondeFiltro;
  }), [porLote, busca, filtro]);

  const lotesPorPagina = isMobile ? LOTES_POR_PAGINA_CELULAR : LOTES_POR_PAGINA_DESKTOP;
  const totalPaginas = Math.max(1, Math.ceil(lotesFiltrados.length / lotesPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * lotesPorPagina;
  const lotesVisiveis = lotesFiltrados.slice(inicio, inicio + lotesPorPagina);
  const ocupados = porLote.filter((lote) => lote.pessoas.length > 0).length;
  const vazios = porLote.length - ocupados;
  const totalPessoas = porLote.reduce((total, lote) => total + lote.pessoas.length, 0);
  const loteSelecionado = porLote.find((lote) => String(lote.id) === String(loteSelecionadoId));

  useEffect(() => {
    if (!loteSelecionadoId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      loteDetalhesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loteSelecionadoId]);

  const alterarBusca = (value) => {
    setBusca(value);
    setPagina(1);
    setLoteSelecionadoId(null);
  };

  const alterarFiltro = (value) => {
    setFiltro(value);
    setPagina(1);
    setLoteSelecionadoId(null);
  };

  if (isLoading) {
    return <div className={styles.page}><div className={styles.container}><section className={styles.stateCard}><Spinner label="Carregando quadra..." /></section></div></div>;
  }

  if (erro || !quadra) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <section className={styles.stateCard}>
            <MapPin size={38} aria-hidden="true" />
            <h1>Quadra não encontrada</h1>
            <p>{erro || 'Nenhuma quadra encontrada para este código.'}</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>Memorial Digital · Cemitério</div>
          <div className={styles.titleRow}>
            <span className={styles.headerIcon}><MapPin size={24} aria-hidden="true" /></span>
            <div>
              <h1>Quadra {quadra.nome}</h1>
              <p>Consulte os lotes e encontre os memoriais desta quadra.</p>
            </div>
          </div>
          <div className={styles.summary} aria-label="Resumo da quadra">
            <div><strong>{porLote.length}</strong><span>lotes cadastrados</span></div>
            <div><strong>{ocupados}</strong><span>lotes ocupados</span></div>
            <div><strong>{vazios}</strong><span>lotes disponíveis</span></div>
            <div><strong>{totalPessoas}</strong><span>pessoas sepultadas</span></div>
          </div>
        </header>

        {porLote.length === 0 ? (
          <section className={styles.emptyState}>
            <MapPin size={28} aria-hidden="true" />
            <h2>Nenhum lote cadastrado</h2>
            <p>Esta quadra ainda não possui lotes disponíveis para consulta.</p>
          </section>
        ) : (
          <>
            <section className={styles.explorer} aria-label="Consultar lotes da quadra">
              <div className={styles.explorerHeading}>
                <div>
                  <h2>Lotes da quadra</h2>
                  <p>Selecione um lote para ver os memoriais vinculados.</p>
                </div>
              </div>
              <div className={styles.controls}>
                <div className={styles.search}>
                  <Search size={18} aria-hidden="true" />
                  <input value={busca} onChange={(event) => alterarBusca(event.target.value)} placeholder="Buscar lote pelo número" aria-label="Buscar lote pelo número" />
                  {busca && <button type="button" className={styles.searchClear} aria-label="Limpar busca" onClick={() => alterarBusca('')}><X size={16} /></button>}
                </div>
                <div className={styles.filters} aria-label="Filtrar lotes">
                  {[
                    ['todos', `Todos (${porLote.length})`],
                    ['ocupados', `Ocupados (${ocupados})`],
                    ['vazios', `Disponíveis (${vazios})`],
                  ].map(([value, label]) => (
                    <button key={value} type="button" className={filtro === value ? styles.filterActive : ''} aria-pressed={filtro === value} onClick={() => alterarFiltro(value)}>{label}</button>
                  ))}
                </div>
              </div>

              {lotesVisiveis.length ? (
                <div className={styles.lotGrid}>
                  {lotesVisiveis.map((lote) => {
                    const tipoOcupacao = lote.pessoas.length === 0 ? styles.lotEmpty : lote.pessoas.length === 1 ? styles.lotOccupied : styles.lotMultiple;
                    const selecionado = String(loteSelecionadoId) === String(lote.id);
                    return (
                      <button
                        key={lote.id}
                        type="button"
                        className={`${styles.lotCard} ${tipoOcupacao} ${selecionado ? styles.lotSelected : ''}`}
                        aria-pressed={selecionado}
                        onClick={() => setLoteSelecionadoId(selecionado ? null : lote.id)}
                      >
                        <span className={styles.lotNumber}>Lote {lote.numero}</span>
                        <span className={styles.lotOccupancy}><Users size={14} aria-hidden="true" />{lote.pessoas.length} {lote.pessoas.length === 1 ? 'pessoa' : 'pessoas'}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.noResults}>Nenhum lote corresponde à busca ou ao filtro selecionado.</div>
              )}

              {lotesFiltrados.length > lotesPorPagina && (
                <div className={styles.pagination}>
                  <span>Lotes {inicio + 1}–{Math.min(inicio + lotesPorPagina, lotesFiltrados.length)} de {lotesFiltrados.length} <span className={styles.pageCount}>· Página {paginaAtual} de {totalPaginas}</span></span>
                  <div className={styles.pageButtons}>
                    <button type="button" disabled={paginaAtual === 1} onClick={() => setPagina((current) => Math.max(1, current - 1))} aria-label="Página anterior"><ChevronLeft size={18} /></button>
                    <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina((current) => Math.min(totalPaginas, current + 1))} aria-label="Próxima página"><ChevronRight size={18} /></button>
                  </div>
                </div>
              )}
            </section>

            {loteSelecionado && (
              <section ref={loteDetalhesRef} className={styles.selectedLot} aria-live="polite">
                <header className={styles.selectedHeader}>
                  <div className={styles.selectedTitle}>
                    <span className={`${styles.selectedMarker} ${loteSelecionado.pessoas.length > 1 ? styles.markerMultiple : loteSelecionado.pessoas.length === 1 ? styles.markerOccupied : styles.markerEmpty}`}>{loteSelecionado.numero}</span>
                    <div>
                      <h2>Lote {loteSelecionado.numero}</h2>
                      <p>{loteSelecionado.pessoas.length} {loteSelecionado.pessoas.length === 1 ? 'pessoa neste lote' : 'pessoas neste lote'}</p>
                    </div>
                  </div>
                  <Link to={`/lote/${loteSelecionado.id}`} className={styles.viewLotLink}>Ver página do lote <ExternalLink size={16} aria-hidden="true" /></Link>
                </header>

                {loteSelecionado.pessoas.length ? (
                  <div className={styles.peopleGrid}>
                    {loteSelecionado.pessoas.map((pessoa) => (
                      <Link key={pessoa.id} to={`/falecidos/${pessoa.id}`} className={styles.personCard}>
                        <span className={styles.personImage}>
                          <img src={resolveImageUrl(pessoa.imagem) || personPlaceholder} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
                        </span>
                        <span className={styles.personInfo}>
                          <strong>{pessoa.nome || 'Nome não informado'}</strong>
                          <span>{pessoa.dataNascimento || '—'} <span aria-hidden="true">—</span> {pessoa.dataMorte || '—'}</span>
                          {pessoa.descricao && <span className={styles.personDescription}>{pessoa.descricao}</span>}
                        </span>
                        <ChevronRight className={styles.personArrow} size={18} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyLot}>Nenhuma pessoa cadastrada neste lote.</p>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
