import JobDetailClient from "./JobDetailClient"

interface JobDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params
  return <JobDetailClient jobId={id} />
}
