"use client"

import { useAuth } from "@/context/AuthContext"
import { createClient } from "@/lib/supabase/client"
import type { LeaveType } from "@/lib/supabase/database.types"
import { Navbar } from "@/components/Navbar"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const LEAVE_TYPES: { value: LeaveType; label: string; days: number; desc: string }[] = [
  { value: "연차", label: "연차", days: -1, desc: "1일 이상 사용 가능" },
  { value: "반차", label: "반차", days: 0.5, desc: "0.5일 차감" },
  { value: "월차", label: "월차", days: 1, desc: "1일 차감" },
]

function countWorkdays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  if (e < s) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function LeaveApplyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [leaveType, setLeaveType] = useState<LeaveType>("연차")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [annualLeaveLeft, setAnnualLeaveLeft] = useState<number>(15)

  useEffect(() => {
    if (!loading && !user) router.replace("/auth")
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && user) fetchLeaveBalance()
  }, [loading, user])

  async function fetchLeaveBalance() {
    if (!user) return
    const year = new Date().getFullYear()
    const [{ data: uInfo }, { data: approved }] = await Promise.all([
      supabase.from("users").select("annual_leave_days").eq("id", user.id).single(),
      supabase
        .from("leave_requests")
        .select("days_used")
        .eq("user_id", user.id)
        .eq("status", "승인")
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`),
    ])
    const total = uInfo?.annual_leave_days ?? 15
    const used = (approved ?? []).reduce((sum, r) => sum + Number(r.days_used), 0)
    setAnnualLeaveLeft(total - used)
  }

  // 반차/월차는 단일 날짜만 (end = start)
  const isSingleDay = leaveType === "반차" || leaveType === "월차"

  const effectiveEndDate = isSingleDay ? startDate : endDate

  const daysUsed = leaveType === "반차"
    ? 0.5
    : countWorkdays(startDate, effectiveEndDate)

  const today = toLocalDateStr(new Date())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!startDate) { setError("시작 날짜를 선택해주세요"); return }
    if (!isSingleDay && !endDate) { setError("종료 날짜를 선택해주세요"); return }
    if (!isSingleDay && endDate < startDate) { setError("종료 날짜가 시작 날짜보다 빠릅니다"); return }
    if (daysUsed <= 0) { setError("유효한 근무일이 없는 기간입니다"); return }
    if (daysUsed > annualLeaveLeft) { setError(`잔여 연차(${annualLeaveLeft}일)가 부족합니다`); return }

    setSubmitting(true)
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leave_type: leaveType,
        start_date: startDate,
        end_date: effectiveEndDate,
        reason: reason.trim() || null,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? "신청 중 오류가 발생했습니다.")
      setSubmitting(false)
    } else {
      router.push("/leave")
    }
  }

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white text-lg">연월차 신청</h1>
        </div>

        {/* 잔여 연차 표시 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-sm text-blue-700 dark:text-blue-300">잔여 연차</span>
          <span className="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">{annualLeaveLeft}일</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 flex flex-col gap-5">

          {/* 연차 유형 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">유형</label>
            <div className="grid grid-cols-3 gap-2">
              {LEAVE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { setLeaveType(t.value); setEndDate("") }}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    leaveType === t.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-600"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="text-xs font-normal opacity-60">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isSingleDay ? "날짜" : "기간"}
            </label>
            {isSingleDay ? (
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={(e) => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value) }}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-400 text-sm shrink-0">~</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || today}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* 사용 일수 미리보기 */}
          {startDate && (
            <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">사용 예정 일수</span>
              <span className={`text-sm font-bold tabular-nums ${daysUsed > annualLeaveLeft ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                {daysUsed}일
                {daysUsed > annualLeaveLeft && <span className="ml-1 font-normal text-xs">(잔여 초과)</span>}
              </span>
            </div>
          )}

          {/* 사유 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              사유 <span className="text-xs font-normal text-gray-400">(선택)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="연차 사용 사유를 입력하세요"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white shadow-sm transition"
          >
            {submitting ? "신청 중..." : "연차 신청"}
          </button>
        </form>
      </main>
    </div>
  )
}
