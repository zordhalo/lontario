"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, GitBranch, FileCode, Scale, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const comparisonData = [
  { 
    feature: "Matching algorithm", 
    blackBox: "Proprietary", 
    blackBoxTooltip: "Translation: 'We don't know either'",
    transparent: "Embeddings + cosine similarity" 
  },
  { 
    feature: "Scoring models", 
    blackBox: "AI-powered", 
    blackBoxTooltip: "Just vibes, probably",
    transparent: "Weighted rubric in JSON" 
  },
  { 
    feature: "Bias mitigation", 
    blackBox: "Handled internally", 
    blackBoxTooltip: "We put it in the terms of service",
    transparent: "Documented limitations" 
  },
  { 
    feature: "Learning system", 
    blackBox: "Self-improving", 
    blackBoxTooltip: "It trains on your data (surprise!)",
    transparent: "Static prompts you control" 
  },
  { 
    feature: "Source code", 
    blackBox: "Closed", 
    blackBoxTooltip: "Trust us, it's very impressive",
    transparent: "MIT licensed" 
  },
];

const transparencyCards = [
  {
    icon: Eye,
    title: "See Everything",
    description: "Every prompt, every scoring rubric, every decision point is visible in the codebase. No \"proprietary algorithms\" — just solid engineering you can inspect.",
  },
  {
    icon: GitBranch,
    title: "Fork & Modify",
    description: "Don't like how we score candidates? Fork the repo and change it. MIT licensed means you own your modifications.",
  },
  {
    icon: FileCode,
    title: "Learn How It Works",
    description: "Designed to teach, not just impress. Every feature includes documentation explaining the technical decisions behind it.",
  },
  {
    icon: Scale,
    title: "Honest Limitations",
    description: "We document where we cut corners, what doesn't scale, and why. Because knowing limitations is as valuable as knowing capabilities.",
  },
];

export function Transparency() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  return (
    <TooltipProvider delayDuration={200}>
      <section id="transparency" className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20 hover:bg-accent/20">
              What makes us different
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              100% Transparent by Design
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              While other AI recruiting platforms present AI as a mysterious black box, 
              Lontario makes everything visible. Because &ldquo;AI-powered&rdquo; shouldn&apos;t mean &ldquo;trust us.&rdquo;
            </p>
          </div>

          {/* Main grid with connecting background */}
          <div className="relative">
            {/* Subtle connecting line between left and right sections */}
            <div className="hidden lg:block absolute left-1/2 top-12 bottom-12 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left side - Feature cards */}
              <div className="space-y-4">
                {transparencyCards.map((card, index) => (
                  <div 
                    key={card.title}
                    className={cn(
                      "p-6 rounded-2xl bg-card border border-border transition-all duration-300",
                      "hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5",
                      "group cursor-default"
                    )}
                    style={{ transitionDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                        <card.icon className="h-5 w-5 text-accent" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                    </div>
                    <p className="text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Right side - Comparison table and mission */}
              <div className="sticky top-24 space-y-6">
                <div className="p-6 rounded-2xl bg-card border border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                    Black Box vs Transparent
                    <Sparkles className="h-4 w-4 text-accent" />
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-sm font-medium text-muted-foreground pb-3">Feature</th>
                          <th className="text-left text-sm font-medium text-muted-foreground pb-3">Others</th>
                          <th className="text-left text-sm font-medium text-accent pb-3">Lontario</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {comparisonData.map((row, index) => (
                          <tr 
                            key={index} 
                            className={cn(
                              "border-b border-border last:border-0 transition-colors",
                              hoveredRow === index && "bg-muted/50"
                            )}
                            onMouseEnter={() => setHoveredRow(index)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            <td className="py-4 text-foreground font-medium">{row.feature}</td>
                            <td className="py-4">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground cursor-help border-b border-dashed border-muted-foreground/30">
                                    {row.blackBox}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-card border border-border">
                                  <p className="text-muted-foreground">{row.blackBoxTooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className={cn(
                              "py-4 text-accent font-medium transition-all",
                              hoveredRow === index && "text-glow"
                            )}>
                              {row.transparent}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Footnote */}
                  <p className="text-xs text-muted-foreground/50 mt-4 text-right">
                    Table accuracy: ±100%
                  </p>
                </div>

                {/* Real Mission card */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 hover:border-accent/40 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-lg bg-accent/20 flex items-center justify-center">
                      <span className="text-accent text-xs font-bold">!</span>
                    </div>
                    <h4 className="font-semibold text-foreground">Real Mission</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Get a job at Contrario (or a similar company) by demonstrating we can build 
                    their core product features from scratch. If you&apos;re hiring, this is the portfolio piece.
                  </p>
                  <div className="mt-4 pt-4 border-t border-accent/20">
                    <p className="text-xs text-accent font-medium">
                      Seriously, hire me →
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
