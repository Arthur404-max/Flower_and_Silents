const PREFIX = 'cvetotishina.order-token.';

function keyFor(number: string): string {
  return `${PREFIX}${encodeURIComponent(number)}`;
}

export function saveOrderToken(number: string, token: string): void {
  try {
    localStorage.setItem(keyFor(number), token);
  } catch {
    try {
      sessionStorage.setItem(keyFor(number), token);
    } catch {
      // The order remains available for this page render when storage is blocked.
    }
  }
}

export function getOrderToken(number: string): string | null {
  const key = keyFor(number);
  try {
    const localToken = localStorage.getItem(key);
    if (localToken) return localToken;
  } catch {
    // Try session storage below.
  }
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
