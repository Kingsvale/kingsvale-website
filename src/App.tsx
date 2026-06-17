import { lazy, Suspense, type ComponentType, type ReactNode, useEffect } from "react";
import { Homepage } from "./pages/Homepage";
import { useSiteContent } from "./hooks/useSiteContent";
import { studioPath } from "./lib/studioRoute";
import { usePageSeo } from "./lib/seo";
import { isStudioPreviewRequest } from "./lib/studioPreview";
import {
  recordAnalyticsVisit,
  shouldRecordAnalyticsVisit,
  shouldTrackRoute,
  type AnalyticsRouteType
} from "./lib/analytics";
import type { SiteContent } from "./lib/contentTypes";

const AboutPage = lazyNamed("AboutPage");
const ContactPage = lazyNamed("ContactPage");
const DesignBuildPage = lazyNamed("DesignBuildPage");
const DevelopmentDetailPage = lazyNamed("DevelopmentDetailPage");
const DevelopmentsIndexPage = lazyNamed("DevelopmentsIndexPage");
const FaqPage = lazyNamed("FaqPage");
const LandOpportunitiesPage = lazyNamed("LandOpportunitiesPage");
const LandSellerGuidePage = lazyNamed("LandSellerGuidePage");
const LandWantedPage = lazyNamed("LandWantedPage");
const LegalPage = lazyNamed("LegalPage");
const NewHomesSouthEnglandPage = lazyNamed("NewHomesSouthEnglandPage");
const NotFoundPage = lazyNamed("NotFoundPage");
const RealEstateDevelopmentPage = lazyNamed("RealEstateDevelopmentPage");
const SecurityReviewPage = lazyNamed("SecurityReviewPage");
const VisionProcessPage = lazyNamed("VisionProcessPage");
const AdminDecoyPage = lazy(() =>
  import("./pages/StudioAuthPage").then((module) => ({ default: module.AdminDecoyPage }))
);
const StudioAuthPage = lazy(() =>
  import("./pages/StudioAuthPage").then((module) => ({ default: module.StudioAuthPage }))
);
const TrackingPage = lazy(() =>
  import("./pages/TrackingPage").then((module) => ({ default: module.TrackingPage }))
);
const PlotLookupPage = lazy(() =>
  import("./pages/PlotLookupPage").then((module) => ({ default: module.PlotLookupPage }))
);

const staticContentRoutes = new Map<string, (content: SiteContent) => ReactNode>([
  ["/plot-lookup", (content) => <PlotLookupPage content={content} />],
  ["/developments", (content) => <DevelopmentsIndexPage content={content} />],
  ["/design-build", (content) => <DesignBuildPage content={content} />],
  ["/vision-process", (content) => <VisionProcessPage content={content} />],
  ["/about", (content) => <AboutPage content={content} />],
  ["/land-wanted", (content) => <LandWantedPage content={content} />],
  ["/new-homes-south-england", (content) => <NewHomesSouthEnglandPage content={content} />],
  ["/real-estate-development", (content) => <RealEstateDevelopmentPage content={content} />],
  ["/land-opportunities", (content) => <LandOpportunitiesPage content={content} />],
  ["/land-seller-guide", (content) => <LandSellerGuidePage content={content} />],
  ["/faq", (content) => <FaqPage content={content} />],
  ["/contact", (content) => <ContactPage content={content} />],
  ["/security-review", (content) => <SecurityReviewPage content={content} />]
]);

export function App() {
  const content = useSiteContent();
  const route = window.location.pathname;
  usePageSeo(content, route);
  useEffect(() => {
    if (isStudioPreviewRequest()) {
      return;
    }

    if (!shouldTrackRoute(route) || !shouldRecordAnalyticsVisit(route)) {
      return;
    }

    void recordAnalyticsVisit({
      path: route,
      title: getRouteTitle(route),
      routeType: getRouteType(route)
    });
  }, [route]);

  if (route === "/") {
    return <Homepage content={content} />;
  }

  if (route === studioPath) {
    return (
      <RouteBoundary>
        <StudioAuthPage publishedContent={content} />
      </RouteBoundary>
    );
  }

  if (route === "/admin") {
    return (
      <RouteBoundary>
        <AdminDecoyPage />
      </RouteBoundary>
    );
  }

  if (route.startsWith("/track/")) {
    const token = route.split("/").filter(Boolean)[1];
    return (
      <RouteBoundary>
        <TrackingPage content={content} token={token ?? ""} />
      </RouteBoundary>
    );
  }

  if (route.startsWith("/developments/")) {
    const developmentId = route.split("/").filter(Boolean)[1];
    const development = content.developments.find((item) => item.id === developmentId);
    return (
      <RouteBoundary>
        {development ? (
          <DevelopmentDetailPage content={content} development={development} />
        ) : (
          <NotFoundPage content={content} />
        )}
      </RouteBoundary>
    );
  }

  const renderStaticPage = staticContentRoutes.get(route);
  if (renderStaticPage) {
    return (
      <RouteBoundary>
        {renderStaticPage(content)}
      </RouteBoundary>
    );
  }

  if (route === "/privacy" || route === "/terms") {
    return (
      <RouteBoundary>
        <LegalPage content={content} kind={route === "/privacy" ? "privacy" : "terms"} />
      </RouteBoundary>
    );
  }

  return (
    <RouteBoundary>
      <NotFoundPage content={content} />
    </RouteBoundary>
  );
}

function getRouteType(route: string): AnalyticsRouteType {
  return route.startsWith("/track/") ? "tracking" : "website";
}

function getRouteTitle(route: string) {
  if (route === "/") {
    return "Homepage";
  }
  if (route.startsWith("/track/")) {
    return "Plot map page";
  }
  if (route === "/plot-lookup") {
    return "Plot lookup";
  }

  return route
    .split("/")
    .filter(Boolean)
    .map((part) => part.replaceAll("-", " "))
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" / ") || "Website page";
}

function RouteBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="route-loading" />}>{children}</Suspense>;
}

function lazyNamed<T extends keyof typeof import("./pages/ContentPages")>(name: T) {
  return lazy(() =>
    import("./pages/ContentPages").then((module) => ({
      default: module[name] as ComponentType<any>
    }))
  );
}
