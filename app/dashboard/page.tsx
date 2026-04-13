"use client"

import { useAuth } from "@/context/AuthContext"
import { createClient } from "@/lib/supabase/client"
import type { AttendanceRow, AttendanceStatus } from "@/lib/supabase/database.types"
import { Navbar } from "@/components/Navbar"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const CHECK_IN_DEADLINE = 9 * 60
const CHECK_OUT_STANDARD = 18 * 60

function computeStatus(checkIn: string | null, checkOut: string | null): AttendanceStatus {
  if (!checkIn) return "결근"
  const inDate = new Date(checkIn)
  const inMinutes = inDate.getHours() * 60 + inDate.getMinutes()
  if (inMinutes > CHECK_IN_DEADLINE) return "지각"
  if (checkOut) {
    const outMinutes = new Date(checkOut).getHours() * 60 + new Date(checkOut).getMinutes()
    if (outMinutes < CHECK_OUT_STANDARD) return "조기퇴근"
  }
  return checkOut ? "정상" : "결근"
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
}

function calcWorkHours(checkIn: string | null, checkOut: string | null): string | null {
  if (!checkIn || !checkOut) return null
  const diff = Math.floor((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000)
  return `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, "0")}m`
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"]

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  정상: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  지각: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  조기퇴근: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  결근: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  휴가: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [records, setRecords] = useState<AttendanceRow[]>([])
  const [today, setToday] = useState<AttendanceRow | null>(null)
  const [fetching, setFetching] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    if (!loading && !user) router.replace("/auth")
  }, [user, loading, router])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchRecords = useCallback(async () => {
    if (!user) return
    setFetching(true)
    const n = new Date()
    const firstDay = toLocalDateStr(new Date(n.getFullYear(), n.getMonth(), 1))
    const lastDay = toLocalDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0))
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", firstDay)
      .lte("date", lastDay)
      .order("date", { ascending: false })
    if (data) {
      setRecords(data)
      setToday(data.find((r) => r.date === toLocalDateStr(new Date())) ?? null)
    }
    setFetching(false)
  }, [user])

  useEffect(() => {
    if (!loading && user) fetchRecords()
  }, [loading, user, fetchRecords])

  async function handleCheckIn() {
    if (!user || actionLoading) return
    setActionLoading(true)
    const checkInTime = new Date().toISOString()
    const dateStr = toLocalDateStr(new Date())
    const { data, error } = await supabase
      .from("attendance")
      .upsert({ user_id: user.id, date: dateStr, check_in: checkInTime, status: computeStatus(checkInTime, null) }, { onConflict: "user_id,date" })
      .select().single()
    if (!error && data) {
      setToday(data)
      setRecords((prev) => {
        const exists = prev.find((r) => r.date === dateStr)
        return exists ? prev.map((r) => r.date === dateStr ? data : r) : [data, ...prev]
      })
    }
    setActionLoading(false)
  }

  async function handleCheckOut() {
    if (!user || !today || actionLoading) return
    setActionLoading(true)
    const checkOutTime = new Date().toISOString()
    const { data, error } = await supabase
      .from("attendance")
      .update({ check_out: checkOutTime, status: computeStatus(today.check_in, checkOutTime) })
      .eq("id", today.id)
      .select().single()
    if (!error && data) {
      setToday(data)
      setRecords((prev) => prev.map((r) => r.id === data.id ? data : r))
    }
    setActionLoading(false)
  }

  if (loading || !user) return null

  const checkedIn = !!today?.check_in
  const checkedOut = !!today?.check_out
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const dateStr = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })
  const workDays = records.filter((r) => ["정상", "지각", "조기퇴근"].includes(r.status)).length
  const lateCount = records.filter((r) => r.status === "지각").length
  const earlyLeaveCount = records.filter((r) => r.status === "조기퇴근").length
  const absentCount = records.filter((r) => r.status === "결근").length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">

        {/* 시계 + 출퇴근 버튼 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{timeStr}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{dateStr}</p>
            {today?.check_in && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                출근 {formatTime(today.check_in)}
                {today.check_out && ` · 퇴근 ${formatTime(today.check_out)}`}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCheckIn}
              disabled={checkedIn || actionLoading}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition"
            >
              출근
            </button>
            <button
              onClick={handleCheckOut}
              disabled={!checkedIn || checkedOut || actionLoading}
              className="rounded-xl bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition"
            >
              퇴근
            </button>
          </div>
        </div>

        {/* 이번 달 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "출근일", value: workDays, unit: "일", color: "text-blue-600 dark:text-blue-400" },
            { label: "지각", value: lateCount, unit: "회", color: "text-yellow-600 dark:text-yellow-400" },
            { label: "조기퇴근", value: earlyLeaveCount, unit: "회", color: "text-orange-600 dark:text-orange-400" },
            { label: "결근", value: absentCount, unit: "일", color: "text-red-600 dark:text-red-400" },
          ].map((item) => (
            <div key={item.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">이번 달 {item.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${item.color}`}>
                {item.value}<span className="text-sm font-medium ml-0.5">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* 출퇴근 기록 게시판 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">출퇴근 기록</h2>
            <span className="text-xs text-gray-400">{now.getFullYear()}년 {now.getMonth() + 1}월</span>
          </div>

          <div className="grid grid-cols-[80px_40px_1fr_1fr_1fr_80px] px-6 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            {["날짜", "요일", "출근", "퇴근", "근무시간", "상태"].map((h) => (
              <span key={h} className={`text-xs font-medium text-gray-500 dark:text-gray-400 ${h === "상태" ? "text-right" : ""}`}>{h}</span>
            ))}
          </div>

          {fetching ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : records.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">이번 달 기록이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {records.map((record) => {
                const d = new Date(record.date + "T00:00:00")
                const dow = DAY_NAMES[d.getDay()]
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                return (
                  <div key={record.id} className="grid grid-cols-[80px_40px_1fr_1fr_1fr_80px] px-6 py-3 items-center hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                    <span className={`text-sm tabular-nums ${isWeekend ? "text-blue-500 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                      {record.date.slice(5).replace("-", "/")}
                    </span>
                    <span className={`text-sm ${isWeekend ? "text-blue-500 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}>{dow}</span>
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">{formatTime(record.check_in) ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">{formatTime(record.check_out) ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">{calcWorkHours(record.check_in, record.check_out) ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
                    <div className="flex justify-end">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[record.status]}`}>{record.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 text-right">총 {records.length}건</div>
        </div>
      </main>
    </div>
  )
}
