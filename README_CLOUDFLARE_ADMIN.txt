FINOVANTA — Cloudflare Pages Admin Setup

This package includes:
- Static website files
- /admin dashboard
- Cloudflare Pages Functions:
  - /api/content  — read/write editable website content
  - /api/contact  — store/read contact form requests
- data/content.json fallback content
- assets/services/*.webp optimized service images

Cloudflare setup:

1. Upload/deploy this folder to Cloudflare Pages.

2. Create a KV namespace in Cloudflare:
   Workers & Pages → KV → Create namespace
   Example name: FINOVANTA_CONTENT

3. Open your Pages project:
   Settings → Functions → KV namespace bindings

4. Add a KV binding:
   Variable name: SITE_CONTENT
   KV namespace: FINOVANTA_CONTENT

5. Add an environment variable:
   Settings → Environment variables
   Variable name: ADMIN_PASSWORD
   Value: choose your admin password

6. Redeploy the Pages project.

7. Open:
   https://your-domain.com/admin

8. Enter ADMIN_PASSWORD.

Notes:
- The admin panel edits website text/services through KV.
- Contact form requests are stored in the same KV namespace.
- If Functions/KV are not configured, the public site still works with data/content.json fallback.
- This is a lightweight Cloudflare admin, not WordPress.
