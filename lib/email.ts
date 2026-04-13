import nodemailer from "nodemailer"

export interface LeaveNotificationData {
  applicantName: string
  applicantEmail: string
  leaveType: string
  startDate: string
  endDate: string
  daysUsed: number
  reason: string | null
  adminEmail: string
}

export async function sendLeaveNotification(data: LeaveNotificationData) {
  const { applicantName, applicantEmail, leaveType, startDate, endDate, daysUsed, reason, adminEmail } = data

  // 함수 호출 시점에 생성해야 env var가 확실히 로드됨
  // 앱 비밀번호의 공백 제거 (Google이 가독성용 공백을 붙여 발급하므로)
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: (process.env.EMAIL_APP_PASSWORD ?? "").replace(/\s/g, ""),
    },
  })

  const period = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:28px 32px;">
              <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:0.5px;">출퇴근 관리 시스템</p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">📋 연월차 신청 알림</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
                <strong style="color:#111827;">${applicantName}</strong> 님이 연월차를 신청했습니다. 아래 내용을 확인하고 승인해주세요.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:24px;">
                ${[
                  ["신청자", `${applicantName} (${applicantEmail})`],
                  ["유형", leaveType],
                  ["기간", period],
                  ["사용 일수", `${daysUsed}일`],
                  ["사유", reason ?? "—"],
                ].map(([label, value], i) => `
                <tr style="${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">
                  <td style="padding:12px 16px;width:90px;font-size:12px;color:#6b7280;font-weight:500;white-space:nowrap;">${label}</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;">${value}</td>
                </tr>`).join("")}
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://projectwaredg.com"}/admin/leave"
                       style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none;">
                      승인 페이지로 이동 →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">출퇴근 관리 시스템 · 이 메일은 자동 발송된 알림입니다</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from: `"출퇴근 관리 시스템" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `[연차신청] ${applicantName}님이 ${leaveType} ${daysUsed}일을 신청했습니다`,
    html,
  })
}
