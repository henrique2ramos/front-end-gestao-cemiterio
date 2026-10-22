import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, X } from 'lucide-react';
import { fetchFalecidoById, resolveImageUrl } from '../lib/api';
import personPlaceholder from '../assets/person-placeholder.svg';
import styles from './FalecidoDetailsModal.module.css';

const getImageSource = (image) => {
  if (typeof image === 'string') return image;
  if (!image || typeof image !== 'object') return '';
  return image.url || image.src || image.path || image.imagem || image.image || '';
};

const normalizeGallery = (value) => {
  let entries = value;
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

  return entries.map(getImageSource).map(resolveImageUrl).filter(Boolean);
};

export default function FalecidoDetailsModal({ falecido, onClose }) {
  const [fullRecord, setFullRecord] = useState(null);
  const [loadingFullRecord, setLoadingFullRecord] = useState(false);
  const falecidoId = falecido?.id;

  useEffect(() => {
    if (falecidoId == null) {
      setFullRecord(null);
      setLoadingFullRecord(false);
      return undefined;
    }

    let active = true;
    setFullRecord(null);
    setLoadingFullRecord(true);
    fetchFalecidoById(falecidoId)
      .then((response) => {
        if (!active) return;
        setFullRecord(response?.falecido || response?.item || response?.data || response);
      })
      .catch(() => {
        if (active) setFullRecord(null);
      })
      .finally(() => {
        if (active) setLoadingFullRecord(false);
      });

    return () => { active = false; };
  }, [falecidoId]);

  if (!falecido) return null;

  const record = fullRecord?.id == null || String(fullRecord.id) !== String(falecidoId)
    ? falecido
    : { ...falecido, ...fullRecord };

  const imagem = resolveImageUrl(record.imagem) || personPlaceholder;
  const possuiImagem = Boolean(record.imagem && record.imagem !== personPlaceholder);
  const biografia = record.biografia || record.descricao || 'Biografia não informada.';
  const galleryData = [record.galeria, record.fotosGaleria, record.imagensGaleria, record.photos, record.gallery]
    .find((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  const galeria = normalizeGallery(galleryData);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="falecido-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="falecido-details-title">Dados do falecido</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar visualização">
            <X size={21} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.profile}>
            {possuiImagem ? (
              <img
                className={styles.photo}
                src={imagem}
                alt={record.nome || 'Foto do falecido'}
                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
              />
            ) : (
              <div className={styles.photoFallback} role="img" aria-label="Foto não informada">Foto não informada</div>
            )}
            <div className={styles.profileInfo}>
              <h3>{record.nome || 'Nome não informado'}</h3>
              <span className={`${styles.badge} ${record.tipo === 'recente' ? styles.recent : styles.historical}`}>
                {record.tipo === 'recente' ? 'Falecido recente' : 'Personalidade histórica'}
              </span>
              <div className={styles.metadata}>
                <span><CalendarDays size={16} /> Nascimento: {record.dataNascimento || record.anoNascimento || 'Não informado'}</span>
                <span><CalendarDays size={16} /> Falecimento: {record.dataMorte || record.anoMorte || 'Não informado'}</span>
                <span><MapPin size={16} /> {record.localizacao || 'Localização não informada'}</span>
              </div>
            </div>
          </div>

          <section className={styles.section}>
              <h4>Breve descrição</h4>
            <p>{record.descricao || 'Descri\u00e7\u00e3o n\u00e3o informada.'}</p>
          </section>

          <section className={styles.section}>
            <h4>Biografia</h4>
            <p>{biografia}</p>
          </section>

          <section className={styles.section}>
            <h4>Galeria de fotos</h4>
            {galeria.length > 0 ? (
              <div className={styles.gallery}>
                {galeria.map((src, index) => (
                  <img
                    key={`${src}-${index}`}
                    src={src}
                    alt={`Foto ${index + 1} de ${record.nome || 'falecido'}`}
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                  />
                ))}
              </div>
            ) : loadingFullRecord ? (
              <p className={styles.emptyGallery}>Carregando fotos...</p>
            ) : (
              <p className={styles.emptyGallery}>Nenhuma foto adicionada à galeria.</p>
            )}
          </section>
        </div>

      </section>
    </div>
  );
}
