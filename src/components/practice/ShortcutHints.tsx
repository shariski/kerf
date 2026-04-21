/**
 * Corner-pinned keyboard shortcut strip shown during active typing.
 * Pure display component; key bindings live in PracticeScreen.
 */

type Props = {
  visible: boolean;
};

export function ShortcutHints({ visible }: Props) {
  return (
    <div className="kerf-shortcut-hints" data-visible={visible || undefined}>
      <div>
        <kbd className="kerf-kbd">Esc</kbd> pause · settings
      </div>
      <div>
        <kbd className="kerf-kbd">Tab</kbd> restart
      </div>
    </div>
  );
}
