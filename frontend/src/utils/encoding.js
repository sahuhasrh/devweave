export function encodeUpdate(update) {
  let binary = '';
  for (let i = 0; i < update.length; i += 1) {
    binary += String.fromCharCode(update[i]);
  }
  return btoa(binary);
}

export function decodeUpdate(encoded) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
