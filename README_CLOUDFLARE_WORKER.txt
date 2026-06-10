FINOVANTA — Cloudflare Worker + Static Assets admin setup

This version includes:
- worker.js
- wrangler.toml
- /admin panel
- /api/content
- /api/contact
- static website assets

This is the setup similar to the previous Quanthexa method.

Required files in GitHub repository root:
- worker.js
- wrangler.toml
- index.html
- admin/
- assets/
- data/

Cloudflare setup:

1. Create KV namespace:
   Storage & databases → Workers KV → Create Instance
   Name:
   FINOVANTA_CONTENT

2. Open the KV namespace settings and copy its Namespace ID.

3. Open wrangler.toml and replace:
   REPLACE_WITH_FINOVANTA_CONTENT_ID

   with the real namespace ID.

4. Commit worker.js and wrangler.toml to GitHub.

5. In Cloudflare, redeploy project.

6. Add admin password:
   Workers & Pages → fino → Settings → Variables and Secrets
   Add variable or secret:
   ADMIN_PASSWORD = your_password

7. Redeploy again.

Admin URL:
https://your-domain.com/admin

API:
https://your-domain.com/api/content
https://your-domain.com/api/contact

Notes:
- worker.js supports KV binding names CONTENT and SITE_CONTENT.
- wrangler.toml uses CONTENT.
- The public site falls back to data/content.json if KV is empty.
- First time you save in admin, KV will receive site-content automatically.

Update v31: KV namespace ID added to wrangler.toml: bb5f2662b2d645d98f5cecbe8e41c4d7

Update v32: Favicon rebuilt as a high-contrast icon so it is visible in browser tabs.

Update v33: Fixed favicon paths. Added root favicon.ico and relative fallback links for local/Cloudflare display.
