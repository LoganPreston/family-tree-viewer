export function extractYearFromBirthdate(birthDate?: string): number | null {
  if (!birthDate) return null;
  const yearMatch = birthDate.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) return parseInt(yearMatch[0], 10);
  const anyYearMatch = birthDate.match(/\b\d{4}\b/);
  if (anyYearMatch) {
    const year = parseInt(anyYearMatch[0], 10);
    if (year >= 1000 && year <= 2100) return year;
  }
  return null;
}
