import styles from "./Avatar.module.css";

/**
 * The "Kai" profile photo — a mint conic-gradient orb with soft warm + cool
 * highlights. Shared so the Profile account card and the Home hero use the exact
 * same avatar. Decorative; pass a pixel `size` (default 52).
 */
export default function Avatar({ size = 52, className = "" }) {
  return (
    <div
      className={`${styles.orb} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className={styles.highlight} />
      <span className={styles.highlightCool} />
    </div>
  );
}
