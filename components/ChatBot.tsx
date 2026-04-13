"use client"

import { useAuth } from "@/context/AuthContext"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

interface Message {
  role: "user" | "assistant"
  content: string
}

const QUICK_ACTIONS = [
  { label: "📊 이번 달 요약", prompt: "이번 달 출퇴근 현황을 요약해줘" },
  { label: "🏖️ 연차 잔여", prompt: "내 연차 잔여가 얼마나 남았어?" },
  { label: "⏰ 지각 분석", prompt: "이번 달 지각 패턴을 분석해줘" },
  { label: "📅 연차 신청", prompt: "연차 신청하고 싶어" },
  { label: "❌ 연차 취소", prompt: "신청한 연차를 취소하고 싶어" },
  { label: "🕐 출근 기록", prompt: "지금 출근 기록해줘" },
  { label: "📈 근무시간", prompt: "이번 달 평균 근무시간을 알려줘" },
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm w-fit shadow-sm">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-400"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  const lines = msg.content.split("\n")

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-0.5">
          AI
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-sm border border-gray-100 dark:border-gray-700"
        }`}
      >
        {lines.map((line, i) => {
          // bold: **text**
          const parts = line.split(/(\*\*[^*]+\*\*)/)
          return (
            <p key={i} className={i > 0 ? "mt-1" : ""}>
              {parts.map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={j}>{part.slice(2, -2)}</strong>
                  : part
              )}
            </p>
          )
        })}
      </div>
    </motion.div>
  )
}

export function ChatBot() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setHasNew(false)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  if (!user) return null

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: "user", content: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const history = [...messages, userMsg]
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })
      const data = await res.json()
      const reply = data.reply ?? "죄송해요, 오류가 발생했습니다."
      setMessages((prev) => [...prev, { role: "assistant", content: reply }])
      if (!open) setHasNew(true)
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "네트워크 오류가 발생했습니다." }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      {/* 채팅 패널 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-950"
            style={{ height: "520px" }}
          >
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">AI</div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">아리</p>
                  <p className="text-blue-100 text-xs">출퇴근 AI 어시스턴트</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="text-white/60 hover:text-white/90 transition text-xs px-2 py-1 rounded-lg hover:bg-white/10"
                  >
                    초기화
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
              {messages.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 pt-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    AI
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">안녕하세요! 아리입니다 👋</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 leading-relaxed">
                      출퇴근 현황 조회, 연차 신청,<br />근무시간 분석 등 도와드릴게요.
                    </p>
                  </div>
                </motion.div>
              ) : (
                messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-0.5">AI</div>
                  <TypingIndicator />
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* 빠른 실행 */}
            {messages.length === 0 && (
              <div className="px-3 pb-2 shrink-0">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => sendMessage(a.prompt)}
                      disabled={loading}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 hover:text-blue-700 dark:hover:text-blue-400 transition whitespace-nowrap shadow-sm"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 입력창 */}
            <div className="px-3 pb-3 shrink-0">
              <div className="flex items-end gap-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 shadow-sm">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none max-h-24"
                  style={{ lineHeight: "1.5" }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 mt-1.5">Enter로 전송 · Shift+Enter 줄바꿈</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 플로팅 버튼 */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-shadow"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.svg key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </motion.svg>
          ) : (
            <motion.svg key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.15)"/>
            </motion.svg>
          )}
        </AnimatePresence>
        <span className="text-sm font-semibold">AI 어시스턴트</span>
        {hasNew && !open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
        )}
      </motion.button>
    </>
  )
}
