---
name: figma-implement-design-new
description: Read a Figma frame from its figma.com link and build it in the app with the project's tokens and DS parts. Figma is read-only. Use when the designer gives a Figma link.
---

# Figma to code

Figma is read-only: use only `get_metadata`, `get_design_context` and `get_screenshot`. Never write
to Figma, Code Connect included; the kit refuses those tools.

## Steps
1. **Node id from the link.** `figma.com/design/<fileKey>/<name>?node-id=1-2`: `fileKey` is the
   segment after `/design/`, `nodeId` is `1-2`. A branch link (`/design/<fileKey>/branch/<branchKey>/...`):
   `branchKey` is the `fileKey`. No `node-id`: ask for the frame's link.
2. **Design context.** `get_design_context(fileKey, nodeId)`. Too large or cut off: `get_metadata`
   for the node map, then `get_design_context` on each child section you need.
3. **Screenshot.** `get_screenshot` of the same node: the reference for layout and hierarchy.
4. **Assets.** Download the images the context returns (photos, illustrations, logos) into the app
   (`public/` on web, `assets/` on mobile) and point the code at the copy. Never a placeholder where
   Figma has the real image (`dk-03`). Icons never come from Figma: take the nearest by meaning from
   the project's one set (`lucide-react` on web, the `@expo/vector-icons` family in `DECISIONS.md`).
5. **Translate.** The context's code (React and Tailwind) describes the design; never paste it. Its
   hex values and sizes like `w-[343px]` fail the gate (`dk-10`).
   - Each colour, size, radius, shadow and type style maps to the nearest token in `src/tokens`.
     `TASTE.md` and the tokens win over Figma's values; a new token is a `DECISIONS.md` line.
   - Each control is a `src/components/DS<Part>`; missing, make it as `/design-screen` step 7 says.
   - Auto Layout becomes flex with spacing tokens; absolute positions become normal flow.
   - Frame widths (375, 1440) are not breakpoints: layout changes only at the breakpoint tokens, for
     the sizes in `## Screen sizes` of `PROJECT.md`.
   - Figma's copy passes the same gate: lorem and em dashes get rewritten as real words.
   - Data the frame shows goes into `src/api/mock`, never into the screen ("Data" in `AGENTS.md`).
   - Mobile: rebuild in React Native with the same tokens.
6. **Check against the screenshot.** Open the built screen beside it (Chrome DevTools on web):
   structure, hierarchy, spacing rhythm, copy, assets. A match is the same structure on tokens, not
   equal pixels. Then the states Figma leaves out (focus, empty, error, long text), per
   `/design-screen`.
7. **Deviations** (a token for a Figma value, a contrast fix, an added state) go in the screen's
   spec, `project/screens/<screen>.md`, one line each with the why. Never in the code.

## Under `/setup`
Steps 1 to 3 only, for structure and content: the screens, their sections, the copy, the first
screen. Take no colours, fonts or sizes (taste comes from `TASTE.md`); write no code.
