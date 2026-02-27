import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { env } from "cloudflare:workers";

// دالة لتنظيف الروابط (Slugify) تدعم العربية والإنجليزية
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // استبدال المسافات بـ -
    .replace(/[^\u0621-\u064A\w\-]+/g, '') // الاحتفاظ بالحروف العربية والإنجليزية والشرطات
    .replace(/\-\-+/g, '-')   // منع تكرار الشرطات
    .replace(/^-+/, '')       // حذف الشرطات من البداية
    .replace(/-+$/, '');      // حذف الشرطات من النهاية
};

export const server = {
  // ... (getCategories و getTags تبقى كما هي)

  savePost: defineAction({
    input: z.object({
      id: z.string().optional(),
      title: z.string().min(1),
      content: z.string(), // قصة الفيلم أو المراجعة
      description: z.string().optional(),
      slug: z.string().min(1),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      // --- الحقول الجديدة الخاصة بالأفلام ---
      poster_url: z.string().url().optional(), // رابط بوستر الفيلم
      rating: z.number().min(0).max(10).optional(), // تقييم الفيلم
      release_year: z.number().optional(), // سنة الإنتاج
      media_type: z.enum(["movie", "series"]).default("movie"), // نوع العمل
    }),
    handler: async (input, context) => {
      const runtimeEnv = (env as any) || (context.locals as any)?.runtime?.env || {};
      const { DB, KV } = runtimeEnv;

      if (!DB) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

      try {
        // 1. معالجة القسم (Category)
        let categoryId: number | null = null;
        if (input.category) {
          const existing = await DB.prepare("SELECT id FROM categories WHERE id = ? OR name = ?")
            .bind(input.category, input.category).first();
          if (existing) {
            categoryId = existing.id;
          } else {
            const newCat = await DB.prepare("INSERT INTO categories (name, slug) VALUES (?, ?) RETURNING id")
              .bind(input.category, slugify(input.category)).first();
            if (newCat) categoryId = newCat.id;
          }
        }

        const now = Date.now();
        let postId: number;

        // 2. إدخال أو تحديث البيانات (أضفنا الأعمدة الجديدة هنا)
        if (input.id && input.id !== "undefined" && input.id !== "") {
          postId = parseInt(input.id);
          await DB.prepare(
            `UPDATE posts SET 
              title = ?, content = ?, description = ?, slug = ?, 
              category_id = ?, poster_url = ?, rating = ?, 
              release_year = ?, media_type = ?, updated_at = ? 
            WHERE id = ?`
          )
          .bind(
            input.title, input.content, input.description || null, input.slug,
            categoryId, input.poster_url || null, input.rating || null,
            input.release_year || null, input.media_type, now, postId
          ).run();
        } else {
          const result = await DB.prepare(
            `INSERT INTO posts 
              (title, content, description, slug, category_id, poster_url, rating, release_year, media_type, published_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
          )
          .bind(
            input.title, input.content, input.description || null, input.slug,
            categoryId, input.poster_url || null, input.rating || null,
            input.release_year || null, input.media_type, now, now
          ).first();
          if (!result) throw new Error("Failed to create post");
          postId = result.id;
        }

        // 3. معالجة الوسوم (Tags) - تبقى كما هي في كودك الأصلي
        // ... (كود حذف وإضافة التاجات)

        // 4. مسح الكاش (KV)
        if (KV) {
          await KV.delete("blog:all").catch(() => {});
          if (input.slug) await KV.delete(`post:${input.slug}`).catch(() => {});
        }

        return { success: true, id: postId };
      } catch (err: any) {
        console.error("Save failed:", err);
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    },
  }),
};
