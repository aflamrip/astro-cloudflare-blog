
INSERT INTO posts (title, content, description, slug, tags, published_at, updated_at)
VALUES (
    'Welcome to CloudBlog',
    '<p>This is your first post powered by <strong>Astro 6</strong> and <strong>Cloudflare D1</strong>. You can edit this or create new ones using the built-in Tiptap editor.</p><h3>Key Features:</h3><ul><li>Astro Actions for data mutations</li><li>Live Content Layer for real-time updates</li><li>Alpine.js for lightweight interactivity</li><li>Tiptap headless editor</li></ul>',
    'A quick introduction to your new blog powered by Astro and Cloudflare.',
    'welcome-to-cloudblog',
    'astro,cloudflare,tutorial',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);
