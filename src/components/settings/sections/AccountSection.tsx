import { FieldRow } from "../FieldRow";
import { InlineEditField } from "../InlineEditField";

type AccountSectionProps = {
  account: {
    email: string;
    displayName: string | null;
    createdAt: string;
  };
  totalSessions: number;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatCreatedAt(iso: string, totalSessions: number): string {
  const date = DATE_FORMATTER.format(new Date(iso));
  const noun = totalSessions === 1 ? "session" : "sessions";
  return `${date} · ${totalSessions} ${noun} logged`;
}

export function AccountSection({ account, totalSessions }: AccountSectionProps) {
  return (
    <section
      id="account"
      aria-labelledby="account-heading"
      style={{ padding: "32px 0", borderBottom: "1px solid var(--lr-border-subtle)" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="account-heading"
          className="text-kerf-text-primary"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Account
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          Your identity and how we reach you.
        </p>
      </header>

      <FieldRow labelName="Email address" labelHint="used for sign-in">
        <InlineEditField value={account.email} ariaLabel="Email address" />
      </FieldRow>

      <FieldRow labelName="Display name" labelHint="optional · shown in greetings">
        <InlineEditField value={account.displayName} ariaLabel="Display name" />
      </FieldRow>

      <FieldRow labelName="Account created" labelHint="read-only">
        <span
          className="text-kerf-text-secondary"
          style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
        >
          {formatCreatedAt(account.createdAt, totalSessions)}
        </span>
      </FieldRow>
    </section>
  );
}
