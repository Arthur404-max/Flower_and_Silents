import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { classNames } from '../lib/format';

interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
}

function resolveAsset(src: string): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src)) return src;
  if (src.startsWith('/')) return `${import.meta.env.BASE_URL}${src.slice(1)}`;
  return src;
}

export function SmartImage({ src, alt, className, loading = 'lazy', ...props }: SmartImageProps) {
  const resolvedSrc = resolveAsset(src);
  const fallbackSrc = resolveAsset('/flower-placeholder.svg');
  const [imageSrc, setImageSrc] = useState(resolvedSrc);

  useEffect(() => setImageSrc(resolvedSrc), [resolvedSrc]);

  return (
    <img
      {...props}
      src={imageSrc}
      alt={alt ?? ''}
      loading={loading}
      className={classNames(className, imageSrc !== resolvedSrc && 'image-fallback')}
      onError={() => {
        if (imageSrc !== fallbackSrc) setImageSrc(fallbackSrc);
      }}
    />
  );
}
