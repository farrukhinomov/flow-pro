# Translation Style Guide

## Goal
Keep UI text consistent, short, and predictable across `en` and `de`.

## Rules
1. Use sentence case for labels and helper text.
2. Keep button labels short and action-first: `Save`, `Export CSV`, `Sign visible periods`.
3. Reuse existing keys before adding new ones.
4. Put dynamic values in placeholders: `{{count}}`, `{{date}}`, `{{periodMonth}}`.
5. Avoid embedding business logic in text; text should describe state, not compute it.
6. Keep tone operational and neutral for business UI.

## Key Naming
- Group by feature surface:
  - `requestsUi.*`
  - `timesheetUi.*`
  - `reportsUi.*`
  - `auditUi.*`
  - `teamAvailabilityUi.*`
  - `usersUi.*`
- Prefer specific names over generic ones:
  - Good: `usersUi.unableSaveEmployee`
  - Avoid: `usersUi.error1`

## Engineering Notes
- Add new keys in both locales in `src/i18n/messages.ts`.
- Use `useI18n()` and `t('...')` in components.
- If a `useCallback`/`useMemo` uses `t`, include `t` in dependency arrays.
- For dates/numbers, prefer locale-aware helpers instead of hardcoded formats when possible.

