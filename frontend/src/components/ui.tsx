import { useEffect } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import type { IconName } from "./Icon";

export function Pill({
  kind = "solid",
  icon,
  children,
  className = "",
  ...rest
}: {
  kind?: "solid" | "ghost" | "danger";
  icon?: IconName;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`pill ${kind} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      <span>{children}</span>
    </button>
  );
}

export function RoundBtn({
  icon,
  small,
  label,
  className = "",
  ...rest
}: {
  icon: IconName;
  small?: boolean;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rb ${small ? "sm" : ""} ${className}`}
      aria-label={label}
      {...rest}
    >
      <Icon name={icon} size={small ? 20 : 22} />
    </button>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  tiny,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  tiny?: boolean;
}) {
  return (
    <div className={`seg ${tiny ? "tiny" : ""}`} role="tablist">
      {items.map((it) => (
        <button
          type="button"
          key={it.value}
          role="tab"
          aria-selected={it.value === value}
          className={it.value === value ? "on" : ""}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`tg ${on ? "on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

export function Chip({
  on,
  children,
  onClick,
}: {
  on?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`ch ${on ? "on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheetwrap">
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

export function Header({
  title,
  back,
  right,
}: {
  title: string;
  back?: string | boolean;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="hd">
      {back && (
        <RoundBtn
          small
          icon="back"
          label="Back"
          onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
        />
      )}
      <h1 className="ht dot">{title}</h1>
      <span className="hr">{right}</span>
    </div>
  );
}

export function Field({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="fieldwrap">
      <span className="fl mono">{label}</span>
      <input className="field" {...rest} />
    </label>
  );
}

export function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p className="errline" role="alert">
      {text}
    </p>
  ) : null;
}
