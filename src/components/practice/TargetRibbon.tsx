type Props = {
  label: string;
  keys: string[];
};

export function TargetRibbon({ label, keys }: Props) {
  return (
    <section
      aria-label="Session target"
      className="flex gap-3 items-center px-3 py-2 text-sm text-kerf-text-secondary border-b border-kerf-border-subtle"
    >
      <span aria-hidden="true">◎</span>
      <span>
        <span className="text-kerf-text-secondary">Target:</span>{" "}
        <span className="text-kerf-text-primary">{label}</span>
      </span>
      <span className="ml-auto font-mono text-kerf-text-secondary">
        {keys.map((k) => (k === " " ? "space" : k)).join(" ")}
      </span>
    </section>
  );
}
