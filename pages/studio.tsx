import Head from 'next/head';
import StudioApp from '../components/StudioApp';

export default function Studio() {
  return (
    <>
      <Head>
        <title>PTC Studio: Make Your Music Move</title>
        <meta property="og:title" content="PTC Studio: Make Your Music Move" />
        <meta property="og:description" content="A visual toy for artists: drop in a track, vibe with audio-reactive visualizers, and record a clip for TikTok, Reels, Instagram, or YouTube." />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
      </Head>
      <StudioApp />
    </>
  );
}
