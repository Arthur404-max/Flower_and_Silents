import type { Category } from '../types';

const categoryImages: Array<[RegExp, string]> = [
  [/пион|peon/i, '/images/peonies.jpg'],
  [/роз|rose/i, '/images/roses.jpg'],
  [/тюль|tulip/i, '/images/tulips.jpg'],
  [/бел|white/i, '/images/white-bouquet.jpg'],
  [/сух|dried/i, '/images/dried-flowers.jpg'],
  [/подар|gift|короб|box/i, '/images/gift-box.jpg'],
];

export function categoryImage(category: Category): string {
  const value = `${category.name} ${category.slug}`;
  return categoryImages.find(([pattern]) => pattern.test(value))?.[1] ?? '/images/seasonal.jpg';
}
