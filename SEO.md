<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Search visibility

The canonical origin is `https://nuclear.porssiohjain.fi`. The homepage starts
with two cards: Nuclear reactor on the left and Companion screen on the right.
A visible introduction, feature overview, startup steps, guide links and questions
follow the cards. The reactor (`/reactor/`) and companion (`/companion/`) have
independent HTML entries with no landing content or guide footer. The text describes
the existing fictional browser simulation; it does not advertise future gameplay,
real reactor fidelity or hardware connectivity.

## Content and build

- `site/pages.mjs` holds each page's title, description, heading and visible copy.
- `site/render.mjs` renders canonical links, Open Graph/Twitter previews and
  JSON-LD, together with the visible content. Vite inserts them into the HTML
  during both development and production builds.
- `reactor/index.html` and `companion/index.html` mount only the application.
  These console URLs are excluded from the sitemap and use `noindex, follow`;
  reload stays on the selected URL, and Back returns to the landing page.
- `guides/*/index.html` are independent static entry points. They load the shared
  stylesheet without React, Three.js or any other JavaScript.
- `public/robots.txt` permits crawling and advertises the sitemap.
- `public/sitemap.xml` lists the homepage and all three guides. Vite copies both
  files unchanged to the root of `dist/`.
- `public/images/nuclear-power-control-room.png` is a 1200 × 630 screenshot of
  the actual running app for social previews. Refresh it when the control room's
  appearance changes substantially.

The four canonical URLs are:

```text
https://nuclear.porssiohjain.fi/
https://nuclear.porssiohjain.fi/guides/startup/
https://nuclear.porssiohjain.fi/guides/reactor-controls/
https://nuclear.porssiohjain.fi/guides/faults-and-recovery/
```

When adding a guide, add its content and HTML entry point, link to it from relevant
pages, and update `public/sitemap.xml`. The build input list follows the page list.
Tests check that every page has a unique title/description, consistent canonical
and social URLs, useful static content, working internal links and a sitemap entry.
Do not add generated timestamps to the sitemap: `lastmod` must represent an actual
content change if it is introduced later.

The JSON-LD describes a `WebSite`, the free `WebApplication`, each `WebPage` and
guide breadcrumbs. No ratings or reviews are invented. Valid schema does not
guarantee a Google rich result; Google's software-app rich results additionally
require an eligible rating or review. The visible questions are ordinary content,
without claims of FAQ rich-result eligibility.

Nginx serves existing files and guide directories, returns real 404 responses for
unknown paths, and redirects explicit `index.html` requests to the matching
canonical directory. Redirects remain relative so a TLS-terminating reverse proxy
does not downgrade their scheme. Hashed assets retain their immutable cache policy;
HTML and crawl files revalidate. The external HTTPS proxy must preserve these
status codes and content types and redirect HTTP to the canonical HTTPS host.
Nginx also compresses HTML, JavaScript, CSS and other text responses with gzip;
guides never download the simulator bundle. The homepage only loads a small
compatibility redirect for old `/?screen=companion` links; it does not download
React or Three.js. Console pages never include the SEO article, even as hidden DOM.

## Verification

```sh
npm ci
npm test
npm run build
npm run test:browser
```

The browser regression checks the actual production HTML with JavaScript disabled,
readable mobile layouts, guide stylesheets, crawl-file responses, social-image
dimensions and missing-page status before exercising the interactive simulator.
It can also target the running container:

```sh
NUCLEAR_POWER_APP_URL=http://127.0.0.1:8080 npm run test:browser
```

## After deployment

The existing container workflow builds and publishes the image; hosting must run
that new image before these changes reach the public site. No Search Console
verification or sitemap submission is performed by the app.

1. Check that the four canonical pages, `/robots.txt`, `/sitemap.xml` and the
   preview image return HTTP 200 from the public HTTPS host. Check that a missing
   page returns 404 and `index.html` redirects without a loop.
2. Verify ownership of the domain or HTTPS URL-prefix property in Google Search
   Console. Use its supplied DNS record or HTML verification file rather than
   inventing a verification token in the app.
3. Submit `https://nuclear.porssiohjain.fi/sitemap.xml` in Search Console's
   Sitemaps report. Inspect the homepage and guide URLs, check Google's rendered
   HTML and request indexing where appropriate.
4. Inspect structured data with Google's Rich Results Test and Schema.org's
   validator. Share a URL to check its image/title preview after deployment.
5. Monitor indexing and search queries before deciding which further guides are
   useful. Extend real simulator documentation rather than creating near-duplicate
   pages for keyword variants. Search rankings and indexing are not guaranteed.

Primary references:

- [Google's SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [JavaScript SEO and static HTML](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Software app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Nginx relative redirects](https://nginx.org/en/docs/http/ngx_http_core_module.html#absolute_redirect)
