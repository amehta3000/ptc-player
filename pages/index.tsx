import Head from 'next/head';
import PlayerApp from '../components/PlayerApp';

export default function Home() {
  return (
    <>
      <Head>
        <title>Sound Visualizer — turn your track into a video</title>
        <meta
          name="description"
          content="Upload an audio file, watch a reactive visualizer synced to your sound, and export a video for social media. Runs entirely in your browser."
        />
        <meta property="og:title" content="Sound Visualizer" />
        <meta property="og:description" content="Upload a track, visualize it, export a video." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <PlayerApp />
    </>
  );
}
