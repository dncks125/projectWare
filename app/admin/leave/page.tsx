"use client"

import { useAuth } from "@/context/AuthContext"
import { createClient } from "@/lib/supabase/client"
import type { LeaveStatus } from "@/lib/supabase/database.types"
import { Navbar } from "@/components/Navbar"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type LeaveWithUser = {
  id: number
  user_id: string
  leave_type: string
  start_date: string
  end_date: string
  days_used: number
  reason: string | null
  status: LeaveStatus
  created_at: string
  users: { name: string | null; email: string; avatar_url: string | null }
}

const STATUS_STYLE: Record<LeaveStatus, string> = {
  대기중: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  승인: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  반려: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  취소: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
}

const TABS: { label: string; value: LeaveStatus | "전체" }[] = [
  { label: "전체", value: "전체" },
  { label: "대기중", value: "대기중" },
  { label: "승인", value: "승인" },
  { label: "반려", value: "반려" },
  { label: "취소", value: "취소" },
]

function formatPeriod(start: string, end: string) {
  if (start === end) return start.slice(5).replace("-", "/")
  return `${start.slice(5).replace("-", "/")} ~ ${end.slice(5).replace("-", "/")}`
}

interface DetailModalProps {
  request: LeaveWithUser
  onClose: () => void
  onAction: (id: number, status: "승인" | "반려") => Promise<void>
}

function DetailModal({ request, onClose, onAction }: DetailModalProps) {
  const [processing, setProcessing] = useState<"승인" | "반려" | null>(null)

  async function handle(action: "승인" | "반려") {
    setProcessing(action)
    await onAction(request.id, action)
    setProcessing(null)
    onClose()
  }

  const displayName = request.users.name ?? request.users.email

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white">연월차 신청 상세</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 신청자 정보 */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          {request.users.avatar_url ? (
            <img src={request.users.avatar_url} alt="" className="w-9 h-9 rounded-full" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-sm text-gray-900 dark:text-white">{displayName}</p>
            <p className="text-xs text-gray-400">{request.users.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {[
            { label: "유형", value: request.leave_type },
            { label: "기간", value: formatPeriod(request.start_date, request.end_date) },
            { label: "사용 일수", value: `${request.days_used}일` },
            { label: "사유", value: request.reason ?? "—" },
            { label: "신청일", value: new Date(request.created_at).toLocaleDateString("ko-KR") },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 py-1 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <span className="text-sm text-gray-500 shrink-0">{label}</span>
              <span className="text-sm text-gray-900 dark:text-white text-right">{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-gray-500">현재 상태</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[request.status]}`}>
              {request.status}
            </span>
          </div>
        </div>

        {request.status === "대기중" && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handle("반려")}
              disabled={!!processing}
              className="flex-1 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 disabled:opacity-40 transition"
            >
              {processing === "반려" ? "처리 중..." : "반려"}
            </button>
            <button
              onClick={() => handle("승인")}
              disabled={!!processing}
              className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition"
            >
              {processing === "승인" ? "처리 중..." : "승인"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminLeavePage() {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [requests, setRequests] = useState<LeaveWithUser[]>([])
  const [fetching, setFetching] = useState(true)
  const [tab, setTab] = useState<LeaveStatus | "전체">("대기중")
  const [selected, setSelected] = useState<LeaveWithUser | null>(null)

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/auth")
      else if (!isAdmin) router.replace("/dashboard")
    }
  }, [user, loading, isAdmin, router])

  useEffect(() => {
    if (!loading && isAdmin) fetchAll()
  }, [loading, isAdmin])

  async function fetchAll() {
    setFetching(true)
    const { data } = await supabase
      .from("leave_requests")
      .select("*, users(name, email, avatar_url)")
      .order("created_at", { ascending: false })
    if (data) setRequests(data as unknown as LeaveWithUser[])
    setFetching(false)
  }

  async function handleAction(id: number, status: "승인" | "반려") {
    const { data, error } = await supabase
      .from("leave_requests")
      .update({ status })
      .eq("id", id)
      .select("*, users(name, email, avatar_url)")
      .single()
    if (!error && data) {
      setRequests((prev) => prev.map((r) => r.id === id ? data as unknown as LeaveWithUser : r))
    }
  }

  if (loading || !user || !isAdmin) return null

  const filtered = tab === "전체" ? requests : requests.filter((r) => r.status === tab)
  const pendingCount = requests.filter((r) => r.status === "대기중").length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">

        {/* 페이지 타이틀 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl text-gray-900 dark:text-white">연월차 승인 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">전체 직원의 연월차 신청을 검토하고 처리합니다</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">대기중 {pendingCount}건</span>
            </div>
          )}
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "전체", value: requests.length, color: "text-gray-800 dark:text-white" },
            { label: "대기중", value: requests.filter(r => r.status === "대기중").length, color: "text-yellow-600 dark:text-yellow-400" },
            { label: "승인", value: requests.filter(r => r.status === "승인").length, color: "text-green-600 dark:text-green-400" },
            { label: "반려", value: requests.filter(r => r.status === "반려").length, color: "text-red-600 dark:text-red-400" },
          ].map((item) => (
            <div key={item.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-1 ${item.color}`}>{item.value}<span className="text-sm font-normal ml-0.5">건</span></p>
            </div>
          ))}
        </div>

        {/* 신청 목록 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* 탭 */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 px-4 pt-1">
            {TABS.map(({ label, value }) => {
              const count = value === "전체" ? requests.length : requests.filter(r => r.status === value).length
              return (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`px-3 py-3 text-sm font-medium border-b-2 transition ${
                    tab === value
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                      tab === value ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 테이블 헤더 */}
          <div className="grid grid-cols-[1fr_100px_80px_80px_70px_80px] px-6 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            {["신청자", "기간", "유형", "일수", "신청일", "상태"].map((h) => (
              <span key={h} className={`text-xs font-medium text-gray-500 dark:text-gray-400 ${h === "상태" ? "text-right" : ""}`}>{h}</span>
            ))}
          </div>

          {fetching ? (
            <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">해당 신청 내역이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((req) => {
                const displayName = req.users.name ?? req.users.email.split("@")[0]
                return (
                  <button
                    key={req.id}
                    onClick={() => setSelected(req)}
                    className="w-full grid grid-cols-[1fr_100px_80px_80px_70px_80px] px-6 py-3.5 items-center hover:bg-gray-50 dark:hover:bg-gray-800/40 transition text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {req.users.avatar_url ? (
                        <img src={req.users.avatar_url} alt="" className="w-7 h-7 rounded-full shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 text-xs font-semibold shrink-0">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{displayName}</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">{formatPeriod(req.start_date, req.end_date)}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{req.leave_type}</span>
                    <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300">{req.days_used}일</span>
                    <span className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</span>
                    <div className="flex justify-end">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[req.status]}`}>
                        {req.status}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 text-right">
            {filtered.length}건 표시 / 전체 {requests.length}건
          </div>
        </div>
      </main>

      {selected && (
        <DetailModal
          request={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}
    </div>
  )
}
