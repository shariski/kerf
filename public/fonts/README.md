# Font files

Self-hosted variable font files for kerf. Referenced by `@font-face` declarations
in `src/styles.css`.

## Installed files

| File | Upstream release | Axes | License |
|------|------------------|------|---------|
| `Inter-Variable.woff2` | rsms/inter — `InterVariable.woff2` (font v4.66, fetched from https://rsms.me/inter/font-files/) | `wght` 100–900, `opsz` 14–32 | SIL OFL 1.1 |
| `JetBrainsMono-Variable.woff2` | JetBrains/JetBrainsMono v2.304 — `fonts/variable/JetBrainsMono[wght].ttf`, converted to woff2 with `fontTools` | `wght` 100–800 | SIL OFL 1.1 |
| `Fraunces-Variable.woff2` | undercasetype/Fraunces v1.000 — `Fonts - Web/Fraunces[SOFT,WONK,opsz,wght].woff2` (Roman, ships as woff2 natively) | `wght` 100–900, `opsz` 9–144, `SOFT` 0–100, `WONK` 0–1 | SIL OFL 1.1 |

Fraunces' full `opsz` + `SOFT` + `WONK` axes are required for the `kerf.` wordmark's
`"opsz" 144, "SOFT" 100` variation settings (see `docs/04-design-system.md` §10).

## Updating

To re-fetch a newer release:

1. Inter — `curl -o Inter-Variable.woff2 https://rsms.me/inter/font-files/InterVariable.woff2`
2. JetBrains Mono — download latest release zip from
   https://github.com/JetBrains/JetBrainsMono/releases, extract
   `fonts/variable/JetBrainsMono[wght].ttf`, convert with:
   ```python
   from fontTools.ttLib import TTFont
   f = TTFont("JetBrainsMono[wght].ttf"); f.flavor = "woff2"
   f.save("JetBrainsMono-Variable.woff2")
   ```
3. Fraunces — download latest release zip from
   https://github.com/undercasetype/Fraunces/releases, copy
   `Fonts - Web/Fraunces[SOFT,WONK,opsz,wght].woff2` as `Fraunces-Variable.woff2`.

Commit updates alongside any `@font-face` changes in `src/styles.css`.
