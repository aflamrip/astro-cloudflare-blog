# Demo

# ! Beta !

This is merely a demo example created for feasibility purposes and does not include usability. Please wait for the official release.

- [Astro v6.0 Beta](https://astro.build/blog/astro-6-beta/)
- [cloudflare v13.0 Beta](https://v6.docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Tailwindcss V4](https://tailwindcss.com/)
- [TipTap for Vanilla JavaScript](https://tiptap.dev/docs/editor/getting-started/install/vanilla-javascript)

## Authentication

Implement access control for the `/admin/` path using Cloudflare Access.

## command

```bash
# install
bun install

# Local Dev
bun dev

# Preview
bun preview

# Build
bun astro build
```

## How to deploy?

You need to install `wrangler` first to deploy your project.

Edit the file `/wrangler.jsonc` to set up project binding.

```json
"d1_databases": [
    {
        "binding": "DB",
        "database_name": "db_name", //your db name
        "database_id": "xxxxxxxxxxxxxxxx", // db id
    },
],
"kv_namespaces": [
    {
        "binding": "KV",
        "id": "xxxxxxxxxxxxxxxx", // kv id
    },
],
```

Compile and deploy `bun astro build` and `bun wrangler deploy`