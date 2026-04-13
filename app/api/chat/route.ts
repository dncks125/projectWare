import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

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

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
}

const TOOLS = [{
  function_declarations: [
    {
      name: "apply_leave",
      description: "연월차를 신청합니다. 날짜와 유형이 불명확하면 먼저 사용자에게 확인 후 호출하세요.",
      parameters: {
        type: "OBJECT",
        properties: {
          leave_type: { type: "STRING", enum: ["연차", "반차", "월차"] },
          start_date: { type: "STRING", description: "시작 날짜 YYYY-MM-DD" },
          end_date: { type: "STRING", description: "종료 날짜 YYYY-MM-DD. 반차/월차는 start_date와 동일" },
          reason: { type: "STRING", description: "사유 (선택)" },
        },
        required: ["leave_type", "start_date", "end_date"],
      },
    },
    {
      name: "cancel_leave",
      description: "대기중인 연월차 신청을 취소합니다. 취소할 신청이 불명확하면 목록을 안내하고 확인 후 호출하세요.",
      parameters: {
        type: "OBJECT",
        properties: {
          leave_id: { type: "NUMBER", description: "취소할 연월차 신청 ID (시스템 컨텍스트의 ID 참조)" },
        },
        required: ["leave_id"],
      },
    },
    {
      name: "record_check_in",
      description: "현재 시각으로 오늘 출근을 기록합니다. 사용자가 출근 기록을 원할 때만 호출하세요.",
      parameters: { type: "OBJECT", properties: {} },
    },
    {
      name: "record_check_out",
      description: "현재 시각으로 오늘 퇴근을 기록합니다. 사용자가 퇴근 기록을 원할 때만 호출하세요.",
      parameters: { type: "OBJECT", properties: {} },
    },
  ],
}]

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`

  const [{ data: attendance }, { data: leaveRequests }, { data: userInfo }] = await Promise.all([
    supabase.from("attendance").select("*").eq("user_id", user.id).gte("date", firstDay).lte("date", lastDay).order("date", { ascending: false }),
    supabase.from("leave_requests").select("*").eq("user_id", user.id).gte("start_date", `${year}-01-01`).order("created_at", { ascending: false }).limit(10),
    supabase.from("users").select("*").eq("id", user.id).single(),
  ])

  const totalLeave = userInfo?.annual_leave_days ?? 15
  const usedLeave = (leaveRequests ?? []).filter(r => r.status === "승인").reduce((s, r) => s + Number(r.days_used), 0)
  const pendingLeave = (leaveRequests ?? []).filter(r => r.status === "대기중").reduce((s, r) => s + Number(r.days_used), 0)
  const remainingLeave = totalLeave - usedLeave

  const att = attendance ?? []
  const avgWork = (() => {
    const records = att.filter(r => r.check_in && r.check_out)
    if (!records.length) return null
    const totalMin = records.reduce((s, r) => {
      return s + Math.floor((new Date(r.check_out!).getTime() - new Date(r.check_in!).getTime()) / 60000)
    }, 0)
    const avg = Math.floor(totalMin / records.length)
    return `${Math.floor(avg / 60)}시간 ${avg % 60}분`
  })()

  const pendingLeaves = (leaveRequests ?? []).filter(r => r.status === "대기중")

  const systemPrompt = `당신은 사내 출퇴근 관리 시스템의 AI 어시스턴트 '아리'입니다.
친절하고 간결하게 한국어로 답변하세요. 불필요한 인사말은 생략하고 핵심만 답하세요.
마크다운 볼드(**) 사용 가능. 이모지는 적절히 사용하세요.

━━━ 현재 상황 ━━━
현재 시간: ${now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })} ${now.toLocaleTimeString("ko-KR")}
오늘 날짜(ISO): ${toLocalDateStr(now)}
사용자: ${userInfo?.name ?? user.email}

━━━ ${month}월 출퇴근 현황 ━━━
출근일: ${att.filter(r => ["정상", "지각", "조기퇴근"].includes(r.status)).length}일
지각: ${att.filter(r => r.status === "지각").length}회
조기퇴근: ${att.filter(r => r.status === "조기퇴근").length}회
결근: ${att.filter(r => r.status === "결근").length}일
평균 근무시간: ${avgWork ?? "데이터 부족"}

최근 기록 (최대 7일):
${att.slice(0, 7).map(r => `${r.date}: ${r.check_in ? fmtTime(r.check_in) : "--:--"} ~ ${r.check_out ? fmtTime(r.check_out) : "--:--"} [${r.status}]`).join("\n") || "없음"}

━━━ 연차 현황 (${year}년) ━━━
총 연차: ${totalLeave}일 / 사용: ${usedLeave}일 / 대기: ${pendingLeave}일 / **잔여: ${remainingLeave}일**

전체 연월차 신청 내역 (ID 포함):
${(leaveRequests ?? []).map(r => `[ID:${r.id}] ${r.start_date}~${r.end_date} ${r.leave_type} ${r.days_used}일 [${r.status}]${r.reason ? ` (${r.reason})` : ""}`).join("\n") || "없음"}

대기중인 신청 (취소 가능):
${pendingLeaves.length > 0
    ? pendingLeaves.map(r => `[ID:${r.id}] ${r.start_date}~${r.end_date} ${r.leave_type} ${r.days_used}일`).join("\n")
    : "없음"}

━━━ 출퇴근 기준 ━━━
출근 기준: 09:00 (이후면 지각), 퇴근 기준: 18:00 (이전이면 조기퇴근)
주말(토/일)은 근무일 아님

━━━ 가능한 작업 ━━━
- apply_leave: 연월차 신청
- cancel_leave: 대기중인 연월차 취소 (승인/반려된 건은 취소 불가)
- record_check_in: 오늘 출근 기록
- record_check_out: 오늘 퇴근 기록
신청/취소/기록 전 반드시 사용자에게 확인하세요.`

  type GeminiPart = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } }
  type GeminiMessage = { role: string; parts: GeminiPart[] }

  const geminiMessages: GeminiMessage[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  let currentMessages: GeminiMessage[] = [...geminiMessages]
  let finalText = ""

  for (let i = 0; i < 4; i++) {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: currentMessages,
        tools: TOOLS,
        system_instruction: { parts: [{ text: systemPrompt }] },
        generation_config: { temperature: 0.7, max_output_tokens: 1024 },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      finalText = `API 오류: ${data.error?.message ?? "알 수 없는 오류"}`
      break
    }

    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? []
    const fnCallPart = parts.find(p => p.functionCall)
    const textPart = parts.find(p => p.text)

    if (!fnCallPart) {
      finalText = textPart?.text ?? "응답을 생성하지 못했습니다."
      break
    }

    const { name, args } = fnCallPart.functionCall!
    let fnResult: Record<string, unknown>

    if (name === "apply_leave") {
      const { leave_type, start_date, end_date, reason } = args as Record<string, string>
      const days_used = leave_type === "반차" ? 0.5 : countWorkdays(start_date, end_date)
      if (days_used <= 0) {
        fnResult = { success: false, error: "유효한 근무일이 없는 기간입니다." }
      } else if (days_used > remainingLeave) {
        fnResult = { success: false, error: `잔여 연차(${remainingLeave}일)가 부족합니다. 신청 일수: ${days_used}일` }
      } else {
        const { error } = await supabase.from("leave_requests").insert({ user_id: user.id, leave_type, start_date, end_date, days_used, reason: reason ?? null })
        fnResult = error
          ? { success: false, error: error.message }
          : { success: true, message: `${start_date} ${leave_type} ${days_used}일 신청 완료`, days_used, remaining_after: remainingLeave - days_used }
      }

    } else if (name === "cancel_leave") {
      const leave_id = Number(args.leave_id)
      // 본인의 대기중 신청인지 확인
      const target = (leaveRequests ?? []).find(r => r.id === leave_id)
      if (!target) {
        fnResult = { success: false, error: "해당 신청을 찾을 수 없습니다." }
      } else if (target.status !== "대기중") {
        fnResult = { success: false, error: `이미 [${target.status}] 상태라 취소할 수 없습니다.` }
      } else {
        const { error } = await supabase
          .from("leave_requests")
          .update({ status: "취소" })
          .eq("id", leave_id)
          .eq("user_id", user.id)
        fnResult = error
          ? { success: false, error: error.message }
          : { success: true, message: `${target.start_date} ${target.leave_type} ${target.days_used}일 신청이 취소되었습니다.` }
      }

    } else if (name === "record_check_in") {
      const today = toLocalDateStr(now)
      const checkInTime = new Date().toISOString()
      const inMin = now.getHours() * 60 + now.getMinutes()
      const status = inMin > 9 * 60 ? "지각" : "정상"
      const { error } = await supabase.from("attendance").upsert({ user_id: user.id, date: today, check_in: checkInTime, status }, { onConflict: "user_id,date" })
      fnResult = error ? { success: false, error: error.message } : { success: true, message: `${fmtTime(checkInTime)} 출근 기록 완료`, status }

    } else if (name === "record_check_out") {
      const today = toLocalDateStr(now)
      const { data: todayRec } = await supabase.from("attendance").select("check_in, status").eq("user_id", user.id).eq("date", today).single()
      if (!todayRec?.check_in) {
        fnResult = { success: false, error: "오늘 출근 기록이 없습니다." }
      } else {
        const checkOutTime = new Date().toISOString()
        const inMin = new Date(todayRec.check_in).getHours() * 60 + new Date(todayRec.check_in).getMinutes()
        const outMin = now.getHours() * 60 + now.getMinutes()
        const newStatus = inMin > 9 * 60 ? "지각" : outMin < 18 * 60 ? "조기퇴근" : "정상"
        const { error } = await supabase.from("attendance").update({ check_out: checkOutTime, status: newStatus }).eq("user_id", user.id).eq("date", today)
        fnResult = error ? { success: false, error: error.message } : { success: true, message: `${fmtTime(checkOutTime)} 퇴근 기록 완료`, status: newStatus }
      }

    } else {
      fnResult = { success: false, error: "알 수 없는 함수" }
    }

    currentMessages = [
      ...currentMessages,
      { role: "model", parts: [{ functionCall: { name, args: args as Record<string, unknown> } }] },
      { role: "user", parts: [{ functionResponse: { name, response: fnResult } }] },
    ]
  }

  return NextResponse.json({ reply: finalText })
}
