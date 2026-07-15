import Head from 'next/head';
import PlayerApp from '../components/PlayerApp';

export default function Home() {
  return (
    <>
      <Head>
        <title>Part Time Chiller</title>
        <meta property="og:title" content="Part Time Chiller" />
        <meta property="og:description" content="Chill vibes, visualized." />
        <meta property="og:image" content="https://media.parttimechiller.com/Okay_PTC.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <PlayerApp />
    </>
  );
}
