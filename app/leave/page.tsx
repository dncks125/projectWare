"use client"

import { useAuth } from "@/context/AuthContext"
import { createClient } from "@/lib/supabase/client"
import type { LeaveRequestRow, LeaveStatus, UserRow } from "@/lib/supabase/database.types"
import { Navbar } from "@/components/Navbar"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const STATUS_STYLE: Record<LeaveStatus, string> = {
  대기중: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  승인: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  반려: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  취소: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
}

function formatPeriod(start: string, end: string): string {
  if (start === end) return formatDate(start)
  return `${formatDate(start)} ~ ${formatDate(end)}`
}

interface DetailModalProps {
  request: LeaveRequestRow
  onClose: () => void
  onCancel: (id: number) => void
}

function DetailModal({ request, onClose, onCancel }: DetailModalProps) {
  const [cancelling, setCancelling] = useState(false)

  async function handleCancel() {
    setCancelling(true)
    await onCancel(request.id)
    setCancelling(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white text-base">연월차 상세</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Row label="유형" value={request.leave_type} />
          <Row label="기간" value={formatPeriod(request.start_date, request.end_date)} />
          <Row label="사용 일수" value={`${request.days_used}일`} />
          <Row label="신청 사유" value={request.reason ?? "—"} />
          <Row label="신청일" value={new Date(request.created_at).toLocaleDateString("ko-KR")} />
          <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500 dark:text-gray-400">상태</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[request.status]}`}>
              {request.status}
            </span>
          </div>
        </div>

        {request.status === "대기중" && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40 transition"
          >
            {cancelling ? "취소 중..." : "신청 취소"}
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white text-right">{value}</span>
    </div>
  )
}

export default function LeavePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [requests, setRequests] = useState<LeaveRequestRow[]>([])
  const [userInfo, setUserInfo] = useState<UserRow | null>(null)
  const [fetching, setFetching] = useState(true)
  const [selected, setSelected] = useState<LeaveRequestRow | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace("/auth")
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && user) fetchData()
  }, [loading, user])

  async function fetchData() {
    if (!user) return
    setFetching(true)
    const year = new Date().getFullYear()

    const [{ data: reqs }, { data: uInfo }] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`)
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single(),
    ])

    if (reqs) setRequests(reqs)
    if (uInfo) setUserInfo(uInfo)
    setFetching(false)
  }

  async function cancelRequest(id: number) {
    const { data, error } = await supabase
      .from("leave_requests")
      .update({ status: "취소" })
      .eq("id", id)
      .select()
      .single()
    if (!error && data) {
      setRequests((prev) => prev.map((r) => (r.id === id ? data : r)))
      setSelected(data)
    }
  }

  if (loading || !user) return null

  const totalDays = userInfo?.annual_leave_days ?? 15
  const usedDays = requests
    .filter((r) => r.status === "승인")
    .reduce((sum, r) => sum + Number(r.days_used), 0)
  const pendingDays = requests
    .filter((r) => r.status === "대기중")
    .reduce((sum, r) => sum + Number(r.days_used), 0)
  const remainingDays = totalDays - usedDays

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">

        {/* 연차 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "총 연차", value: totalDays, unit: "일", color: "text-gray-900 dark:text-white" },
            { label: "사용 연차", value: usedDays, unit: "일", color: "text-blue-600 dark:text-blue-400" },
            { label: "승인 대기", value: pendingDays, unit: "일", color: "text-yellow-600 dark:text-yellow-400" },
            { label: "잔여 연차", value: remainingDays, unit: "일", color: remainingDays <= 3 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400" },
          ].map((item) => (
            <div key={item.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${item.color}`}>
                {item.value}<span className="text-sm font-medium ml-0.5">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* 연차 현황 바 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">올해 연차 사용 현황</p>
            <p className="text-xs text-gray-400">{new Date().getFullYear()}년</p>
          </div>
          <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min((usedDays / totalDays) * 100, 100)}%` }}
            />
            <div
              className="h-full bg-yellow-400 transition-all duration-500"
              style={{ width: `${Math.min((pendingDays / totalDays) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />사용 {usedDays}일</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />대기 {pendingDays}일</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 inline-block" />잔여 {remainingDays}일</span>
          </div>
        </div>

        {/* 신청 목록 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">연월차 신청 내역</h2>
            <Link
              href="/leave/apply"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              + 연차 신청
            </Link>
          </div>

          {/* 테이블 헤더 */}
          <div className="grid grid-cols-[1fr_80px_80px_70px_80px] px-6 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            {["기간", "유형", "일수", "신청일", "상태"].map((h) => (
              <span key={h} className={`text-xs font-medium text-gray-500 dark:text-gray-400 ${h === "상태" ? "text-right" : ""}`}>{h}</span>
            ))}
          </div>

          {fetching ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-400">신청 내역이 없습니다</p>
              <Link href="/leave/apply" className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
                연차 신청하기
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {requests.map((req) => (
                <button
                  key={req.id}
                  onClick={() => setSelected(req)}
                  className="w-full grid grid-cols-[1fr_80px_80px_70px_80px] px-6 py-3 items-center hover:bg-gray-50 dark:hover:bg-gray-800/40 transition text-left"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{formatPeriod(req.start_date, req.end_date)}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{req.leave_type}</span>
                  <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">{req.days_used}일</span>
                  <span className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</span>
                  <div className="flex justify-end">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[req.status]}`}>
                      {req.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 text-right">
            총 {requests.length}건
          </div>
        </div>
      </main>

      {selected && (
        <DetailModal
          request={selected}
          onClose={() => setSelected(null)}
          onCancel={cancelRequest}
        />
      )}
    </div>
  )
}
