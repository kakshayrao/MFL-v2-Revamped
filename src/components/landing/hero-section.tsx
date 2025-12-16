'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Zap, Users, TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Hero Section Component
// ============================================================================

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />

      <div className="container relative max-w-7xl mx-auto px-2 md:px-2 lg:px-2 py-12 md:py-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: Image */}
          <div className="relative order-2 lg:order-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl blur-2xl" />
            <div className="relative aspect-[4/3] lg:aspect-square bg-muted rounded-2xl overflow-hidden border shadow-xl">
              {/* Replace src with your image */}
              <Image
                src="/images/auth-bg.jpg"
                alt="My Fitness League App"
                fill
                className="object-cover"
                priority
              />
              {/* Fallback placeholder if no image */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <span className="text-muted-foreground text-sm">Hero Image</span>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="order-1 lg:order-2 text-center lg:text-left">
            <Badge variant="secondary" className="mb-4 px-4 py-1.5">
              <Zap className="size-3.5 mr-1.5" />
              Fitness Competitions Made Simple
            </Badge>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Fitness Challenges{' '}
              <span className="text-primary">For Teams</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground mb-6 max-w-lg mx-auto lg:mx-0">
              Create leagues, build teams, and track workouts together. Simple
              tools to keep your community motivated and accountable.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <Button size="lg" asChild className="px-6">
                <Link href="/signup">
                  Get Started
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm whitespace-nowrap">
                <Zap className="size-3.5 flex-shrink-0" />
                <span className="font-medium">Setup in minutes</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-sm whitespace-nowrap">
                <Users className="size-3.5 flex-shrink-0" />
                <span className="font-medium">Team leaderboards</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-sm whitespace-nowrap">
                <TrendingUp className="size-3.5 flex-shrink-0" />
                <span className="font-medium">Live tracking</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
