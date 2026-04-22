/**
 * Mobile gate — Task 4.3.
 *
 * Rendered as a sibling of the app tree in __root.tsx; a CSS media
 * query at max-width: 767px hides the app and shows this gate. No
 * props, no state, no interactivity — kerf is a split-keyboard
 * practice platform and a touch screen literally cannot host the
 * product. Firm and respectful per CLAUDE.md §B3 accuracy-first tone.
 */

export function MobileGate() {
  return (
    <main
      className="kerf-mobile-gate"
      aria-labelledby="kerf-mobile-gate-headline"
    >
      <div className="kerf-mobile-gate-inner">
        <div className="kerf-mobile-gate-logo" aria-hidden>
          kerf<span className="kerf-mobile-gate-logo-accent">.</span>
        </div>
        <h1
          id="kerf-mobile-gate-headline"
          className="kerf-mobile-gate-headline"
        >
          kerf is a desktop experience.
        </h1>
        <p className="kerf-mobile-gate-body">
          You'll need a split mechanical keyboard to practice — we'll see you
          at your desk.
        </p>
      </div>
    </main>
  );
}
