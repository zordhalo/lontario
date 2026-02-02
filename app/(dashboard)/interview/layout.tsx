import { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Interview Generator | Lontario",
  description:
    "Generate personalized interview questions with AI-powered scoring rubrics based on job descriptions and candidate profiles",
}

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="container max-w-6xl py-8 px-4 lg:px-6">
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
          AI Interview Generator
        </h1>
        <p className="text-muted-foreground mt-2 text-base lg:text-lg">
          Create personalized interview questions based on job descriptions and
          candidate profiles
        </p>
      </div>
      {children}
    </div>
  )
}
