"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    quote: "Every candidate Lontario sends us ranks in the top 5% compared to anyone else. Mainly because they're all fictional.",
    name: "Marcus Chen",
    title: "Chief Operating Officer, Acme Labs",
    image: "/images/testimonial-1.jpg",
  },
  {
    quote: "We've tested 50+ recruiting channels and only hired from 2. Lontario was one of them. The other was nepotism.",
    name: "Jasmine Williams",
    title: "Chief Executive Officer, Enigma Inc",
    image: "/images/testimonial-2.jpg",
  },
  {
    quote: "Lontario are the only good recruiters I know. They find high-signal candidates 3x faster than anyone. Probably because JSON files load fast.",
    name: "David Miller",
    title: "Founder, Debug Labs",
    image: "/images/testimonial-3.jpg",
  },
  {
    quote: "The transparency is unreal. I can literally see the code that rejected me. That's... actually kind of nice?",
    name: "Priya Sharma",
    title: "Engineering Lead, Unix Systems",
    image: "/images/testimonial-4.jpg",
  },
  {
    quote: "Finally, an AI recruiting tool that admits it's just embeddings and cosine similarity. Refreshing honesty.",
    name: "Carlos Rodriguez",
    title: "VP Engineering, Apollo Tech",
    image: "/images/testimonial-5.jpg",
  },
  {
    quote: "Built by one engineer who could've been writing production code but chose parody instead. Respect.",
    name: "Marcus Chen",
    title: "Open Source Enthusiast",
    image: "/images/testimonial-1.jpg",
  },
  // Hidden easter egg testimonial - appears after several scrolls
  {
    quote: "I never said this.",
    name: "Someone",
    title: "Who definitely doesn't exist",
    image: "/images/testimonial-2.jpg",
    isSecret: true,
  },
];

export function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const scrollCountRef = useRef(0);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate visible testimonials based on secret state
  const visibleTestimonials = showSecret 
    ? testimonials 
    : testimonials.filter(t => !t.isSecret);
  const totalCards = visibleTestimonials.length;

  // Calculate current index from scroll position
  const updateCurrentIndex = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    
    const cardWidth = 416; // 400px card + 16px gap
    const newIndex = Math.round(container.scrollLeft / cardWidth) % totalCards;
    setCurrentIndex(newIndex);
  }, [totalCards]);

  // Auto-scroll animation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || isPaused) return;

    let animationId: number;
    let scrollPosition = scrollContainer.scrollLeft;

    const animate = () => {
      scrollPosition += 0.5;
      const halfWidth = scrollContainer.scrollWidth / 2;
      
      if (scrollPosition >= halfWidth) {
        scrollPosition = 0;
        scrollCountRef.current += 1;
        
        // Reveal secret testimonial after 7 complete scrolls
        if (scrollCountRef.current >= 7 && !showSecret) {
          setShowSecret(true);
        }
      }
      
      scrollContainer.scrollLeft = scrollPosition;
      updateCurrentIndex();
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [isPaused, showSecret, updateCurrentIndex]);

  // Navigate to specific card
  const scrollToCard = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    
    // Pause auto-scroll when user manually navigates
    setIsPaused(true);
    
    // Clear any existing timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    
    // Resume auto-scroll after 5 seconds
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 5000);
    
    const cardWidth = 416;
    container.scrollTo({
      left: index * cardWidth,
      behavior: "smooth"
    });
    setCurrentIndex(index);
  };

  // Navigate with arrows
  const handlePrev = () => {
    const newIndex = currentIndex === 0 ? totalCards - 1 : currentIndex - 1;
    scrollToCard(newIndex);
  };

  const handleNext = () => {
    const newIndex = (currentIndex + 1) % totalCards;
    scrollToCard(newIndex);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  return (
    <section id="testimonials" className="py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center">
          Don&apos;t just take our word for it
        </h2>
        <p className="mt-4 text-muted-foreground text-center max-w-2xl mx-auto">
          These testimonials are 100% fictional, just like our recruiting network. But the sentiment is real.
        </p>
      </div>

      {/* Carousel container with gradient edges */}
      <div 
        className="relative group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Left gradient fade */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        
        {/* Right gradient fade */}
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        
        {/* Navigation arrows - visible on hover */}
        <Button
          variant="outline"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-card/80 backdrop-blur-sm"
          onClick={handlePrev}
          aria-label="Previous testimonial"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-card/80 backdrop-blur-sm"
          onClick={handleNext}
          aria-label="Next testimonial"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-hidden px-4"
          style={{ scrollBehavior: "auto" }}
        >
          {[...visibleTestimonials, ...visibleTestimonials].map((testimonial, index) => (
            <div
              key={`${testimonial.name}-${index}`}
              className={cn(
                "shrink-0 w-[400px] p-6 rounded-2xl bg-card border border-border transition-all duration-300 hover:border-accent/30 hover:shadow-lg",
                testimonial.isSecret && "border-accent/50 bg-accent/5"
              )}
            >
              <div className="flex items-start gap-4">
                <Image
                  src={testimonial.image || "/placeholder.svg"}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover shrink-0"
                />
                <div>
                  <p className={cn(
                    "text-foreground leading-relaxed mb-4",
                    testimonial.isSecret && "italic text-accent"
                  )}>
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.title}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex justify-center gap-2 mt-8">
        {visibleTestimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToCard(index)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              currentIndex === index 
                ? "w-6 bg-accent" 
                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            aria-label={`Go to testimonial ${index + 1}`}
          />
        ))}
      </div>
      
      {/* Scroll hint */}
      <p className="text-center text-xs text-muted-foreground/50 mt-4">
        Hover to pause • Click dots or arrows to jump to a specific testimonial
      </p>
    </section>
  );
}
