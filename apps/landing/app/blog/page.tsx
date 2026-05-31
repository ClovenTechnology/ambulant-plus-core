import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Search,
} from "lucide-react";
import JsonLd from "@/components/JsonLd";
import { blogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog | Contactless Medicine, Remote Monitoring and Digital Health",
  description:
    "Read Ambulant+ articles on Contactless Medicine, telemedicine, remote patient monitoring, IoMT, connected medical devices, home diagnostics, medical aids and preventive care.",
  keywords: [
    "Contactless Medicine blog",
    "remote patient monitoring blog",
    "telemedicine South Africa",
    "IoMT healthcare",
    "medical aid preventive care",
    "connected medical devices",
    "home diagnostics",
    "pharmacy fulfilment",
    "digital health South Africa",
  ],
  alternates: {
    canonical: absoluteUrl("/blog"),
  },
  openGraph: {
    title: "Ambulant+ Blog | Contactless Medicine and Digital Health",
    description:
      "Articles on Contactless Medicine, device-supported virtual care, remote monitoring, medical aids, home diagnostics and preventive healthcare.",
    url: absoluteUrl("/blog"),
    siteName: site.name,
    images: [
      {
        url: absoluteUrl("/og/ambulant-og.webp"),
        width: 1200,
        height: 630,
        alt: "Ambulant+ Contactless Medicine blog",
      },
    ],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ambulant+ Blog | Contactless Medicine and Digital Health",
    description:
      "Contactless Medicine, remote monitoring, IoMT, medical aids and preventive-care articles from Ambulant+.",
    images: [absoluteUrl("/og/ambulant-og.webp")],
  },
};

export default function BlogPage() {
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": absoluteUrl("/blog#blog"),
    name: "Ambulant+ Blog",
    url: absoluteUrl("/blog"),
    description:
      "Ambulant+ articles on Contactless Medicine, remote patient monitoring, IoMT, medical aid preventive care, connected devices, home diagnostics and pharmacy fulfilment.",
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
    },
    blogPost: blogPosts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      url: absoluteUrl(`/blog/${post.slug}`),
      datePublished: post.date,
      image: absoluteUrl(post.image),
    })),
  };

  return (
    <main>
      <JsonLd data={blogJsonLd} />

      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
            <BookOpen className="h-4 w-4" />
            Ambulant+ Blog
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Contactless Medicine, remote monitoring and healthcare infrastructure.
          </h1>

          <p className="mt-6 text-lg leading-9 text-slate-600">
            Read Ambulant+ perspectives on Contactless Medicine, telemedicine, remote patient
            monitoring, IoMT, integrated medical hardware, home diagnostics, medicine fulfilment,
            medical-aid preventive care and governance-aware digital health.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-[34px] border border-white/80 bg-white/82 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="relative h-56 overflow-hidden">
                <Image
                  src={post.image}
                  alt={post.imageAlt}
                  width={1200}
                  height={675}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>

              <div className="p-6">
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-3 py-1 text-cyan-800">
                    <Search className="h-3.5 w-3.5" />
                    {post.category}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(post.date).toLocaleDateString("en-ZA", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {post.readTime}
                  </span>
                </div>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                  {post.title}
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {post.description}
                </p>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800">
                  Read article <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
