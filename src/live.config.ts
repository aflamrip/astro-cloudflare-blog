import { defineLiveCollection } from "astro:content";
import type { LiveLoader } from "astro/loaders";
import { env } from "cloudflare:workers";

// 对应你的 SQL 表结构
type PostRow = {
  id: number;
  title: string;
  content: string;
  description: string | null;
  slug: string;
  published_at: number;
  updated_at?: number;
  category_name?: string | null;
  category_slug?: string | null;
  category_id?: number | null;
  tags?: string | null; // Comma separated tags
};

export function d1Loader(): LiveLoader<
  PostRow,
  { id?: string; slug?: string }
> {
  return {
    name: "d1-live-loader",
    loadCollection: async () => {
      // @ts-ignore
      const { DB, KV } = env;
      const CACHE_KEY = "blog:all";

      if (KV) {
        try {
          const cached = await KV.get(CACHE_KEY, "json");
          if (cached && Array.isArray((cached as any).entries)) {
            return { entries: (cached as any).entries };
          }
        } catch (e) {
          console.error("KV read failed:", e);
        }
      }

      if (!DB) throw new Error("D1 Database binding not found");

      // Fetch posts with category and tags
      const result = await DB.prepare(
        `
        SELECT 
          p.*, 
          c.name as category_name, 
          c.slug as category_slug,
          (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = p.id) as tags
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.published_at DESC
      `,
      ).all();

      const posts = result.results as PostRow[];

      const entries = posts.map((post) => ({
        id: String(post.id),
        data: post,
      }));

      if (KV) {
        try {
          await KV.put(CACHE_KEY, JSON.stringify({ entries }));
        } catch (e) {
          console.error("KV write failed:", e);
        }
      }

      return { entries };
    },

    loadEntry: async ({ filter }) => {
      // @ts-ignore
      const { DB, KV } = env;
      const slug = filter.slug;
      const cacheKey = slug ? `post:${slug}` : null;

      if (cacheKey && KV) {
        try {
          const cached = await KV.get(cacheKey, "json");
          if (cached) return cached as any;
        } catch (e) {}
      }

      if (!DB) throw new Error("D1 Database binding not found");

      const query = `
        SELECT 
          p.*, 
          c.name as category_name, 
          c.slug as category_slug,
          (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = p.id) as tags
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.${filter.id ? "id" : "slug"} = ? 
        LIMIT 1
      `;
      const param = filter.id || filter.slug;

      const post = (await DB.prepare(query)
        .bind(param)
        .first()) as PostRow | null;

      if (!post) {
        throw new Error(`Post not found: ${param}`);
      }

      const entry = {
        id: String(post.id),
        data: post,
        rendered: {
          html: post.content || "",
        },
      };

      if (KV && post.slug) {
        try {
          await KV.put(`post:${post.slug}`, JSON.stringify(entry));
        } catch (e) {
          console.error("KV entry write failed:", e);
        }
      }

      return entry;
    },
  };
}

const blog = defineLiveCollection({
  loader: d1Loader(),
});

export const collections = { blog };
