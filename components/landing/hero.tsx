"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const words = ["critical", "engineering", "product", "design"];

const companies = [
  { name: "Acme Corp", tooltip: "They're still chasing that roadrunner" },
  { name: "Initech", tooltip: "TPS reports pending approval" },
  { name: "Hooli", tooltip: "Making the world a better place" },
  { name: "Pied Piper", tooltip: "Middle-out compression not included" },
  { name: "Umbrella Co", tooltip: "No zombies were harmed in this demo" },
];

export function Hero() {
  const [currentWord, setCurrentWord] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentWord((prev) => (prev + 1) % words.length);
        setIsAnimating(false);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px]" />
        {/* Additional decorative mesh */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-accent/5 to-transparent rounded-full blur-[80px]" />
      </div>
      
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-20 text-center">
        {/* Badge with animation */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border mb-8 ${mounted ? 'animate-fade-in stagger-1' : 'opacity-0'}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          <span className="text-sm text-muted-foreground">The second-best AI recruiting agency you&apos;ll talk to this week</span>
        </div>
        
        {/* Headline with animation */}
        <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground max-w-5xl mx-auto text-balance ${mounted ? 'animate-fade-in-up stagger-2' : 'opacity-0'}`}>
          Fill{" "}
          <span className={`inline-block text-accent transition-all duration-300 ${isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
            {words[currentWord]}
          </span>
          {" "}roles faster with{" "}
          <span className="bg-linear-to-r from-foreground to-muted-foreground bg-clip-text">
            AI-empowered
          </span>
          {" "}recruiters
        </h1>
        
        {/* Subtitle with animation */}
        <p className={`mt-8 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty ${mounted ? 'animate-fade-in-up stagger-3' : 'opacity-0'}`}>
          Startups trust Lontario from pre-seed to post-IPO for their most important hires. 
          Well, they would if we weren&apos;t a portfolio demo.
        </p>
        
        {/* CTAs with animation and improved hierarchy */}
        <div className={`mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 ${mounted ? 'animate-fade-in-up stagger-4' : 'opacity-0'}`}>
          <Link href="/dashboard">
            <Button 
              size="lg" 
              className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 h-12 text-base font-semibold shadow-lg shadow-accent/20 btn-lift"
            >
              Get a demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="https://github.com/zordhalo/lontario-YC" target="_blank" rel="noopener noreferrer">
            <Button 
              variant="outline" 
              size="lg" 
              className="px-8 h-12 text-base border-border hover:border-accent/50 hover:bg-accent/5 transition-all bg-transparent"
            >
              <Github className="mr-2 h-4 w-4" />
              View source code
            </Button>
          </Link>
        </div>
        
        {/* Trusted by section with tooltips */}
        <div className={`mt-16 ${mounted ? 'animate-fade-in-up stagger-5' : 'opacity-0'}`}>
          <p className="text-sm text-muted-foreground mb-6">Trusted by companies that don&apos;t exist yet</p>
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {companies.map((company) => (
                <Tooltip key={company.name}>
                  <TooltipTrigger asChild>
                    <div className="text-lg font-semibold text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-default">
                      {company.name}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="bottom" 
                    className="bg-card border border-border text-muted-foreground text-sm"
                  >
                    <p>{company.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </section>
  );
}
