"use client";

import styles from "@/styles/Calculator.module.css";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** 显示值的格式化，默认原样 */
  format?: (v: number) => string;
  /** 值被用户手动改过、与自动值不同时给个视觉提示 */
  dirty?: boolean;
  hint?: string;
  minLabel?: string;
  maxLabel?: string;
}

export default function ParamSlider({
  label, value, min, max, step = 1, onChange, format, dirty, hint, minLabel, maxLabel,
}: Props) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <label>{label}</label>
        <span className={`${styles.value} ${dirty ? styles.dirty : ""}`} title={dirty ? "已手动覆盖" : undefined}>
          {format ? format(value) : value}
          {dirty ? " *" : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <div className={styles.fieldFoot}>
        <span>{minLabel ?? min}</span>
        {hint && <span>{hint}</span>}
        <span>{maxLabel ?? max}</span>
      </div>
    </div>
  );
}
