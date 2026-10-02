/**
 * The rules for choosing a form password, kept out of the dialog.
 *
 * A module of its own, with no React in it, because this repo's Vitest runs in a node
 * environment with no Testing Library. The dialog is then only responsible for rendering
 * what these return.
 *
 * Both rules exist because of a trap this feature has. There is no way to recover a forgotten
 * form password: the hash never leaves the database, and nothing resets it. So a typo locked a
 * creator out of the responses on their own form, permanently, with the only way out being to
 * delete and rebuild the form. Asking twice is cheap next to that.
 */

/** Mirrors `setFormPasswordInput` in the services package, which enforces the same floor. */
export const PASSWORD_MIN_LENGTH = 8;

/** Why a pair of entries is not yet a password, or `null` when it is. */
export type PasswordProblem = "too_short" | "mismatch";

export const validatePasswordPair = (
  password: string,
  confirmation: string,
): PasswordProblem | null => {
  if (password.length < PASSWORD_MIN_LENGTH) return "too_short";
  if (password !== confirmation) return "mismatch";
  return null;
};

export const passwordProblemMessage = (problem: PasswordProblem): string =>
  problem === "too_short"
    ? `Use at least ${PASSWORD_MIN_LENGTH} characters.`
    : "Those two passwords do not match.";