import { lazy, Suspense, type ComponentType, type ReactNode, useEffect } from "react";
import { Homepage } from "./pages/Homepage";
import { useSiteContent } from "./hooks/useSiteContent";
import { studioPath } from "./lib/studioRoute";
import { usePageSeo } from "./lib/seo";
import {
  recordAnalyticsVisit,
  shouldRecordAnalyticsVisit,
  shouldTrackRoute,
  type AnalyticsRouteType
} from "./lib/analytics";

const AboutPage = lazyNamed("AboutPage");
const ContactPage = lazyNamed("ContactPage");
const DesignBuildPage = lazyNamed("DesignBuildPage");
const DevelopmentDetailPage = lazyNamed("DevelopmentDetailPage");
const DevelopmentsIndexPage = lazyNamed("DevelopmentsIndexPage");
const LandWantedPage = lazyNamed("LandWantedPage");
const LegalPage = lazyNamed("LegalPage");
const NotFoundPage = lazyNamed("NotFoundPage");
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

export function App() {
  const content = useSiteContent();
  const route = window.location.pathname;
  usePageSeo(content, route);
  useEffect(() => {
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

  if (route === "/developments") {
    return (
      <RouteBoundary>
        <DevelopmentsIndexPage content={content} />
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

  if (route === "/design-build") {
    return (
      <RouteBoundary>
        <DesignBuildPage content={content} />
      </RouteBoundary>
    );
  }

  if (route === "/vision-process") {
    return (
      <RouteBoundary>
        <VisionProcessPage content={content} />
      </RouteBoundary>
    );
  }

  if (route === "/about") {
    return (
      <RouteBoundary>
        <AboutPage content={content} />
      </RouteBoundary>
    );
  }

  if (route === "/land-wanted") {
    return (
      <RouteBoundary>
        <LandWantedPage content={content} />
      </RouteBoundary>
    );
  }

  if (route === "/contact") {
    return (
      <RouteBoundary>
        <ContactPage content={content} />
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

  if (route === "/security-review") {
    return (
      <RouteBoundary>
        <SecurityReviewPage content={content} />
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
<<<<<<< HEAD
    return "Land interest map page";
=======
    return "Customer tracking page";
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
