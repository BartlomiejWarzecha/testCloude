# betkowskiservice.pl – Site Audit & Improvement Suggestions

_Date: 2026-09-29 · Platform: Comarch e-Sklep (fixes are made in `panel.comarchesklep.pl`)_

## Method

Live site fetched and rendered in Chromium (desktop 1440 px and iPhone 13 viewport, Polish and English
browser locale). Checked: home, contact, product list, loyalty program, one category and four product
pages, `robots.txt`, `sitemap.xml`, JSON-LD structured data, and the sister domains `betkowski.pl` and
`betkowski.net`. The admin panel itself was **not** accessed; items marked **[panel]** need to be
checked or changed there.

## Top priorities

| # | Issue | Where | Impact | Effort |
|---|-------|-------|--------|--------|
| 1 | Archived / out-of-stock products are marked **InStock** in structured data | Product pages | Google Shopping/rich results show wrong availability, bad UX | Low **[panel]** |
| 2 | Every subpage has meta description = `Betkowski Service` | Whole site | SEO, click-through | Low–Medium |
| 3 | Broken page titles (`\| Bętkowski Service…`, `- Program lojalnościowy`) | Title template | SEO | Low |
| 4 | **No phone number anywhere** (header, contact page, JSON-LD) and no opening hours | Whole site | Leads, local SEO, trust | Low |
| 5 | Parts named only `Rura`, `Filtr` with empty description | Product data | SEO, conversion | Medium (ERP/import) |
| 6 | Service (repairs) offer has no page on the shop – the home "Fachowy serwis" tile has no link | Home | Service leads | Low–Medium |

---

## 1. Product pages & structured data

**Example – archived product** `/rura,3,39114,55808`
- Visible page: only "Przeglądasz ofertę archiwalną, wybrany towar jest niedostępny." + the name "Rura".
  No image, price, description or replacement suggestion is shown.
- But the page is `index,follow` and its JSON-LD says:
  `"availability": "https://schema.org/InStock"`, `"price": "209.99"`, `"description": ""`.
- The hidden HTML also sets delivery to "Wysyłka elektroniczna – link zostanie wysłany e-mailem"
  for a 1.786 kg physical part, which suggests the product's delivery group is misconfigured. **[panel]**

**Recommendations**
- Archived products: set **OutOfStock / Discontinued** in schema, or `noindex` them, or 301 them to the
  replacement part / category. At minimum show "Zamiennik: …" and a link to the category. **[panel]**
- Check the delivery-method assignment for products showing "Wysyłka elektroniczna". **[panel]**

**Example – good product page** `/tuleja-r970,3,39114,14993`
- Has a long **"Pasuje do:"** compatibility list (Husqvarna Rider 11/13/850/970, Jonsered FR…). This is
  exactly what parts buyers need. Make it the standard for all parts.
- But the title is only `Tuleja R970 506505401` (no brand, no shop name), and the H1 `Tuleja R970` has
  neither the brand nor the part number.
- "PROMOCJA" badge for 10,91 zł vs 11,00 zł (−0.8 %). Tiny discounts marked as promotions weaken the
  badge; consider a minimum threshold (e.g. ≥ 5 %).

**Product naming pattern (for ERP/import):**
`[Part type] [Brand] [OEM number] – [main compatible models]`
e.g. `Rura Husqvarna 532174345` → `Rura wydechu Husqvarna 532174345 – [model]`.
The home page's best-sellers already follow this well
(`Pasek napędu noży M155-107 TC 142 McCulloch Husqvarna Oryginał`); the old catalogue items don't.

## 2. SEO – titles, descriptions, headings

| Page | Title | Meta description | H1 |
|------|-------|------------------|----|
| `/` | `Bętkowski Service - Sklep Internetowy - Kraków, Dobczyce, Mszana Dolna, Skawina , Barwałd \| Strona główna` (≈ 110 chars, truncated in Google) | OK, but says **"ponad 15 lat"** while the page says **"Ponad 20 lat"**; ends in a dangling comma | OK |
| `/kontakt,12` | `Bętkowski Service - Sklep Internetowy \| Kontakt` | `Betkowski Service` | **missing** |
| `/produkty,2` | `\| Bętkowski Service - Sklep Internetowy` (**empty first part**) | `Betkowski Service` | **missing** |
| `/program-lojalnosciowy,27` | `- Program lojalnościowy` (**shop name missing**) | `Betkowski Service` | **missing** |
| category `maszyny-ogrodowe` | `Maszyny ogrodowe \| Bętkowski Service - Sklep Internetowy` | `Betkowski Service` | OK |
| products | `Rura \| …`, `Filtr \| …` | `Betkowski Service` | name only |

**Recommendations [panel → SEO / page settings]**
- Fix the two broken title templates (product list, loyalty program).
- Shorten the home title to ≤ 60 chars, e.g.
  `Części i serwis maszyn ogrodowych Husqvarna, John Deere | Bętkowski Service`.
- Set a **default meta-description template** for products (e.g. `{name} {producer} {code} – oryginalna część, wysyłka 24h. Bętkowski Service`) and categories; write unique ones for home, contact, top categories.
- Unify "15 lat" vs "20 lat".
- Add H1 to contact, product-list and loyalty pages.
- Social sharing: there is **no `og:title` / `og:image`** (only `og:image:width=50`), so links shared on
  Facebook/WhatsApp have no proper preview. Set an OG image (logo or banner, 1200×630).

## 3. Contact, locations and local SEO

The contact page (`/kontakt,12`) lists 5 addresses and one e-mail, but:
- **No phone number** anywhere on the shop (no `tel:` link on any page checked). JSON-LD has
  `"telephone": ""`. The footer shows `351488923` with no label (REGON?), which reads like a phone
  number.
- **No opening hours** per location.
- Location labels don't match the address list: "Sklep, Skawina, Kraków Libertów, Oddział Mszana Dolna,
  Oddział Skawina" (Skawina twice, Dobczyce and Myślenice not named).
- A notice says "Nie prowadzimy doboru części… Nie realizujemy zamówień ręcznych…". The policy is fine,
  but the tone is off-putting. Suggest pairing it with a positive link to **"Jak szukać części?"** and the
  parts finder.

**Recommendations**
- Add a clickable phone in the header (mobile) and on the contact page, and fill `telephone` in the
  company data so JSON-LD picks it up. **[panel → company data]**
- One card per location: name, address, hours, phone, what's available there (shop / service /
  machines), map link.
- Google Business Profile for each location with identical name/address/phone.
- Label the footer number (`REGON: 351488923`).

## 4. Service (repairs) offer

- Home page tiles "Narzędzia do ogrodu", "Jesienna promocja", "Profesjonalna dostawa" all have a
  **SPRAWDŹ** button; **"Fachowy serwis" has none**, so there's nowhere to go.
- The actual service description lives on the old site `betkowski.net/serwis.html`, which has a
  typo ("atutetem") and no meta description.
- Recommendations: create a **"Serwis" content page** in the shop (brands serviced, what you repair,
  pre-season service packages, warranty repairs, locations, turnaround, how to book), link the home tile
  to it, and add a **service request form** (device, model, serial no., problem, preferred location, photo
  upload). The contact form already supports attachments, so a "Serwis" department there is a quick
  first step.

## 5. Domains & brand consistency

| Domain | What it is | Note |
|--------|-----------|------|
| `betkowskiservice.pl` | e-shop (parts + tools) | main |
| `betkowski.pl` | machines, professional robots, golf/sport turf, rentals | links to shop once |
| `betkowski.net` | older site with a service page and product categories | 30+ links to shop |

- Decide the role of each: e.g. **betkowski.pl** = company & pro machines, **betkowskiservice.pl** =
  shop + service. Then retire `betkowski.net` with **301 redirects** page-by-page (serwis.html →
  new shop Serwis page) so its links and rankings transfer.
- Use one company name/NAP everywhere (the JSON-LD currently says name
  "Firma Handlowo-Usługowa Tomasz Bętkowski" and legalName "Betkowski Service", which is reversed).

## 6. Technical

| Check | Result |
|-------|--------|
| HTTPS, HSTS | ✅ |
| `betkowskiservice.pl` → `www` | ✅ 301 |
| Canonical tags | ✅ present |
| `sitemap.xml` | ✅ sitemap index (5 parts) – but **not referenced in `robots.txt`** → add `Sitemap: https://www.betkowskiservice.pl/sitemap.xml` |
| `robots.txt` | OK; contains Meta/Facebook crawler rules only |
| Mobile layout | ✅ no horizontal scroll at 390 px |
| Page load (lab, from EU cloud) | TTFB 0.25–1.1 s, full load 3.5–5.9 s, ~80–120 requests, ~0.8 MB per page. Home is slowest (TTFB ~1.1 s on mobile) |
| Images | home on mobile: 19 images served at > 2× displayed size → enable resized/WebP thumbnails **[panel]** |
| `alt` texts | 156 of 160 `<img>` on home have empty alt (mostly menu icons – fine – but check product/banner images) |
| Meta keywords | present (ignored by Google, harmless) |

**Run** PageSpeed Insights (mobile) on home, one category and one product for field (CrUX) data.

## 7. UX observations

- **Cookie banner covers ~half of the mobile screen** on first visit, including the page's H1/product.
  A bottom sheet ≤ 30 % of the height is standard.
- For non-Polish browsers a **Google Translate bar** appears on top and machine-translates the UI
  ("Rura" → "Pipe", "Koszyk" → "Basket"). Since you advertise "europejska dostawa", consider proper
  EN/DE translations of at least the top categories and checkout.
- Category-menu typos: `DŹWIGNIĘ` → `DŹWIGNIE`, `HYDRUALICZNY` → `HYDRAULICZNY`,
  `Skawina , Barwałd` (space before comma) in the home title.
- Parts finder (producer → device → model) is a strong feature. Consider putting it above the fold on
  mobile as well.
- "Opinie klientów" section on home shows product names only. If reviews exist, show stars + text;
  also add Ceneo/Google rating widget (Ceneo reviews are mixed, and the complaints are about service
  response time).

## Order of work

1. **This week [panel]:** fix title templates, default meta descriptions, phone number + JSON-LD
   company data, archived-product availability, sitemap line in robots.txt, link the "Fachowy serwis"
   tile.
2. **Next 2–4 weeks:** Serwis page + request form, locations with hours, OG image, cookie banner size,
   typo fixes.
3. **Ongoing:** product names/descriptions with brand + OEM + "Pasuje do" (start with top 100 sellers);
   betkowski.net → 301 plan.

## Sources

- https://www.betkowskiservice.pl/ and subpages listed above (fetched 2026-09-29)
- https://betkowski.pl/ , https://www.betkowski.net/serwis.html
- https://www.ceneo.pl/sklepy/betkowskiservice.pl-s44441 (reviews)
