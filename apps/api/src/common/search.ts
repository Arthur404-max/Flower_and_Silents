export function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ').trim();
}

export function buildProductSearchText(name: string, description: string, composition: string): string {
  return normalizeSearchText(`${name} ${description} ${composition}`);
}
