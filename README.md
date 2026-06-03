# Lontario - AI Hiring Platform

Lontario is an AI-powered hiring platform that revolutionizes recruitment through intelligent automation. The platform enables recruiters to post jobs, receive AI-analyzed candidate applications, conduct automated text-based interviews, and make data-driven hiring decisions in minutes instead of hours.

## Features

- **AI Resume Parsing** - Extract structured data from resumes using GPT-4o
- **Smart Candidate Matching** - AI-powered scoring and ranking of candidates
- **Automated Text Interviews** - Generate personalized interview questions with scoring rubrics
- **Kanban Pipeline** - Visual drag-and-drop candidate management
- **Profile Scraping** - Import candidate data from GitHub and LinkedIn
- **Real-time Updates** - Live collaboration with Supabase Realtime

## Tech Stack

- **Frontend**: Next.js 16+ (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **State**: TanStack Query (React Query), Zustand
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: OpenAI GPT-4o with structured outputs (Zod)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account (for database and auth)
- OpenAI API key (for AI features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lontario-YC
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy the environment template:
```bash
cp .env.example .env.local
```

4. Configure environment variables in `.env.local`:
```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...  # Publishable key from Supabase
OPENAI_API_KEY=sk-...

# Optional
GITHUB_TOKEN=ghp_...        # For higher GitHub API rate limits
PROXYCURL_API_KEY=...       # For LinkedIn profile fetching
```

5. Set up the database:
   - Create a new Supabase project
   - Run the SQL schema from the documentation
   - Enable Row Level Security policies

6. Start the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
lontario-YC/
├── app/                     # Next.js App Router pages
│   ├── (dashboard)/         # Dashboard layout and pages
│   │   ├── interview/       # AI Interview Generator
│   │   ├── jobs/            # Job listing and details
│   │   └── page.tsx         # Dashboard home
│   ├── api/                 # API routes
│   │   ├── jobs/            # Job CRUD operations
│   │   ├── candidates/      # Candidate management
│   │   └── ai/              # AI endpoints
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── interview/           # Interview generator components
│   ├── jobs/                # Job-related components
│   └── dashboard/           # Dashboard components
├── hooks/                   # Custom React hooks
│   ├── use-jobs.ts          # Job data fetching
│   ├── use-candidates.ts    # Candidate management
│   └── use-ai.ts            # AI operations
├── lib/                     # Utilities and services
│   ├── ai/                  # AI integrations
│   │   ├── openai.ts        # OpenAI client
│   │   ├── github.ts        # GitHub profile fetching
│   │   └── linkedin.ts      # LinkedIn profile fetching
│   ├── stores/              # Zustand state stores
│   │   └── interview-store.ts
│   ├── supabase/            # Supabase clients
│   └── utils.ts             # Utility functions
├── types/                   # TypeScript types
│   └── index.ts             # All type definitions
└── middleware.ts            # Auth middleware
```

## API Endpoints

### Jobs
- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create job
- `GET /api/jobs/[id]` - Get job details
- `PUT /api/jobs/[id]` - Update job
- `DELETE /api/jobs/[id]` - Delete job

### Candidates
- `GET /api/candidates?job_id=xxx` - List candidates for a job
- `POST /api/candidates` - Create application
- `GET /api/candidates/[id]` - Get candidate details
- `PATCH /api/candidates/[id]` - Update candidate
- `POST /api/candidates/[id]/move` - Move candidate to new stage

### AI
- `POST /api/ai/generate-questions` - Generate interview questions
- `POST /api/ai/score-candidate` - Score candidate-job fit
- `POST /api/ai/parse-resume` - Extract resume data
- `POST /api/ai/evaluate-answer` - Evaluate interview answer
- `POST /api/ai/follow-up` - Generate follow-up question
- `POST /api/ai/scrape-profile` - Fetch GitHub/LinkedIn profile

## Demo Mode

The application works in demo mode without Supabase configured, using mock data. This allows you to explore the UI and test AI features without setting up a database.

To enable demo mode, simply don't configure the Supabase environment variables.

## Development

### Running Tests
```bash
pnpm test
```

### Type Checking
```bash
pnpm tsc --noEmit
```

### Linting
```bash
pnpm lint
```

### Building for Production
```bash
pnpm build
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes* | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes* | Supabase publishable key (client-side, RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase secret key (admin operations) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI features |
| `GITHUB_TOKEN` | No | GitHub token for higher rate limits |
| `PROXYCURL_API_KEY` | No | Proxycurl API key for LinkedIn |

*Not required for demo mode

## AI Features

### AI Interview Generator (`/interview`)

A 3-step wizard for generating personalized interview questions:

**Step 1: Job Details**
- Enter job title, level, and description
- Add required skills and nice-to-have skills
- Minimum 100 character description required

**Step 2: Candidate Profile**
- Fetch profile from GitHub or LinkedIn URL
- Or manually enter candidate information
- Auto-extracts skills and experience from profiles

**Step 3: Questions**
- View 8-10 personalized questions
- Filter by category (Technical, Behavioral, System Design, Problem Solving)
- See difficulty breakdown and time estimates
- Expandable scoring rubrics with evaluation criteria
- Generate intelligent follow-up questions

**Usage:**
1. Navigate to `/interview` in the application
2. Fill in the job description form
3. Fetch or enter candidate profile
4. Review generated questions with scoring rubrics
5. Use follow-up generator for deeper probing

### Interview Question Generation
Generates 8-10 personalized interview questions based on:
- Job requirements and level
- Candidate's skills and experience
- Projects and background

Each question includes:
- Category (technical, behavioral, etc.)
- Difficulty level
- Scoring rubric with evaluation criteria
- Estimated time

### Candidate Scoring
Evaluates candidates on:
- Skills match (40%)
- Experience relevance (30%)
- Education fit (15%)
- Keyword alignment (15%)

Returns:
- Overall score (0-100)
- Detailed breakdown
- Strengths and concerns
- Hiring recommendation

### Resume Parsing
Extracts structured data including:
- Contact information
- Skills and technologies
- Work experience
- Education history
- Years of experience

### Cost Estimates
- **OpenAI GPT-4o**: ~$0.10-0.30 per question set generation
- **GitHub API**: Free (60 req/hr without token, 5000 req/hr with token)
- **Proxycurl (LinkedIn)**: ~$0.03 per profile lookup (optional)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For questions or issues, please open a GitHub issue or contact the development team.


---

<sub>Built by <a href="https://advancelabs.dev"><strong>Advance Labs Inc.</strong></a> — a software studio shipping <a href="https://www.creatin.ca">Creatin</a>, <a href="https://www.cartrix.live">Cartrix</a>, and <a href="https://github.com/Advance-Labs/aeo-toolkit">AEO Toolkit</a>.</sub>