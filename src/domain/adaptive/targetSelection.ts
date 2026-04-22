export type TargetType =
  | "character"
  | "bigram"
  | "vertical-column"
  | "inner-column"
  | "thumb-cluster"
  | "hand-isolation"
  | "cross-hand-bigram"
  | "diagnostic";

export type SessionTarget = {
  type: TargetType;
  value: string;
  keys: string[];
  label: string;
  score?: number;
};

// Implementation lands in Task 8.
