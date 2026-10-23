import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin, Search, Users } from 'lucide-react';
import { fetchLote, fetchFalecidosPorLote, resolveImageUrl } from '../lib/api';
import Spinner from '../components/Spinner';
import styles from './LotePage.module.css';
import personPlaceholder from '../assets/person-placeholder.svg';

const PESSOAS_POR_PAGINA = 12;

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export default function LotePage() {
  const { id } = useParams();
  const [lote, setLote] = useState(null);
  const [pessoas, setPessoas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setIsLoading(true);
      setErro(null);

      try {
        const [dadosLote, dadosMemoriais] = await Promise.all([
          fetchLote(id),
          fetchFalecidosPorLote(id),
        ]);

        if (cancelado) return;
        setLote(dadosLote?.lote || dadosLote?.item || dadosLote);
        setPessoas(getItems(dadosMemoriais));
      } catch (error) {
        if (cancelado) return;
        console.error('Erro ao carregar o lote:', error);
        setLote(null);
        setPessoas([]);
        setErro(error.message || 'Não foi possível carregar este lote.');
      } finally {
        if (!cancelado) setIsLoading(false);
      }
    }

    carregar();
    return () => { cancelado = true; };
  }, [id]);

  const pessoasFiltradas = useMemo(() => pessoas
    .filter((pessoa) => (pessoa.nome || '').toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })), [pessoas, busca]);
  const totalPaginas = Math.max(1, Math.ceil(pessoasFiltradas.length / PESSOAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * PESSOAS_POR_PAGINA;
  const pessoasVisiveis = pessoasFiltradas.slice(inicio, inicio + PESSOAS_POR_PAGINA);
  const nomeQuadra = lote?.quadraNome || lote?.quadra?.nome;
  const quadraId = lote?.quadraId || lote?.quadra?.id;

  if (isLoading) {
    return <div className={styles.page}><div className={styles.container}><section className={styles.stateCard}><Spinner label="Carregando lote..." /></section></div></div>;
  }

  if (erro || !lote) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <section className={styles.stateCard}>
            <MapPin size={38} aria-hidden="true" />
            <h1>Lote não encontrado</h1>
            <p>{erro || 'Nenhum lote encontrado para este código.'}</p>
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
            <div className={styles.titleInfo}>
              {nomeQuadra && <span className={styles.quadraLabel}>Quadra {nomeQuadra}</span>}
              <h1>Lote {lote.numero ?? lote.nome ?? '—'}</h1>
              <p>Consulte os memoriais das pessoas sepultadas neste lote.</p>
            </div>
          </div>
          <div className={styles.summary}>
            <span className={styles.summaryIcon}><Users size={18} aria-hidden="true" /></span>
            <div><strong>{pessoas.length}</strong><span>{pessoas.length === 1 ? 'pessoa sepultada neste lote' : 'pessoas sepultadas neste lote'}</span></div>
            {quadraId != null && (
              <Link to={`/quadra/${quadraId}`} className={styles.quadraLink}>
                <ChevronLeft size={16} aria-hidden="true" /> Ver todos os lotes da quadra
              </Link>
            )}
          </div>
        </header>

        {pessoas.length === 0 ? (
          <section className={styles.emptyState}>
            <Users size={28} aria-hidden="true" />
            <h2>Nenhum memorial neste lote</h2>
            <p>Não há pessoas cadastradas para este lote no momento.</p>
          </section>
        ) : (
          <section className={styles.peopleSection} aria-label="Memoriais deste lote">
            <div className={styles.sectionHeader}>
              <div>
                <h2>Memoriais</h2>
                <p>Toque em uma pessoa para abrir o memorial completo.</p>
              </div>
              {pessoas.length > 5 && (
                <label className={styles.search}>
                  <Search size={18} aria-hidden="true" />
                  <input
                    value={busca}
                    onChange={(event) => { setBusca(event.target.value); setPagina(1); }}
                    placeholder="Buscar pelo nome"
                    aria-label="Buscar pessoa pelo nome"
                  />
                </label>
              )}
            </div>

            {pessoasVisiveis.length ? (
              <div className={styles.peopleList}>
                {pessoasVisiveis.map((pessoa) => (
                  <Link key={pessoa.id} to={`/falecidos/${pessoa.id}`} className={styles.personCard}>
                    <span className={styles.personImage}>
                      <img src={resolveImageUrl(pessoa.imagem) || personPlaceholder} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
                    </span>
                    <span className={styles.personInfo}>
                      <strong>{pessoa.nome || 'Nome não informado'}</strong>
                      <span className={styles.dates}>
                        <CalendarDays size={15} aria-hidden="true" />
                        {pessoa.dataNascimento || '—'} <span aria-hidden="true">—</span> {pessoa.dataMorte || '—'}
                      </span>
                      {pessoa.descricao && <span className={styles.personDescription}>{pessoa.descricao}</span>}
                    </span>
                    <span className={styles.openMemorial}>Abrir memorial <ExternalLink size={15} aria-hidden="true" /></span>
                    <ChevronRight className={styles.personArrow} size={18} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.noResults}>Nenhuma pessoa encontrada com esse nome.</div>
            )}

            {pessoasFiltradas.length > PESSOAS_POR_PAGINA && (
              <div className={styles.pagination}>
                <span>Pessoas {inicio + 1}–{Math.min(inicio + PESSOAS_POR_PAGINA, pessoasFiltradas.length)} de {pessoasFiltradas.length}<span className={styles.pageCount}> · Página {paginaAtual} de {totalPaginas}</span></span>
                <div className={styles.pageButtons}>
                  <button type="button" disabled={paginaAtual === 1} onClick={() => setPagina((current) => Math.max(1, current - 1))} aria-label="Página anterior"><ChevronLeft size={18} /></button>
                  <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina((current) => Math.min(totalPaginas, current + 1))} aria-label="Próxima página"><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
