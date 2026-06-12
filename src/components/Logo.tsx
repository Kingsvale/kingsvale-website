type LogoProps = {
  brandName: string;
  brandSuffix: string;
  href?: string;
};

export function Logo({ brandName, brandSuffix, href = "/" }: LogoProps) {
  const label = `${brandName} ${brandSuffix}`;

  return (
    <a className="logo" href={href} aria-label={`${label} home`}>
      <img
        className="logo__image"
        src="/brand/kingsvale-white.png"
        alt=""
        aria-hidden="true"
      />
    </a>
  );
}
