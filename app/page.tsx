"use client";

import { useEffect, useState } from "react";

const features = [
  {
    icon: "🤖",
    title: "AI Chat",
    description: "Smart conversations with memory",
    gradient: "from-blue-500/20 to-purple-500/20",
  },
  {
    icon: "🎬",
    title: "Video AI",
    description: "Cinematic prompts for top platforms",
    gradient: "from-purple-500/20 to-pink-500/20",
  },
  {
    icon: "🎨",
    title: "Image AI",
    description: "Stunning visual prompts",
    gradient: "from-pink-500/20 to-orange-500/20",
  },
  {
    icon: "📱",
    title: "Social Media",
    description: "Viral content generation",
    gradient: "from-orange-500/20 to-yellow-500/20",
  },
  {
    icon: "💻",
    title: "Coding",
    description: "Production-ready code",
    gradient: "from-green-500/20 to-teal-500/20",
  },
  {
    icon: "💼",
    title: "Business",
    description: "Growth strategies & plans",
    gradient: "from-teal-500/20 to-cyan-500/20",
  },
  {
    icon: "🌍",
    title: "Translate",
    description: "Global language support",
    gradient: "from-cyan-500/20 to-blue-500/20",
  },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-screen bg-primary">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pt-32 lg:px-8">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />

        {/* Animated grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center animate-in">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-sm text-accent-300">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              AI-Powered Platform
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              <span className="text-gradient">AI Creator</span>
              <br />
              <span>Studio</span>
            </h1>

            {/* Description */}
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400 sm:text-xl">
              Your all-in-one AI platform for content creation, coding, and
              business growth. Powered by cutting-edge AI technology.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={process.env.NEXT_PUBLIC_BOT_URL || "https://t.me/your_bot_username"}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white transition-all duration-300 hover:bg-accent-600 hover:shadow-lg hover:shadow-accent/25"
              >
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent to-secondary opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="relative flex items-center gap-2">
                  🚀 Open in Telegram
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </a>

              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-gray-300 transition-all duration-300 hover:bg-white/10 hover:text-white"
              >
                Explore Features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mt-4 text-gray-400">
              One platform. Infinite possibilities.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface-card/50 p-6 transition-all duration-500 hover:border-accent/20 hover:shadow-xl hover:shadow-accent/5 animate-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Gradient background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                />

                {/* Content */}
                <div className="relative">
                  <span className="mb-4 inline-block text-3xl">{feature.icon}</span>
                  <h3 className="mb-2 text-lg font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t border-white/5 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="stats-card text-center">
              <span className="stat-value text-gradient">7+</span>
              <span className="stat-label">AI Features</span>
            </div>
            <div className="stats-card text-center">
              <span className="stat-value text-gradient">∞</span>
              <span className="stat-label">Possibilities</span>
            </div>
            <div className="stats-card text-center">
              <span className="stat-value text-gradient">24/7</span>
              <span className="stat-label">Availability</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-500">
              AI Creator Studio — Premium AI Platform
            </p>
            <p className="text-sm text-gray-500">
              Built with Next.js & grammY
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
