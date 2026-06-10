import { forwardRef } from "react";
import styles from "./TextField.module.css";

/**
 * Text field with label and error. Works with react-hook-form (spread register()).
 * @param {{ label?: string, error?: string, hint?: string }} props
 */
const TextField = forwardRef(function TextField(
  { label, error, hint, id, className = "", ...rest },
  ref,
) {
  const fieldId = id || rest.name;
  return (
    <div className={`${styles.field} ${className}`}>
      {label ? (
        <label htmlFor={fieldId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <input
        id={fieldId}
        ref={ref}
        className={`${styles.input} ${error ? styles.inputError : ""}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      />
      {error ? (
        <span id={`${fieldId}-error`} className={styles.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
});

export default TextField;
