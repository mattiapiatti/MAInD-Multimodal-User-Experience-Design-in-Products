import styles from "./Card.module.css";

/**
 * Surface card used across the app screens.
 * @param {{ title?: string, subtitle?: string, icon?: import("react").ReactNode, footer?: import("react").ReactNode, padded?: boolean }} props
 */
export default function Card({
  title,
  subtitle,
  icon,
  footer,
  padded = true,
  className = "",
  children,
}) {
  return (
    <section className={`${styles.card} ${className}`}>
      {title ? (
        <header className={styles.head}>
          <div className={styles.titleRow}>
            {icon ? (
              <span className={styles.icon} aria-hidden="true">
                {icon}
              </span>
            ) : null}
            <h2 className={styles.title}>{title}</h2>
          </div>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </header>
      ) : null}
      <div className={padded ? styles.body : ""}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </section>
  );
}
