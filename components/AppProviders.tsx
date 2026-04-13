"use client"

import { AuthProvider } from "@/context/AuthContext"
import { ChatBot } from "./ChatBot"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <ChatBot />
    </AuthProvider>
  )
}
