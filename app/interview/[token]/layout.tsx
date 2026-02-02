import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Interview",
  description: "Complete your AI-powered interview",
};

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
      {children}
    </div>
  );
}
