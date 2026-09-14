export type LegalSection = { id: string; title: string; paragraphs: string[] };

export const legalCompany = "Kingsvale Homes is the trading name of Kingsvale Ltd, registered in England and Wales with company number 17289813. Our registered office is 71–75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom.";
export const legalEmail = "enquiries@kingsvalehomes.co.uk";
export const legalUpdated = "14 September 2026";

export const privacySections: LegalSection[] = [
  {
    id: "who-we-are", title: "Who we are",
    paragraphs: [legalCompany, "Kingsvale Ltd is the controller responsible for the personal information described in this policy. It covers our website, enquiries, newsletter registrations, landowner research and correspondence, and property pages accessed through letters or QR codes. For privacy questions or requests, email us using the contact details below or write to our registered office, marked ‘Privacy’."]
  },
  {
    id: "information", title: "Information we collect and its sources",
    paragraphs: [
      "When you contact us, we collect the details you provide, such as your name, email, telephone number, postal address, enquiry type, message and attachments. Newsletter registration collects your email address. Please only send information relevant to your enquiry.",
      "For land and development discussions, our records may include ownership and title information, site addresses and boundaries, planning details, correspondence, documents, contact preferences and the progress of a proposal. We may receive these directly from you or your representative, or obtain them from public sources such as HM Land Registry and planning registers, property research services, agents and professional advisers. You can ask us for the source of information we hold about you.",
      "The website records technical information including IP addresses, browser information and request times for enquiries, security and diagnostics. Visit records include the page address, page title and time of a visit. Visits to an individual property link can be associated with that property record; a visit alone does not establish who opened the link."
    ]
  },
  {
    id: "purposes", title: "Why we use information",
    paragraphs: [
      "Enquiries and requested services: we use your details to answer questions, arrange conversations and manage a potential project. Our basis is taking steps at your request before a contract, or performing a contract where applicable. For general enquiries, we rely on our legitimate interest in communicating with people who contact us.",
      "Property research and landowner correspondence: we rely on our legitimate interests in identifying suitable development opportunities, contacting relevant owners and maintaining accurate project records. We consider the effect on your privacy and your reasonable expectations. You can object to this use, and you can stop direct marketing at any time.",
      "Newsletters: we use your consent to send the email updates you sign up for. An ordinary enquiry does not sign you up to a newsletter. Security, service administration and understanding use of our pages are based on our legitimate interests in protecting and improving our business and website, subject to any separate consent requirements for browser technologies. We also process information where necessary to meet legal obligations or establish, exercise or defend legal claims."
    ]
  },
  {
    id: "marketing", title: "Your choice about marketing",
    paragraphs: ["You have an absolute right to object to use of your personal information for direct marketing, including related profiling. To stop newsletters or landowner marketing letters, email us with ‘Unsubscribe’ or ‘Stop marketing’ and the email or postal address concerned. Withdrawing consent does not affect earlier lawful use. We may retain the minimum details on a suppression list so that we respect your request. Necessary correspondence about an existing enquiry or agreement is separate from marketing."]
  },
  {
    id: "property-links", title: "Letters, QR codes and property links",
    paragraphs: ["A letter may include a QR code or reference leading to a property page. These pages can display a site address, recipient name, reference, plans, project summary and shared documents. They are accessible to anyone with the link, or the required reference and postcode; they are not an authenticated private account. Share the link carefully and contact us if details need correcting or access should be withdrawn. Opening the page may create a visit record associated with the property, helping us understand engagement with our correspondence."]
  },
  {
    id: "browser-storage", title: "Browser storage, visits and external content",
    paragraphs: [
      "Our own visit measurement records page views through website requests and a small tracking image. Session storage remembers the most recent page and time to avoid duplicate events and normally clears when that browser session ends. If a visit request fails, up to 500 visit records may be kept in local storage on that device. Local storage has no automatic time expiry and can be cleared through your browser’s site-data settings. Clearing it does not delete records already received by us. Authorised Studio users also use browser storage for editing and session functions.",
      "The website does not currently use Google Analytics or advertising pixels. Maps and externally hosted images can connect your browser to their providers, which receive technical request information such as your IP address. Depending on the page, these may include Esri/ArcGIS, OpenStreetMap, Google Maps and external image hosts. Their privacy notices explain their own processing. Browser privacy settings may restrict these features. Contact us to object to our use of identifiable visit information."
    ]
  },
  {
    id: "sharing", title: "Who receives information",
    paragraphs: [
      "Access is limited to people who need information for their work, including authorised staff and service providers supporting website hosting, storage, backups, email and business administration. We use Google Workspace for business email, including website enquiry notifications. If enabled for a workflow, record-management integrations may also receive relevant details. We do not sell your personal information.",
      "Where relevant to your enquiry or project, we may share necessary information with appointed agents, solicitors, planners, surveyors, other professional advisers and parties involved in a proposed transaction. We may disclose information to authorities when required by law, or where necessary to protect legal rights. Recipients acting as independent controllers are responsible for their own privacy notices."
    ]
  },
  {
    id: "international", title: "International processing",
    paragraphs: ["Some service providers may process information outside the UK. Where a transfer is restricted under UK data protection law, it requires an applicable adequacy regulation, appropriate safeguards such as approved contractual protections, or a legally permitted exception. Contact us for information about the destination and safeguards relevant to a particular use of your data."]
  },
  {
    id: "retention", title: "Keeping information and protecting it",
    paragraphs: ["We retain information for as long as needed for the purpose concerned, taking account of an active enquiry or project, the relationship with you, legal record-keeping obligations and potential claims. Newsletter details are retained while you remain subscribed; suppression details may be kept longer to honour an opt-out. We review records for deletion or anonymisation when they are no longer needed. Backups may retain copies until replaced or deleted as part of the backup cycle. We use access controls and other technical and organisational measures to protect information, but no website or email system can guarantee absolute security."]
  },
  {
    id: "rights", title: "Your rights and complaints",
    paragraphs: [
      "Depending on the circumstances, you may ask to access or correct your personal information, have it erased, restrict its use, receive a portable copy, withdraw consent, or object to processing based on legitimate interests. These rights have legal conditions and exceptions. We may need proportionate information to verify your identity. Requests are normally free and answered within one month; we will explain if a lawful extension or exception applies.",
      "Providing enquiry details is voluntary, but without the information needed to understand or respond to a request we may not be able to help. We do not make solely automated decisions about you that have legal or similarly significant effects. If you have concerns, please contact us so we can investigate. You can also complain to the Information Commissioner’s Office (ICO), the UK data protection regulator, without first contacting us."
    ]
  },
  {
    id: "updates", title: "Changes to this policy",
    paragraphs: ["We may update this policy as our services or practices change. The date above identifies this version. Where required, we will bring material changes to your attention and obtain consent for a new use that requires it."]
  }
];

export const termsSections: LegalSection[] = [
  {
    id: "about", title: "About us and these terms",
    paragraphs: [legalCompany, "These terms explain use of kingsvalehomes.co.uk and its development, land and property information pages. Please read them before using the website. Our privacy policy separately explains how we handle personal information. These website terms do not replace a signed purchase, reservation, consultancy or land agreement."]
  },
  {
    id: "development-information", title: "Development information and imagery",
    paragraphs: ["We take reasonable care in preparing website information. Availability, plans, specifications, dimensions, timescales and any prices shown can change as a project develops. Photographs, computer-generated images, illustrations and show-home styling may be indicative, may show optional items, and may not depict the final property or its surroundings. Ask us for the current particulars and clarification of anything important before making a commitment. Nothing in these terms removes responsibility for information or representations that are legally binding."]
  },
  {
    id: "enquiries", title: "Enquiries, viewings and agreements",
    paragraphs: ["Sending an enquiry, joining a mailing list, viewing a property page or arranging a discussion does not reserve a home, create a purchase contract or commit either party to a land transaction. Any reservation, purchase, service appointment or other transaction requires its own agreed terms and any applicable legal formalities. Costs, scope, responsibilities and conditions will be set out in the relevant agreement."]
  },
  {
    id: "land", title: "Land, planning and property pages",
    paragraphs: ["Site plans, map outlines, ownership information and planning observations are provided to support discussion. They are not a legal boundary determination, title report, valuation, survey or guarantee of planning permission or development value. Outcomes depend on site conditions, legal rights, permissions and other circumstances. Obtain suitable independent legal, planning or technical advice before entering a transaction.", "A property link does not establish ownership or authority to act. Do not share another person’s details without authority. Contact us about errors or misdirected links."]
  },
  {
    id: "permitted-use", title: "Using the website responsibly",
    paragraphs: ["Use the website lawfully and provide accurate information. Do not impersonate others, submit unauthorised material, upload malicious code, attempt unauthorised access or disrupt the website. We may restrict access to address misuse or protect security."]
  },
  {
    id: "intellectual-property", title: "Content and intellectual property",
    paragraphs: ["The website’s text, design, branding, photographs, plans and other materials belong to Kingsvale or their respective owners and are protected by intellectual property law. You may view, save or print reasonable extracts for personal reference, preserving notices and attribution. Other copying, commercial reuse or adaptation requires permission unless allowed by law. Sending us an enquiry does not transfer ownership of your documents; we may use them as necessary to consider and respond to your request."]
  },
  {
    id: "external-services", title: "Availability and external services",
    paragraphs: ["Maintenance or technical faults may interrupt the website, and features may change. External websites and map providers have their own terms and privacy notices."]
  },
  {
    id: "liability", title: "Responsibility and your legal rights",
    paragraphs: ["We remain responsible for loss or damage caused by our breach of these terms or failure to exercise reasonable care and skill where that loss or damage was reasonably foreseeable. We are not responsible for loss caused solely by events outside our reasonable control or your misuse of the website. Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any liability that cannot lawfully be excluded or limited. Your statutory consumer rights are unaffected."]
  },
  {
    id: "law-and-complaints", title: "Questions, complaints and applicable law",
    paragraphs: ["Please send questions or complaints to our contact email or registered office, with enough detail for us to investigate. These website terms are governed by the law of England and Wales. The courts of England and Wales may hear disputes; if you are a consumer living elsewhere in the UK, you may also bring proceedings in the courts where you live. This does not remove any mandatory protections or court rights available to you under applicable consumer law."]
  },
  {
    id: "changes", title: "Changes to these terms",
    paragraphs: ["Updated terms apply to future website use and do not change existing separate contracts. The date above identifies this version."]
  }
];
