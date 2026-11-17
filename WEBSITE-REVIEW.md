GATE: OPEN 69 (rounds used up)

# Main website review — 17 November 2026

This review used the actual published public content and uploaded media in an isolated local server. The established Kingsvale identity and copy were retained. Functional improvements in this release are described in [STUDIO-UPGRADE.md](STUDIO-UPGRADE.md).

## Follow-up status

The approved recommendations below have been implemented in the follow-up release described in [WEBSITE-FOLLOWUP.md](WEBSITE-FOLLOWUP.md). The homepage headline and broad claims are deliberately retained at the user's request. Visual refinements are limited to the existing layout and interactions; the original design gate findings remain recorded rather than represented as passed.

## Original recommendations

| Priority | Finding | Recommended change |
| --- | --- | --- |
| High | Private letter and title-document URLs share the public `/media/` delivery route. The public QR JSON hides their references, but knowing a file URL still allows retrieval without Studio authentication. | Move private documents behind authenticated downloads, with short-lived explicit sharing links where needed. Migrate existing references, embedded previews and backup/restore together, then test document printing and download workflows. Do not simply block all `/media/` files: public website photographs use the same route. |
| Medium | Unrecognised page routes render the not-found UI with HTTP 200. | Return HTTP 404 for genuinely missing pages, preserving valid CMS development routes and the client application shell. This prevents soft-404 indexing. |
| Medium | The sitemap is generated from build-time default content. Publishing a development in Studio does not regenerate it. | Serve a sitemap from published CMS routes, with the actual publication dates, and notify indexing services after publication. |
| Medium | The homepage headline is broad and some claims, such as “Award-winning craftsmanship”, lack visible supporting detail. | State the homes/services and geographic focus plainly; show specific completed projects and evidence for awards. Confirm facts with the business before changing published claims. |
| Medium | Mobile cover crops can request sources sized only to viewport width. The homepage hero and Land wanted photograph have been corrected in this release; other wide images in tall sections still merit review. | Add crop-aware responsive sizing to the remaining sections, and provide dedicated portrait crops where a landscape photo loses its subject. |
| Lower | Existing section widths, heading levels and spacing vary; repeated scroll reveals delay content appearing. | Consolidate content margins and spacing, simplify reveals, and review mobile menu/tap targets and keyboard navigation across the whole site. Keep the project imagery and Kingsvale branding. |

## Visual review scope

Kind: property-development service website. Existing green, ivory and charcoal palette, serif headings and sans-serif controls were retained because they match the established Kingsvale identity. Existing public project photographs remain in use; no substitute stock imagery, invented facts, new brand name or generated artwork was introduced. The Studio uses compact operational layouts with clear status, actions and visible errors. Its desktop and mobile screenshots were checked for legibility and overflow.

Voice: direct property and correspondence language; new Studio text explains what an action changes and whether it is live. Existing public marketing copy was reviewed, not rewritten. Copy warnings that remain are part of the recommendations above, rather than evidence that new business facts have been verified.

The Taste Skill gate applies a prescriptive full redesign template (including one section per screen and `.wrap` containers) to this established site. Outstanding findings are retained in the accompanying generated report; they are not waived or represented as a pass. This release addresses the first-paint defect and Studio workflow, not every pre-existing design finding.

Functional production build, browser checks and repository performance budgets pass. A whole-site accessibility audit, independent penetration test, real external recipient scan and independent mobile network delivery have not been performed. IP counts do not establish a visitor's identity.

Full gate findings: [design-review.txt](design-review.txt).
