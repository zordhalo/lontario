"use client";

const stats = [
  { 
    value: "$0", 
    label: "Funding raised", 
    subtext: "Self-funded via ramen budget" 
  },
  { 
    value: "1", 
    label: "Engineers", 
    subtext: "Doing product, ML, backend, frontend, DevOps, and marketing" 
  },
  { 
    value: "250", 
    label: "Vetted recruiters", 
    subtext: "All in a JSON file, but very qualified" 
  },
  { 
    value: "50", 
    label: "Mock profiles", 
    subtext: "Carefully crafted fictional candidates" 
  },
];

export function Stats() {
  return (
    <section className="py-16 bg-card/30 border-y border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-accent">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{stat.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.subtext}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
