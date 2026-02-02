import CandidateInterviewClient from "./CandidateInterviewClient"

interface CandidateInterviewPageProps {
  params: Promise<{ token: string }>
}

export default async function CandidateInterviewPage({ params }: CandidateInterviewPageProps) {
  const { token } = await params
  return <CandidateInterviewClient token={token} />
}
