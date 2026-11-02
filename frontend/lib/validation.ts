/**
 * Common validation utilities for authentication and forms.
 */

// Recognized top-level domains (TLDs)
const RECOGNIZED_TLDS = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int",
  "in", "co", "io", "ai", "me", "app", "dev", "tech", "info", "biz", "xyz", "online", "site", "live", "pro", "store", "demo",
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in", "ac.in", "edu.in", "res.in", "gov.in", "mil.in",
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "sch.uk", "ac.uk", "gov.uk",
  "us", "uk", "ca", "au", "de", "fr", "jp", "cn", "eu", "ch", "se", "nl", "es", "it", "br", "za", "sg", "my", "ae", "sa", "ru", "nz", "kr", "hk", "tw", "ie", "no", "fi", "dk", "be", "at", "pl", "mx", "ar", "cl", "pe", "ph", "id", "th", "vn", "cc", "tv", "to", "so", "fm", "is", "vc",
  "cloud", "digital", "global", "agency", "email", "world", "space", "design", "media", "travel", "club", "group", "life", "today", "zone", "center", "expert", "company", "solutions", "services", "team"
]);

/**
 * Validates an email address.
 * Ensures presence of '@', username, domain name, dot '.', and a valid recognized TLD like .com, .in, etc.
 * Returns null if valid, or a descriptive error string.
 */
export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) {
    return "Enter your email address";
  }
  if (email.length > 254) {
    return "Email address is too long";
  }
  if (/\s/.test(email)) {
    return "Email cannot contain spaces";
  }
  if (!email.includes("@")) {
    return "Email must include '@' (e.g. you@example.com)";
  }

  const parts = email.split("@");
  if (parts.length !== 2) {
    return "Email must contain only one '@'";
  }

  const [local, domain] = parts;
  if (!local) {
    return "Enter the username before '@'";
  }
  if (!domain) {
    return "Enter the domain name after '@' (e.g. gmail.com)";
  }
  if (!domain.includes(".")) {
    return "Domain must include an extension like .com or .in";
  }

  // Check general email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    return "Enter a valid email address (e.g. you@example.com)";
  }

  // TLD validation
  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1].toLowerCase();

  if (!/^[a-z]{2,24}$/.test(tld)) {
    return "Email domain extension is invalid";
  }

  const multiTLD = domainParts.slice(-2).join(".").toLowerCase();
  if (!RECOGNIZED_TLDS.has(tld) && !RECOGNIZED_TLDS.has(multiTLD)) {
    return "Please enter a valid domain extension (e.g. .com, .in, .org, .net)";
  }

  return null;
}
