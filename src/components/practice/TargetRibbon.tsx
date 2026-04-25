type Props = {
  label: string;
  keys: string[];
};

export function TargetRibbon({ label, keys }: Props) {
  return (
    <section aria-label="Session target" className="kerf-target-ribbon">
      <span aria-hidden="true" className="kerf-target-ribbon-icon">
        ◎
      </span>
      <span className="kerf-target-ribbon-label">{label}</span>
      {keys.length > 0 && (
        <ul className="kerf-target-ribbon-keys" aria-label="Keys in this target">
          {keys.map((k, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional key needed because target keys can repeat (e.g. ["e","e"] for "ee" bigram); list is replaced wholesale on target change, never reordered in place.
            <li key={`${k}-${i}`} className="kerf-target-ribbon-key">
              <span aria-hidden="true">{k === " " ? "␣" : k.toUpperCase()}</span>
              <span className="sr-only">{k === " " ? "space" : k}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
