export type FocusOrigin = "recommended" | "manual";
export type KeyboardFocus = "innerColumn" | "crossHandBigram" | "thumbCluster";

export const KEYBOARD_FOCUS_OPTIONS: readonly {
  id: KeyboardFocus;
  label: string;
}[] = [
  {
    id: "innerColumn",
    label: "Inner-column reach",
  },
  {
    id: "crossHandBigram",
    label: "Cross-hand transitions",
  },
  {
    id: "thumbCluster",
    label: "Thumb transitions",
  },
];
