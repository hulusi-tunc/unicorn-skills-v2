# After handover

Handover is a dated line in `project/DECISIONS.md`. From then on:

- Work on a branch `design/<topic>`, never `main`, always started from `main` just pulled.
- Before changing a file whose last commit is not the designer's
  (`git log -1 --format=%an -- <file>`), propose the change instead of making it.
- The dev sends an API spec: `types.ts` and `mock/` follow it, and every difference from what the
  screens need goes to `project/DEV.md`.
