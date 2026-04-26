# kerf — legal template customization

`/privacy` and `/terms` ship as templates. Before deploying kerf
to production, replace every `{{PLACEHOLDER}}` with a real value
and remove the amber "template" banner.

## Placeholders

| Placeholder | Example | Notes |
|-------------|---------|-------|
| `{{COMPANY_NAME}}` | `Kerf Typing Labs Ltd.` | Legal entity name |
| `{{JURISDICTION}}` | `England and Wales` | Governing law |
| `{{CONTACT_EMAIL}}` | `legal@typekerf.com` | Public contact for rights requests |
| `{{EFFECTIVE_DATE}}` | `1 May 2026` | When the current version took effect |
| `{{DATA_REGION}}` | `the European Union` | Where user data is stored |
| `{{EMAIL_PROVIDER}}` | `Resend, Inc.` | Magic-link delivery service |
| `{{HOSTING}}` | `Hetzner Cloud, Germany` | Infrastructure provider |

## Customization steps

1. Open `src/routes/privacy.tsx` and `src/routes/terms.tsx`.
2. Replace every `{{PLACEHOLDER}}` instance in the page content.
3. Remove the `isTemplate` prop from the `<DocPage>` usage in
   both files. This hides the amber banner.
4. Remove the `// TEMPLATE PLACEHOLDERS …` comment block at the
   top of each file.
5. Verify the result:

   ```bash
   grep -R '{{' src/routes/privacy.tsx src/routes/terms.tsx
   ```

   Expected: no output (no remaining placeholders).
6. Run the full test suite:

   ```bash
   npx vitest run
   npm run typecheck
   npm run test:a11y
   npm run build
   ```

7. Have a lawyer review the results. These are templates, not
   final legal documents; they should be reviewed by someone
   qualified to do so in the relevant jurisdiction.

## Pre-deploy check

Include this grep in your deployment checklist:

```bash
if grep -Rq '{{' src/routes/privacy.tsx src/routes/terms.tsx; then
  echo "ERROR: unresolved legal placeholders — refusing to deploy"
  exit 1
fi
```

Add it to your CI pipeline or a pre-deploy git hook so you can
never ship with `{{PLACEHOLDER}}` text live.
