export interface Mix {
  title: string;
  slug: string;
  cover: string;
  audio: string;
  duration: string;
  description: string;
  type: 'mix' | 'track';
  artist: string;
}

export function getMixBySlug(slug: string): Mix | undefined {
  return mixes.find(m => m.slug === slug);
}

export const mixes: Mix[] = [
   {
    title: "Okay",
    slug: "okay",
    cover: "https://media.parttimechiller.com/Okay_PTC.png",
    audio: "https://media.parttimechiller.com/Okay_PTC.mp3",
    duration: "3:43",
    description: "I heard ya, okay?",
    type: "track",
    artist: "Part-Time Chiller"
  },
  {
    title: "Dive into dark",
    slug: "dive-into-dark",
    cover: "https://media.parttimechiller.com/DiveIntoDark_PTC.png",
    audio: "https://media.parttimechiller.com/DiveIntoDark_PTC.mp3",
    duration: "2:52",
    description: "Sometimes you need to go deep into the dark",
    type: "track",
    artist: "Part-Time Chiller"
  },
  {
    title: "Slow down",
    slug: "slow-down",
    cover: "https://media.parttimechiller.com/Slowdown_PTC.png",
    audio: "https://media.parttimechiller.com/Slowdown_PTC.mp3",
    duration: "2:36",
    description: "You just got too...",
    type: "track",
    artist: "Part-Time Chiller"
  },
  {
    title: "Slow Burn",
    slug: "slow-burn",
    cover: "https://media.parttimechiller.com/SlowBurn_PTC.png",
    audio: "https://media.parttimechiller.com/SlowBurn_PTC.mp3",
    duration: "3:47",
    description: "Low end head nodding vibes",
    type: "track",
    artist: "Part-Time Chiller"
  },
  {
    title: "Synthcopated",
    slug: "synthcopated",
    cover: "https://media.parttimechiller.com/Synthcopated_PTC.png",
    audio: "https://media.parttimechiller.com/Synthcopated_PTC.mp3",
    duration: "3:17",
    description: "A little bounce for an ounce.",
    type: "track",
    artist: "Part-Time Chiller"
  },
   {
    title: "Midnight interlude",
    slug: "midnight-interlude",
    cover: "https://media.parttimechiller.com/Midnight_Interlude_PTC.png",
    audio: "https://media.parttimechiller.com/Midnight_Interlude_PTC.mp3",
    duration: "5:30",
    description: "Driving down the freeway floating in darkness",
    type: "track",
    artist: "Part-Time Chiller"
  },
   {
    title: "Some Vibes",
    slug: "some-vibes",
    cover: "https://media.parttimechiller.com/SomeVibes_PTC.png",
    audio: "https://media.parttimechiller.com/SomeVibes_PTC.mp3",
    duration: "2:15",
    description: "Some Roland vibes for your midnight soul",
    type: "track",
    artist: "Part-Time Chiller"
  },
  {
    title: "Live at Oldfields mix",
    slug: "live-at-oldfields",
    cover: "https://media.parttimechiller.com/OldfieldsMix_PTC.png",
    audio: "https://media.parttimechiller.com/OldfieldsMix_PTC.mp3",
    duration: "3:00:00",
    description: "Midtempo vibes for Friday evening soirée",
    type: "mix",
    artist: "Part-Time Chiller DJ Set"
  },
  {
    title: "Live at Tamarak Ventures",
    slug: "live-at-tamarak-ventures",
    cover: "https://media.parttimechiller.com/TamarakMix_PTC.png",
    audio: "https://media.parttimechiller.com/TamarakMix_PTC.mp3",
    duration: "3:00:00",
    description: "Perfect early summertime evening vibes recorded at Tamarak Ventures 2025",
    type: "mix",
    artist: "Part-Time Chiller DJ Set"
  },
  {
    title: "Mixing at Margot",
    slug: "mixing-at-margot",
    cover: "https://media.parttimechiller.com/MixAtMargot_PTC.png",
    audio: "https://media.parttimechiller.com/MixAtMargot_PTC.mp3",
    duration: "2:38:29",
    description: "Sophisticated sexy vibes recorded live at Margot in Los Angeles",
    type: "mix",
    artist: "Part-Time Chiller DJ Set"
  },
  {
    title: "Rise Up",
    slug: "rise-up",
    cover: "https://media.parttimechiller.com/RiseUp_PTC.png",
    audio: "https://media.parttimechiller.com/RiseUp_PTC.mp3",
    duration: "3:28",
    description: "Time to get up and get down",
    type: "track",
    artist: "Part-Time Chiller"
  }
];
