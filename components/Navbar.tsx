"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"

export function Navbar() {
  const { user, isAdmin, signOut } = useAuth()
  const pathname = usePathname()

  const navLinks = [
    { href: "/dashboard", label: "출퇴근 관리" },
    { href: "/leave", label: "연월차 관리" },
    ...(isAdmin ? [{ href: "/admin/leave", label: "관리자" }] : []),
  ]

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? ""

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-0 flex items-center justify-between h-14">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill="currentColor"/>
            </svg>
          </div>
          <span className="font-bold text-gray-900 dark:text-white text-sm hidden sm:block">출퇴근 관리</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            const isAdminLink = href.startsWith("/admin")
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? isAdminLink
                      ? "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : isAdminLink
                      ? "text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {isAdminLink && (
                  <span className="mr-1 text-xs">🛡</span>
                )}
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-400">
            관리자
          </span>
        )}
        {avatarUrl && <img src={avatarUrl} alt="avatar" className="w-7 h-7 rounded-full" />}
        <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">{displayName}</span>
        <button
          onClick={signOut}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
