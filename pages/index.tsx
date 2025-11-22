import React, { useState, useRef, useEffect } from "react";
import { Mix, mixes } from "../data/mixes";

type FilterType = 'all' | 'mix' | 'track';

export default function Mixes() {
  const [currentMix, setCurrentMix] = useState<Mix | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dominantColor, setDominantColor] = useState<string>('rgb(115, 115, 115)');
  const [accentColor, setAccentColor] = useState<string>('rgb(163, 163, 163)');
  const [audioData, setAudioData] = useState<number[]>(Array(32).fill(0));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Filter mixes based on selected filter
  const filteredMixes = mixes.filter(mix => {
    if (filter === 'all') return true;
    return mix.type === filter;
  });

  // Format time helper function
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Sync progress bar and time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
      setCurrentTime(audio.currentTime);
    };

    const updateDuration = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [currentMix]);

  // Setup audio analyzer for visualizer
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentMix) return;

    // Only create audio context once
    if (!analyserRef.current) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaElementSource(audio);
        
        analyser.fftSize = 256; // Increased for better frequency resolution
        analyser.smoothingTimeConstant = 0.8; // Smoothing for better visual effect
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      } catch (error) {
        console.log("Audio context setup failed:", error);
      }
    }

    // Resume audio context on interaction
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentMix]);

  // Animate visualizer
  useEffect(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = 32; // Number of bars to display
    const step = Math.floor(bufferLength / barCount);
    let frameCount = 0;

    const animate = () => {
      frameCount++;
      
      // Update only every other frame for better performance
      if (frameCount % 2 === 0) {
        const audio = audioRef.current;
        const isCurrentlyPlaying = audio && !audio.paused && !audio.ended;
        
        if (isCurrentlyPlaying) {
          analyser.getByteFrequencyData(dataArray);
          
          // Sample frequency data across the spectrum
          const bars: number[] = new Array(barCount);
          
          for (let i = 0; i < barCount; i++) {
            const start = i * step;
            const end = start + step;
            let sum = 0;
            
            // Average the frequencies in this range
            for (let j = start; j < end; j++) {
              sum += dataArray[j];
            }
            
            bars[i] = sum / step;
          }
          
          setAudioData(bars);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentMix]);

  // Auto-play when mix is selected
  useEffect(() => {
    if (currentMix && audioRef.current) {
      const audio = audioRef.current;
      
      // Small delay to ensure audio element is ready
      const timer = setTimeout(async () => {
        try {
          // Resume audio context if suspended
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
          await audio.play();
          setIsPlaying(true);
        } catch (error) {
          console.log("Auto-play failed:", error);
          // Auto-play might be blocked by browser, but that's okay
          setIsPlaying(false);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [currentMix]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        // Resume audio context if suspended
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.log("Play failed:", error);
      }
    }
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
  };

  // Extract colors from album art
  const extractColors = (imgSrc: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgSrc;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Simple color extraction - get average of brighter pixels
        let r = 0, g = 0, b = 0, count = 0;
        let r2 = 0, g2 = 0, b2 = 0, count2 = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
          const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          
          // Dominant color (mid-brightness)
          if (brightness > 40 && brightness < 180) {
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
            count++;
          }
          
          // Accent color (brighter)
          if (brightness > 100 && brightness < 220) {
            r2 += pixels[i];
            g2 += pixels[i + 1];
            b2 += pixels[i + 2];
            count2++;
          }
        }
        
        if (count > 0) {
          const avgR = Math.floor(r / count);
          const avgG = Math.floor(g / count);
          const avgB = Math.floor(b / count);
          setDominantColor(`rgb(${avgR}, ${avgG}, ${avgB})`);
        }
        
        if (count2 > 0) {
          const avgR2 = Math.floor(r2 / count2);
          const avgG2 = Math.floor(g2 / count2);
          const avgB2 = Math.floor(b2 / count2);
          setAccentColor(`rgb(${avgR2}, ${avgG2}, ${avgB2})`);
        }
      } catch (error) {
        console.log("Color extraction failed:", error);
      }
    };
  };

  const handleMixSelect = (mix: Mix) => {
    setCurrentMix(mix);
    // Reset progress when selecting new mix
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    // Extract colors from album art
    extractColors(mix.cover);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    const clickPercentage = (clickX / progressBarWidth) * 100;
    
    const newTime = (clickPercentage / 100) * audio.duration;
    audio.currentTime = newTime;
    setProgress(clickPercentage);
    setCurrentTime(newTime);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <img src="/logo2.png" alt="Part Time Chiller" className="h-10 sm:h-12" />
          <span className="text-base sm:text-xl font-bold hidden sm:inline">PartTimeChiller</span>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex space-x-1 sm:space-x-2">
            <a
              href="https://instagram.com/parttimechiller"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all bg-neutral-800 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 hover:scale-110"
              title="Instagram"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a
              href="https://youtube.com/@parttimechiller"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all bg-neutral-800 hover:bg-red-600 hover:scale-110"
              title="YouTube"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            <a
              href="https://open.spotify.com/user/ameet3000?si=833fb8c8623241a1"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all bg-neutral-800 hover:bg-green-500 hover:scale-110"
              title="Spotify"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </a>
          </div>
          <div className="h-6 w-px bg-neutral-700 hidden sm:block"></div>
          <div className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition-colors ${
                filter === 'all' 
                  ? 'bg-white text-black' 
                  : 'bg-neutral-800 text-white hover:bg-neutral-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('mix')}
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition-colors ${
                filter === 'mix' 
                  ? 'bg-white text-black' 
                  : 'bg-neutral-800 text-white hover:bg-neutral-700'
              }`}
            >
              Mixes
            </button>
            <button
              onClick={() => setFilter('track')}
              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition-colors ${
                filter === 'track' 
                  ? 'bg-white text-black' 
                  : 'bg-neutral-800 text-white hover:bg-neutral-700'
              }`}
            >
              Tracks
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {filteredMixes.map((mix, idx) => (
          <div
            key={idx}
            onClick={() => handleMixSelect(mix)}
            className="bg-neutral-900 border border-neutral-800 hover:border-white transition-all duration-300 cursor-pointer rounded-lg hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3 p-3">
              <img 
                src={mix.cover} 
                alt={mix.title} 
                className="w-12 h-12 rounded object-cover"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="w-12 h-12 rounded bg-neutral-700 flex items-center justify-center hidden">
                <span className="text-xs text-neutral-400">🎵</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h2 className="text-md font-medium leading-tight">{mix.title}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    mix.type === 'mix' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    {mix.type}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">{mix.description} • {mix.duration}</p>
              </div>
              <button 
                className="bg-neutral-700 hover:bg-neutral-600 text-xs px-3 py-1 rounded transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {currentMix && (
        <>
          {/* Waveform Visualizer */}
          <div className="fixed bottom-20 left-0 right-0 h-24 flex items-end justify-center gap-1.5 px-4 pointer-events-none">
            {audioData.map((value, index) => {
              const scale = Math.max(0.08, value / 255);
              
              return (
                <div
                  key={index}
                  className="flex-1 h-full origin-bottom rounded-t-md will-change-transform"
                  style={{
                    transform: `scaleY(${scale})`,
                    background: `linear-gradient(to top, ${dominantColor}, ${accentColor})`,
                    opacity: isPlaying ? 0.9 : 0.4,
                  }}
                />
              );
            })}
          </div>

          {/* Player Bar */}
          <div 
            className="fixed bottom-0 left-0 right-0 px-4 py-3 flex items-center space-x-4 backdrop-blur-xl transition-all duration-500"
            style={{ 
              background: `linear-gradient(to right, ${dominantColor}15, ${accentColor}15)`
            }}
          >
          <img 
            src={currentMix.cover} 
            alt={currentMix.title} 
            className="w-12 h-12 rounded object-cover shadow-lg transition-all duration-500"
            style={{ 
              boxShadow: `0 0 0 2px ${accentColor}40`
            }}
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="w-12 h-12 rounded bg-neutral-700 flex items-center justify-center hidden">
            <span className="text-xs text-neutral-400">🎵</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium truncate">{currentMix.title}</div>
            <div 
              className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden mt-1 cursor-pointer relative backdrop-blur"
              onClick={handleProgressClick}
            >
              <div
                className="h-full transition-all duration-300 shadow-lg"
                style={{ 
                  width: `${progress}%`,
                  background: `linear-gradient(to right, ${dominantColor}, ${accentColor})`
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-neutral-300">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={skipBackward}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`
              }}
              aria-label="Skip backward 10 seconds"
            >
              <span className="font-bold text-xs">-10</span>
            </button>
            <button
              onClick={togglePlay}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`,
                color: 'white'
              }}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              onClick={skipForward}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`
              }}
              aria-label="Skip forward 10 seconds"
            >
              <span className="font-bold text-xs">+10</span>
            </button>
          </div>
          <audio ref={audioRef} src={currentMix.mp3} preload="metadata" />
        </div>
        </>
      )}
    </div>
  );
}
