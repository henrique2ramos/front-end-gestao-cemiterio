import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Quote, Star, User } from 'lucide-react';
import {
  fetchLotes,
  fetchFalecidosPorQuadra,
  fetchQuadra,
  resolveImageUrl,
} from '../lib/api';
import Spinner from '../components/Spinner';
import styles from './QuadraPage.module.css';
import personPlaceholder from '../assets/person-placeholder.svg';

export default function QuadraPage() {
  const { id } = useParams();
  const [quadra, setQuadra] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setIsLoading(true);
      setErro(null);

      try {
        const [dadosQuadra, dadosLotes, dadosMemoriais] = await Promise.all([
          fetchQuadra(id),
          fetchLotes(id),
          fetchFalecidosPorQuadra(id),
        ]);

        if (cancelado) return;

        setQuadra(dadosQuadra);
        setLotes(Array.isArray(dadosLotes) ? dadosLotes : []);
        setPessoas(Array.isArray(dadosMemoriais) ? dadosMemoriais : []);
      } catch (e) {
        if (cancelado) return;

        console.error('Erro ao carregar a quadra:', e);
        setQuadra(null);
        setLotes([]);
        setPessoas([]);
        setErro(e.message || 'Não foi possível carregar esta quadra.');
      } finally {
        if (!cancelado) setIsLoading(false);
      }
    }

    carregar();

    return () => { cancelado = true; };
  }, [id]);

  // Agrupa por loteId: comparacao exata de UUID, sem parse de texto
  const porLote = lotes.map((lote) => ({
    ...lote,
    pessoas: pessoas.filter((pessoa) => pessoa.loteId === lote.id),
  }));

  const totalPessoas = porLote.reduce((total, lote) => total + lote.pessoas.length, 0);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <section className={styles.mainSection}>
            <Spinner label="Carregando quadra..." />
          </section>
        </div>
      </div>
    );
  }

  if (erro || !quadra) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <section className={styles.mainSection}>
            <div className={styles.card} style={{ padding: '48px', textAlign: 'center' }}>
              <MapPin size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
              <h2>Quadra não encontrada</h2>
              <p style={{ color: '#666', marginTop: '12px' }}>
                {erro || 'Nenhuma quadra encontrada para este código.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <header className={styles.tombHeader}>
          <div className={styles.tombIcon}>
            <MapPin size={28} />
          </div>
          <h1 className={styles.tombTitle}>Quadra {quadra.nome}</h1>
          <p className={styles.tombSubtitle}>
            {lotes.length} lote{lotes.length !== 1 ? 's' : ''} ·{' '}
            {totalPessoas} pessoa{totalPessoas !== 1 ? 's' : ''} nesta quadra
          </p>
        </header>

        {porLote.length === 0 ? (
          <div className={styles.card} style={{ padding: '48px', textAlign: 'center' }}>
            <User size={40} style={{ color: '#ccc', marginBottom: '12px' }} />
            <h2 style={{ fontSize: '1.1rem' }}>Nenhum lote cadastrado nesta quadra</h2>
          </div>
        ) : (
          porLote.map((lote) => (
            <section key={lote.id} style={{ marginBottom: '32px' }}>
              <div className={styles.loteHeader}>
                <h2 className={styles.personName} style={{ fontSize: '1.25rem' }}>
                  Lote {lote.numero}
                </h2>
                <Link to={`/lote/${lote.id}`} className={styles.loteLink}>
                  Ver lote
                </Link>
              </div>

              {lote.pessoas.length === 0 ? (
                <div className={styles.card} style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ color: '#888', margin: 0 }}>Nenhum falecido neste lote</p>
                </div>
              ) : (
                <div className={styles.grid}>
                  {lote.pessoas.map((pessoa) => (
                    <Link
                      key={pessoa.id}
                      to={`/falecidos/${pessoa.id}`}
                      className={styles.personCard}
                    >
                      <div className={styles.personImage}>
                  <img
                    src={resolveImageUrl(pessoa.imagem) || personPlaceholder}
                    alt={pessoa.nome}
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                  />
                      </div>

                      <div className={styles.personInfo}>
                        <h2 className={styles.personName}>{pessoa.nome}</h2>

                        <div className={styles.personDates}>
                          <span className={styles.dateBlock}>
                            <Star size={14} className={styles.starIcon} />
                            {pessoa.dataNascimento || '—'}
                          </span>
                          <span className={styles.dateDivider}></span>
                          <span className={styles.dateBlock}>
                            <span className={styles.crossIcon}>✝</span>
                            {pessoa.dataMorte || '—'}
                          </span>
                        </div>

                        {pessoa.descricao && <p className={styles.personDesc}>{pessoa.descricao}</p>}

                        {pessoa.mensagemFamilia && (
                          <blockquote className={styles.tributeBox}>
                            <Quote size={20} className={styles.tributeIcon} />
                            <p>"{pessoa.mensagemFamilia}"</p>
                          </blockquote>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
