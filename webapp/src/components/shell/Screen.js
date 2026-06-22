import styles from "./Screen.module.css";

/**
 * Standard screen scaffold: a sticky title header and a scrollable content
 * column padded clear of the bottom tab bar.
 * @param {{ title: string, action?: import("react").ReactNode }} props
 */
export default function Screen({ title, action, children }) {
  return (
    <>
      {title || action ? (
        <header className={styles.header}>
          {title ? <h1 className={styles.title}>{title}</h1> : <span />}
          {action ? <div className={styles.action}>{action}</div> : null}
        </header>
      ) : null}
      <main className={styles.content}>{children}</main>
    </>
  );
}
