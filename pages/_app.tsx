import type { AppProps } from 'next/app'
import { Space_Mono } from 'next/font/google'
import Head from 'next/head'
import '../styles/globals.css'

const spaceMono = Space_Mono({ 
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
})

export default function App({ Component, pageProps }: AppProps) {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  
  return (
    <>
      <Head>
        {/* Microsoft Clarity */}
        {clarityId && (
          <script
            type="text/javascript"
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${clarityId}");
              `,
            }}
          />
        )}
      </Head>
      <main className={`${spaceMono.variable} font-sans`}>
        <Component {...pageProps} />
      </main>
    </>
  )
} 