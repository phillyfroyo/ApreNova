// src/lib/admin/anahuac.ts
//
// Identifies Anáhuac students in the admin dashboard so they can be visually
// flagged (and not accidentally contacted during personal user outreach).
//
// Computed rule, no DB field: a user is Anáhuac if EITHER
//   1. their email is on the @anahuac.mx domain (most students followed the
//      instruction to sign up with their institutional address), OR
//   2. their userNumber is in ANAHUAC_OVERRIDE_NUMBERS below (the stragglers
//      who used a personal email).
//
// The email rule is self-maintaining — future @anahuac.mx signups are flagged
// automatically. The override list is for exceptions only; add the personal-
// email students' userNumbers to it. (This lives in code, so adding one needs
// a deploy — fine for a handful; if it grows, promote to a User.isAnahuac DB
// field.)

// userNumbers of Anáhuac students who signed up with a NON-anahuac.mx email.
// Add the stragglers here, e.g. [4, 11, 23].
export const ANAHUAC_OVERRIDE_NUMBERS: number[] = [
  181, 178, 176, 172, 171, 169, 166, 161,
  155, 154, 153, 152, 147, 136, 125, 123,
];

// Broad safety net: flag any email that contains "anahuac" anywhere. This is
// deliberately permissive — the feature exists so we NEVER accidentally contact
// an Anáhuac student during personal outreach, so over-flagging is far safer
// than missing one. A strict domain match previously let at least one genuine
// @anahuac.mx student (#147) slip through for an unexplained reason; this
// catches every variant (subdomains, .edu.mx, hidden/encoding quirks). The only
// downside is an implausible false positive: an unrelated address that happens
// to contain the literal string "anahuac".
function hasAnahuacEmail(email: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().includes("anahuac");
}

/** True if this user should be flagged as an Anáhuac student. */
export function isAnahuacUser(user: { email: string | null; userNumber: number }): boolean {
  return hasAnahuacEmail(user.email) || ANAHUAC_OVERRIDE_NUMBERS.includes(user.userNumber);
}
