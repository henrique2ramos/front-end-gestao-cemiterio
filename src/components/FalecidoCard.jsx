import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { resolveImageUrl } from '../lib/api';
import personPlaceholder from '../assets/person-placeholder.svg';
import styles from './FalecidoCard.module.css';

export default function FalecidoCard({
  falecido,
  onClick,
  compactName = false,
}) {
  const image = resolveImageUrl(falecido.imagem);
  const [imageFailed, setImageFailed] = useState(false);
  const isPlaceholderImage = image === personPlaceholder || /person-placeholder|imagem-indisponivel/i.test(image || '');
  const hasImage = image && !imageFailed && !isPlaceholderImage;

  return (
    <Link
      to={`/falecidos/${falecido.id}`}
      className={styles.card}
      onClick={onClick}
    >
      <div className={styles.imageWrapper}>
        {hasImage ? (
          <img
            src={image}
            alt={falecido.nome}
            className={styles.image}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <img src={personPlaceholder} alt="Imagem indisponível" className={styles.image} />
        )}
      </div>

      <div className={styles.content}>
        <h3 className={`${styles.name} ${compactName ? styles.nameCompact : ''}`}>{falecido.nome}</h3>

        <p className={styles.dates}>
          {falecido.dataNascimento || '—'} — {falecido.dataMorte || '—'}
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
