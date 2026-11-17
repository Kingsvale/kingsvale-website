export const publicStaticRoutes = ["/", "/developments", "/design-build", "/vision-process", "/about", "/land-wanted", "/new-homes-south-england", "/real-estate-development", "/land-opportunities", "/land-seller-guide", "/faq", "/plot-lookup", "/contact", "/privacy", "/terms", "/security-review"];
export function developmentRoute(development) {
  const path = String(development.ctaHref || "").split(/[?#]/)[0];
  return /^\/developments\/[^/]+$/.test(path) ? path : `/developments/${encodeURIComponent(development.id)}`;
}
export function findDevelopment(content, route) {
  if (!/^\/developments\/[^/]+$/.test(route)) return undefined;
  return content.developments.find(item => developmentRoute(item) === route || `/developments/${encodeURIComponent(item.id)}` === route);
}
export function publishedRoutes(content) { return [...new Set([...publicStaticRoutes, ...content.developments.map(developmentRoute)])]; }
export function publicRouteExists(content, route) { return publicStaticRoutes.includes(route) || Boolean(findDevelopment(content, route)); }
