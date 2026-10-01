# Production UX audit — October 1, 2026

Scope: the current production app at `3b2ec809427d` and its public pages at
https://typekerf.com/. This audit covers entry, sign-in, onboarding, practice,
navigation, and the first result. It is a code and public-page review; it does
not claim measured conversion or usability-test results.

## Current path to a keystroke

| Visitor | Current path |
| --- | --- |
| Signed out, existing account | `/` → permanent redirect to `/welcome` → **Start practicing** → `/login` → email/OAuth → `/` → Home lobby → primary CTA → session briefing → typing |
| Signed out, new account | Same entry and sign-in → four onboarding questions → onboarding landing → `/practice` → first-session CTA → briefing → typing |
| Signed in, returning | `/` → Home lobby → primary CTA → session briefing → typing |

The long public page has six sections and repeats its main CTA at the top and
bottom (`src/routes/welcome.tsx`). The signed-in Home and `/practice` are two
separate decision surfaces (`src/routes/index.tsx`, `src/routes/practice.tsx`).

## What works

- The main Home CTA can open a session with `?autostart=1`, avoiding the
  practice mode picker for returning users (`src/routes/index.tsx:142`,
  `src/routes/practice.tsx:61`).
- A focused briefing explains the chosen target; keyboard shortcuts make
  repeat practice fast (`src/components/practice/SessionBriefing.tsx`).
- Educational pages can stay available as optional reference material.

## Friction and waste

| Priority | Finding | Effect | Recommended change |
| --- | --- | --- | --- |
| P0 | `/` sends signed-out visitors through a **301** to `/welcome`, whose six sections are mostly prose; the primary CTA only reaches login (`src/routes/index.tsx:31`, `src/routes/welcome.tsx:80`). | A visitor who wants to type must first parse a marketing page and then sign in. | Make the first screen a compact product entry: one sentence, one prominent **Start typing** action, and optional links to deeper explanations. Keep the auth requirement clear. |
| P0 | Signed-in users land on a Home lobby, then get another briefing before typing (`src/routes/index.tsx:47`, `src/components/practice/SessionBriefing.tsx:17`). | The core task sits behind two screens. | Send returning users to `/practice` or provide a direct **Quick start** path. Preserve the target as a short inline cue when skipping the separate briefing. |
| P1 | Onboarding asks four questions on separate screens and adds a fifth landing screen (`src/routes/onboarding.tsx:58`). | Time to first keystroke is long, even though defaults are already selected. | Combine essential setup into one screen, then let users edit hand, level, and finger assignment later. Keep keyboard choice explicit. |
| P1 | The practice picker includes a disabled **Warm up** card and terms such as **Inner column** (`src/components/practice/PreSessionStage.tsx:130`). The nav shows a visual-only avatar (`src/components/nav/AppNav.tsx:52`). | Dead controls and jargon compete with the main action. | Remove unavailable actions; use plain labels; make the avatar functional or remove it. |
| P1 | The generic post-session page has an **improved** section that says session history is a future feature (`src/components/practice/PostSessionStage.tsx:149`). The public page promises “No streaks,” while Home displays a day streak (`src/routes/welcome.tsx:294`, `src/routes/index.tsx:201`). | Results and product promises can feel unfinished or inconsistent. | Show only measured changes, or remove the placeholder. Decide whether streaks belong in the product and align both surfaces. |
| P1 | Home loads every session row for the active profile on each visit, then computes the last session and 30-day activity in JavaScript (`src/server/home.ts:91`). | Work grows with a user's lifetime history even though the UI needs a count, one latest row, and 30 days. | Use SQL count/latest/grouped daily queries or cached aggregates; avoid loading the whole history. |
| P2 | The mobile gate hides the entire app tree, including public explanations, login, and progress views (`src/components/MobileGate.tsx`, `src/routes/__root.tsx:101`). | Phone visitors cannot explore the product or inspect their account. | Limit the gate to typing interactions; allow responsive public pages and read-only account views. |

## Recommended sequence on this branch

1. **Entry and task:** reduce `/welcome` to one viewport with a clear CTA;
   route signed-in visitors toward practice. Retain the deeper pages as links.
2. **Practice flow:** remove disabled options and test a one-click Quick start
   for returning users, with the focus cue visible while typing.
3. **First result:** remove the unmeasured improvement placeholder and align
   copy about streaks.
4. **Efficiency:** replace the unbounded Home history query, then shorten
   onboarding and relax the mobile gate if usage data supports it.

Measure time to first keystroke, login/onboarding completion, first-session
completion, and repeat-session use before and after the changes. The code
currently cannot establish where visitors abandon this journey.

## Routing and rollout detail

The signed-out redirect from `/` is permanent (`301`) for search canonical
reasons. Browsers and crawlers may cache it. The safest first release changes
the content and CTA of `/welcome` while preserving that route. A later move
of the public canonical page to `/` should include redirect, canonical,
sitemap, and Search Console checks. The typing error-indicator fix is a
separate commit on this branch and can be released before these UX changes.
