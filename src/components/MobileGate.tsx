/**
 * Mobile gate — Task 4.3.
 *
 * Shown on narrow screens for keyboard-dependent app routes. Public
 * entry, login, and reading pages remain available on phones.
 */

export function MobileGate({ visible = true }: { visible?: boolean }) {
  return (
    <main
      className="kerf-mobile-gate"
      data-visible={visible || undefined}
      aria-labelledby="kerf-mobile-gate-headline"
    >
      <div className="kerf-mobile-gate-inner">
        <div className="kerf-mobile-gate-logo" aria-hidden>
          kerf<span className="kerf-mobile-gate-logo-accent">.</span>
        </div>
        <h1 id="kerf-mobile-gate-headline" className="kerf-mobile-gate-headline">
          kerf is a desktop experience.
        </h1>
        <p className="kerf-mobile-gate-body">
          You'll need a split mechanical keyboard to practice — we'll see you at your desk.
        </p>
      </div>
    </main>
  );
}
