import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import PlayerApp from '../../components/PlayerApp';
import { mixes, Mix } from '../../data/mixes';

interface TrackPageProps {
  track: Mix;
}

export default function TrackPage({ track }: TrackPageProps) {
  return (
    <>
      <Head>
        <title>{track.title} — Part Time Chiller</title>
        <meta property="og:title" content={`${track.title} — Part Time Chiller`} />
        <meta property="og:description" content={`${track.description} | ${track.artist}`} />
        <meta property="og:image" content={track.cover} />
        <meta property="og:type" content="music.song" />
        <meta property="og:url" content={`https://parttimechiller.com/ptc-player/track/${track.slug}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${track.title} — Part Time Chiller`} />
        <meta name="twitter:description" content={`${track.description} | ${track.artist}`} />
        <meta name="twitter:image" content={track.cover} />
      </Head>
      <PlayerApp initialSlug={track.slug} />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = () => ({
  paths: mixes.map(m => ({ params: { slug: m.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<TrackPageProps> = ({ params }) => {
  const track = mixes.find(m => m.slug === params?.slug);
  if (!track) return { notFound: true };
  return { props: { track } };
};
