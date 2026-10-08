/** Lightweight language metadata shared by setup, history, and the corpus. */
export const CODE_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "sql", label: "SQL" },
  { id: "bash", label: "Bash" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "java", label: "Java" },
  { id: "csharp", label: "C#" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "ruby", label: "Ruby" },
  { id: "php", label: "PHP" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["id"];

export function isCodeLanguage(value: unknown): value is CodeLanguage {
  return CODE_LANGUAGES.some((item) => item.id === value);
}

export function codeLanguageLabel(language: CodeLanguage): string {
  return CODE_LANGUAGES.find((item) => item.id === language)?.label ?? language;
}

export function emptyCodeLanguageCounts(): Record<CodeLanguage, number> {
  return Object.fromEntries(CODE_LANGUAGES.map((item) => [item.id, 0])) as Record<
    CodeLanguage,
    number
  >;
}

export const CODE_INDENT_WIDTH: Record<CodeLanguage, number> = {
  javascript: 2,
  typescript: 2,
  python: 4,
  html: 2,
  css: 2,
  json: 2,
  sql: 2,
  bash: 2,
  go: 2,
  rust: 4,
  java: 4,
  csharp: 4,
  c: 2,
  cpp: 2,
  ruby: 2,
  php: 4,
  swift: 4,
  kotlin: 4,
};
