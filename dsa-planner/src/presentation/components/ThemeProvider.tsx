'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/** Adds or removes the `dark` class on <html>. Dark is the default theme. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
