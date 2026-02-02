"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-accent/20 via-card to-card border border-border p-8 sm:p-12 lg:p-16">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-balance">
              Ready to see what&apos;s under the hood?
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              This isn&apos;t a real product — it&apos;s a technical demonstration. But if you&apos;re impressed 
              by the engineering, imagine what we could build together.
            </p>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link href="/jobs">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8">
                  Get in touch
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="https://github.com/zordhalo/lontario-YC" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="border-border hover:bg-secondary h-12 px-8 bg-transparent">
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </Button>
              </Link>
            </div>
            
            <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                MIT Licensed
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Open Source
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Documentation Included
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
