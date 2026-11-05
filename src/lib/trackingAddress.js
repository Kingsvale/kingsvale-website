// Address text is a best-effort split, not a postcode lookup. Keep every supplied
// component and leave missing information for the editor to review.
const counties = new Set((
  "Bedfordshire|Berkshire|Bristol|Buckinghamshire|Cambridgeshire|Cheshire|Cornwall|Cumbria|Derbyshire|Devon|Dorset|Durham|East Riding of Yorkshire|East Sussex|Essex|Gloucestershire|Greater London|Greater Manchester|Hampshire|Herefordshire|Hertfordshire|Isle of Wight|Kent|Lancashire|Leicestershire|Lincolnshire|London|Merseyside|Norfolk|North Yorkshire|Northamptonshire|Northumberland|Nottinghamshire|Oxfordshire|Rutland|Shropshire|Somerset|South Yorkshire|Staffordshire|Suffolk|Surrey|Tyne and Wear|Warwickshire|West Midlands|West Sussex|West Yorkshire|Wiltshire|Worcestershire|Middlesex|Antrim|Armagh|Down|Fermanagh|Londonderry|Tyrone|Clwyd|Dyfed|Gwent|Gwynedd|Mid Glamorgan|South Glamorgan|West Glamorgan|Powys|Anglesey|Carmarthenshire|Ceredigion|Conwy|Denbighshire|Flintshire|Monmouthshire|Pembrokeshire|Wrexham|Aberdeenshire|Angus|Argyll|Ayrshire|Banffshire|Berwickshire|Bute|Caithness|Clackmannanshire|Dumfriesshire|Dunbartonshire|East Lothian|Fife|Inverness-shire|Kincardineshire|Kinross-shire|Kirkcudbrightshire|Lanarkshire|Midlothian|Moray|Nairnshire|Orkney|Peeblesshire|Perthshire|Renfrewshire|Ross-shire|Roxburghshire|Selkirkshire|Shetland|Stirlingshire|Sutherland|West Lothian|Wigtownshire"
).toLowerCase().split("|"));

export function parseTrackingAddress(value = "") {
  const text = String(value ?? "").trim();
  const match = text.match(/\b(?:GIR\s*0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  const compactPostcode = match?.[0].replace(/\s/g, "").toUpperCase() ?? "";
  const postcode = compactPostcode ? `${compactPostcode.slice(0, -3)} ${compactPostcode.slice(-3)}` : "";
  const withoutPostcode = match ? text.slice(0, match.index) + text.slice(match.index + match[0].length) : text;
  const parts = withoutPostcode.split(/[,;\r\n]+/).map((part) => part.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (parts.length > 1 && /^(?:UK|U\.K\.|GB|United Kingdom|England|Scotland|Wales|Northern Ireland)$/i.test(parts.at(-1))) parts.pop();

  const line1 = parts.shift() ?? "";
  const last = parts.at(-1) ?? "";
  const countyName = last.toLowerCase().replace(/^(?:county|co\.?)\s+/, "");
  // London and Bristol commonly follow a locality as the postal town.
  const county = parts.length > 1 && counties.has(countyName) && !["london", "bristol"].includes(last.toLowerCase()) ? parts.pop() : "";
  const town = parts.pop() ?? "";
  return { line1, line2: parts.join(", "), town, county, postcode };
}

export function publicTrackingAddress(site) {
  const landAddress = typeof site.landAddress === "string" ? site.landAddress.trim() : "";
  if (landAddress) {
    return { siteAddress: landAddress, siteAddressParts: parseTrackingAddress(landAddress) };
  }
  return { siteAddress: site.siteAddress ?? "", siteAddressParts: site.siteAddressParts };
}
