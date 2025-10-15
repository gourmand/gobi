/**
 * Utility to check if a user is a Gobi team member
 */
export function isGobiTeamMember(email?: string): boolean {
  if (!email) return false;
  return email.endsWith("@gourmand.dev");
}
