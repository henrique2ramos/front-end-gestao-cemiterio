import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import styles from './CopyLinkButton.module.css';

export default function CopyLinkButton({ url, label = 'Copiar link' }) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);

  async function copiar() {
    const texto = url || '';

    if (!texto) {
      return;
    }

    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // clipboard API exige contexto seguro (https ou localhost).
      // Em rede local sem TLS, cai no fallback com textarea.
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }

    setCopiado(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${copiado ? styles.copiado : ''}`}
      onClick={copiar}
      disabled={!url}
    >
      {copiado ? <Check size={16} /> : <Copy size={16} />}
      {copiado ? 'Link copiado' : label}
    </button>
  );
}