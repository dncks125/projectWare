import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendLeaveNotification } from "@/lib/email"

function countWorkdays(start: string, end: string): number {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { leave_type, start_date, end_date, reason } = await req.json()

  if (!leave_type || !start_date || !end_date) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다" }, { status: 400 })
  }

  const days_used = leave_type === "반차" ? 0.5 : countWorkdays(start_date, end_date)
  if (days_used <= 0) {
    return NextResponse.json({ error: "유효한 근무일이 없는 기간입니다" }, { status: 400 })
  }

  // 잔여 연차 확인
  const year = new Date().getFullYear()
  const [{ data: userInfo }, { data: approved }] = await Promise.all([
    supabase.from("users").select("annual_leave_days, name, email").eq("id", user.id).single(),
    supabase.from("leave_requests").select("days_used").eq("user_id", user.id).eq("status", "승인").gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`),
  ])

  const totalLeave = userInfo?.annual_leave_days ?? 15
  const usedLeave = (approved ?? []).reduce((s, r) => s + Number(r.days_used), 0)
  const remainingLeave = totalLeave - usedLeave

  if (days_used > remainingLeave) {
    return NextResponse.json({ error: `잔여 연차(${remainingLeave}일)가 부족합니다` }, { status: 400 })
  }

  // 연차 신청 저장
  const { data: newRequest, error } = await supabase
    .from("leave_requests")
    .insert({ user_id: user.id, leave_type, start_date, end_date, days_used, reason: reason ?? null })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 관리자 이메일로 알림 발송 (실패해도 신청은 성공 처리)
  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map(e => e.trim())
    .filter(Boolean)

  if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD && adminEmails.length > 0) {
    const applicantName = userInfo?.name ?? user.email ?? "사용자"

    const results = await Promise.allSettled(
      adminEmails.map(adminEmail =>
        sendLeaveNotification({
          applicantName,
          applicantEmail: user.email ?? "",
          leaveType: leave_type,
          startDate: start_date,
          endDate: end_date,
          daysUsed: days_used,
          reason: reason ?? null,
          adminEmail,
        })
      )
    )
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[이메일 발송 실패] ${adminEmails[i]}:`, r.reason)
      }
    })
  }

  return NextResponse.json({ data: newRequest })
}
