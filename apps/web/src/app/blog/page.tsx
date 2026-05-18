"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, User } from "lucide-react";
import Footer from "@/components/Footer";

const blogPosts = [
  {
    title: "Introducing ZerithDB: The Future of Local-First Apps",
    excerpt:
      "Learn how ZerithDB is changing the way developers think about data persistence and synchronization.",
    date: "Oct 24, 2024",
    author: "Pranav Shankar",
    category: "Product",
  },
  {
    title: "Deep Dive into P2P Synchronization",
    excerpt: "Understanding the underlying architecture of ZerithDB's peer-to-peer sync engine.",
    date: "Oct 20, 2024",
    author: "Zerith Team",
    category: "Engineering",
  },
  {
    title: "Building a Collaborative To-Do App in 5 Minutes",
    excerpt:
      "A step-by-step guide to building your first real-time collaborative application with ZerithDB.",
    date: "Oct 15, 2024",
    author: "Community",
    category: "Tutorial",
  },
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
            <span className="font-bold text-xl">ZerithDB</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-gray-600 hover:text-black flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <Link href="/docs" className="hover:text-foreground transition-colors font-medium">
              Docs
            </Link>
            <Link href="/#features" className="hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="/#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </Link>
            <Link href="/#compare" className="hover:text-foreground transition-colors">
              Compare
            </Link>
            <Link
              href="/playground"
              className="text-blue-600 font-semibold hover:text-blue-700 transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4" /> Playground
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Zerith-Labs/ZerithDB"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-foreground transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
              GitHub
            </a>
            <Link
              href="/#get-started"
              className="bg-black text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20"
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Blog</h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              Insights, updates, and tutorials from the team building the future of the local-first
              web.
            </p>
          </motion.div>

          <div className="grid gap-12">
            {blogPosts.map((post, i) => (
              <motion.article
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group cursor-pointer"
              >
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
                        {post.category}
                      </span>
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {post.date}
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-4 group-hover:text-blue-600 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-gray-500 text-lg leading-relaxed mb-6">{post.excerpt}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{post.author}</span>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
