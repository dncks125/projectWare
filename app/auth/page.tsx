"use client"

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { motion } from "framer-motion"
import { FloatingPaths, AnimatedTitle } from "@/components/FloatingPaths"

export default function AuthPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard")
    }
  }, [user, loading, router])

  if (loading) return null

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="max-w-4xl mx-auto flex flex-col items-center"
        >
          <AnimatedTitle title="출퇴근 관리 시스템" />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="w-full max-w-sm"
          >
            <div className="bg-gradient-to-b from-black/10 to-white/10 dark:from-white/10 dark:to-black/10 p-px rounded-2xl backdrop-blur-lg overflow-hidden shadow-lg">
              <div className="bg-white/95 dark:bg-black/95 rounded-[calc(1rem-1px)] p-8 flex flex-col gap-6">

                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  계속하려면 Google 계정으로 로그인하세요
                </p>

                <button
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-200 shadow-sm transition hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:-translate-y-0.5 duration-300"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8055.54-1.8368.859-3.0477.859-2.3441 0-4.3286-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.5954.1023-1.1741.282-1.71V4.9582H.9574A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
                    <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6714 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335"/>
                  </svg>
                  Google로 로그인
                </button>

                <p className="text-center text-xs text-neutral-400">
                  로그인 시{" "}
                  <span className="underline underline-offset-2 cursor-pointer">이용약관</span>
                  {" "}및{" "}
                  <span className="underline underline-offset-2 cursor-pointer">개인정보처리방침</span>
                  에 동의합니다
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
