import styles from './Spinner.module.css';

export default function Spinner({ label = 'Carregando...', size = 36 }) {
  const borderWidth = Math.max(2, Math.round(size / 9));

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <span
        className={styles.spinner}
        style={{ width: size, height: size, borderWidth }}
        aria-hidden="true"
      />
      {label ? <span className={styles.label}>{label}</span> : null}
    </div>
  );
}