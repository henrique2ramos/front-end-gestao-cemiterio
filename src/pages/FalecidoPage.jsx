import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChevronLeft, X, Map, Quote, Share2 } from 'lucide-react';
import { fetchFalecidoById, resolveImageUrl } from '../lib/api';
import styles from './FalecidoPage.module.css';
import Button from '../components/Button';
import personPlaceholder from '../assets/person-placeholder.svg';
import ramoFloral from '../assets/ramo_floral.png';

const displayDate = (value) => {
  if (!value) return '—';
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
};

const dateParts = (value) => {
  const text = String(value || '');
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return { year: Number(br[3]), month: Number(br[2]), day: Number(br[1]) };
  const year = text.match(/\b(\d{4})\b/);
  return year ? { year: Number(year[1]) } : null;
};

const calculateAge = (birthValue, deathValue) => {
  const birth = dateParts(birthValue);
  const death = dateParts(deathValue);
  if (!birth || !death) return null;
  let age = death.year - birth.year;
  if (birth.month && death.month
    && (death.month < birth.month || (death.month === birth.month && death.day < birth.day))) age -= 1;
  return age >= 0 ? age : null;
};

function MemorialFloralMark({ className }) {
  return <img className={className} src={ramoFloral} alt="" aria-hidden="true" />;
}

export default function FalecidoPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [falecido, setFalecido] = useState(null);
  const [activeTab, setActiveTab] = useState('bio');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: falecido?.nome || 'Memorial', url });
      else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 1800);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('Não foi possível compartilhar o memorial:', error);
    }
  };

  useEffect(() => {
    async function loadFalecido() {
      try {
        const data = await fetchFalecidoById(id);
        setFalecido(data);
      } catch (error) {
        console.error('Erro ao carregar falecido:', error);
        setFalecido(null);
      } finally {
        setLoading(false);
      }
    }

    loadFalecido();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.topNav}>
            <button onClick={handleBack} className={styles.backLink}>
              <ChevronLeft size={20} />
              Voltar
            </button>
          </div>
          <section className={styles.mainSection}>
            <div className={styles.profileCard} style={{ padding: '48px', textAlign: 'center' }}>
              <h2>Carregando falecido...</h2>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!falecido) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.topNav}>
            <button onClick={handleBack} className={styles.backLink}>
              <ChevronLeft size={20} />
              Voltar
            </button>
          </div>
          <section className={styles.mainSection}>
            <div className={styles.profileCard} style={{ padding: '48px', textAlign: 'center' }}>
              <h2>Falecido não encontrado</h2>
              <p style={{ color: '#666', marginTop: '12px' }}>Este registro pode ter sido removido.</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const galleryImages = Array.isArray(falecido.galeria) && falecido.galeria.length > 0
    ? falecido.galeria.map((src, index) => ({ src: resolveImageUrl(src), caption: `Foto ${index + 1}` }))
    : falecido.imagem
      ? [{ src: resolveImageUrl(falecido.imagem), caption: falecido.nome }]
      : [];
  const nomeComComplemento = String(falecido.nome || '').match(/^(.*?)\s*(\([^()]*\))\s*$/);
  const bioText = falecido.biografia || falecido.descricao || 'Biografia não informada.';
  const shouldCollapseBio = bioText.length > 300;

  return (
    <div className={styles.page}>

      <div className={styles.container}>
        
        <section className={styles.mainSection}>
          <div className={styles.profileCard}>

            
            <div className={styles.profileHeader}>
              <MemorialFloralMark className={`${styles.memorialLeaf} ${styles.memorialLeafLeft}`} />
              <MemorialFloralMark className={`${styles.memorialLeaf} ${styles.memorialLeafRight}`} />
              <div className={styles.topNav}>
                <button onClick={handleBack} className={styles.backLink}>
                  <ChevronLeft size={20} />
                  Voltar
                </button>
              </div>
              <div className={styles.photoWrapper}>
                <img
                  src={resolveImageUrl(falecido.imagem) || personPlaceholder}
                  alt={falecido.nome}
                  className={styles.photo}
                  onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                />
              </div>

              <div className={styles.infoWrapper}>
                <h1 className={styles.name}>
                  {nomeComComplemento ? <>
                    <span>{nomeComComplemento[1]}</span>
                    {' '}
                    <span className={styles.nameQualifier}>{nomeComComplemento[2]}</span>
                  </> : falecido.nome}
                </h1>

                <div className={styles.metadata}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Nascimento</span>
                    <span className={styles.metaValue}>{displayDate(falecido.dataNascimento || falecido.anoNascimento)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Falecimento</span>
                    <span className={styles.metaValue}>{displayDate(falecido.dataMorte || falecido.anoMorte)}</span>
                  </div>
                  {calculateAge(falecido.dataNascimento || falecido.anoNascimento, falecido.dataMorte || falecido.anoMorte) !== null && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Idade</span>
                      <span className={styles.metaValue}>{calculateAge(falecido.dataNascimento || falecido.anoNascimento, falecido.dataMorte || falecido.anoMorte)} anos</span>
                    </div>
                  )}
                  {falecido.localizacao && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Localização</span>
                      <span className={styles.metaValue}>{falecido.localizacao}</span>
                    </div>
                  )}
                </div>

                <div className={styles.actionButtons}>
                  <Button
                    onClick={() => navigate(`/mapa?falecido=${encodeURIComponent(falecido.id)}`, { state: { falecido, scrollToMap: true } })}
                    variant="primary"
                    size="small"
                    className={styles.mapButton}
                    icon={<Map size={16} />}
                  >
                    Ver no mapa
                  </Button>
                  <button type="button" className={styles.shareButton} onClick={handleShare}>
                    <Share2 size={16} />
                    {shareCopied ? 'Link copiado' : 'Compartilhar'}
                  </button>
                </div>
              </div>
            </div>

            
            <div className={styles.memorialSections}>
              <div className={styles.tabNavWrapper}>
                <div className={styles.tabNav} role="tablist" aria-label="Conteúdo do memorial">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'bio'}
                    className={`${styles.tabBtn} ${activeTab === 'bio' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('bio')}
                  >
                    Biografia
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'gallery'}
                    className={`${styles.tabBtn} ${activeTab === 'gallery' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('gallery')}
                  >
                    Galeria de Fotos
                    <span className={styles.tabCount}>{galleryImages.length}</span>
                  </button>
                </div>
              </div>

              <div className={styles.tabContent}>
              {activeTab === 'bio' ? (
                <section className={styles.bioSection} role="tabpanel">
                  <div className={`${styles.bioTextWrap} ${shouldCollapseBio && !bioExpanded ? styles.bioCollapsed : ''}`}>
                    <h2 className={styles.contentTitle}>Biografia</h2>
                    <p className={styles.bioText}>{bioText}</p>
                  </div>
                  {shouldCollapseBio && (
                    <button type="button" className={styles.readMore} onClick={() => setBioExpanded((expanded) => !expanded)}>
                      {bioExpanded ? 'Recolher biografia' : 'Ler biografia completa'}
                      <ChevronRight size={17} className={bioExpanded ? styles.readMoreExpanded : ''} />
                    </button>
                  )}
                  {falecido.mensagemFamilia && (
                    <blockquote className={styles.tributeBox}>
                      <Quote className={styles.tributeIcon} size={48} />
                      <div className={styles.tributeContent}>
                        <p>"{falecido.mensagemFamilia}"</p>
                        <span className={styles.tributeAuthor}>— Homenagem da Família</span>
                      </div>
                    </blockquote>
                  )}
                </section>
              ) : (
                <section className={styles.gallerySection} role="tabpanel">
                  <div className={styles.galleryHeader}>
                    <h2 className={styles.contentTitle}>Galeria de fotos</h2>
                    {galleryImages.length > 0 && <span>{galleryImages.length} {galleryImages.length === 1 ? 'foto' : 'fotos'}</span>}
                  </div>
                  {galleryImages.length > 0 ? (
                    <div className={styles.galleryGrid}>
                      {galleryImages.map((img, i) => (
                        <button
                          key={i}
                          className={styles.galleryThumb}
                          onClick={() => setLightboxIndex(i)}
                          aria-label={`Abrir ${img.caption}`}
                        >
                          <img src={img.src || personPlaceholder} alt={img.caption} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
                          <div className={styles.thumbOverlay}>
                            <span>{img.caption}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyGallery}>Nenhuma foto adicionada a esta galeria ainda.</div>
                  )}
                </section>
              )}
              </div>
            </div>

          </div>
        </section>
      </div>

      
      {lightboxIndex !== null && galleryImages.length > 0 && (
        <div className={styles.lightbox} onClick={() => setLightboxIndex(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxIndex(null)}>
            <X size={24} />
          </button>
          <button
            className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
            onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + galleryImages.length) % galleryImages.length); }}
          >
            ‹
          </button>
          <div className={styles.lightboxInner} onClick={(e) => e.stopPropagation()}>
            <img src={galleryImages[lightboxIndex].src || personPlaceholder} alt={galleryImages[lightboxIndex].caption} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
            <p>{galleryImages[lightboxIndex].caption}</p>
            <span>{lightboxIndex + 1} / {galleryImages.length}</span>
          </div>
          <button
            className={`${styles.lightboxNav} ${styles.lightboxNext}`}
            onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % galleryImages.length); }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
