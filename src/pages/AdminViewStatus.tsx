import { Eye } from "lucide-react";
import type { QrEngagement } from "../hooks/useEngagement";

export function ViewBadge({ value }: { value?: QrEngagement }) {
  return <span className={`qr-view-badge${value?.viewed ? " qr-view-badge--viewed" : ""}`}><Eye aria-hidden="true" />{value ? value.viewed ? "Viewed externally" : "Not yet viewed" : "Views unavailable"}</span>;
}
export function ViewDetail({ value }: { value?: QrEngagement }) {
  return <section className="qr-view-detail" aria-label="QR page views"><ViewBadge value={value} />{value?.viewed && <><span>{value.uniqueNetworks} unique external {value.uniqueNetworks === 1 ? "network" : "networks"}</span><span>First: {date(value.firstViewedAt)}</span><span>Latest: {date(value.lastViewedAt)}</span><strong>{value.viewedLatestUpdate ? "Latest page content viewed" : "Latest page content not yet viewed"}</strong></>}</section>;
}

function date(value: string | null) { return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
