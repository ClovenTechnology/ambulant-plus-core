import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
} from "lucide-react";
import JsonLd from "@/components/JsonLd";
import type { BlogPost } from "@/lib/blog";
import { getRelatedPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

type BlogPostPageProps = {
  post: BlogPost;
};

export default function BlogPostPage({ post }: BlogPostPageProps) {
  const relatedPosts = getRelatedPosts(post.slug);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": absoluteUrl(`/blog/${post.slug}#article`),
    headline: post.title,
    description: post.description,
    image: absoluteUrl(post.image),
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: site.parentCompany,
      url: "https://cloventechnology.com/",
    },
    publisher: {
      "@type": "Organization",
      name: site.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/brand/ambulant-logo-full.png"),
      },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    keywords: post.keywords.join(", "),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": absoluteUrl(`/blog/${post.slug}#faq`),
    mainEntity: post.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: absoluteUrl("/blog"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: absoluteUrl(`/blog/${post.slug}`),
      },
    ],
  };

  return (
    <main>
      <JsonLd data={[articleJsonLd, faqJsonLd, breadcrumbJsonLd]} />

      <article>
        <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800"
              >
                ← Back to blog
              </Link>

              <div className="mt-6 text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
                {post.category}
              </div>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                {post.title}
              </h1>

              <p className="mt-5 text-xl leading-9 text-slate-700">
                {post.subtitle}
              </p>

              <p className="mt-5 text-base leading-8 text-slate-600">
                {post.description}
              </p>

              <div className="mt-7 flex flex-wrap gap-3 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white/80 px-4 py-2">
                  <CalendarDays className="h-4 w-4 text-cyan-700" />
                  {new Date(post.date).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white/80 px-4 py-2">
                  <Clock3 className="h-4 w-4 text-cyan-700" />
                  {post.readTime}
                </span>
              </div>
            </div>

            <div className="glass-panel rounded-[42px] p-3 md:p-4">
              <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
                <Image
                  src={post.image}
                  alt={post.imageAlt}
                  width={2400}
                  height={1350}
                  className="h-auto w-full"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-16 md:px-6">
          <div className="grid gap-8">
            {post.sections.map((section) => (
              <section key={section.heading} className="rounded-[34px] border border-white/80 bg-white/82 p-6 shadow-sm md:p-8">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                  {section.heading}
                </h2>

                <div className="mt-5 grid gap-4">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-8 text-slate-600">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.bullets && (
                  <div className="mt-6 grid gap-3">
                    {section.bullets.map((bullet) => (
                      <div key={bullet} className="flex gap-3 rounded-3xl bg-cyan-50/70 p-4">
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                        <p className="text-sm leading-7 text-slate-600">{bullet}</p>
                      </div>
                    ))}
                  </div>
                )}

                {section.callout && (
                  <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-sm font-semibold leading-7 text-white">
                    {section.callout}
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-16 md:px-6">
          <div className="rounded-[34px] bg-slate-950 p-6 text-white md:p-8">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
              Frequently asked questions
            </div>

            <div className="mt-6 grid gap-4">
              {post.faqs.map((faq) => (
                <div key={faq.question} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </article>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Next steps
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Continue exploring Ambulant+.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {post.relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="glass-panel rounded-[30px] p-6 transition hover:-translate-y-1"
              >
                <FileText className="h-6 w-6 text-cyan-700" />
                <div className="mt-5 text-lg font-semibold text-slate-950">
                  {link.label}
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800">
                  Open <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {relatedPosts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
          <div className="rounded-[38px] border border-cyan-100 bg-cyan-50/50 p-6 md:p-8">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Related reading
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="rounded-3xl border border-white/80 bg-white/85 p-6 shadow-sm transition hover:-translate-y-1"
                >
                  <div className="text-sm font-semibold text-cyan-800">
                    {related.category}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-slate-950">
                    {related.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {related.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
