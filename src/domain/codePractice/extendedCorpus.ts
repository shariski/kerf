import type { CodeLanguage } from "./languages";

type ExtendedLanguage = Exclude<CodeLanguage, "javascript" | "python" | "html">;
type Entry = readonly [id: string, title: string, lines: readonly string[]];

/** Additional, fixed practice text. No snippet is generated during a user session. */
export const EXTRA_CODE_CORPUS = {
  typescript: [
    [
      "ts-user-type",
      "Describe a user",
      ["type User = { id: number; name: string };", 'const user: User = { id: 1, name: "Ada" };'],
    ],
    [
      "ts-optional",
      "Optional account",
      [
        "type Account = { profile?: { name: string } };",
        'const name = account.profile?.name ?? "guest";',
      ],
    ],
    [
      "ts-union",
      "Narrow a union",
      [
        "function label(value: string | number): string {",
        '  return typeof value === "number" ? value.toFixed(1) : value;',
        "}",
      ],
    ],
    [
      "ts-array",
      "Filter typed items",
      [
        "const scores: number[] = [82, 91, 74];",
        "const passing = scores.filter((score) => score >= 80);",
        "console.log(passing.length);",
      ],
    ],
    [
      "ts-interface",
      "Define a result",
      [
        "interface Result { ok: boolean; count: number }",
        "const result: Result = { ok: true, count: 3 };",
      ],
    ],
    [
      "ts-generic",
      "Return a generic value",
      ["function first<T>(items: T[]): T | undefined {", "  return items[0];", "}"],
    ],
    [
      "ts-record",
      "Index a record",
      [
        "const counts: Record<string, number> = { a: 2, b: 4 };",
        "counts.a += 1;",
        'console.log(counts["b"]);',
      ],
    ],
    [
      "ts-tuple",
      "Use a tuple",
      ["const point: [number, number] = [12, 8];", "const [x, y] = point;", "console.log(x + y);"],
    ],
    [
      "ts-enumless",
      "Constrain a status",
      [
        'type Status = "idle" | "ready" | "error";',
        'const status: Status = "ready";',
        "console.log(status);",
      ],
    ],
    [
      "ts-guard",
      "Check a string",
      [
        "function isName(value: unknown): value is string {",
        '  return typeof value === "string" && value.length > 0;',
        "}",
      ],
    ],
    [
      "ts-promise",
      "Await a typed result",
      [
        "async function loadCount(): Promise<number> {",
        '  const response = await fetch("/api/count");',
        "  return Number(await response.text());",
        "}",
      ],
    ],
    [
      "ts-map",
      "Map a typed list",
      [
        "const names = users.map((user: { name: string }) => {",
        "  return user.name.trim();",
        "});",
      ],
    ],
  ],
  css: [
    ["css-card", "Style a card", [".card {", "  padding: 1rem;", "  border: 1px solid #444;", "}"]],
    [
      "css-grid",
      "Two column grid",
      [".grid {", "  display: grid;", "  grid-template-columns: repeat(2, 1fr);", "}"],
    ],
    [
      "css-focus",
      "Visible focus",
      ["button:focus-visible {", "  outline: 2px solid #f59e0b;", "  outline-offset: 2px;", "}"],
    ],
    [
      "css-hover",
      "Hover state",
      [".link:hover {", "  color: #fbbf24;", "  text-decoration: underline;", "}"],
    ],
    [
      "css-flex",
      "Align actions",
      [".actions {", "  display: flex;", "  align-items: center;", "  gap: 0.75rem;", "}"],
    ],
    [
      "css-media",
      "Small screen layout",
      ["@media (max-width: 640px) {", "  .grid { display: block; }", "}"],
    ],
    [
      "css-variable",
      "Use a color token",
      [":root {", "  --accent: #f59e0b;", "}", ".badge { color: var(--accent); }"],
    ],
    [
      "css-transition",
      "Animate a border",
      [".input {", "  border-color: #3a3128;", "  transition: border-color 150ms ease;", "}"],
    ],
    [
      "css-pseudo",
      "Add a marker",
      [".item::before {", '  content: ">";', "  margin-right: 0.5rem;", "}"],
    ],
    [
      "css-clamp",
      "Scale a heading",
      ["h1 {", "  font-size: clamp(2rem, 4vw, 3rem);", "  line-height: 1.1;", "}"],
    ],
    [
      "css-attribute",
      "Select active tabs",
      ['[aria-selected="true"] {', "  border-bottom: 2px solid orange;", "  color: white;", "}"],
    ],
    [
      "css-reduced",
      "Reduce motion",
      ["@media (prefers-reduced-motion: reduce) {", "  .panel { transition: none; }", "}"],
    ],
  ],
  json: [
    ["json-profile", "User profile", ["{", '  "name": "Ada",', '  "active": true', "}"]],
    [
      "json-colors",
      "Theme colors",
      ["{", '  "theme": {"background": "#181410"},', '  "accent": "#f59e0b"', "}"],
    ],
    ["json-list", "Task list", ["{", '  "tasks": ["practice", "review"],', '  "done": false', "}"]],
    [
      "json-config",
      "Build settings",
      ["{", '  "build": {"target": "es2022"},', '  "minify": true', "}"],
    ],
    ["json-metrics", "Session metrics", ["{", '  "wpm": 72,', '  "accuracy": 0.96', "}"]],
    [
      "json-route",
      "Route response",
      ["{", '  "path": "/practice",', '  "methods": ["GET", "POST"]', "}"],
    ],
    ["json-empty", "Empty state", ["{", '  "items": [],', '  "nextPage": null', "}"]],
    [
      "json-nested",
      "Nested account",
      ["{", '  "user": {"id": 7, "name": "Lin"},', '  "roles": ["editor"]', "}"],
    ],
    [
      "json-limits",
      "Numeric limits",
      ["{", '  "limits": {"min": 1, "max": 10},', '  "step": 1', "}"],
    ],
    [
      "json-flags",
      "Feature flags",
      ["{", '  "flags": {"hints": true, "sound": false},', '  "version": 2', "}"],
    ],
    [
      "json-links",
      "Navigation links",
      ["{", '  "links": ["/docs", "/help"],', '  "current": "/docs"', "}"],
    ],
    [
      "json-errors",
      "Error details",
      ["{", '  "error": {"code": "NOT_FOUND"},', '  "retryable": false', "}"],
    ],
  ],
  sql: [
    [
      "sql-filter",
      "Filter recent users",
      ["SELECT id, name", "FROM users", "WHERE active = true", "ORDER BY created_at DESC;"],
    ],
    [
      "sql-count",
      "Count sessions",
      ["SELECT user_id,", "  COUNT(*) AS sessions", "FROM practice_sessions", "GROUP BY user_id;"],
    ],
    [
      "sql-join",
      "Join profiles",
      [
        "SELECT u.name,",
        "  p.layout",
        "FROM users AS u",
        "JOIN profiles AS p ON p.user_id = u.id;",
      ],
    ],
    [
      "sql-limit",
      "Latest five rows",
      [
        "SELECT id,",
        "  started_at",
        "FROM practice_sessions",
        "ORDER BY started_at DESC",
        "LIMIT 5;",
      ],
    ],
    [
      "sql-insert",
      "Insert a tag",
      ["INSERT INTO tags (name, color)", "VALUES ('practice', '#f59e0b')", "RETURNING id;"],
    ],
    [
      "sql-update",
      "Update a status",
      ["UPDATE tasks", "SET status = 'done'", "WHERE id = 42", "RETURNING id, status;"],
    ],
    [
      "sql-delete",
      "Remove old drafts",
      ["DELETE FROM drafts", "WHERE created_at < '2025-01-01'", "RETURNING id;"],
    ],
    [
      "sql-average",
      "Average accuracy",
      [
        "SELECT language,",
        "  AVG(accuracy) AS average",
        "FROM code_sessions",
        "GROUP BY language",
        "HAVING COUNT(*) >= 3;",
      ],
    ],
    [
      "sql-case",
      "Label a score",
      [
        "SELECT id,",
        "  CASE WHEN score >= 80 THEN 'ready' ELSE 'retry' END AS status",
        "FROM attempts;",
      ],
    ],
    [
      "sql-distinct",
      "List languages",
      ["SELECT DISTINCT language", "FROM code_sessions", "WHERE ended_at IS NOT NULL;"],
    ],
    [
      "sql-null",
      "Find missing names",
      [
        "SELECT id,",
        "  COALESCE(name, 'guest') AS label",
        "FROM users",
        "WHERE deleted_at IS NULL;",
      ],
    ],
    [
      "sql-window",
      "Rank attempts",
      [
        "SELECT user_id, score,",
        "  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY score DESC) AS rank",
        "FROM attempts;",
      ],
    ],
  ],
  bash: [
    [
      "sh-files",
      "Find source files",
      ["#!/usr/bin/env bash", "find src -type f -name '*.ts'", "printf 'done\\n'"],
    ],
    [
      "sh-guard",
      "Guard an argument",
      ['if [[ -z "$1" ]]; then', '  echo "missing path" >&2', "fi"],
    ],
    ["sh-loop", "Print arguments", ['for item in "$@"; do', "  printf '%s\\n' \"$item\"", "done"]],
    ["sh-default", "Default a value", ["name=$" + "{1:-guest}", "printf 'hello, %s\\n' \"$name\""]],
    [
      "sh-pipe",
      "Count log errors",
      ["count=$(grep -c 'ERROR' app.log)", "printf 'errors: %s\\n' \"$count\""],
    ],
    [
      "sh-directory",
      "Create a folder",
      ['output="build/reports"', 'mkdir -p "$output"', "printf '%s\\n' \"$output\""],
    ],
    [
      "sh-read",
      "Read lines",
      ["while IFS= read -r line; do", "  printf '[%s]\\n' \"$line\"", "done < notes.txt"],
    ],
    [
      "sh-case",
      "Choose a mode",
      ['case "$mode" in', '  test) echo "running tests" ;;', '  *) echo "unknown mode" ;;', "esac"],
    ],
    ["sh-exists", "Check a file", ['if [[ -f "config.json" ]]; then', '  cat "config.json"', "fi"]],
    [
      "sh-array",
      "Use an array",
      ["files=(src/app.ts src/main.ts)", "printf '%s\\n' \"$" + '{files[@]}"'],
    ],
    [
      "sh-status",
      "Capture a status",
      ["command -v node >/dev/null", "status=$?", "printf 'status: %s\\n' \"$status\""],
    ],
    ["sh-function", "Define a helper", ["greet() {", "  printf 'hello, %s\\n' \"$1\"", "}"]],
  ],
  go: [
    ["go-sum", "Add two numbers", ["func sum(a, b int) int {", "  return a + b", "}"]],
    [
      "go-guard",
      "Guard an empty name",
      [
        "func label(name string) string {",
        '  if name == "" { return "guest" }',
        "  return name",
        "}",
      ],
    ],
    [
      "go-slice",
      "Append to a slice",
      ["scores := []int{72, 88}", "scores = append(scores, 95)", "first := scores[0]"],
    ],
    [
      "go-map",
      "Read a map",
      ['counts := map[string]int{"a": 2}', 'value, ok := counts["a"]', "_ = value; _ = ok"],
    ],
    [
      "go-range",
      "Loop over items",
      ["for index, item := range items {", "  println(index, item)", "}"],
    ],
    [
      "go-error",
      "Return an error",
      ["value, err := parse(input)", "if err != nil {", "  return err", "}"],
    ],
    ["go-struct", "Declare a struct", ["type User struct {", "  ID int", "  Name string", "}"]],
    [
      "go-pointer",
      "Update through a pointer",
      ["func increment(value *int) {", "  *value = *value + 1", "}"],
    ],
    [
      "go-switch",
      "Choose a label",
      ["switch status {", '  case "ready": println("go")', '  default: println("wait")', "}"],
    ],
    [
      "go-defer",
      "Close a file",
      ["file, err := os.Open(path)", "if err != nil { return err }", "defer file.Close()"],
    ],
    [
      "go-channel",
      "Read a channel",
      ["message, open := <-updates", "if open {", "  println(message)", "}"],
    ],
    ["go-format", "Format a count", ['label := fmt.Sprintf("%d items", count)', "println(label)"]],
  ],
  rust: [
    ["rs-sum", "Add values", ["fn sum(a: i32, b: i32) -> i32 {", "    a + b", "}"]],
    [
      "rs-option",
      "Default an option",
      ['let name: Option<&str> = Some("Ada");', 'let label = name.unwrap_or("guest");'],
    ],
    [
      "rs-vector",
      "Push to a vector",
      ["let mut scores = vec![72, 88];", "scores.push(95);", 'println!("{}", scores[0]);'],
    ],
    [
      "rs-match",
      "Match a state",
      [
        "match status {",
        '    Some(value) => println!("{}", value),',
        '    None => println!("empty"),',
        "}",
      ],
    ],
    ["rs-struct", "Define a struct", ["struct User {", "    id: u32,", "    name: String,", "}"]],
    [
      "rs-iter",
      "Filter an iterator",
      [
        "let passing: Vec<_> = scores.iter()",
        "    .filter(|score| **score >= 80)",
        "    .collect();",
      ],
    ],
    ["rs-borrow", "Borrow a string", ["fn length(value: &str) -> usize {", "    value.len()", "}"]],
    [
      "rs-result",
      "Propagate an error",
      [
        "fn load(path: &str) -> std::io::Result<String> {",
        "    let text = std::fs::read_to_string(path)?;",
        "    Ok(text)",
        "}",
      ],
    ],
    ["rs-enum", "Declare a status", ["enum Status {", "    Idle,", "    Ready,", "}"]],
    [
      "rs-tuple",
      "Destructure a pair",
      ["let point = (12, 8);", "let (x, y) = point;", 'println!("{}", x + y);'],
    ],
    [
      "rs-format",
      "Format a message",
      [
        'let name = "Ada";',
        'let message = format!("Hello, {}", name);',
        'println!("{}", message);',
      ],
    ],
    [
      "rs-loop",
      "Enumerate items",
      [
        "for (index, item) in items.iter().enumerate() {",
        '    println!("{}: {}", index, item);',
        "}",
      ],
    ],
  ],
  java: [
    [
      "java-record",
      "Define a record",
      [
        "record User(int id, String name) {",
        '    String label() { return id + ": " + name; }',
        "}",
      ],
    ],
    [
      "java-list",
      "Make a list",
      [
        'var names = List.of("Ada", "Lin");',
        "var first = names.get(0);",
        "System.out.println(first);",
      ],
    ],
    [
      "java-map",
      "Read a map",
      [
        'var counts = Map.of("a", 2, "b", 4);',
        'var total = counts.getOrDefault("c", 0);',
        "System.out.println(total);",
      ],
    ],
    [
      "java-stream",
      "Filter a stream",
      ["var passing = scores.stream()", "    .filter(score -> score >= 80)", "    .toList();"],
    ],
    [
      "java-guard",
      "Guard a value",
      ["if (name == null || name.isBlank()) {", '    name = "guest";', "}"],
    ],
    [
      "java-loop",
      "Loop over names",
      ["for (String name : names) {", "    System.out.println(name.trim());", "}"],
    ],
    [
      "java-switch",
      "Switch expression",
      [
        "String label = switch (status) {",
        '    case "ready" -> "Go";',
        '    default -> "Wait";',
        "};",
      ],
    ],
    [
      "java-optional",
      "Default an optional",
      [
        "var label = Optional.ofNullable(name)",
        "    .filter(value -> !value.isBlank())",
        '    .orElse("guest");',
      ],
    ],
    [
      "java-format",
      "Format a count",
      [
        "int count = 3;",
        'String message = "Items: %d".formatted(count);',
        "System.out.println(message);",
      ],
    ],
    [
      "java-array",
      "Read an array",
      ["int[] scores = {72, 88, 95};", "int first = scores[0];", "System.out.println(first);"],
    ],
    [
      "java-method",
      "Clamp a number",
      ["static int clamp(int value) {", "    return Math.max(0, Math.min(value, 100));", "}"],
    ],
    [
      "java-try",
      "Catch a number error",
      [
        "try {",
        "    int count = Integer.parseInt(raw);",
        "    System.out.println(count);",
        "} catch (NumberFormatException error) { System.out.println(0); }",
      ],
    ],
  ],
  csharp: [
    [
      "cs-record",
      "Declare a record",
      [
        "public record User(int Id, string Name);",
        'var user = new User(1, "Ada");',
        "Console.WriteLine(user.Name);",
      ],
    ],
    [
      "cs-null",
      "Default a name",
      [
        "string? name = profile?.Name;",
        'string label = name ?? "guest";',
        "Console.WriteLine(label);",
      ],
    ],
    [
      "cs-list",
      "Make a list",
      [
        "var scores = new List<int> { 72, 88, 95 };",
        "scores.Add(100);",
        "Console.WriteLine(scores[0]);",
      ],
    ],
    [
      "cs-linq",
      "Filter with LINQ",
      ["var passing = scores", "    .Where(score => score >= 80)", "    .ToList();"],
    ],
    [
      "cs-dict",
      "Read a dictionary",
      [
        'var counts = new Dictionary<string, int> { ["a"] = 2 };',
        'counts.TryGetValue("a", out int value);',
        "Console.WriteLine(value);",
      ],
    ],
    [
      "cs-guard",
      "Guard empty input",
      ["if (string.IsNullOrWhiteSpace(name)) {", '    name = "guest";', "}"],
    ],
    [
      "cs-loop",
      "Loop over items",
      ["foreach (var item in items) {", "    Console.WriteLine(item.Name);", "}"],
    ],
    [
      "cs-switch",
      "Switch expression",
      ["string label = status switch {", '    "ready" => "Go",', '    _ => "Wait"', "};"],
    ],
    [
      "cs-method",
      "Clamp a value",
      ["static int Clamp(int value) {", "    return Math.Max(0, Math.Min(value, 100));", "}"],
    ],
    [
      "cs-array",
      "Read an array",
      ["int[] values = { 3, 5, 8 };", "int first = values[0];", "Console.WriteLine(first);"],
    ],
    [
      "cs-async",
      "Await text",
      [
        "async Task<string> LoadAsync(string path) {",
        "    return await File.ReadAllTextAsync(path);",
        "}",
      ],
    ],
    [
      "cs-format",
      "Interpolate a string",
      ["int count = 3;", 'string message = $"Items: {count}";', "Console.WriteLine(message);"],
    ],
  ],
  c: [
    ["c-sum", "Add two numbers", ["int sum(int a, int b) {", "  return a + b;", "}"]],
    [
      "c-array",
      "Read an array",
      ["int scores[] = {72, 88, 95};", "int first = scores[0];", 'printf("%d\\n", first);'],
    ],
    ["c-guard", "Guard a pointer", ["if (name == NULL) {", '  name = "guest";', "}"]],
    [
      "c-loop",
      "Count items",
      ["int total = 0;", "for (int i = 0; i < count; i++) {", "  total += values[i];", "}"],
    ],
    ["c-struct", "Declare a point", ["struct Point {", "  int x;", "  int y;", "};"]],
    ["c-pointer", "Increment a value", ["void increment(int *value) {", "  *value += 1;", "}"]],
    ["c-format", "Print a label", ['const char *name = "Ada";', 'printf("Hello, %s\\n", name);']],
    [
      "c-switch",
      "Choose a status",
      ["switch (status) {", '  case 1: puts("ready"); break;', '  default: puts("wait");', "}"],
    ],
    [
      "c-size",
      "Count array members",
      [
        "int values[] = {3, 5, 8};",
        "size_t count = sizeof(values) / sizeof(values[0]);",
        'printf("%zu\\n", count);',
      ],
    ],
    ["c-condition", "Clamp a score", ["if (score > 100) {", "  score = 100;", "}"]],
    [
      "c-string",
      "Copy a name",
      ["char name[16] = {0};", 'snprintf(name, sizeof(name), "%s", input);', "puts(name);"],
    ],
    ["c-enum", "Declare states", ["enum Status {", "  STATUS_IDLE,", "  STATUS_READY", "};"]],
  ],
  cpp: [
    [
      "cpp-vector",
      "Append to a vector",
      [
        "std::vector<int> scores{72, 88};",
        "scores.push_back(95);",
        "std::cout << scores.at(0) << '\\n';",
      ],
    ],
    [
      "cpp-optional",
      "Default an optional",
      [
        'std::optional<std::string> name = "Ada";',
        'auto label = name.value_or("guest");',
        "std::cout << label;",
      ],
    ],
    [
      "cpp-map",
      "Read a map",
      [
        'std::map<std::string, int> counts{{"a", 2}};',
        'int value = counts.at("a");',
        "std::cout << value;",
      ],
    ],
    [
      "cpp-lambda",
      "Filter values",
      ["auto isPassing = [](int score) {", "  return score >= 80;", "};"],
    ],
    [
      "cpp-range",
      "Loop over names",
      ["for (const auto& name : names) {", "  std::cout << name << '\\n';", "}"],
    ],
    ["cpp-struct", "Declare a point", ["struct Point {", "  double x;", "  double y;", "};"]],
    [
      "cpp-function",
      "Clamp a value",
      ["int clamp(int value) {", "  return std::max(0, std::min(value, 100));", "}"],
    ],
    [
      "cpp-string",
      "Build a message",
      [
        'std::string name = "Ada";',
        'std::string message = "Hello, " + name;',
        "std::cout << message;",
      ],
    ],
    [
      "cpp-pair",
      "Read a pair",
      ["std::pair<int, int> point{12, 8};", "auto [x, y] = point;", "std::cout << x + y;"],
    ],
    ["cpp-guard", "Guard an empty string", ["if (name.empty()) {", '  name = "guest";', "}"]],
    [
      "cpp-algorithm",
      "Sort scores",
      [
        "std::vector<int> scores{88, 72, 95};",
        "std::sort(scores.begin(), scores.end());",
        "std::cout << scores.front();",
      ],
    ],
    ["cpp-enum", "Declare a state", ["enum class Status {", "  idle,", "  ready", "};"]],
  ],
  ruby: [
    ["rb-method", "Define a greeting", ["def greet(name)", '  "Hello, #{name}"', "end"]],
    [
      "rb-array",
      "Filter scores",
      [
        "scores = [72, 88, 95]",
        "passing = scores.select { |score| score >= 80 }",
        "puts passing.first",
      ],
    ],
    [
      "rb-hash",
      "Read a hash",
      ['user = { name: "Ada", active: true }', 'label = user.fetch(:name, "guest")', "puts label"],
    ],
    [
      "rb-safe",
      "Use safe navigation",
      ["name = user&.dig(:profile, :name)", 'puts name || "guest"'],
    ],
    [
      "rb-each",
      "Number items",
      ["items.each_with_index do |item, index|", '  puts "#{index}: #{item}"', "end"],
    ],
    [
      "rb-guard",
      "Guard empty input",
      ["def label(name)", '  return "guest" if name.nil? || name.empty?', "  name", "end"],
    ],
    [
      "rb-map",
      "Map to names",
      ["names = users.map do |user|", '  user.fetch(:name, "guest")', "end"],
    ],
    [
      "rb-case",
      "Choose a label",
      ["label = case status", '  when :ready then "Go"', '  else "Wait"', "end"],
    ],
    [
      "rb-range",
      "Take recent items",
      ["recent = items.last(5)", "first = recent.fetch(0, nil)", 'puts first || "empty"'],
    ],
    [
      "rb-sum",
      "Add prices",
      ["total = cart.sum do |item|", "  item[:price] * item[:quantity]", "end"],
    ],
    [
      "rb-symbol",
      "Use symbol keys",
      [
        "settings = { theme: :dark, hints: true }",
        "settings[:hints] = false",
        "puts settings[:theme]",
      ],
    ],
    [
      "rb-rescue",
      "Handle a number error",
      ["begin", "  count = Integer(raw)", "rescue ArgumentError", "  count = 0", "end"],
    ],
  ],
  php: [
    ["php-array", "Read an array", ["<?php", "$scores = [72, 88, 95];", "echo $scores[0];"]],
    [
      "php-guard",
      "Default a name",
      ["<?php", "$name = $user['name'] ?? 'guest';", "echo trim($name);"],
    ],
    [
      "php-map",
      "Map item names",
      ["<?php", "$names = array_map(", "    fn($item) => $item['name'],", "    $items", ");"],
    ],
    [
      "php-filter",
      "Filter scores",
      ["<?php", "$passing = array_filter(", "    $scores,", "    fn($score) => $score >= 80", ");"],
    ],
    [
      "php-function",
      "Define a helper",
      [
        "<?php",
        "function label(string $name): string {",
        "    return $name !== '' ? $name : 'guest';",
        "}",
      ],
    ],
    [
      "php-loop",
      "Loop over items",
      ["<?php", "foreach ($items as $item) {", "    echo $item['name'] . PHP_EOL;", "}"],
    ],
    [
      "php-match",
      "Match a status",
      [
        "<?php",
        "$label = match ($status) {",
        "    'ready' => 'Go',",
        "    default => 'Wait',",
        "};",
      ],
    ],
    [
      "php-assoc",
      "Build a response",
      ["<?php", "$response = ['ok' => true, 'count' => 3];", "echo json_encode($response);"],
    ],
    [
      "php-nullsafe",
      "Use a nullsafe call",
      ["<?php", "$name = $user?->profile?->name ?? 'guest';", "echo $name;"],
    ],
    ["php-string", "Format a message", ["<?php", "$name = 'Ada';", "printf('Hello, %s', $name);"]],
    [
      "php-try",
      "Catch an exception",
      [
        "<?php",
        "try {",
        "    $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);",
        "} catch (JsonException $error) { $value = []; }",
      ],
    ],
    [
      "php-count",
      "Count active items",
      [
        "<?php",
        "$active = array_filter($users, fn($user) => $user['active']);",
        "echo count($active);",
      ],
    ],
  ],
  swift: [
    [
      "swift-struct",
      "Define a user",
      ["struct User {", "    let id: Int", "    let name: String", "}"],
    ],
    [
      "swift-optional",
      "Default a name",
      ["let name: String? = profile?.name", 'let label = name ?? "guest"', "print(label)"],
    ],
    [
      "swift-array",
      "Filter scores",
      [
        "let scores = [72, 88, 95]",
        "let passing = scores.filter { $0 >= 80 }",
        "print(passing.count)",
      ],
    ],
    [
      "swift-dict",
      "Read a dictionary",
      ['let counts = ["a": 2, "b": 4]', 'let value = counts["a"] ?? 0', "print(value)"],
    ],
    [
      "swift-guard",
      "Guard a value",
      [
        "func label(_ name: String?) -> String {",
        '    guard let name else { return "guest" }',
        "    return name",
        "}",
      ],
    ],
    [
      "swift-loop",
      "Enumerate names",
      ["for (index, name) in names.enumerated() {", "    print(index, name)", "}"],
    ],
    [
      "swift-switch",
      "Switch on a state",
      ["switch status {", '    case .ready: print("Go")', '    default: print("Wait")', "}"],
    ],
    [
      "swift-function",
      "Clamp a score",
      ["func clamp(_ value: Int) -> Int {", "    min(max(value, 0), 100)", "}"],
    ],
    [
      "swift-map",
      "Map to labels",
      ["let labels = users.map { user in", "    user.name.uppercased()", "}"],
    ],
    [
      "swift-string",
      "Format a message",
      ['let name = "Ada"', 'let message = "Hello, \\(name)"', "print(message)"],
    ],
    [
      "swift-set",
      "Unique tags",
      ['let tags: Set<String> = ["code", "typing"]', "let sorted = tags.sorted()", "print(sorted)"],
    ],
    [
      "swift-range",
      "Slice a list",
      [
        "let recent = Array(items.suffix(3))",
        'let first = recent.first ?? "empty"',
        "print(first)",
      ],
    ],
  ],
  kotlin: [
    [
      "kt-data",
      "Define a user",
      [
        "data class User(val id: Int, val name: String)",
        'val user = User(1, "Ada")',
        "println(user.name)",
      ],
    ],
    [
      "kt-null",
      "Default a name",
      ["val name: String? = profile?.name", 'val label = name ?: "guest"', "println(label)"],
    ],
    [
      "kt-list",
      "Filter scores",
      [
        "val scores = listOf(72, 88, 95)",
        "val passing = scores.filter { it >= 80 }",
        "println(passing.size)",
      ],
    ],
    [
      "kt-map",
      "Read a map",
      ['val counts = mapOf("a" to 2, "b" to 4)', 'val value = counts["a"] ?: 0', "println(value)"],
    ],
    [
      "kt-guard",
      "Guard input",
      [
        "fun label(name: String?): String {",
        '    if (name.isNullOrBlank()) return "guest"',
        "    return name",
        "}",
      ],
    ],
    [
      "kt-loop",
      "Loop over names",
      ["for ((index, name) in names.withIndex()) {", '    println("$index: $name")', "}"],
    ],
    [
      "kt-when",
      "Choose a label",
      ["val label = when (status) {", '    "ready" -> "Go"', '    else -> "Wait"', "}"],
    ],
    [
      "kt-function",
      "Clamp a value",
      ["fun clamp(value: Int): Int {", "    return value.coerceIn(0, 100)", "}"],
    ],
    ["kt-group", "Group items", ["val groups = items.groupBy { item ->", "    item.category", "}"]],
    ["kt-range", "Use a range", ["for (number in 1..3) {", "    println(number)", "}"]],
    [
      "kt-set",
      "Unique tags",
      ['val tags = setOf("code", "typing")', "val sorted = tags.sorted()", "println(sorted)"],
    ],
    [
      "kt-string",
      "Format a greeting",
      ['val name = "Ada"', 'val message = "Hello, $name"', "println(message)"],
    ],
  ],
} satisfies Record<ExtendedLanguage, readonly Entry[]>;
