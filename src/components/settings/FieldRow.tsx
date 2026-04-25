import type { ReactNode } from "react";

type FieldRowProps = {
  labelName: string;
  labelHint?: string;
  children: ReactNode;
};

export function FieldRow({ labelName, labelHint, children }: FieldRowProps) {
  return (
    <div
      className="grid items-center border-b border-kerf-border-subtle last:border-b-0"
      style={{
        gridTemplateColumns: "200px 1fr",
        gap: "24px",
        padding: "16px 0",
      }}
    >
      <div className="flex flex-col" style={{ gap: "2px" }}>
        <span className="text-kerf-text-primary" style={{ fontSize: "13px", fontWeight: 500 }}>
          {labelName}
        </span>
        {labelHint ? (
          <span
            className="text-kerf-text-tertiary"
            style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}
          >
            {labelHint}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between" style={{ gap: "12px" }}>
        {children}
      </div>
    </div>
  );
}
