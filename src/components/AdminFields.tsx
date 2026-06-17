import { useId } from "react";

type AdminTextInputProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  helper?: string;
  error?: string;
  type?: "text" | "url" | "email" | "tel";
  placeholder?: string;
};

type AdminTextareaProps = Omit<AdminTextInputProps, "type" | "placeholder"> & {
  rows?: number;
};

type AdminSelectFieldProps = {
  id?: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
};

type AdminDateFieldProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  overdue?: boolean;
};

type AdminColorInputProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

type AdminRangeInputProps = {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export function AdminTextInput({
  id: preferredId,
  label,
  value,
  onChange,
  maxLength,
  helper,
  error,
  type = "text",
  placeholder
}: AdminTextInputProps) {
  const generatedId = useAdminFieldId(label);
  const id = preferredId ?? generatedId;

  return (
    <label className="admin-field" htmlFor={id}>
      <FieldLabel label={label} count={`${value.length}/${maxLength}`} />
      <input
        id={id}
        aria-label={label}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldHelper helper={helper} error={error} />
    </label>
  );
}

export function AdminTextarea({
  id: preferredId,
  label,
  value,
  onChange,
  maxLength,
  rows = 4,
  helper,
  error
}: AdminTextareaProps) {
  const generatedId = useAdminFieldId(label);
  const id = preferredId ?? generatedId;

  return (
    <label className="admin-field" htmlFor={id}>
      <FieldLabel label={label} count={`${value.length}/${maxLength}`} />
      <textarea
        id={id}
        aria-label={label}
        value={value}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldHelper helper={helper} error={error} />
    </label>
  );
}

export function AdminSelectField({
  id: preferredId,
  label,
  value,
  options,
  onChange
}: AdminSelectFieldProps) {
  const generatedId = useAdminFieldId(label);
  const id = preferredId ?? generatedId;

  return (
    <label className="admin-field" htmlFor={id}>
      <FieldLabel label={label} />
      <select id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminDateField({
  id: preferredId,
  label,
  value,
  onChange,
  overdue = false
}: AdminDateFieldProps) {
  const generatedId = useAdminFieldId(label);
  const id = preferredId ?? generatedId;

  return (
    <label className={overdue ? "admin-field admin-field--overdue" : "admin-field"} htmlFor={id}>
      <FieldLabel label={label} />
      <input
        id={id}
        aria-label={label}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {overdue && <span className="admin-field__error">Reminder overdue</span>}
    </label>
  );
}

export function AdminColorInput({ id: preferredId, label, value, onChange }: AdminColorInputProps) {
  const generatedId = useAdminFieldId(label);
  const id = preferredId ?? generatedId;

  return (
    <label className="admin-field color-field" htmlFor={id}>
      <FieldLabel label={label} />
      <span className="color-field__control">
        <input
          id={id}
          aria-label={label}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>{value}</span>
      </span>
    </label>
  );
}

export function AdminRangeInput({ id: preferredId, label, value, onChange }: AdminRangeInputProps) {
  const generatedId = useAdminFieldId(label);
  const id = preferredId ?? generatedId;
  const safeValue = Number.isFinite(value) ? value : 0;

  return (
    <label className="admin-field range-field" htmlFor={id}>
      <FieldLabel label={label} count={`${Math.round(safeValue)}%`} />
      <input
        id={id}
        aria-label={label}
        type="range"
        min="0"
        max="100"
        step="1"
        value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function FieldLabel({ label, count }: { label: string; count?: string }) {
  return (
    <span className="admin-field__label">
      {label}
      {count && <span aria-hidden="true">{count}</span>}
    </span>
  );
}

function FieldHelper({ helper, error }: { helper?: string; error?: string }) {
  return (
    <>
      {helper && <span className="admin-field__helper">{helper}</span>}
      {error && <span className="admin-field__error">{error}</span>}
    </>
  );
}

function useAdminFieldId(label: string) {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${useId()}`;
}
