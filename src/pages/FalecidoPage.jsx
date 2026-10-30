import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Map, Quote, Share2, MessageCircle, Copy } from 'lucide-react';
import { fetchFalecidoById, resolveImageUrl } from '../lib/api';
import styles from './FalecidoPage.module.css';
import Button from '../components/Button';
import personPlaceholder from '../assets/person-placeholder.svg';
import ramoFloral from '../assets/ramo_floral.png';
import MemorialImageViewer from '../components/MemorialImageViewer';

const displayDate = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '—';
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : normalized;
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
  const [imageViewer, setImageViewer] = useState(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const closeImageViewer = useCallback(() => setImageViewer(null), []);
  const navigateImageViewer = useCallback((index) => {
    setImageViewer((current) => current ? { ...current, index } : current);
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    setShareMenuOpen(false);
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

  const handleCopyMemorialLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMenuOpen(false);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch (error) {
      console.error('NÃ£o foi possÃ­vel copiar o link do memorial:', error);
    }
  };

  useEffect(() => {
    if (!shareMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!shareMenuRef.current?.contains(event.target)) setShareMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShareMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [shareMenuOpen]);

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
  const profileImage = resolveImageUrl(falecido.imagem) || personPlaceholder;
  const openProfileImage = () => setImageViewer({ images: [{ src: profileImage, caption: falecido.nome }], index: 0 });
  const whatsappMessage = `Memorial de ${falecido.nome || 'uma pessoa querida'}: ${window.location.href}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
  const nascimento = falecido.dataNascimento || falecido.anoNascimento;
  const falecimento = falecido.dataMorte || falecido.anoMorte;
  const nomeComComplemento = String(falecido.nome || '').match(/^(.*?)\s*(\([^()]*\))\s*$/);
  const bioText = falecido.biografia || '';
  const shouldCollapseBio = bioText.length > 300;
  const idadeFalecido = calculateAge(falecido.dataNascimento || falecido.anoNascimento, falecido.dataMorte || falecido.anoMorte);

  return (
    <div className={styles.page}>

      <div className={styles.container}>
        
        <section className={styles.mainSection}>
          <div className={styles.profileCard}>

            <div className={styles.profileHeader}>
              <MemorialFloralMark className={`${styles.memorialLeaf} ${styles.memorialLeafLeft}`} />
              <MemorialFloralMark className={`${styles.memorialLeaf} ${styles.memorialLeafRight}`} />
              <div className={`${styles.topNav} ${styles.profileBackNav}`}>
                <button onClick={handleBack} className={styles.backLink}>
                  <ChevronLeft size={17} />
                  Voltar
                </button>
              </div>
              <button type="button" className={styles.photoWrapper} onClick={openProfileImage} aria-label={`Ampliar foto de ${falecido.nome}`}>
                <img
                  src={profileImage}
                  alt={falecido.nome}
                  className={styles.photo}
                  onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                />
              </button>

              <div className={styles.infoWrapper}>
                <h1 className={styles.name}>
                  {nomeComComplemento ? <>
                    <span>{nomeComComplemento[1]}</span>
                    {' '}
                    <span className={styles.nameQualifier}>{nomeComComplemento[2]}</span>
                  </> : falecido.nome}
                </h1>

                <div className={`${styles.metadata} ${styles.metadataHasAge}`}>
                  <div className={`${styles.metaItem} ${!nascimento ? styles.metaItemMissing : ''}`}>
                    <span className={styles.metaLabel}>Nascimento</span>
                    <span className={styles.metaValue} title={!nascimento ? 'Data não informada' : undefined}>{nascimento ? displayDate(nascimento) : 'N\u00e3o informada'}</span>
                  </div>
                  <div className={`${styles.metaItem} ${!falecimento ? styles.metaItemMissing : ''}`}>
                    <span className={styles.metaLabel}>Falecimento</span>
                    <span className={styles.metaValue} title={!falecimento ? 'Data não informada' : undefined}>{falecimento ? displayDate(falecimento) : 'N\u00e3o informada'}</span>
                  </div>
                  <div className={`${styles.metaItem} ${idadeFalecido === null ? styles.metaItemMissing : ''}`}>
                    <span className={styles.metaLabel}>Idade</span>
                    <span className={styles.metaValue} title={idadeFalecido === null ? 'Idade não informada' : undefined}>
                      {idadeFalecido !== null ? `${idadeFalecido} anos` : 'N\u00e3o informada'}
                    </span>
                  </div>
                  {falecido.localizacao && (
                    <div className={`${styles.metaItem} ${styles.metaLocation}`}>
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
                  <div className={styles.shareMenuWrapper} ref={shareMenuRef}>
                    <button type="button" className={styles.shareButton} onClick={() => setShareMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={shareMenuOpen}>
                      <Share2 size={16} />
                      {shareCopied ? 'Link copiado' : 'Compartilhar'}
                    </button>
                    {shareMenuOpen && (
                      <div className={styles.shareMenu} role="menu" aria-label="Opções de compartilhamento">
                        <a className={styles.whatsappShare} href={whatsappShareUrl} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setShareMenuOpen(false)}>
                          <MessageCircle size={17} aria-hidden="true" />
                          WhatsApp
                        </a>
                        <button type="button" role="menuitem" onClick={handleShare}>
                          <Share2 size={16} aria-hidden="true" />
                          Outros aplicativos
                        </button>
                        <button type="button" role="menuitem" onClick={handleCopyMemorialLink}>
                          <Copy size={16} aria-hidden="true" />
                          Copiar link
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            
            <div className={styles.memorialSections}>
              <div className={styles.tabNavWrapper}>
                <div className={styles.tabNav} role="tablist" aria-label="Conteúdo do memorial">
                  <button type="button" role="tab" id="memorial-bio-tab" aria-controls="memorial-bio-panel" aria-selected={activeTab === 'bio'} className={`${styles.tabBtn} ${activeTab === 'bio' ? styles.tabActive : ''}`} onClick={() => setActiveTab('bio')}>
                    Biografia
                  </button>
                  <button type="button" role="tab" id="memorial-gallery-tab" aria-controls="memorial-gallery-panel" aria-selected={activeTab === 'gallery'} className={`${styles.tabBtn} ${activeTab === 'gallery' ? styles.tabActive : ''}`} onClick={() => setActiveTab('gallery')}>
                    Galeria de Fotos
                    <span className={styles.tabCount}>{galleryImages.length}</span>
                  </button>
                </div>
              </div>

              <div className={styles.tabContent}>
              {activeTab === 'bio' ? (
                <section className={styles.bioSection} id="memorial-bio-panel" role="tabpanel" aria-labelledby="memorial-bio-tab">
                  <div className={`${styles.bioTextWrap} ${shouldCollapseBio && !bioExpanded ? styles.bioCollapsed : ''}`}>
                    <h2 id="memorial-bio-heading" className={styles.contentTitle}>Biografia</h2>
                    {bioText
                      ? <p className={styles.bioText}>{bioText}</p>
                      : <p className={styles.emptyBio}>A biografia ainda não foi adicionada.</p>}
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
                <section className={styles.gallerySection} id="memorial-gallery-panel" role="tabpanel" aria-labelledby="memorial-gallery-tab">
                  <div className={styles.galleryHeader}>
                    <h2 id="memorial-gallery-heading" className={styles.contentTitle}>Galeria de fotos</h2>
                    {galleryImages.length > 0 && <span>{galleryImages.length} {galleryImages.length === 1 ? 'foto' : 'fotos'}</span>}
                  </div>
                  {galleryImages.length > 0 ? (
                    <div className={styles.galleryGrid}>
                      {galleryImages.map((img, i) => (
                        <button
                          key={i}
                          className={styles.galleryThumb}
                          onClick={() => setImageViewer({ images: galleryImages, index: i })}
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

      
      {imageViewer && (
        <MemorialImageViewer
          images={imageViewer.images}
          index={imageViewer.index}
          onNavigate={navigateImageViewer}
          onClose={closeImageViewer}
        />
      )}
    </div>
  );
}
