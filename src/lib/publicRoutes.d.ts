import type { SiteContent, Development } from "./contentTypes";
export const publicStaticRoutes: string[];
export function developmentRoute(development: Development): string;
export function findDevelopment(content: SiteContent, route: string): Development | undefined;
export function publishedRoutes(content: SiteContent): string[];
export function publicRouteExists(content: SiteContent, route: string): boolean;
