"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users, Zap, HeartHandshake, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    number: "01",
    label: "Network",
    title: "High-quality candidates",
    description: "We deliver strong candidates through a network of 250+ vetted boutique recruiters. (They're all in a JSON file, but they're very qualified.)",
    stat: "80%",
    statLabel: "of candidates interviewed",
    statTooltip: "*The other 20% ghosted us. We understand.",
    icon: Users,
    visual: (
      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border hover:border-accent/30 transition-colors">
          <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-accent">FS</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Fullstack Eng</p>
            <p className="text-xs text-muted-foreground">7 YOE • Ex-Linear</p>
          </div>
          <Badge variant="outline" className="text-xs">Expert-Vetted</Badge>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border hover:border-accent/30 transition-colors">
          <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-accent">PD</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Product Designer</p>
            <p className="text-xs text-muted-foreground">5 YOE • Ex-Figma</p>
          </div>
          <Badge variant="outline" className="text-xs">Expert-Vetted</Badge>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border hover:border-accent/30 transition-colors">
          <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-accent">ML</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">ML Engineer</p>
            <p className="text-xs text-muted-foreground">4 YOE • Ex-OpenAI</p>
          </div>
          <Badge variant="outline" className="text-xs">Expert-Vetted</Badge>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    label: "Velocity",
    title: "Faster time-to-hire",
    description: "Our recruiter network and HMs move quickly so strong talent closes in days to weeks. (Or instantly, since it's just database queries.)",
    stat: "5:1",
    statLabel: "average candidate to hire ratio",
    statTooltip: "Industry average is 42:1. We made up both numbers.",
    icon: Zap,
    visual: (
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Lontario</span>
          <span className="font-semibold text-accent">45 days</span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-accent animate-pulse" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Traditional Agency</span>
          <span className="font-semibold text-muted-foreground">3+ Months</span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <div className="h-full w-full rounded-full bg-muted-foreground/30" />
        </div>
        <div className="mt-4 p-4 rounded-xl bg-accent/10 border border-accent/20">
          <p className="text-2xl font-bold text-accent">100+</p>
          <p className="text-sm text-muted-foreground">hrs saved across sourcing, scheduling, and screening</p>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    label: "Service",
    title: "White-glove support",
    description: "Our team provides the same experience you would expect from an in-house recruiter. (If your in-house recruiter was a well-documented API.)",
    stat: "100%",
    statLabel: "of customers renew after their 1st hire",
    statTooltip: "Sample size: 0 customers. But the math checks out.",
    icon: HeartHandshake,
    visual: (
      <div className="mt-6 space-y-3">
        <div className="p-4 rounded-xl bg-secondary/50 border border-border hover:border-accent/30 transition-colors">
          <p className="text-xs text-muted-foreground mb-1">10:00 AM • Automated</p>
          <p className="text-sm text-foreground font-medium">Job description updates</p>
          <p className="text-xs text-muted-foreground">Increased salary range to convert stronger candidates.</p>
        </div>
        <div className="p-4 rounded-xl bg-secondary/50 border border-border hover:border-accent/30 transition-colors">
          <p className="text-xs text-muted-foreground mb-1">1:30 PM • Manual Review</p>
          <p className="text-sm text-foreground font-medium">Candidate feedback</p>
          <p className="text-xs text-muted-foreground">Clarified Sarah&apos;s job-hopping pattern to the founder.</p>
        </div>
        <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
          <p className="text-xs text-accent mb-1">Candidate Closed</p>
          <p className="text-sm text-foreground font-medium">Offer negotiations</p>
          <p className="text-xs text-muted-foreground">Confirmed Alex&apos;s alignment with Level-5 band.</p>
        </div>
      </div>
    ),
  },
  {
    number: "04",
    label: "Communication",
    title: "One streamlined channel",
    description: "Interact directly with Lontario's team instead of managing multiple recruiter inboxes. (It's just one inbox because there's only one developer.)",
    stat: "1",
    statLabel: "unified point of contact",
    statTooltip: "It's literally just one person. Hi!",
    icon: MessageSquare,
    visual: (
      <div className="mt-6 p-4 rounded-xl bg-secondary/50 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
            <span className="text-xs font-bold text-accent-foreground">L</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Lontario Concierge</p>
            <span className="inline-flex items-center gap-1 text-xs text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Live
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-secondary/80 rounded-lg p-3 max-w-[80%]">
            <p className="text-sm text-foreground">Hi Alex! We&apos;ve just finalized the offer details for the Senior Designer role. Ready for your review?</p>
          </div>
          <div className="bg-accent/20 rounded-lg p-3 max-w-[80%] ml-auto">
            <p className="text-sm text-foreground">That&apos;s great. Let&apos;s move forward!</p>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/10 border border-accent/20">
            <span className="text-accent">✓</span>
            <span className="text-sm text-foreground">Offer Sent Successfully</span>
          </div>
        </div>
      </div>
    ),
  },
];

export function Features() {
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-index"));
          if (entry.isIntersecting) {
            setVisibleCards((prev) => new Set(prev).add(index));
          }
        });
      },
      { threshold: 0.2, rootMargin: "-50px" }
    );

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Why teams trust Lontario
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Our customers replace manual sourcing, repetitive scheduling, and complex tracking with Lontario&apos;s software. 
              (Hypothetically, if we had customers.)
            </p>
          </div>

          <div className="grid gap-8 md:gap-12">
            {features.map((feature, index) => (
              <div
                key={feature.number}
                ref={(el) => { cardRefs.current[index] = el; }}
                data-index={index}
                className={cn(
                  "grid md:grid-cols-2 gap-8 items-start p-6 lg:p-8 rounded-3xl bg-card border border-border",
                  "transition-all duration-500 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5",
                  visibleCards.has(index)
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-mono text-accent font-semibold px-2 py-1 rounded bg-accent/10">[{feature.number}]</span>
                    <span className="text-sm text-muted-foreground uppercase tracking-wide font-medium">{feature.label}</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {feature.description}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-end gap-2 cursor-help group">
                        <span className="text-5xl font-bold text-accent group-hover:text-glow transition-all">{feature.stat}</span>
                        <span className="text-sm text-muted-foreground pb-2 flex items-center gap-1">
                          {feature.statLabel}
                          <span className="text-accent/50 text-xs">*</span>
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-card border border-border text-muted-foreground">
                      <p>{feature.statTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="bg-background rounded-2xl p-4 border border-border hover:border-accent/20 transition-colors">
                  {feature.visual}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
