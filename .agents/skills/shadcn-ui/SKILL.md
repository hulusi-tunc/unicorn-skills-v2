---
name: shadcn-ui
description: Web only. Add a shadcn/ui part, wrap it as a DS part on the tokens, build forms with React Hook Form and Zod. Use when a web screen needs a control, dialog, menu or form.
---

# shadcn/ui under the design system

- Add: `npx shadcn@latest add <part> -y -s` into `src/components/ui`. Never edit those files: the
  next add overwrites them.
- Wrap: `src/components/DS<Part>.tsx` wraps one part; native props and `ref` pass through, the
  library's `variant` and `size` never do. Only what `TASTE.md` allows: two or three variants, two
  sizes. Read the installed file first: its primitives are Base UI or Radix (`style` in
  `components.json`), so never assume `asChild`.
- Screens import `@/components/DS<Part>`, never `@/components/ui` (gate `dk-08`).
- Theme: the library's variables in `globals.css` point at the tokens (`/tokenize`). Dark mode is
  `light-dark()` and the system: no `next-themes`, no `.dark` class.
- Icons: `lucide-react` only. Toast: the `sonner` part. Animation: `tw-animate-css` (from init),
  durations from the motion tokens.

## Form
One `Controller` per field; the error says how to fix it.

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { saveReceiptEmail } from "@/api"
import { DSButton } from "@/components/DSButton"
import { DSField } from "@/components/DSField"
import { DSInput } from "@/components/DSInput"

const schema = z.object({ email: z.string().email("Enter an email with an @, like name@example.com") })

export function ReceiptEmailForm() {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } })

  return (
    <form onSubmit={form.handleSubmit(saveReceiptEmail)} className="flex flex-col gap-4">
      <Controller name="email" control={form.control} render={({ field, fieldState }) => (
        <DSField label="Email for receipts" htmlFor="email" error={fieldState.error?.message}>
          <DSInput {...field} id="email" type="email" autoComplete="email" aria-invalid={fieldState.invalid} />
        </DSField>
      )} />
      <DSButton type="submit" disabled={form.formState.isSubmitting}>Save email</DSButton>
    </form>
  )
}
```
