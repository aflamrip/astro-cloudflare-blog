import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { env } from "cloudflare:workers";
import { pinyin } from "pinyin-pro";

const slugify = (text: string) => {
  return text
    .replace(
      /[\u4e00-\u9fa5]/g,
      (match) => pinyin(match, { toneType: "none" }) + " ",
    )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const server = {
  getCategories: defineAction({
    handler: async (_, context) => {
      const runtimeEnv =
        (env as any) || (context.locals as any)?.runtime?.env || {};
      const { DB } = runtimeEnv;
      if (!DB) return [];
      const { results } = await DB.prepare(
        "SELECT * FROM categories ORDER BY name ASC",
      ).all();
      return results;
    },
  }),

  getTags: defineAction({
    handler: async (_, context) => {
      const runtimeEnv =
        (env as any) || (context.locals as any)?.runtime?.env || {};
      const { DB } = runtimeEnv;
      if (!DB) return [];
      const { results } = await DB.prepare(
        "SELECT * FROM tags ORDER BY name ASC",
      ).all();
      return results;
    },
  }),

  savePost: defineAction({
    input: z.object({
      id: z.string().optional(),
      title: z.string().min(1),
      content: z.string(),
      description: z.string().optional(),
      slug: z.string().min(1),
      category: z.string().optional(), // Can be ID or name
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input, context) => {
      const runtimeEnv =
        (env as any) || (context.locals as any)?.runtime?.env || {};
      const { DB, KV } = runtimeEnv;

      if (!DB) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }

      try {
        // 1. Handle Category
        let categoryId: number | null = null;
        if (input.category) {
          // Check if it's an existing ID or a name
          const existing = (await DB.prepare(
            "SELECT id FROM categories WHERE id = ? OR name = ?",
          )
            .bind(input.category, input.category)
            .first()) as { id: number } | null;

          if (existing) {
            categoryId = existing.id;
          } else {
            // Create new category
            const newCat = (await DB.prepare(
              "INSERT INTO categories (name, slug) VALUES (?, ?) RETURNING id",
            )
              .bind(input.category, slugify(input.category))
              .first()) as { id: number } | null;
            if (newCat) categoryId = newCat.id;
          }
        }

        const now = Date.now();
        let postId: number;

        // 2. Insert/Update Post
        if (input.id && input.id !== "undefined" && input.id !== "") {
          postId = parseInt(input.id);
          await DB.prepare(
            "UPDATE posts SET title = ?, content = ?, description = ?, slug = ?, category_id = ?, updated_at = ? WHERE id = ?",
          )
            .bind(
              input.title,
              input.content,
              input.description || null,
              input.slug,
              categoryId,
              now,
              postId,
            )
            .run();
        } else {
          const result = (await DB.prepare(
            "INSERT INTO posts (title, content, description, slug, category_id, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
          )
            .bind(
              input.title,
              input.content,
              input.description || null,
              input.slug,
              categoryId,
              now,
              now,
            )
            .first()) as { id: number } | null;
          if (!result) throw new Error("Failed to create post");
          postId = result.id;
        }

        // 3. Handle Tags
        // Clear existing associations
        await DB.prepare("DELETE FROM post_tags WHERE post_id = ?")
          .bind(postId)
          .run();

        if (input.tags && input.tags.length > 0) {
          for (const tagName of input.tags) {
            // Find or create tag
            let tagId: number | null = null;
            const existingTag = (await DB.prepare(
              "SELECT id FROM tags WHERE name = ?",
            )
              .bind(tagName)
              .first()) as { id: number } | null;

            if (existingTag) {
              tagId = existingTag.id;
            } else {
              const newTag = (await DB.prepare(
                "INSERT INTO tags (name, slug) VALUES (?, ?) RETURNING id",
              )
                .bind(tagName, slugify(tagName))
                .first()) as { id: number } | null;
              if (newTag) tagId = newTag.id;
            }

            // Associate tag with post
            if (tagId) {
              await DB.prepare(
                "INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)",
              )
                .bind(postId, tagId)
                .run();
            }
          }
        }

        // 4. Purge Cache
        if (KV) {
          await KV.delete("blog:all").catch(() => {});
          if (input.slug) await KV.delete(`post:${input.slug}`).catch(() => {});
        }

        return { success: true, id: postId };
      } catch (err: any) {
        console.error("Save failed:", err);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message,
        });
      }
    },
  }),
};
