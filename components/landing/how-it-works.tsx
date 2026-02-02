"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Code, Brain, Briefcase, Lightbulb } from "lucide-react";

const expertCategories = [
  {
    title: "Engineering & AI",
    description: "AI/ML, Full-Stack, Backend, Applied Research, and more",
    expertsActive: 4,
    icon: Code,
  },
  {
    title: "GTM & Revenue Teams",
    description: "SDR, BDR, Marketing, AE, RevOps, CSM, and more",
    expertsActive: 3,
    icon: Briefcase,
  },
  {
    title: "Product, Ops & Talent",
    description: "PM, TPM, Operations, People, Finance, and more",
    expertsActive: 3,
    icon: Lightbulb,
  },
  {
    title: "Design & Research",
    description: "Product Design, UX Research, Brand, and more",
    expertsActive: 2,
    icon: Brain,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-card/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            How Lontario works
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            We match you with experts who&apos;ve filled your exact role 50+ times. 
            (Or at least, their JSON profiles claim they have.)
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {expertCategories.map((category) => (
            <div
              key={category.title}
              className="group p-6 rounded-2xl bg-background border border-border hover:border-accent/50 transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <category.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {category.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {category.description}
              </p>
              <Badge variant="secondary" className="text-xs">
                {category.expertsActive} experts active
              </Badge>
            </div>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-3xl bg-background border border-border">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Meet Not-Nova
              </h3>
              <p className="text-muted-foreground mb-4">
                Our AI interviewer that screens engineers on how they code with AI tools. 
                Unlike black-box solutions, you can see exactly how Not-Nova thinks.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-accent text-xs">✓</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Transparent scoring</strong> — See the rubric, edit the rubric
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-accent text-xs">✓</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Adaptive follow-ups</strong> — Context-aware conversation
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-accent text-xs">✓</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Open source</strong> — Fork it, modify it, make it yours
                  </span>
                </li>
              </ul>
            </div>
            <div className="bg-secondary/50 rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/images/not-nova.jpg"
                  alt="Not-Nova AI"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">Not-Nova</p>
                  <p className="text-xs text-muted-foreground">AI Technical Interviewer</p>
                </div>
              </div>
              <div className="space-y-3 font-mono text-sm">
                <div className="p-3 rounded-lg bg-background border border-border">
                  <p className="text-muted-foreground">
                    <span className="text-accent">Not-Nova:</span> Walk me through how you&apos;d use Cursor to refactor this function...
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border">
                  <p className="text-muted-foreground">
                    <span className="text-foreground">Candidate:</span> I&apos;d start by selecting the function and using Cmd+K to...
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs text-muted-foreground mb-1">Score breakdown (visible to candidate):</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-foreground">Problem-solving: <span className="text-accent">8/10</span></span>
                    <span className="text-foreground">AI fluency: <span className="text-accent">9/10</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
