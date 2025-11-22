import type { AppProps } from 'next/app'
import { Space_Mono } from 'next/font/google'
import '../styles/globals.css'

const spaceMono = Space_Mono({ 
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={`${spaceMono.variable} font-sans`}>
      <Component {...pageProps} />
    </main>
  )
} 