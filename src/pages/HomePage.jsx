import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ArrowRight, ChevronRight, ChevronLeft } from 'lucide-react';
import FalecidoCard from '../components/FalecidoCard';
import { fetchFalecidos, resolveImageUrl } from '../lib/api';
import styles from './HomePage.module.css';
import mapaImg from '../assets/mapaExemplo.png';
import texturaImg from '../assets/texturaMemorial.jfif';

const PLACEHOLDER_IMG = 'https://placehold.co/400x400/e4e2e1/44474e?text=Foto';

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [falecidos, setFalecidos] = useState([]);
  const historicalRef = useRef(null);
  const recentRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    fetchFalecidos()
      .then((data) => {
        if (isMounted) setFalecidos(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (isMounted) setFalecidos([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const historicalFalecidos = useMemo(
    () => falecidos.filter((falecido) => falecido.tipo === 'historica' || falecido.tipo === 'historico'),
    [falecidos]
  );
  const recentFalecidos = useMemo(
    () => falecidos.filter((falecido) => falecido.tipo === 'recente'),
    [falecidos]
  );
  const filteredResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return falecidos
      .filter((falecido) => typeof falecido.nome === 'string' && falecido.nome.toLowerCase().includes(query))
      .slice(0, 5);
  }, [falecidos, searchQuery]);

  function scrollCarousel(ref, direction) {
    ref.current?.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  }

  function handleSearch(event) {
    event?.preventDefault();
    const query = searchQuery.trim();
    if (query) navigate(`/falecidos?search=${encodeURIComponent(query)}`);
  }

  function renderCarousel(items, ref) {
    if (items.length === 0) {
      return <div className={styles.emptyState}>Ainda não há falecidos cadastrados.</div>;
    }

    return (
      <div className={styles.falecidosGrid} ref={ref}>
        {items.slice(0, 10).map((falecido) => (
          <FalecidoCard key={falecido.id} falecido={falecido} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroIntegrated}>
        <div className={styles.integratedBackground}>
          <img
            src={texturaImg}
            alt="Textura Falecido"
            className={styles.integratedImage}
          />
          <div className={styles.integratedOverlay} />
        </div>

        <div className={styles.integratedContent}>
          <div className={styles.integratedHeader}>
            <h1 className={styles.heroTitle}>
              <span className={styles.heroTitlePrefix}>Cemitério Municipal</span>
              <span className={styles.heroLineStrong}>São Miguel</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Pesquise homenagens e preserve a memória de nossa comunidade.
            </p>
          </div>

          <div className={styles.integratedSearchContainer}>
            <form className={styles.searchWrapper} onSubmit={handleSearch}>
              <Search size={22} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar pelo nome..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button type="button" className={styles.clearSearch} onClick={() => setSearchQuery('')}>
                  x
                </button>
              )}
              <button type="submit" className={styles.searchButton}>Pesquisar</button>
            </form>

            {filteredResults.length > 0 && (
              <div className={styles.searchResults}>
                {filteredResults.map((falecido) => (
                  <Link key={falecido.id} to={`/falecidos/${falecido.id}`} className={styles.resultItem}>
                    <img src={resolveImageUrl(falecido.imagem) || PLACEHOLDER_IMG} alt={falecido.nome} />
                    <strong>{falecido.nome}</strong>
                  </Link>
                ))}
                <button className={styles.viewAll} onClick={handleSearch}>
                  Ver todos os resultados <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionLabel}>Acervo Histórico Municipal</span>
              <h2 className={styles.sectionTitle}>Figuras Históricas de Pirpirituba</h2>
            </div>
            <Link to="/falecidos?type=historical" className={styles.sectionLink}>
              Ver todos <ArrowRight size={16} />
            </Link>
          </div>

          <div className={styles.carouselWrapper}>
            <button className={`${styles.navButton} ${styles.navLeft}`} onClick={() => scrollCarousel(historicalRef, 'left')} aria-label="Rolar para a esquerda">
              <ChevronLeft size={24} />
            </button>
            {renderCarousel(historicalFalecidos, historicalRef)}
            <button className={`${styles.navButton} ${styles.navRight}`} onClick={() => scrollCarousel(historicalRef, 'right')} aria-label="Rolar para a direita">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </section>

      <section className={styles.mapSectionBlue}>
        <div className={styles.container}>
          <div className={styles.mapGridBlue}>
            <div className={styles.mapImageWrapperBlue}>
              <img src={mapaImg} alt="Vista aérea do Cemitério" className={styles.mapPreviewBlue} />
            </div>

            <div className={styles.mapContentBlue}>
              <h2>Mapa do Cemitério</h2>
              <p>Utilize o sistema de mapeamento digital para localizar quadras, lotes e setores do Cemitério Público São Miguel.</p>
              <div className={styles.mapFeatureBlue}>
                <MapPin size={20} />
                <span>Mapeamento dos sepultamentos</span>
              </div>
              <Link to="/mapa" className={styles.mapButton}>Acessar Mapa Digital</Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionLabel}>Atualizações do Sistema</span>
              <h2 className={styles.sectionTitle}>Registros Recentes</h2>
            </div>
            <Link to="/falecidos?type=recent" className={styles.sectionLink}>
              Ver todos <ArrowRight size={16} />
            </Link>
          </div>

          <div className={styles.carouselWrapper}>
            <button className={`${styles.navButton} ${styles.navLeft}`} onClick={() => scrollCarousel(recentRef, 'left')} aria-label="Rolar para a esquerda">
              <ChevronLeft size={24} />
            </button>
            {renderCarousel(recentFalecidos, recentRef)}
            <button className={`${styles.navButton} ${styles.navRight}`} onClick={() => scrollCarousel(recentRef, 'right')} aria-label="Rolar para a direita">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
