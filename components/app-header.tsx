"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Briefcase,
  Calendar,
  LayoutDashboard,
} from "lucide-react"

import { cn } from "@/lib/utils"

// #region agent log
fetch('http://127.0.0.1:7243/ingest/7c4bf3a4-0f60-40ce-82a9-6233b2ea9862',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-header.tsx:13',message:'Module evaluation - checking imports',data:{briefcaseDefined:typeof Briefcase!=='undefined',layoutDashboardDefined:typeof LayoutDashboard!=='undefined',calendarDefined:typeof Calendar!=='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Interviews", href: "/interviews", icon: Calendar },
]

// #region agent log
fetch('http://127.0.0.1:7243/ingest/7c4bf3a4-0f60-40ce-82a9-6233b2ea9862',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-header.tsx:18',message:'Navigation array created',data:{navLength:navigation.length,hasBriefcase:navigation.some(n=>n.icon===Briefcase)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

export function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-card">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Logo and Navigation */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/images/logo.jpg"
              alt="Lontario logo"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-semibold text-foreground">
              Lontario
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
        </div>
      </div>
    </header>
  )
}
