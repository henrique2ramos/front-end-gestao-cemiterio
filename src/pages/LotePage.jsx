import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Quote, Star, User } from 'lucide-react';
import { fetchLote, fetchFalecidosPorLote, resolveImageUrl } from '../lib/api';
import Spinner from '../components/Spinner';
import styles from './LotePage.module.css';

export default function LotePage() {
  const { id } = useParams();
  const [lote, setLote] = useState(null);
  const [pessoas, setPessoas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setIsLoading(true);
      setErro(null);

      try {
        // O lote e resolvido pelo UUID: renomear a quadra ou o lote nao
        // invalida mais o link da placa impressa.
        const [dadosLote, dadosMemoriais] = await Promise.all([
          fetchLote(id),
          fetchFalecidosPorLote(id),
        ]);

        if (cancelado) return;

        setLote(dadosLote);
        setPessoas(Array.isArray(dadosMemoriais) ? dadosMemoriais : []);
      } catch (e) {
        if (cancelado) return;

        console.error('Erro ao carregar o lote:', e);
        setLote(null);
        setPessoas([]);
        setErro(e.message || 'Não foi possível carregar este lote.');
      } finally {
        if (!cancelado) setIsLoading(false);
      }
    }

    carregar();

    return () => { cancelado = true; };
  }, [id]);

  const titulo = lote ? `Lote ${lote.numero}` : 'Lote';
  const subtitulo = lote?.quadraNome ? `Quadra ${lote.quadraNome}` : '';

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <section className={styles.mainSection}>
            <Spinner label="Carregando lote..." />
          </section>
        </div>
      </div>
    );
  }

  if (erro || !lote) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <section className={styles.mainSection}>
            <div className={styles.card} style={{ padding: '48px', textAlign: 'center' }}>
              <MapPin size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
              <h2>Lote não encontrado</h2>
              <p style={{ color: '#666', marginTop: '12px' }}>
                {erro || 'Nenhum lote encontrado para este código.'}
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
          <h1 className={styles.tombTitle}>{titulo}</h1>
          <p className={styles.tombSubtitle}>
            {subtitulo}
            {subtitulo ? ' — ' : ''}
            {pessoas.length} pessoa{pessoas.length !== 1 ? 's' : ''} neste lote
          </p>
        </header>

        {pessoas.length === 0 ? (
          <div className={styles.card} style={{ padding: '48px', textAlign: 'center' }}>
            <User size={40} style={{ color: '#ccc', marginBottom: '12px' }} />
            <h2 style={{ fontSize: '1.1rem' }}>Nenhum falecido neste lote</h2>
          </div>
        ) : (
          <div className={styles.grid}>
            {pessoas.map((pessoa) => (
              <Link
                key={pessoa.id}
                to={`/falecidos/${pessoa.id}`}
                className={styles.personCard}
              >
                <div className={styles.personImage}>
                  {pessoa.imagem ? (
                    <img src={resolveImageUrl(pessoa.imagem)} alt={pessoa.nome} />
                  ) : (
                    <User size={40} className={styles.userIcon} />
                  )}
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

                  <p className={styles.personDesc}>{pessoa.descricao}</p>

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
      </div>
    </div>
  );
}