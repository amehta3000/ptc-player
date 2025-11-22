export interface Mix {
  title: string;
  cover: string;
  mp3: string;
  duration: string;
  description: string;
  type: 'mix' | 'track';
}

export const mixes: Mix[] = [
  {
    title: "Slow Burn",
    cover: "/covers/SlowBurn_PTC.png",
    mp3: "/mixes/SlowBurn_PTC.mp3",
    duration: "3:47",
    description: "Low end head nodding vibes",
    type: "track"
  },
  {
    title: "Rise Up",
    cover: "/covers/RiseUp_PTC.png",
    mp3: "/mixes/RiseUp_PTC.mp3",
    duration: "3:28",
    description: "Time to get up and get down",
    type: "track"
  },
  {
    title: "Live at Oldfields mix",
    cover: "/covers/OldfieldsMix_PTC.png",
    mp3: "/mixes/OldfieldsMix_PTC.mp3",
    duration: "3:00:00",
    description: "Midtempo vibes for Friday evening soirée",
    type: "mix"
  },
  {
    title: "Live at Tamarak Ventures",
    cover: "/covers/TamarakMix_PTC.png",
    mp3: "/mixes/TamarakMix_PTC.mp3",
    duration: "3:00:00",
    description: "Perfect early summertime evening vibes recorded at Tamarak Ventures 2025",
    type: "mix"
  }  
]; 