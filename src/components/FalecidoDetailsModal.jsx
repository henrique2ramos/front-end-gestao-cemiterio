import { CalendarDays, MapPin, X } from 'lucide-react';
import { resolveImageUrl } from '../lib/api';
import personPlaceholder from '../assets/person-placeholder.svg';
import styles from './FalecidoDetailsModal.module.css';

export default function FalecidoDetailsModal({ falecido, onClose }) {
  if (!falecido) return null;

  const imagem = resolveImageUrl(falecido.imagem) || personPlaceholder;
  const biografia = falecido.biografia || falecido.descricao || 'Biografia não informada.';
  const galeria = Array.isArray(falecido.galeria) ? falecido.galeria.filter(Boolean) : [];

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
            <span className={styles.eyebrow}>Visualização do registro</span>
            <h2 id="falecido-details-title">Dados do falecido</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar visualização">
            <X size={21} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.profile}>
            <img
              className={styles.photo}
              src={imagem}
              alt={falecido.nome || 'Foto do falecido'}
              onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
            />
            <div className={styles.profileInfo}>
              <h3>{falecido.nome || 'Nome não informado'}</h3>
              <span className={`${styles.badge} ${falecido.tipo === 'recente' ? styles.recent : styles.historical}`}>
                {falecido.tipo === 'recente' ? 'Falecido recente' : 'Personalidade histórica'}
              </span>
              <div className={styles.metadata}>
                <span><CalendarDays size={16} /> Nascimento: {falecido.dataNascimento || falecido.anoNascimento || 'Não informado'}</span>
                <span><CalendarDays size={16} /> Falecimento: {falecido.dataMorte || falecido.anoMorte || 'Não informado'}</span>
                <span><MapPin size={16} /> {falecido.localizacao || 'Localização não informada'}</span>
              </div>
            </div>
          </div>

          {true && (
            <section className={styles.section}>
              <h4>Breve descrição</h4>
            <p>{falecido.descricao || 'Descri\u00e7\u00e3o n\u00e3o informada.'}</p>
            </section>
          )}

          <section className={styles.section}>
            <h4>Biografia</h4>
            <p>{biografia}</p>
          </section>

          {galeria.length > 0 && (
            <section className={styles.section}>
              <h4>Galeria de fotos</h4>
              <div className={styles.gallery}>
                {galeria.map((src, index) => (
                  <img
                    key={`${src}-${index}`}
                    src={resolveImageUrl(src) || personPlaceholder}
                    alt={`Foto ${index + 1} de ${falecido.nome || 'falecido'}`}
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" onClick={onClose}>Fechar</button>
        </footer>
      </section>
    </div>
  );
}
