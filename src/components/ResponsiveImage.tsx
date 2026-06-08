import type { ImgHTMLAttributes } from "react";
import type { ImageAsset } from "../lib/contentTypes";
import { getOptimizedImageUrl, getResponsiveSrcSet } from "../lib/imageUtils";

type ResponsiveImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "alt"
> & {
  image: ImageAsset;
  widthHint?: number;
  priority?: boolean;
};

export function ResponsiveImage({
  image,
  sizes,
  className,
  widthHint = 1280,
  priority = false,
  loading,
  ...props
}: ResponsiveImageProps) {
  return (
    <img
      {...props}
      className={className}
      src={getOptimizedImageUrl(image.src, widthHint)}
      srcSet={getResponsiveSrcSet(image.src)}
      sizes={sizes}
      alt={image.alt}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      style={{
        objectPosition: image.focalPoint ?? "50% 50%",
        ...props.style
      }}
    />
  );
}
