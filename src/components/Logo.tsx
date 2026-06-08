type LogoProps = {
  brandName: string;
  brandSuffix: string;
  href?: string;
};

export function Logo({ brandName, brandSuffix, href = "/" }: LogoProps) {
  const label = `${brandName} ${brandSuffix}`;

  return (
    <a className="logo" href={href} aria-label={`${label} home`}>
      <span className="logo-mark" aria-hidden="true">
        <span className="logo-mark__k">K</span>
        <span className="logo-mark__v">V</span>
      </span>
      <span className="logo-type">
        <span>{brandName}</span>
        <span>{brandSuffix}</span>
      </span>
    </a>
  );
}
