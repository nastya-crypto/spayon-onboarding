export function isValidFileUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
