import { Check, Circle } from "lucide-react";

interface PasswordHintProps {
  password: string;
}

// Mirrors passwordSchema in @/lib/schemas/auth, in priority order — keep in sync if the
// rules change. Only the first unmet rule is ever shown, so order determines what a user
// sees first (length before character-class rules feels like the most natural fix-order).
const REQUIREMENTS: { hint: string; test: (pw: string) => boolean }[] = [
  { hint: "Use at least 8 characters", test: (pw) => pw.length >= 8 },
  { hint: "Add an uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { hint: "Add a lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { hint: "Add a number", test: (pw) => /[0-9]/.test(pw) },
  { hint: "Add a special character", test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
  { hint: "Remove spaces", test: (pw) => !/\s/.test(pw) },
];

export function PasswordHint({ password }: PasswordHintProps) {
  if (!password) {
    return (
      <p className="text-xs text-muted-foreground">
        At least 8 characters, with uppercase, lowercase, a number, and a special character.
      </p>
    );
  }

  const nextUnmet = REQUIREMENTS.find(({ test }) => !test(password));

  if (!nextUnmet) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-cta">
        <Check className="h-3 w-3 shrink-0" />
        Strong password
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Circle className="h-3 w-3 shrink-0" />
      {nextUnmet.hint}
    </p>
  );
}
