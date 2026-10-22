import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, X, Map, Quote, Star } from 'lucide-react';
import { fetchFalecidoById, resolveImageUrl } from '../lib/api';
import styles from './FalecidoPage.module.css';
import Button from '../components/Button';
import personPlaceholder from '../assets/person-placeholder.svg';

export default function FalecidoPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [falecido, setFalecido] = useState(null);
  const [activeTab, setActiveTab] = useState('bio');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [loading, setLoading] = useState(true);

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
            <button onClick={() => navigate(-1)} className={styles.backLink}>
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
            <button onClick={() => navigate(-1)} className={styles.backLink}>
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

  return (
    <div className={styles.page}>

      <div className={styles.container}>
        
        <div className={styles.topNav}>
          <button onClick={() => navigate(-1)} className={styles.backLink}>
            <ChevronLeft size={20} />
            Voltar
          </button>
        </div>

        
        <section className={styles.mainSection}>
          <div className={styles.profileCard}>

            
            <div className={styles.profileHeader}>
              <div className={styles.photoWrapper}>
                <img
                  src={resolveImageUrl(falecido.imagem) || personPlaceholder}
                  alt={falecido.nome}
                  className={styles.photo}
                  onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
                />
              </div>

              <div className={styles.infoWrapper}>
                <h1 className={styles.name}>{falecido.nome}</h1>

                <div className={styles.metadata}>
                  <div className={styles.dateWrapper}>
                    <div className={styles.dateBlock}>
                      <Star size={18} className={styles.starIcon} />
                      <span>{falecido.dataNascimento || falecido.anoNascimento}</span>
                    </div>
                    
                    <span className={styles.dateDivider}></span>
                    
                    <div className={styles.dateBlock}>
                      <span className={styles.crossIcon}>✝</span>
                      <span>{falecido.dataMorte || falecido.anoMorte}</span>
                    </div>
                  </div>
                </div>

                {falecido.descricao && <p className={styles.shortBio}>{falecido.descricao}</p>}
                <div className={styles.actionButtons}>
                  <Button onClick={() => navigate('/mapa')} variant="primary" size="small" icon={<Map size={16} />}>
                    Ver no Mapa 
                  </Button>
                  
                  <div className={styles.locationBadge}>
                    <MapPin size={16} />
                    <span>{falecido.localizacao}</span>
                  </div>
                </div>
              </div>
            </div>

            
            <div className={styles.tabNavWrapper}>
              <div className={styles.tabNav}>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'bio' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('bio')}
                >
                  Biografia
                </button>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'gallery' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('gallery')}
                >
                  Galeria de Fotos
                </button>
              </div>
            </div>

            
            <div className={styles.tabContent}>
              {activeTab === 'bio' && (
                <div className={styles.bioSection}>
                  <p className={styles.bioText}>{falecido.biografia || falecido.descricao || 'Biografia não informada.'}</p>

                  {falecido.mensagemFamilia && (
                    <blockquote className={styles.tributeBox}>
                      <Quote className={styles.tributeIcon} size={48} />
                      <div className={styles.tributeContent}>
                        <p>"{falecido.mensagemFamilia}"</p>
                        <span className={styles.tributeAuthor}>— Homenagem da Família</span>
                      </div>
                    </blockquote>
                  )}
                </div>
              )}

              {activeTab === 'gallery' && (
                galleryImages.length > 0 ? (
                  <div className={styles.galleryGrid}>
                    {galleryImages.map((img, i) => (
                      <button
                        key={i}
                        className={styles.galleryThumb}
                        onClick={() => setLightboxIndex(i)}
                      >
                        <img src={img.src || personPlaceholder} alt={img.caption} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
                        <div className={styles.thumbOverlay}>
                          <span>{img.caption}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyGallery}>
                    Nenhuma foto adicionada a esta galeria ainda.
                  </div>
                )
              )}
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
