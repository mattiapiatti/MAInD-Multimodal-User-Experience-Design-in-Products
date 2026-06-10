import styles from "./Button.module.css";

/**
 * Reusable button.
 * @param {{ variant?: "primary" | "secondary" | "ghost" | "danger", loading?: boolean, fullWidth?: boolean }} props
 */
export default function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...rest
}) {
  const cls = [
    styles.button,
    styles[variant],
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
