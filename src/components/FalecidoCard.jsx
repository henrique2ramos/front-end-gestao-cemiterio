import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { resolveImageUrl } from '../lib/api';
import styles from './FalecidoCard.module.css';

export default function FalecidoCard({
  falecido,
  onClick
}) {

  return (
    <Link
      to={`/falecidos/${falecido.id}`}
      className={styles.card}
      onClick={onClick}
    >
      <div className={styles.imageWrapper}>
        <img
          src={resolveImageUrl(falecido.imagem)}
          alt={falecido.nome}
          className={styles.image}
        />
      </div>

      <div className={styles.content}>
        <h3 className={styles.name}>{falecido.nome}</h3>

        <p className={styles.dates}>
          {falecido.dataNascimento || '—'} — {falecido.dataMorte || '—'}
        </p>

        <p className={styles.description}>
          {falecido.descricao}
        </p>

        <div className={styles.metaData}>
          <div className={styles.location}>
            <MapPin size={16} className={styles.iconLocation} />
            <span>{falecido.localizacao}</span>
          </div>
        </div>

      </div>
    </Link>
  );
}
