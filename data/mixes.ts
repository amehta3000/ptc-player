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
    title: "Okay",
    cover: "https://media.parttimechiller.com/Okay_PTC.png",
    audio: "https://media.parttimechiller.com/Okay_PTC.mp3",
    duration: "3:43",
    description: "I heard ya, okay?",
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
    title: "Slow down",
    cover: "https://media.parttimechiller.com/Slowdown_PTC.png",
    audio: "https://media.parttimechiller.com/Slowdown_PTC.mp3",
    duration: "2:36",
    description: "You just got too...",
    type: "track"
  },  
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
    description: "A little bounce for an ounce.",
    type: "track"
  },
   {
    title: "Midnight interlude",
    cover: "https://media.parttimechiller.com/Midnight_Interlude_PTC.png",
    audio: "https://media.parttimechiller.com/Midnight_Interlude_PTC.mp3",
    duration: "5:30",
    description: "Driving down the freeway floating in darkness",
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
    title: "Mixing at Margot",
    cover: "https://media.parttimechiller.com/MixAtMargot_PTC.png",
    audio: "https://media.parttimechiller.com/MixAtMargot_PTC.mp3",
    duration: "2:38:29",
    description: "Sophisticated sexy vibes recorded live at Margot in Los Angeles",
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