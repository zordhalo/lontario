"use client";

import Link from "next/link";
import Image from "next/image";
import { Github, Linkedin, Mail, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FooterLink {
  label: string;
  href: string;
  isReal?: boolean;
  toastTitle?: string;
  toastDescription?: string;
}

const footerLinks: Record<string, FooterLink[]> = {
  product: [
    { label: "Features", href: "#features", isReal: true },
    { label: "How it works", href: "#how-it-works", isReal: true },
    { label: "Not-Nova", href: "#how-it-works", isReal: true },
    { label: "Transparency", href: "#transparency", isReal: true },
  ],
  company: [
    { 
      label: "About (it's just one person)", 
      href: "#", 
      toastTitle: "About Us",
      toastDescription: "It's literally one person in a room with a laptop and dreams. That's the whole 'us'."
    },
    { 
      label: "Careers (hiring me)", 
      href: "#", 
      toastTitle: "Careers",
      toastDescription: "The only career opportunity here is YOU hiring ME. Let's talk!"
    },
    { 
      label: "Blog (coming never)", 
      href: "#", 
      toastTitle: "Blog",
      toastDescription: "We said never. We meant it. The code is the only content you need."
    },
  ],
  resources: [
    { 
      label: "Documentation", 
      href: "#", 
      toastTitle: "Documentation",
      toastDescription: "The code IS the documentation. Good luck! (Just kidding, check the README)"
    },
    { 
      label: "API Reference", 
      href: "#", 
      toastTitle: "API Reference",
      toastDescription: "It's REST. Or GraphQL. We can't decide. Both are in the codebase."
    },
    { label: "GitHub", href: "https://github.com/zordhalo/lontario-YC", isReal: true },
    { label: "Source Code", href: "https://github.com/zordhalo/lontario-YC", isReal: true },
  ],
  legal: [
    { 
      label: "Privacy (we don't collect data)", 
      href: "#", 
      toastTitle: "Privacy Policy",
      toastDescription: "We don't track you. We can barely track our own code changes."
    },
    { 
      label: "Terms (use at your own risk)", 
      href: "#", 
      toastTitle: "Terms of Service",
      toastDescription: "Terms: Have fun. Service: No guarantees. Risk: Might make you want to hire me."
    },
    { 
      label: "Disclaimer (it's a demo)", 
      href: "#", 
      toastTitle: "Disclaimer",
      toastDescription: "This is a portfolio demo. Don't actually use it for hiring. Unless you're hiring me."
    },
  ],
};

const socialLinks = [
  { icon: Github, href: "https://github.com/zordhalo/lontario-YC", label: "GitHub" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Mail, href: "mailto:hello@lontario.dev", label: "Email" },
];

export function Footer() {
  const { toast } = useToast();

  const handleLinkClick = (e: React.MouseEvent, link: FooterLink) => {
    if (!link.isReal && link.toastTitle) {
      e.preventDefault();
      toast({
        title: link.toastTitle,
        description: link.toastDescription,
      });
    }
  };

  const handleNavigation = (href: string) => {
    if (href.startsWith("#")) {
      const section = document.getElementById(href.replace("#", ""));
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Image
                src="/images/logo.jpg"
                alt="Lontario logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-semibold text-lg text-foreground">Lontario</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              The second-best AI recruiting agency you&apos;ll talk to this week. 
              A portfolio demo with attitude.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Not affiliated with Contrario. Just admiring.
            </p>
            
            {/* Social links */}
            <div className="flex gap-3 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target={social.href.startsWith("http") ? "_blank" : undefined}
                  rel={social.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="h-9 w-9 rounded-lg bg-muted/50 hover:bg-accent/20 flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          
          {/* Product links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  {link.isReal ? (
                    <button
                      onClick={() => handleNavigation(link.href)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleLinkClick(e as unknown as React.MouseEvent, link)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Company links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={(e) => handleLinkClick(e as unknown as React.MouseEvent, link)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Resources links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Resources</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  {link.isReal ? (
                    <a
                      href={link.href}
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <button
                      onClick={(e) => handleLinkClick(e as unknown as React.MouseEvent, link)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Legal links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={(e) => handleLinkClick(e as unknown as React.MouseEvent, link)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Prominent Hire Me section */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col items-center text-center mb-8">
            <p className="text-muted-foreground mb-2">Like what you see?</p>
            <a 
              href="mailto:hello@lontario.dev"
              className={cn(
                "inline-flex items-center gap-2 text-accent hover:text-accent/80 font-semibold text-lg transition-colors",
                "group"
              )}
            >
              Seriously though, hire me
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Lontario. Built with excessive amounts of coffee.
            </p>
            <p className="text-xs text-muted-foreground">
              Inspired by <span className="text-accent">Contrario</span> (Y Combinator W25). This is the portfolio piece.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
