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
  cover?: { mobile: number; desktop: number; desktopWidth?: string };
};

export function ResponsiveImage({
  image,
  sizes,
  className,
  widthHint = 1280,
  priority = false,
  loading,
  field,
  cover,
  ...props
}: ResponsiveImageProps) {
  const context = useContext(SiteEditingContext);
  const path = field ?? context?.bindings.images.get(image) ?? `imageOverrides.${copyKey(image.src, context?.route ?? "/")}`;
  const override = path.startsWith("imageOverrides.") ? context?.content.imageOverrides?.[path.slice(15)] : undefined;
  image = override ?? image;
  const ratio = image.width && image.height ? image.width / image.height : 0;
  if (cover && ratio) sizes = `(max-width: 860px) max(100vw, ${Math.ceil(cover.mobile * ratio * 1.03)}px), max(${cover.desktopWidth ?? "100vw"}, ${Math.ceil(cover.desktop * ratio * 1.03)}px)`;
  return (
    <img
      {...props}
      className={className}
      width={props.width ?? image.width}
      height={props.height ?? image.height}
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
