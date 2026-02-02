"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Search, Github } from "lucide-react";
import { useState, useEffect } from "react";

const funnyMessages = [
  "This page doesn't exist. Much like our customer base.",
  "404: Page not found. Our AI couldn't locate it either.",
  "You've reached the void. It's nice here, but empty.",
  "This page was rejected in the screening phase.",
  "Our algorithm determined this page has a 0% match score.",
  "Page not found. It probably ghosted us.",
  "Error: Page failed the technical interview.",
  "This URL has been archived. Permanently.",
];

const suggestions = [
  { label: "Browse job listings", href: "/jobs", icon: Search },
  { label: "View the dashboard", href: "/dashboard", icon: Home },
  { label: "Check the source code", href: "https://github.com/zordhalo/lontario-YC", icon: Github },
];

export default function NotFound() {
  const [message, setMessage] = useState(funnyMessages[0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Pick a random message on mount
    const randomIndex = Math.floor(Math.random() * funnyMessages.length);
    setMessage(funnyMessages[randomIndex]);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-destructive/5 rounded-full blur-[80px]" />
      </div>

      <div className={`relative z-10 text-center max-w-lg ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
          <Image
            src="/images/logo.jpg"
            alt="Lontario logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="font-semibold text-xl text-foreground">Lontario</span>
        </Link>

        {/* 404 Number */}
        <div className="relative mb-6">
          <h1 className="text-[120px] sm:text-[160px] font-bold text-accent/20 leading-none select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl sm:text-7xl font-bold text-accent text-glow">
              404
            </span>
          </div>
        </div>

        {/* Error message */}
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
          Page Not Found
        </h2>
        <p className="text-muted-foreground mb-8 text-lg">
          {message}
        </p>

        {/* Primary CTA */}
        <Link href="/">
          <Button 
            size="lg" 
            className="bg-accent text-accent-foreground hover:bg-accent/90 mb-8 btn-lift"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Safety
          </Button>
        </Link>

        {/* Suggestions */}
        <div className="border-t border-border pt-8">
          <p className="text-sm text-muted-foreground mb-4">Or try one of these:</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {suggestions.map((item) => (
              <Link 
                key={item.label} 
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full sm:w-auto bg-transparent hover:bg-accent/5 hover:border-accent/30"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-12 text-xs text-muted-foreground/50">
          If you think this is an error, it probably is. We're still in development.
        </p>
      </div>
    </div>
  );
}
