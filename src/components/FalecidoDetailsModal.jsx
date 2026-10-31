import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, X } from 'lucide-react';
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

const parseDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  if (brMatch) return new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]));
  return null;
};

const calculateAge = (birthValue, deathValue) => {
  const birth = parseDate(birthValue);
  const death = parseDate(deathValue);
  if (!birth || !death || death < birth) return '';
  let age = death.getFullYear() - birth.getFullYear();
  if (death.getMonth() < birth.getMonth()
    || (death.getMonth() === birth.getMonth() && death.getDate() < birth.getDate())) age -= 1;
  return age;
};

export default function FalecidoDetailsModal({ falecido, onClose }) {
  const [fullRecord, setFullRecord] = useState(null);
  const [loadingFullRecord, setLoadingFullRecord] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const falecidoId = falecido?.id;
  const closeModal = () => {
    setSelectedPhoto(null);
    setPhotoZoomed(false);
    onClose();
  };
  const openPhoto = (photo) => {
    setPhotoZoomed(false);
    setSelectedPhoto(photo);
  };

  useEffect(() => {
    if (falecidoId == null) {
      setFullRecord(null);
      setLoadingFullRecord(false);
      return undefined;
    }

    let active = true;
    setFullRecord(null);
    setLoadingFullRecord(true);
    setBioExpanded(false);
    fetchFalecidoById(falecidoId, { includeAdministrative: true })
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

  useEffect(() => {
    if (!selectedPhoto) return undefined;
    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    const previousOverscroll = root.style.overscrollBehavior;
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setSelectedPhoto(null);
        setPhotoZoomed(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousOverscroll;
    };
  }, [selectedPhoto]);

  if (!falecido) return null;

  const record = fullRecord?.id == null || String(fullRecord.id) !== String(falecidoId)
    ? falecido
    : { ...falecido, ...fullRecord };

  const imagem = resolveImageUrl(record.imagem) || personPlaceholder;
  const possuiImagem = Boolean(record.imagem && record.imagem !== personPlaceholder);
  const biografia = record.biografia || 'Biografia não informada.';
  const shouldCollapseBio = String(record.biografia || '').length > 300;
  const normalizeComparableText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const observacoes = [record.observacoes, record.observacao, record.descricao]
    .map((value) => String(value || '').trim())
    .find((value) => value && normalizeComparableText(value) !== normalizeComparableText(record.biografia)) || '';
  const galleryData = [
    record.galeria, record.fotosGaleria, record.imagensGaleria, record.photos, record.gallery,
    falecido.galeria, falecido.fotosGaleria, falecido.imagensGaleria, falecido.photos, falecido.gallery,
  ]
    .find((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  const galeria = normalizeGallery(galleryData);
  const memorialUrl = `/falecidos/${encodeURIComponent(record.id)}`;
  const localizacao = String(record.localizacao || '');
  const quadra = localizacao.match(/Quadra\s+(.+?)(?:,|$)/i)?.[1]?.trim() || record.quadra || '';
  const lote = localizacao.match(/Lote\s+(.+?)$/i)?.[1]?.trim() || record.lote || '';
  const idade = record.idade ?? calculateAge(
    record.dataNascimento || record.anoNascimento,
    record.dataMorte || record.anoMorte
  );
  const idadeLabel = idade === ''
    ? 'Não informada'
    : /^\d+$/.test(String(idade))
      ? `${idade} ${Number(idade) === 1 ? 'ano' : 'anos'}`
      : idade;

  return (
    <div className={styles.overlay} onClick={closeModal}>
      <section
        className={`${styles.modal} ${selectedPhoto ? styles.photoOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="falecido-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <h2 id="falecido-details-title">Dados do falecido</h2>
            {record.id != null && (
              <Link
                className={styles.memorialLink}
                to={memorialUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} aria-hidden="true" />
                Ver memorial
              </Link>
            )}
          </div>
          <button type="button" className={styles.close} onClick={closeModal} aria-label="Fechar visualização">
            <X size={21} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.detailsGrid}>
            <section className={`${styles.section} ${styles.identificationSection}`}>
              <h4><span>1.</span> Identificação</h4>
              <div className={styles.identityTopRow}>
                <div className={styles.identityPhotoField}>
                  <span className={styles.imageFieldLabel}>Imagem de perfil</span>
                  {possuiImagem ? (
                    <button type="button" className={styles.photoButton} onClick={() => openPhoto({ src: imagem, alt: record.nome || 'Foto do falecido' })} aria-label={`Ampliar foto de ${record.nome || 'falecido'}`}>
                      <img
                        src={imagem}
                        alt={record.nome || 'Foto do falecido'}
                        onLoad={(event) => {
                          const image = event.currentTarget;
                          image.classList.toggle(styles.portraitPhoto, image.naturalHeight > image.naturalWidth);
                          image.classList.toggle(styles.landscapePhoto, image.naturalWidth > image.naturalHeight);
                        }}
                        onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                      />
                    </button>
                  ) : <div className={styles.photoFallback}>Foto não informada</div>}
                </div>
                <div className={styles.identityData}>
                  <div className={`${styles.recordField} ${styles.identityNameField}`}>
                    <span>Nome completo</span>
                    <strong>{record.nome || 'Não informado'}</strong>
                  </div>
                  <div className={`${styles.metadata} ${styles.identityDates}`}>
                    <div className={styles.recordField}><span>Data de nascimento</span><strong>{record.dataNascimento || record.anoNascimento || 'Não informado'}</strong></div>
                    <div className={styles.recordField}><span>Data de falecimento</span><strong>{record.dataMorte || record.anoMorte || 'Não informado'}</strong></div>
                  </div>
                  <div className={`${styles.metadata} ${styles.identityCategory}`}>
                    <div className={styles.recordField}><span>Idade</span><strong>{idadeLabel}</strong></div>
                    <div className={styles.recordField}><span>Categoria</span><strong>{record.tipo === 'recente' ? 'Falecido recente' : 'Personalidade histórica'}</strong></div>
                  </div>
                </div>
              </div>
            </section>
            <section className={`${styles.section} ${styles.locationSection}`}>
              <h4><span>2.</span> Localização no cemitério</h4>
              <div className={styles.profileLocation}>
                <div className={styles.recordField}><span>Quadra</span><strong>{quadra || 'Não informada'}</strong></div>
                <div className={styles.recordField}><span>Lote</span><strong>{lote || 'Não informado'}</strong></div>
                <div className={styles.recordField}><span>Tipo de estrutura funerária</span><strong>{record.tipoEstrutura || 'Não informado'}</strong></div>
              </div>
            </section>
            <section className={`${styles.section} ${styles.biographySection}`}>
              <h4><span>3.</span> Biografia</h4>
              <div className={styles.biographyBox}>
                <div className={`${styles.biographyText} ${shouldCollapseBio && !bioExpanded ? styles.bioCollapsed : ''}`}>
                  <p>{biografia || 'Biografia não informada.'}</p>
                </div>
                {shouldCollapseBio && (
                  <button type="button" className={styles.readMore} onClick={() => setBioExpanded((expanded) => !expanded)}>
                    {bioExpanded ? 'Recolher biografia' : 'Ler biografia completa'}
                    <ChevronRight size={17} className={bioExpanded ? styles.readMoreExpanded : ''} />
                  </button>
                )}
              </div>
            </section>
            <section className={`${styles.section} ${styles.observationsSection}`}>
              <h4><span>4.</span> Observações</h4>
              <div className={styles.recordText}>
                <p>{observacoes || 'Nenhuma observação informada.'}</p>
              </div>
            </section>
            <section className={`${styles.section} ${styles.responsibleSection}`}>
              <h4><span>5.</span> Dados do responsável</h4>
              <div className={styles.responsibleFields}>
                <div className={`${styles.recordField} ${styles.responsibleName}`}><span>Nome completo</span><strong>{record.responsavelNome || 'Não informado'}</strong></div>
                <div className={styles.recordField}><span>Parentesco ou vínculo</span><strong>{record.responsavelParentesco || 'Não informado'}</strong></div>
                <div className={styles.recordField}><span>Telefone</span><strong>{record.responsavelTelefone || 'Não informado'}</strong></div>
              </div>
            </section>
          </div>

            <section className={`${styles.section} ${styles.gallerySection}`}>
              <h4><span className={styles.sectionNumber}>6.</span> Imagens</h4>
              <div className={styles.galleryRecordField}>
                  <span className={styles.imageFieldLabel}>Fotos da galeria ({galeria.length})</span>
                  {galeria.length > 0 ? (
                    <div className={styles.gallery}>
                {galeria.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    className={styles.galleryPhotoButton}
                    onClick={() => openPhoto({ src, alt: `Foto ${index + 1} de ${record.nome || 'falecido'}` })}
                    aria-label={`Ampliar foto ${index + 1} de ${record.nome || 'falecido'}`}
                  >
                    <img
                      src={src}
                      alt={`Foto ${index + 1} de ${record.nome || 'falecido'}`}
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                    />
                  </button>
                ))}
                    </div>
                  ) : loadingFullRecord ? (
                    <p className={styles.emptyGallery}>Carregando fotos...</p>
                  ) : (
                    <p className={styles.emptyGallery}>Nenhuma foto adicionada à galeria.</p>
                  )}
              </div>
            </section>
        </div>
      </section>
      {selectedPhoto && (
        <div className={`${styles.photoViewer} ${photoZoomed ? styles.photoViewerZoomed : ''}`} role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) { setSelectedPhoto(null); setPhotoZoomed(false); } }}>
          <button type="button" className={styles.photoViewerClose} onClick={(event) => { event.stopPropagation(); setSelectedPhoto(null); setPhotoZoomed(false); }} aria-label="Fechar foto ampliada">
            <X size={22} />
          </button>
          <button type="button" className={styles.photoViewerImageButton} onClick={(event) => { event.stopPropagation(); setPhotoZoomed((zoomed) => !zoomed); }} aria-label={photoZoomed ? 'Reduzir foto' : 'Ampliar foto'}>
            <img src={selectedPhoto.src} alt={selectedPhoto.alt} />
          </button>
        </div>
      )}
    </div>
  );
}
