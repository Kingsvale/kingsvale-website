import { useContext } from "react";
import { SiteEditingContext } from "./SiteText";

type LogoProps = {
  brandName: string;
  brandSuffix: string;
  href?: string;
};

export function Logo({ brandName, brandSuffix, href = "/" }: LogoProps) {
  const label = `${brandName} ${brandSuffix}`;
  const context = useContext(SiteEditingContext);

  return (
    <a className="logo" href={href} aria-label={`${label} home`}>
      <img
        className="logo__image"
        src={context?.content.imageOverrides?.logo?.src ?? "/brand/kingsvale-white.png"}
        data-cms-image="imageOverrides.logo"
        alt=""
        aria-hidden="true"
      />
    </a>
  );
}
