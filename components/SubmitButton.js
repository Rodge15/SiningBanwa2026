"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/formStyles";

// A submit button that shows a spinner and disables itself while its form's
// server action is running. Drop-in replacement for a <button type="submit">.
// Must be rendered inside the <form> it submits.
//
//   <SubmitButton>Save</SubmitButton>                      -> brand button
//   <SubmitButton className="w-full">Log in</SubmitButton> -> brand + extra
//   <SubmitButton base="<outline classes>">Reject</…>      -> non-brand button
export function SubmitButton({ children, className = "", base = buttonClass, pendingLabel }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${base} ${className} disabled:opacity-70`.trim()}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          {pendingLabel || "Please wait…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}