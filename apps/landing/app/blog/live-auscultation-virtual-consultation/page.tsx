import type { Metadata } from "next";
import BlogPostPage from "@/components/BlogPostPage";
import { getBlogPost, type BlogPost } from "@/lib/blog";
import { buildPageMetadata } from "@/lib/seo";

function requirePost(slug: string): BlogPost {
  const post = getBlogPost(slug);

  if (!post) {
    throw new Error(`Blog post not found: ${slug}`);
  }

  return post;
}

const post = requirePost("live-auscultation-virtual-consultation");

export const metadata: Metadata = buildPageMetadata(
  "/blog/live-auscultation-virtual-consultation",
  {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
  },
);

export default function Page() {
  return <BlogPostPage post={post} />;
}