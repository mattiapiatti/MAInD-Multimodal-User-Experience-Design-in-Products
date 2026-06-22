import styles from "./Avatar.module.css";

/**
 * The "Kai" profile photo — a mint conic-gradient orb with soft warm + cool
 * highlights. Shared so the Profile account card and the Home hero use the exact
 * same avatar. Decorative; pass a pixel `size` (default 52).
 */
export default function Avatar({ size = 52, face = false, className = "" }) {
  return (
    <div
      className={`${styles.orb} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className={styles.highlight} />
      <span className={styles.highlightCool} />
      {face ? (
        <svg className={styles.face} viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <circle cx="37" cy="45" r="6" fill="#fff" />
          <circle cx="63" cy="45" r="6" fill="#fff" />
          <path
            d="M35 61 Q50 77 65 61"
            stroke="#fff"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      ) : null}
    </div>
  );
}
