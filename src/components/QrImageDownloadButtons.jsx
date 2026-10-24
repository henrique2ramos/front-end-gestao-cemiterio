import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadBlob, qrFileName, svgToLabeledRasterBlob, svgToRasterBlob } from '../lib/qrImageExport';
import styles from './QrImageDownloadButtons.module.css';

export default function QrImageDownloadButtons({ containerRef, fileName = 'qr-code', title = '', subtitle = '', className = '' }) {
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState('');

    const download = async () => {
        setIsBusy(true);
        setError('');
        try {
            const svg = containerRef.current?.querySelector('svg');
            const blob = title || subtitle
                ? await svgToLabeledRasterBlob(svg, title, subtitle)
                : await svgToRasterBlob(svg, 'png');
            downloadBlob(blob, `${qrFileName(fileName)}.png`);
        } catch (downloadError) {
            setError(downloadError.message || 'Não foi possível gerar a imagem.');
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className={`${styles.wrapper} ${className}`.trim()}>
            <div className={styles.buttons}>
                <button type="button" onClick={download} disabled={isBusy}>
                    <Download size={16} /> {isBusy ? 'Gerando...' : 'Baixar PNG'}
                </button>
            </div>
            {error && <span className={styles.error} role="alert">{error}</span>}
        </div>
    );
}
