export interface Mix {
  title: string;
  cover: string;
  audio: string;
  duration: string;
  description: string;
  type: 'mix' | 'track';
}

export const mixes: Mix[] = [
  {
    title: "Slow Burn",
    cover: "https://media.parttimechiller.com/SlowBurn_PTC.png",
    audio: "https://media.parttimechiller.com/SlowBurn_PTC.mp3",
    duration: "3:47",
    description: "Low end head nodding vibes",
    type: "track"
  },
  {
    title: "Synthcopated",
    cover: "https://media.parttimechiller.com/Synthcopated_PTC.png",
    audio: "https://media.parttimechiller.com/Synthcopated_PTC.mp3",
    duration: "3:17",
    description: "Synths and beats that are stressed unexpectedly, emphasizing an off-beat where a weaker beat is usually expected",
    type: "track"
  },
  {
    title: "Some Vibes",
    cover: "https://media.parttimechiller.com/SomeVibes_PTC.png",
    audio: "https://media.parttimechiller.com/SomeVibes_PTC.mp3",
    duration: "2:15",
    description: "Some Roland vibes for your midnight soul",
    type: "track"
  },
  {
    title: "Dive into dark",
    cover: "https://media.parttimechiller.com/DiveIntoDark_PTC.png",
    audio: "https://media.parttimechiller.com/DiveIntoDark_PTC.mp3",
    duration: "2:52",
    description: "Sometimes you need to go deep into the dark",
    type: "track"
  },  
  {
    title: "Live at Oldfields mix",
    cover: "https://media.parttimechiller.com/OldfieldsMix_PTC.png",
    audio: "https://media.parttimechiller.com/OldfieldsMix_PTC.mp3",
    duration: "3:00:00",
    description: "Midtempo vibes for Friday evening soirée",
    type: "mix"
  },
  {
    title: "Live at Tamarak Ventures",
    cover: "https://media.parttimechiller.com/TamarakMix_PTC.png",
    audio: "https://media.parttimechiller.com/TamarakMix_PTC.mp3",
    duration: "3:00:00",
    description: "Perfect early summertime evening vibes recorded at Tamarak Ventures 2025",
    type: "mix"
  },  
  {
    title: "Rise Up",
    cover: "https://media.parttimechiller.com/RiseUp_PTC.png",
    audio: "https://media.parttimechiller.com/RiseUp_PTC.mp3",
    duration: "3:28",
    description: "Time to get up and get down",
    type: "track"
  }
]; 