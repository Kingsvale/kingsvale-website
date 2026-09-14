import { useContext, type ImgHTMLAttributes } from "react";
import { SiteEditingContext } from "./SiteText";
import { copyKey } from "../lib/siteEditing";
import type { ImageAsset } from "../lib/contentTypes";
import { getOptimizedImageUrl, getResponsiveSrcSet } from "../lib/imageUtils";

type ResponsiveImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "alt"
> & {
  image: ImageAsset;
  widthHint?: number;
  priority?: boolean;
  field?: string;
};

export function ResponsiveImage({
  image,
  sizes,
  className,
  widthHint = 1280,
  priority = false,
  loading,
  field,
  ...props
}: ResponsiveImageProps) {
  const context = useContext(SiteEditingContext);
  const path = field ?? context?.bindings.images.get(image) ?? `imageOverrides.${copyKey(image.src, context?.route ?? "/")}`;
  const override = path.startsWith("imageOverrides.") ? context?.content.imageOverrides?.[path.slice(15)] : undefined;
  image = override ?? image;
  return (
    <img
      {...props}
      className={className}
      data-cms-image={path}
      src={getOptimizedImageUrl(image.src, widthHint)}
      srcSet={image.variants?.map((variant) => `${variant.src} ${variant.width}w`).join(", ") || getResponsiveSrcSet(image.src)}
      sizes={sizes}
      alt={image.alt ?? ""}
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
