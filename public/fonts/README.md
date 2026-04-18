# Font files

Self-hosted variable font files for kerf.

## Required files

| File | Source |
|------|--------|
| `Inter-Variable.woff2` | https://rsms.me/inter/ — download the variable font zip |
| `JetBrainsMono-Variable.woff2` | https://www.jetbrains.com/lp/mono/ — download zip, use the variable .woff2 |
| `Fraunces-Variable.woff2` | https://github.com/undercasetype/Fraunces/releases — download the variable .woff2 |

Place each file directly in this directory. The @font-face declarations in `src/styles.css`
reference these paths as `/fonts/*.woff2`.

Until these files are present, all three fonts fall back gracefully to system stacks
defined in `@theme` in `src/styles.css`.
