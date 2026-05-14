# Bureau Design — Drop-in Files

Copy each file into your `elections-tool/` codebase at the same path shown below.
Then `git push origin main` and Vercel will deploy automatically.

## Files to copy

| Source (this package)                                    | Destination in your repo                                        |
|----------------------------------------------------------|-----------------------------------------------------------------|
| `src/index.css`                                          | `src/index.css`                                                 |
| `src/components/bureau/BureauComponents.tsx`             | `src/components/bureau/BureauComponents.tsx`  ← new folder     |
| `src/components/shared/LanguageSwitcher.tsx`             | `src/components/shared/LanguageSwitcher.tsx`                    |
| `src/components/Survey/QuestionCard.tsx`                 | `src/components/Survey/QuestionCard.tsx`                        |
| `src/components/Survey/DimensionHeader.tsx`              | `src/components/Survey/DimensionHeader.tsx`                     |
| `src/pages/IntroPage.tsx`                                | `src/pages/IntroPage.tsx`                                       |
| `src/pages/PrioritiesPage.tsx`                           | `src/pages/PrioritiesPage.tsx`                                  |
| `src/pages/SurveyPage.tsx`                               | `src/pages/SurveyPage.tsx`                                      |
| `src/pages/ResultsPage.tsx`                              | `src/pages/ResultsPage.tsx`                                     |

## What changed

- **Visual design** — Bureau palette (`#fafaf7` bg, `#0a0a0a` ink, `#0891b2` accent), Heebo/Rubik fonts, card borders, compass rose motif, grid-paper dot backgrounds
- **Dimension transitions** — SurveyPage now shows a full-screen dimension intro screen when entering each new topic (new feature)
- **Question card** — radio-button scale, compass rose label, "learn more" link
- **No logic changes** — all state management, routing, scoring, share/compare, analytics, API calls are identical

## After copying

```bash
cd elections-tool
git add -A
git commit -m "apply Bureau design"
git push origin main
```

Vercel picks it up automatically → live on vote-compass.vercel.app
