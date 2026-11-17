import { BlockList, isIP } from "node:net";

export function normalizeIp(value) {
  let ip = String(value ?? "").trim().toLowerCase();
  if (ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  if (!isIP(ip) || ip.includes("%")) return null;
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
}
export function matchesCidr(ip, cidr) {
  try {
    const [address, prefix] = cidr.split("/");
    const normalized = normalizeIp(address);
    if (!ip || !normalized || isIP(ip) !== isIP(normalized)) return false;
    const list = new BlockList();
    const family = isIP(normalized) === 6 ? "ipv6" : "ipv4";
    if (prefix === undefined) list.addAddress(normalized, family);
    else list.addSubnet(normalized, Number(prefix), family);
    return list.check(ip, family);
  } catch { return false; }
}
export function resolveClientAddress(request, config = process.env) {
  const peer = normalizeIp(request.socket.remoteAddress);
  const trusted = String(config.TRUSTED_PROXY_CIDRS || "").split(",").map(x => x.trim()).filter(Boolean);
  const isTrusted = ip => trusted.some(cidr => matchesCidr(ip, cidr));
  const forwarded = request.headers["x-forwarded-for"] || request.headers["cf-connecting-ip"];
  if (!peer) return { ip: null, reliable: false, source: "unavailable" };
  if (!isTrusted(peer)) return { ip: peer, reliable: !forwarded, source: forwarded ? "untrusted-proxy" : "direct" };
  if (config.CLIENT_IP_HEADER === "cf-connecting-ip") {
    const ip = normalizeIp(request.headers["cf-connecting-ip"]);
    return { ip, reliable: Boolean(ip), source: "cloudflare" };
  }
  const chain = String(request.headers["x-forwarded-for"] || "").split(",").map(normalizeIp);
  if (!chain.length || chain.some(ip => !ip)) return { ip: null, reliable: false, source: "invalid-proxy-chain" };
  for (let i = chain.length - 1; i >= 0; i--) if (!isTrusted(chain[i])) return { ip: chain[i], reliable: true, source: "forwarded" };
  return { ip: null, reliable: false, source: "unresolved-proxy-chain" };
}
export function networkAddress(ip) {
  if (isIP(ip) !== 6) return ip;
  // Expand IPv6 before reducing privacy addresses to their network's /64.
  const [left, right = ""] = ip.split("::");
  const a = left ? left.split(":") : [], b = right ? right.split(":") : [];
  const full = [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
  return `${full.slice(0, 4).map(x => parseInt(x, 16).toString(16)).join(":")}::/64`;
}
