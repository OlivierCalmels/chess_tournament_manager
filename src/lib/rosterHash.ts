/** Hash stable SHA-256 (hex) du roster pour snapshot fichier. */
export async function hashRosterPayload(json: string): Promise<string> {
  const enc = new TextEncoder().encode(json)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
