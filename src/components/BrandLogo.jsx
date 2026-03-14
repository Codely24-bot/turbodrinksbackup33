import { Link } from "react-router-dom";

function BrandLogo({
  to = "/",
  subtitle = "",
  variant = "storefront",
  className = ""
}) {
  const content = (
    <>
      <img
        className={`brand-logo-image is-${variant}`}
        src="/turbo-drinks-logo.png"
        alt="Turbo Drinks"
      />
      {subtitle ? <small className={`brand-logo-subtitle is-${variant}`}>{subtitle}</small> : null}
    </>
  );

  if (!to) {
    return <div className={`brand-mark brand-mark-${variant} ${className}`.trim()}>{content}</div>;
  }

  return (
    <Link to={to} className={`brand-mark brand-mark-${variant} ${className}`.trim()}>
      {content}
    </Link>
  );
}

export default BrandLogo;
