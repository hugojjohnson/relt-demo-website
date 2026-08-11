import type { ReactNode } from "react";
export const choices = {
  status: ["ACTIVE", "REJECTED", "BLACKLISTED", "INACTIVE"],
  mode: ["IN_PERSON", "ONLINE"],
  assessment: ["LOW", "MODERATE", "HIGH", "OUTSTANDING"],
  cefr: ["A1", "A2", "B1", "B2", "C1", "C2"],
  interview: ["PENDING", "CONDUCTED", "FOLLOW_UP"],
};
export function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {options.map((x) => (
          <option key={x}>{x.replaceAll("_", " ")}</option>
        ))}
      </select>
    </label>
  );
}
export function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="wide">
      {label}
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="form-grid">{children}</div>
    </section>
  );
}
