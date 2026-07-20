import Head from 'next/head';
import StudioApp from '../components/StudioApp';

export default function Studio() {
  return (
    <>
      <Head>
        <title>PTC Studio — Create Your Own Visual</title>
        <meta property="og:title" content="PTC Studio" />
        <meta property="og:description" content="Upload your track, visualize it, and record a video for your socials." />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
      </Head>
      <StudioApp />
    </>
  );
}
