import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { classNames } from '../lib/format';

interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
}

export function SmartImage({ src, alt, className, loading = 'lazy', ...props }: SmartImageProps) {
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => setImageSrc(src), [src]);

  return (
    <img
      {...props}
      src={imageSrc}
      alt={alt ?? ''}
      loading={loading}
      className={classNames(className, imageSrc !== src && 'image-fallback')}
      onError={() => {
        if (imageSrc !== '/flower-placeholder.svg') setImageSrc('/flower-placeholder.svg');
      }}
    />
  );
}
