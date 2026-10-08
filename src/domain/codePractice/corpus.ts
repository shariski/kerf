/**
 * Versioned, reviewed code practice corpus. These short, self-contained
 * examples are authored and reviewed before build time, never by a live model.
 * Keep existing IDs and text stable so saved session IDs always identify the
 * exact exercise a user saw.
 */

import { EXTRA_CODE_CORPUS } from "./extendedCorpus";
import type { CodeLanguage } from "./languages";

export {
  CODE_INDENT_WIDTH,
  CODE_LANGUAGES,
  codeLanguageLabel,
  emptyCodeLanguageCounts,
  isCodeLanguage,
} from "./languages";
export type { CodeLanguage } from "./languages";

export const CODE_CORPUS_VERSION = 2;

export type CodeSnippet = {
  id: string;
  language: CodeLanguage;
  title: string;
  text: string;
  introducedInVersion: number;
  lineCount: number;
  /** Distinct punctuation characters available to code-adaptive selection. */
  symbols: string[];
};

function snippet(
  id: string,
  language: CodeLanguage,
  title: string,
  lines: readonly string[],
  introducedInVersion = 1,
): CodeSnippet {
  const text = lines.join("\n");
  return {
    id,
    language,
    title,
    text,
    introducedInVersion,
    lineCount: lines.length,
    symbols: [...new Set([...text].filter((char) => /[^a-zA-Z0-9\s]/.test(char)))].sort(),
  };
}

export const CODE_SNIPPETS: readonly CodeSnippet[] = [
  snippet("js-filter-names", "javascript", "Filter and map", [
    "const names = users",
    "  .filter((user) => user.active)",
    "  .map((user) => user.name);",
    'console.log(names[0] ?? "none");',
  ]),
  snippet("js-optional-profile", "javascript", "Optional profile", [
    "function displayName(user) {",
    '  const name = user?.profile?.name ?? "guest";',
    "  return name.trim();",
    "}",
  ]),
  snippet("js-destructure", "javascript", "Destructure a response", [
    "const { items = [], page = 1 } = response;",
    "const first = items[0]?.title;",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: this is literal example code typed by the user.
    "console.log(first ?? `Page ${page}`);",
  ]),
  snippet("js-dom-link", "javascript", "Update a link", [
    'const link = document.querySelector("a[data-nav]");',
    'link?.setAttribute("href", "/docs?tab=api");',
    'link?.classList.add("ready");',
  ]),
  snippet("js-fetch", "javascript", "Fetch JSON", [
    'const response = await fetch("/api/items?limit=5");',
    "const items = await response.json();",
    'console.log(items[0]?.name ?? "empty");',
  ]),
  snippet("js-loop", "javascript", "Count active items", [
    "let count = 0;",
    "for (const item of items) {",
    "  if (item.active) count += 1;",
    "}",
  ]),
  snippet("js-date", "javascript", "Format a date", [
    "const date = new Date(2026, 9, 1);",
    'const label = date.toLocaleDateString("en-US");',
    "console.log(label);",
  ]),
  snippet("js-url-params", "javascript", "Build a search URL", [
    'const params = new URLSearchParams({ q: "split", page: "2" });',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: this is literal example code typed by the user.
    "const url = `/search?${params.toString()}`;",
    "console.log(url);",
  ]),
  snippet("js-regex", "javascript", "Check a slug", [
    'const slug = "code-practice";',
    "const valid = /^[a-z]+(-[a-z]+)*$/.test(slug);",
    'console.log(valid ? "valid" : "invalid");',
  ]),
  snippet("js-click-handler", "javascript", "Handle a click", [
    'button.addEventListener("click", (event) => {',
    "  event.preventDefault();",
    '  console.log(event.currentTarget?.id ?? "button");',
    "});",
  ]),
  snippet("js-reduce", "javascript", "Add prices", [
    "const total = cart.reduce((sum, item) => {",
    "  return sum + item.price * item.qty;",
    "}, 0);",
  ]),
  snippet("js-object-map", "javascript", "Map to labels", [
    "const labels = items.map((item) => ({",
    "  id: item.id,",
    '  text: item.name ?? "untitled",',
    "}));",
  ]),
  snippet("js-try-catch", "javascript", "Handle a parse error", [
    "try {",
    '  const value = JSON.parse(raw ?? "{}");',
    "  console.log(value.items?.length ?? 0);",
    "} catch (error) { console.error(error); }",
  ]),
  snippet("js-template", "javascript", "Build a greeting", [
    'const person = { name: "Ada", role: "writer" };',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: this is literal example code typed by the user.
    "const message = `${person.name} / ${person.role}`;",
    "console.log(message);",
  ]),
  snippet("js-ternary", "javascript", "Choose a label", [
    "const score = results[0]?.score ?? 0;",
    'const label = score > 80 ? "ready" : "keep going";',
    "console.log(label);",
  ]),

  snippet("py-label", "python", "Label a user", [
    "def label(user):",
    '    name = user.get("name", "guest")',
    '    return f"Hello, {name}!"',
  ]),
  snippet("py-comprehension", "python", "Collect names", [
    'names = [item["name"] for item in users',
    '    if item.get("active")]',
    "print(names[:3])",
  ]),
  snippet("py-dict", "python", "Build a dictionary", [
    'profile = {"name": "Ada", "level": 2}',
    'profile["level"] += 1',
    'print(profile.get("name", "guest"))',
  ]),
  snippet("py-enumerate", "python", "Number a list", [
    "for index, item in enumerate(items, start=1):",
    "    print(f\"{index}. {item['name']}\")",
  ]),
  snippet("py-sum", "python", "Total a cart", [
    'total = sum(item["price"] * item["qty"]',
    "    for item in cart)",
    'print(f"Total: {total:.2f}")',
  ]),
  snippet("py-exception", "python", "Parse a number", [
    "try:",
    '    count = int(value or "0")',
    "except ValueError:",
    "    count = 0",
  ]),
  snippet("py-path", "python", "Read a file", [
    "from pathlib import Path",
    'path = Path("notes/today.txt")',
    'text = path.read_text(encoding="utf-8")',
  ]),
  snippet("py-format", "python", "Format a status", [
    'name = user.get("name", "guest")',
    'status = "ready" if user.get("active") else "away"',
    'print(f"{name}: {status}")',
  ]),
  snippet("py-slice", "python", "Slice recent items", [
    "recent = items[-5:]",
    "first_two = recent[:2]",
    'print(first_two[0] if first_two else "empty")',
  ]),
  snippet("py-filter", "python", "Filter results", [
    'matches = filter(lambda item: item["score"] > 80,',
    "    results)",
    "print(list(matches))",
  ]),
  snippet("py-nested", "python", "Read nested data", [
    'settings = data.get("user", {}).get("settings", {})',
    'theme = settings.get("theme", "auto")',
    'print(f"Theme: {theme}")',
  ]),
  snippet("py-set", "python", "Unique tags", [
    "tags = {tag.lower() for item in posts",
    '    for tag in item.get("tags", [])}',
    "print(sorted(tags))",
  ]),
  snippet("py-sort", "python", "Sort by score", [
    "ranked = sorted(results,",
    '    key=lambda item: item["score"],',
    "    reverse=True)",
  ]),
  snippet("py-zip", "python", "Pair labels and values", [
    'labels = ["speed", "accuracy"]',
    "values = [72, 98]",
    "for label, value in zip(labels, values):",
    '    print(f"{label}: {value}")',
  ]),
  snippet("py-query", "python", "Build query parameters", [
    "from urllib.parse import urlencode",
    'query = urlencode({"q": "split keys", "page": 2})',
    'print(f"/search?{query}")',
  ]),

  snippet("html-nav", "html", "Navigation links", [
    '<nav class="menu">',
    '  <a href="/docs?lang=en">Docs</a>',
    '  <a href="/help">Help</a>',
    "</nav>",
  ]),
  snippet("html-search", "html", "Search form", [
    '<form action="/search" method="get">',
    '  <input name="q" type="search" />',
    '  <button type="submit">Search</button>',
    "</form>",
  ]),
  snippet("html-figure", "html", "Image and caption", [
    "<figure>",
    '  <img src="/images/keys.png" alt="Split keyboard" />',
    "  <figcaption>Keyboard layout</figcaption>",
    "</figure>",
  ]),
  snippet("html-list", "html", "Task list", [
    '<ul class="tasks">',
    '  <li data-done="true">Set up the board</li>',
    '  <li data-done="false">Practice symbols</li>',
    "</ul>",
  ]),
  snippet("html-table", "html", "Small table", [
    "<table>",
    "  <tr><th>Key</th><th>Count</th></tr>",
    "  <tr><td>[</td><td>12</td></tr>",
    "</table>",
  ]),
  snippet("html-details", "html", "Expandable details", [
    "<details>",
    "  <summary>Keyboard tips</summary>",
    "  <p>Use both hands for common pairs.</p>",
    "</details>",
  ]),
  snippet("html-article", "html", "Article card", [
    '<article class="card" id="intro">',
    "  <h2>Getting started</h2>",
    "  <p>Practice a little each day.</p>",
    "</article>",
  ]),
  snippet("html-label", "html", "Labeled input", [
    '<label for="email">Email</label>',
    '<input id="email" name="email" type="email" />',
    '<p class="hint">We will send a link.</p>',
  ]),
  snippet("html-option", "html", "Language selector", [
    '<select name="language">',
    '  <option value="js">JavaScript</option>',
    '  <option value="py">Python</option>',
    "</select>",
  ]),
  snippet("html-link", "html", "Stylesheet link", [
    '<link rel="stylesheet" href="/app.css" />',
    '<main class="page">',
    "  <h1>Code practice</h1>",
    "</main>",
  ]),
  snippet("html-button", "html", "Button and status", [
    '<button type="button" aria-pressed="false">',
    "  Show keyboard",
    "</button>",
    '<p role="status">Ready</p>',
  ]),
  snippet("html-quote", "html", "Block quote", [
    "<blockquote>",
    '  <p>"Practice makes progress."</p>',
    "  <cite>Typing notes</cite>",
    "</blockquote>",
  ]),
  snippet("html-picture", "html", "Responsive picture", [
    "<picture>",
    '  <source srcset="/small.webp" media="(max-width: 600px)" />',
    '  <img src="/large.webp" alt="Keyboard" />',
    "</picture>",
  ]),
  snippet("html-meter", "html", "Progress meter", [
    '<label for="progress">Accuracy</label>',
    '<meter id="progress" min="0" max="100" value="92">',
    "  92 percent",
    "</meter>",
  ]),
  snippet("html-footer", "html", "Page footer", [
    '<footer class="site-footer">',
    '  <a href="/privacy">Privacy</a>',
    '  <a href="/contact">Contact</a>',
    "</footer>",
  ]),
  ...Object.entries(EXTRA_CODE_CORPUS).flatMap(([language, entries]) =>
    entries.map(([id, title, lines]) => snippet(id, language as CodeLanguage, title, lines, 2)),
  ),
];

const SNIPPET_BY_ID = new Map(CODE_SNIPPETS.map((item) => [item.id, item]));

export function getCodeSnippet(id: string): CodeSnippet | undefined {
  return SNIPPET_BY_ID.get(id);
}

export function getCodeSnippetsForLanguage(language: CodeLanguage): CodeSnippet[] {
  return CODE_SNIPPETS.filter((item) => item.language === language);
}

/** Avoid repeating the immediately recent examples when possible. */
export function pickCodeSnippet(
  language: CodeLanguage,
  recentIds: readonly string[],
  rng: () => number = Math.random,
): CodeSnippet {
  const all = getCodeSnippetsForLanguage(language);
  if (all.length === 0) throw new Error(`No code snippets for ${language}`);
  const recent = new Set(recentIds.slice(0, 3));
  const available = all.filter((item) => !recent.has(item.id));
  const pool = available.length > 0 ? available : all;
  const selected = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  if (!selected) throw new Error(`No code snippets for ${language}`);
  return selected;
}
