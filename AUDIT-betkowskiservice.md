# betkowskiservice.pl – Site Audit & Improvement Suggestions

_Date: 2026-09-29_

## Scope and method

- **Site:** https://www.betkowskiservice.pl/ (Comarch e-Sklep, admin panel at `panel.comarchesklep.pl`)
- **Limitation:** the site itself could not be loaded from the audit environment (network egress blocked),
  and the admin panel requires a login. Findings below are based on **how search engines index the site**
  (page titles, URLs, snippets) and on public third-party listings/reviews. Items marked **[verify]** should
  be confirmed in a browser or in the panel before acting.
- Because the shop is a hosted Comarch e-Sklep, almost every fix below is a **panel setting or content
  edit**, not a code change.

## Summary – top 5 priorities

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | Page titles are identical/broken across the site | SEO, click-through | Low |
| 2 | Spare-part product names are too generic ("Filtr", "Rura") | SEO, conversion | Medium |
| 3 | Brand is split across 3 domains (betkowskiservice.pl, betkowski.pl, betkowski.net) | SEO, trust | Medium |
| 4 | Service (repair) offer is not a first-class section of the shop | Leads, revenue | Low–Medium |
| 5 | Public reviews criticise service-department response times | Trust, conversion | Process |

---

## 1. SEO – titles and meta data

**Observed in search index:**

| URL | Indexed title | Problem |
|-----|---------------|---------|
| `/` | `Bętkowski Service - Sklep Internetowy - Kraków, Dobczyce, Mszana ...` | Truncated; lists towns instead of what you sell |
| `/kontakt,12` | `Bętkowski Service - Sklep Internetowy` | Same generic title as other pages |
| `/regulamin,11` | `Bętkowski Service - Sklep Internetowy` | Same generic title |
| `/produkty,2` | `\| Bętkowski Service - Sklep Internetowy` | **Empty title part** before the separator |
| `/program-lojalnosciowy,27` | `- Program lojalnościowy` | **Shop name missing** – empty variable in the title template |

**Recommendations (Panel → SEO / page settings, and per-page meta fields):**

- Fix the title template so no page renders with an empty part (`| …` or `- …`). **[verify]** which
  template variable is empty for the product list and loyalty-program pages.
- Give every static page its own title and meta description, e.g.:
  - Home: `Części i serwis kosiarek, traktorków i pił – Husqvarna, John Deere, Stiga | Bętkowski Service`
  - Contact: `Kontakt i punkty serwisowe – Myślenice, Dobczyce, Skawina, Mszana Dolna | Bętkowski Service`
- Keep titles ≤ 60 characters where possible so they aren't truncated.
- Write a unique meta description (~150 characters) for home, category and top product pages.

## 2. Product and category content

**Observed:** spare-part product pages are indexed with bare names such as `Filtr`, `Rura`,
`Sterownik elektryczny`, `Tuleja R970 506505401`.

A customer searching for a part usually types **brand + model + part number**
(for example `filtr powietrza Husqvarna 544…`). A title of just "Filtr" won't match that search.

**Recommendations:**

- Product name pattern: `[Part type] [Brand] [OEM part number] – [compatible models]`
  e.g. `Filtr powietrza Husqvarna 5xxxxxxxx – LC 140, LC 247`.
- Put the OEM part number in a dedicated attribute and in the name (it's what people search for).
- Add a "Pasuje do / compatible with" list to part descriptions.
- Category pages (e.g. `/produkty/nawozenie-uprawy/maszyny-ogrodowe,2,39236`): add 100–200 words of
  intro text above the product list and a unique meta description.
- Consider bulk-editing names via the ERP/Comarch import if parts come from a feed; fixing it at the
  source scales better than manual edits.

## 3. URLs, domains and brand consistency

- URLs contain numeric IDs (`/rura,3,39114,55808`). This is Comarch's standard scheme and fine to keep;
  just make sure the text slug is descriptive (it follows the product name, so fixing names in §2 helps).
- **Three web presences** show up for the same business: `betkowskiservice.pl` (shop),
  `betkowski.pl` and `betkowski.net` (with its own `serwis.html` page). **[verify]** ownership/purpose.
  - If they are the same company: pick one primary domain, 301-redirect the others (or clearly link
    between them), and use one name/logo/NAP (name-address-phone) everywhere.
  - Duplicate service pages on different domains compete with each other in Google.
- Make sure `http://` → `https://` and non-`www` → `www` redirect to a single version. **[verify]**

## 4. Local presence and the service offer

The business has **5 locations** (Myślenice, Dobczyce, Libertów, Skawina, Mszana Dolna) while the
correspondence address listed is Raciechowice. That's a strong local-SEO asset that the shop doesn't
seem to use.

**Recommendations:**

- One **"Punkty / Locations" page** with a card per location: address, opening hours, phone,
  services available there, embedded map.
- Claim/verify a **Google Business Profile for each location** with consistent NAP data matching the site.
- Create a dedicated **"Serwis" page** in the shop (Panel → content pages): what you repair
  (mowers, tractors, riders, chainsaws, robotic mowers), brands, seasonal pre-season service
  packages, warranty service info, how to book, typical turnaround.
- Add a simple **service request form** (model, serial number, problem, preferred location) so leads
  arrive in a trackable form instead of phone only.
- Show the "authorised dealer" badges (Husqvarna, John Deere, Stiga, AL-KO…) on the home page.

## 5. Trust and reputation

- Public reviews on Ceneo praise products/sales but **criticise the service department**
  (slow replies, a warranty/return dispute). Reviews on Morele are 5/5.
- **Recommendations:**
  - Reply publicly and politely to negative reviews with a concrete resolution.
  - Publish clear **service SLAs** on the site (e.g. "response within 2 working days",
    "repair status update every X days").
  - Send a status e-mail/SMS at each repair stage (accepted → diagnosed → ready for pickup).
  - Display trusted-review widgets (Ceneo "Zaufane Opinie" / Google rating) on the site.

## 6. Conversion and UX checklist **[verify in browser]**

These couldn't be checked without loading the site; review them on desktop and mobile:

- [ ] Phone number (532 875 788) clickable (`tel:`) and visible in the header on mobile
- [ ] Search finds products by **OEM part number**
- [ ] Filter parts by **brand and machine model**
- [ ] Delivery cost and time shown on the product page
- [ ] "Available in store X" / click & collect per location
- [ ] Loyalty program (`/program-lojalnosciowy,27`) linked from the header/basket, not only the footer
- [ ] Cookie banner doesn't cover the "add to cart" button on mobile

## 7. Technical checklist **[verify]**

- [ ] PageSpeed Insights (mobile) score – compress large images / banners
- [ ] `sitemap.xml` submitted in Google Search Console, `robots.txt` not blocking categories
- [ ] Product structured data (Product, Offer, price, availability) present – test with Rich Results Test
- [ ] LocalBusiness structured data on contact/locations page
- [ ] No duplicate content between filter/sort URL variants (canonical tags)
- [ ] Google Analytics 4 + conversion tracking (purchase, service-form submit, phone click)

---

## Suggested order of work

1. **Week 1 (quick wins):** fix title template (§1), write titles/descriptions for home, contact,
   categories; clickable phone; check redirects.
2. **Weeks 2–4:** Serwis page + locations page + service form (§4); Google Business Profiles.
3. **Ongoing:** rename top-selling parts with brand + OEM number (§2), starting with the 100 best
   sellers; respond to reviews (§5).
4. **Decision needed:** what to do with `betkowski.pl` / `betkowski.net` (§3).

## Sources

- Google/Bing index of `site:betkowskiservice.pl` (page titles and URLs)
- https://www.betkowskiservice.pl/ , /kontakt,12 , /produkty,2 , /program-lojalnosciowy,27
- https://www.ceneo.pl/sklepy/betkowskiservice.pl-s44441 (reviews)
- https://www.morele.net/dostawca/betkowski-service-4852/ (reviews)
- https://www.betkowski.net/serwis.html , https://betkowski.pl/kontakt/centrala-firmy
- https://www.facebook.com/BetkowskiService/
