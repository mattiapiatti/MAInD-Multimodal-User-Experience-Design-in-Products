import styles from "./GlassBackground.module.css";

/**
 * Fixed "liquid glass" backdrop rendered once behind the whole app: a deep
 * green-black radial gradient with three slow-drifting blurred glow orbs.
 * Purely decorative — content sits above it in a z-index:1 wrapper.
 */
export default function GlassBackground() {
  return (
    <div className={styles.bg} aria-hidden="true">
      <span className={`${styles.orb} ${styles.orb1}`} />
      <span className={`${styles.orb} ${styles.orb2}`} />
      <span className={`${styles.orb} ${styles.orb3}`} />
    </div>
  );
}
