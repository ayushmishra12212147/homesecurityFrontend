async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getDeviceFingerprint(): Promise<string> {
  const nav = window.navigator as any;
  const parts = [
    nav.userAgent || "",
    nav.language || "",
    String(nav.hardwareConcurrency || ""),
    String(nav.deviceMemory || ""),
    String(screen.width) + "x" + String(screen.height),
    String(Intl.DateTimeFormat().resolvedOptions().timeZone || ""),
  ];
  // Server stores sha256(fingerprint) already; still OK to send a hashed blob as "fingerprint" value
  return await sha256Hex(parts.join("|"));
}


