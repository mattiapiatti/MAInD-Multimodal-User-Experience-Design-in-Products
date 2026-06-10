import styles from "./Alert.module.css";

/**
 * Inline status message.
 * @param {{ tone?: "error" | "success" | "info" | "warning" }} props
 */
export default function Alert({ tone = "info", children }) {
  if (!children) return null;
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role="alert">
      {children}
    </div>
  );
}
