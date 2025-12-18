import React, { useState, useRef, useEffect } from "react";
import { Mix, mixes } from "../data/mixes";
import * as THREE from 'three';
import { SonicGalaxyVisualizer } from '../lib/visualizers/SonicGalaxyVisualizer';

type FilterType = 'all' | 'mix' | 'track';
type VisualizerType = 'bars' | 'orb' | 'web' | 'terrain' | 'chrysalis' | 'sonicGalaxy';

// Declare Clarity type
declare global {
  interface Window {
    clarity?: (action: string, ...args: any[]) => void;
  }
}

export default function Mixes() {
  const [currentMix, setCurrentMix] = useState<Mix | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [showVisualizer, setShowVisualizer] = useState<boolean>(true);
  const [visualizerType, setVisualizerType] = useState<VisualizerType>('terrain');
  
  // List of monospace fonts
  const fonts = [
    'Stint Ultra Expanded',
    'Barrio',
    'Bungee Hairline',
    'Splash',
    'Cal Sans',
    'Inconsolata',
    'Kumbh Sans',
    'Nabla',
    'Barriecito'
  ];
  
  const [currentFont, setCurrentFont] = useState<string>('Stint Ultra Expanded');
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const threeCanvasRef = useRef<HTMLDivElement | null>(null);
  const whitecapCanvasRef = useRef<HTMLDivElement | null>(null);
  const terrainCanvasRef = useRef<HTMLDivElement | null>(null);
  const chrysalisCanvasRef = useRef<HTMLDivElement | null>(null);
  const sonicGalaxyCanvasRef = useRef<HTMLDivElement | null>(null);
  const barsContainerRef = useRef<HTMLDivElement | null>(null);
  const threeSceneRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; mesh: THREE.Mesh; originalPositions: Float32Array } | null>(null);
  const audioDataRef = useRef<number[]>(Array(64).fill(0));
  const dominantColorRef = useRef<string>('rgb(115, 115, 115)');
  const accentColorRef = useRef<string>('rgb(163, 163, 163)');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dominantColor, setDominantColor] = useState<string>('rgb(115, 115, 115)');
  const [accentColor, setAccentColor] = useState<string>('rgb(163, 163, 163)');
  const [audioData, setAudioData] = useState<number[]>(Array(64).fill(0));
  
  // Visualizer control parameters
  const [showControls, setShowControls] = useState<boolean>(false);
  
  // Three.js sphere controls
  const [freqMultiplier, setFreqMultiplier] = useState<number>(3.6);
  const [noiseMultiplier, setNoiseMultiplier] = useState<number>(0.55);
  const [timeSpeed, setTimeSpeed] = useState<number>(2.0);
  const [autoRotationSpeed, setAutoRotationSpeed] = useState<number>(0.003);
  const [orbWireframe, setOrbWireframe] = useState<boolean>(true);
  const [orbRadius, setOrbRadius] = useState<number>(2.0);
  
  // Bars visualizer controls
  const [barsScale, setBarsScale] = useState<number>(0.5);
  const [barsSmoothness, setBarsSmoothness] = useState<number>(1.0);
  const [barsWidth, setBarsWidth] = useState<number>(4);
  const [barsColorMode, setBarsColorMode] = useState<boolean>(false);
  

  
  // WhiteCap visualizer controls
  const [whitecapBassPulse, setWhitecapBassPulse] = useState<number>(0.4);
  const [whitecapMidExtension, setWhitecapMidExtension] = useState<number>(0.5);
  const [whitecapHighShimmer, setWhitecapHighShimmer] = useState<number>(0.1);
  const [whitecapRotationSpeed, setWhitecapRotationSpeed] = useState<number>(0.002);
  const [whitecapColorMode, setWhitecapColorMode] = useState<boolean>(false);
  
  // Terrain visualizer controls
  const [terrainAmplitude, setTerrainAmplitude] = useState<number>(3.9);
  const [terrainSpeed, setTerrainSpeed] = useState<number>(17.5);
  const [terrainDecay, setTerrainDecay] = useState<number>(0.95);
  const [terrainCameraDistance, setTerrainCameraDistance] = useState<number>(9.5);
  const [terrainAutoRotation, setTerrainAutoRotation] = useState<number>(0.0005);
  const [terrainRenderMode, setTerrainRenderMode] = useState<'grid' | 'wireframe' | 'surface'>('wireframe');
  
  // Chrysalis visualizer controls
  const [chrysalisSlices, setChrysalisSlices] = useState<number>(56);
  const [chrysalisWaviness, setChrysalisWaviness] = useState<number>(0.05);
  const [chrysalisRotationSpeed, setChrysalisRotationSpeed] = useState<number>(0.003);
  const [chrysalisPulseIntensity, setChrysalisPulseIntensity] = useState<number>(0.7);
  const [chrysalisLissajousA, setChrysalisLissajousA] = useState<number>(3);
  const [chrysalisLissajousB, setChrysalisLissajousB] = useState<number>(4);
  const [chrysalisLineThickness, setChrysalisLineThickness] = useState<number>(2);
  
  // Sonic Galaxy visualizer controls
  const [galaxyParticleCount, setGalaxyParticleCount] = useState<number>(50000);
  const [galaxyAttractorCount, setGalaxyAttractorCount] = useState<number>(4);
  const [galaxyBassGravity, setGalaxyBassGravity] = useState<number>(2.0);
  const [galaxyMidSpin, setGalaxyMidSpin] = useState<number>(2.0);
  const [galaxyMaxSpeed, setGalaxyMaxSpeed] = useState<number>(8);
  const [galaxyDamping, setGalaxyDamping] = useState<number>(0.05);
  const [galaxyParticleSize, setGalaxyParticleSize] = useState<number>(0.5);
  const [galaxyCameraSpeed, setGalaxyCameraSpeed] = useState<number>(0.005);
  const [galaxyBoundSize, setGalaxyBoundSize] = useState<number>(10);
  const [galaxyBeatSensitivity, setGalaxyBeatSensitivity] = useState<number>(1.2);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  
  // Refs for real-time parameter access in animation loop
  const freqMultiplierRef = useRef<number>(3.6);
  const noiseMultiplierRef = useRef<number>(0.55);
  const timeSpeedRef = useRef<number>(2.0);
  const autoRotationSpeedRef = useRef<number>(0.003);
  const barsScaleRef = useRef<number>(1.0);
  const barsSmoothnessRef = useRef<number>(1.0);
  const barsWidthRef = useRef<number>(4);
  const barsColorModeRef = useRef<boolean>(false);

  const whitecapBassPulseRef = useRef<number>(0.4);
  const whitecapMidExtensionRef = useRef<number>(0.5);
  const whitecapHighShimmerRef = useRef<number>(0.1);
  const whitecapRotationSpeedRef = useRef<number>(0.002);
  const whitecapColorModeRef = useRef<boolean>(false);
  const terrainAmplitudeRef = useRef<number>(2.0);
  const terrainSpeedRef = useRef<number>(1.0);
  const terrainDecayRef = useRef<number>(0.95);
  const terrainCameraDistanceRef = useRef<number>(8);
  const terrainAutoRotationRef = useRef<number>(0.002);
  const terrainRenderModeRef = useRef<'grid' | 'wireframe' | 'surface'>('wireframe');
  const chrysalisSlicesRef = useRef<number>(32);
  const chrysalisWavinessRef = useRef<number>(0.3);
  const chrysalisRotationSpeedRef = useRef<number>(0.002);
  const chrysalisPulseIntensityRef = useRef<number>(0.5);
  const chrysalisLissajousARef = useRef<number>(3);
  const chrysalisLissajousBRef = useRef<number>(4);
  const chrysalisLineThicknessRef = useRef<number>(2);
  
  // Update refs when state changes
  useEffect(() => {
    freqMultiplierRef.current = freqMultiplier;
    noiseMultiplierRef.current = noiseMultiplier;
    timeSpeedRef.current = timeSpeed;
    autoRotationSpeedRef.current = autoRotationSpeed;
    barsScaleRef.current = barsScale;
    barsSmoothnessRef.current = barsSmoothness;
    barsWidthRef.current = barsWidth;
    barsColorModeRef.current = barsColorMode;

    whitecapBassPulseRef.current = whitecapBassPulse;
    whitecapMidExtensionRef.current = whitecapMidExtension;
    whitecapHighShimmerRef.current = whitecapHighShimmer;
    whitecapRotationSpeedRef.current = whitecapRotationSpeed;
    whitecapColorModeRef.current = whitecapColorMode;
    terrainAmplitudeRef.current = terrainAmplitude;
    terrainSpeedRef.current = terrainSpeed;
    terrainDecayRef.current = terrainDecay;
    terrainCameraDistanceRef.current = terrainCameraDistance;
    terrainAutoRotationRef.current = terrainAutoRotation;
    terrainRenderModeRef.current = terrainRenderMode;
    chrysalisSlicesRef.current = chrysalisSlices;
    chrysalisWavinessRef.current = chrysalisWaviness;
    chrysalisRotationSpeedRef.current = chrysalisRotationSpeed;
    chrysalisPulseIntensityRef.current = chrysalisPulseIntensity;
    chrysalisLissajousARef.current = chrysalisLissajousA;
    chrysalisLissajousBRef.current = chrysalisLissajousB;
    chrysalisLineThicknessRef.current = chrysalisLineThickness;
  }, [freqMultiplier, noiseMultiplier, timeSpeed, autoRotationSpeed, barsScale, barsSmoothness, barsWidth, barsColorMode, whitecapBassPulse, whitecapMidExtension, whitecapHighShimmer, whitecapRotationSpeed, whitecapColorMode, terrainAmplitude, terrainSpeed, terrainDecay, terrainCameraDistance, terrainAutoRotation, terrainRenderMode, chrysalisSlices, chrysalisWaviness, chrysalisRotationSpeed, chrysalisPulseIntensity, chrysalisLissajousA, chrysalisLissajousB, chrysalisLineThickness]);
  
  // Update ref whenever audioData changes
  useEffect(() => {
    audioDataRef.current = audioData;
  }, [audioData]);
  
  // Update color refs when colors change
  useEffect(() => {
    dominantColorRef.current = dominantColor;
    accentColorRef.current = accentColor;
  }, [dominantColor, accentColor]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Filter mixes based on selected filter
  const filteredMixes = mixes.filter(mix => {
    if (filter === 'all') return true;
    return mix.type === filter;
  });

  // Get current track index in filtered list
  const currentIndex = currentMix ? filteredMixes.findIndex(m => m.title === currentMix.title) : -1;

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

    const handleSongEnd = () => {
      // Track when song completes
      if (typeof window !== 'undefined' && window.clarity && currentMix) {
        window.clarity('event', 'song_completed', currentMix.title);
      }
      // Auto-advance to next track
      playNext();
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', audio.error);
      console.error('Error event:', e);
      alert(`Error loading audio file: ${currentMix?.title}\nPlease check if the file exists and is in a supported format.`);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("ended", handleSongEnd);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("ended", handleSongEnd);
      audio.removeEventListener("error", handleError);
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
        
        analyser.fftSize = 2048; // Higher FFT for better frequency resolution
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
    const barCount = 64; // Number of bars to display
    let frameCount = 0;

    const animate = () => {
      frameCount++;
      
      // Update only every other frame for better performance
      if (frameCount % 2 === 0) {
        const audio = audioRef.current;
        const isCurrentlyPlaying = audio && !audio.paused && !audio.ended;
        
        if (isCurrentlyPlaying) {
          analyser.getByteFrequencyData(dataArray);
          
          // Dual-curve logarithmic: gentle curve for bass, standard curve for mids/highs
          const bars: number[] = new Array(barCount);
          const sampleRate = audioContextRef.current?.sampleRate || 44100;
          const binFreqRange = sampleRate / analyser.fftSize; // ~21.5 Hz per bin at 2048 FFT
          
          // Use 40% of bars for bass/low-mids with gentler curve
          const bassCutoff = 0.4;
          const bassTransitionFreq = 800; // Transition frequency
          const minFreq = 20;
          const maxFreq = 16000;
          
          for (let i = 0; i < barCount; i++) {
            let f0, f1;
            
            if (i < barCount * bassCutoff) {
              // Gentle logarithmic curve for bass (20-800 Hz)
              // Use square root to flatten the curve and spread bass bars more evenly
              const t0 = i / (barCount * bassCutoff);
              const t1 = (i + 1) / (barCount * bassCutoff);
              
              // Apply square root to t values to make distribution more linear-like
              const adjusted_t0 = Math.sqrt(t0);
              const adjusted_t1 = Math.sqrt(t1);
              
              f0 = minFreq * Math.pow(bassTransitionFreq / minFreq, adjusted_t0);
              f1 = minFreq * Math.pow(bassTransitionFreq / minFreq, adjusted_t1);
            } else {
              // Standard logarithmic for mids/highs (800-16000 Hz)
              const midHighIndex = i - (barCount * bassCutoff);
              const midHighCount = barCount * (1 - bassCutoff);
              const t0 = midHighIndex / midHighCount;
              const t1 = (midHighIndex + 1) / midHighCount;
              
              f0 = bassTransitionFreq * Math.pow(maxFreq / bassTransitionFreq, t0);
              f1 = bassTransitionFreq * Math.pow(maxFreq / bassTransitionFreq, t1);
            }
            
            // Map to bin indices
            let startIndex = Math.floor(f0 / binFreqRange);
            let endIndex = Math.floor(f1 / binFreqRange);
            
            // Ensure each bar has at least one unique bin
            if (endIndex <= startIndex) {
              endIndex = startIndex + 1;
            }
            
            // Clamp to valid range
            startIndex = Math.max(0, Math.min(startIndex, bufferLength - 1));
            endIndex = Math.min(bufferLength - 1, endIndex);
            
            let sum = 0;
            let count = 0;
            
            for (let bin = startIndex; bin <= endIndex; bin++) {
              sum += dataArray[bin];
              count++;
            }
            
            const avg = count ? sum / count : 0;
            
            // Loudness compensation based on frequency
            let loudnessBoost = 1.0;
            if (i < barCount * 0.2) {
              // Extra boost for sub-bass/bass (first 20%)
              loudnessBoost = 1.5;
            } else if (i < barCount * 0.35) {
              // Moderate boost for low-mids (20-35%)
              loudnessBoost = 1.2;
            } else if (i > barCount * 0.75) {
              // Boost highs (last 25%)
              loudnessBoost = 1 + ((i / barCount - 0.75) / 0.25) * 0.6;
            }
            
            bars[i] = avg * loudnessBoost;
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

  // Setup Three.js visualizer
  useEffect(() => {
    if (!threeCanvasRef.current || visualizerType !== 'orb' || !showVisualizer || !currentMix) return;

    // Create scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    const container = threeCanvasRef.current;
    if (!container) return;
    
    const size = Math.min(container.clientWidth, container.clientHeight);
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Create sphere geometry using IcosahedronGeometry for more uniform vertex distribution
    const detailLevel = 6; // Higher subdivision level for more triangles and detail
    const geometry = new THREE.IcosahedronGeometry(orbRadius, detailLevel);
    
    // Store original positions for animation
    const originalPositions = new Float32Array(geometry.attributes.position.array);
    
    // Add vertex colors initialized with a default color (will be updated in animation loop)
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = 0.5;
      colors[i + 1] = 0.5;
      colors[i + 2] = 0.5;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create material - toggle between wireframe with vertex colors and solid yellow
    const material = new THREE.MeshBasicMaterial({
      vertexColors: orbWireframe,
      wireframe: orbWireframe,
      color: orbWireframe ? 0xffffff : 0xffff00,
      transparent: true,
      opacity: 0.9,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    
    camera.position.z = 6;
    camera.lookAt(0, 0, 0);

    threeSceneRef.current = { scene, camera, renderer, mesh, originalPositions };

    // Mouse interaction variables
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraRotation = { x: 0, y: 0 };
    const rotationSpeed = 0.005;

    // Mouse event handlers
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      cameraRotation.y += deltaX * rotationSpeed;
      cameraRotation.x += deltaY * rotationSpeed;

      // Clamp vertical rotation
      cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Parse album artwork colors helper
    const parseRGB = (rgbString: string) => {
      const match = rgbString.match(/\d+/g);
      if (match && match.length >= 3) {
        return {
          r: parseInt(match[0]) / 255,
          g: parseInt(match[1]) / 255,
          b: parseInt(match[2]) / 255
        };
      }
      return { r: 0, g: 1, b: 1 }; // Fallback cyan
    };

    // Animation loop with smooth transitions
    let frameId: number;
    let currentEnergyLevel = 0.1; // Start at calm state (0.1 = 10%)
    
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      // Get current values from refs for real-time updates
      const currentAutoRotationSpeed = autoRotationSpeedRef.current;
      const currentTimeSpeed = timeSpeedRef.current;
      const currentFreqMultiplier = freqMultiplierRef.current;
      const currentNoiseMultiplier = noiseMultiplierRef.current;
      
      // Update colors dynamically from current state via refs
      const dominantRGB = parseRGB(dominantColorRef.current);
      const accentRGB = parseRGB(accentColorRef.current);
      
      // Continuous auto-rotation of the mesh
      mesh.rotation.y += currentAutoRotationSpeed;
      mesh.rotation.x += currentAutoRotationSpeed * 0.5;
      
      // Update camera position based on user rotation
      const radius = 6;
      camera.position.x = radius * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);
      camera.position.y = radius * Math.sin(cameraRotation.x);
      camera.position.z = radius * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
      camera.lookAt(0, 0, 0);
      
      // Update vertices based on audio data from ref
      const positions = geometry.attributes.position;
      const count = positions.count;
      const currentAudioData = audioDataRef.current;
      
      // Calculate average frequency (as per tutorial: analyser.getAverageFrequency())
      let frequencySum = 0;
      for (let i = 0; i < currentAudioData.length; i++) {
        frequencySum += currentAudioData[i] || 0;
      }
      const averageFrequency = frequencySum / currentAudioData.length;
      const normalizedFreq = averageFrequency / 255; // Normalize to 0-1
      
      // Use time for animation (tutorial uses u_time uniform)
      const time = Date.now() * 0.001 * currentTimeSpeed;
      
      for (let i = 0; i < count; i++) {
        // Get original position
        const origX = originalPositions[i * 3];
        const origY = originalPositions[i * 3 + 1];
        const origZ = originalPositions[i * 3 + 2];
        
        // Create position with time offset (as per tutorial: position + u_time)
        const posX = origX + time;
        const posY = origY + time;
        const posZ = origZ + time;
        
        // Perlin-like noise using layered sine waves
        // Tutorial: float noise = 5. * pnoise(position + u_time, vec3(10.));
        const noise = 
          Math.sin(posX * 2) * Math.cos(posY * 2) * 0.5 +
          Math.sin(posY * 3) * Math.cos(posZ * 3) * 0.3 +
          Math.sin(posZ * 4) * Math.cos(posX * 2) * 0.4 +
          Math.sin((posX + posY + posZ) * 1.5) * 0.3;
        
        // Multiply noise by intensity factor (tutorial uses 5.0, we use freqMultiplier)
        const intensifiedNoise = noise * currentFreqMultiplier * 2;
        
        // Tutorial formula: displacement = (u_frequency / 30.) * (noise / 10.);
        // Simplified: displacement = normalizedFreq * noise * scale
        const displacement = (normalizedFreq * currentNoiseMultiplier) * (intensifiedNoise * 0.1);
        
        // Apply displacement along normal
        const scale = 1 + displacement;
        positions.setXYZ(
          i,
          origX * scale,
          origY * scale,
          origZ * scale
        );
        
        // Update vertex color based on displacement
        const colorAttr = geometry.attributes.color;
        // Blend between dominant and accent colors based on displacement
        const colorIntensity = Math.abs(displacement) * 8; // Amplify for visibility
        const blend = Math.min(1, Math.max(0, colorIntensity)); // Clamp 0-1
        
        // Add subtle time-based variation for animation
        const timeVariation = Math.sin(time * 0.5 + i * 0.01) * 0.15; // Subtle wave
        const finalBlend = Math.min(1, Math.max(0, blend + timeVariation));
        
        // Interpolate between dominant and accent colors
        const r = dominantRGB.r + (accentRGB.r - dominantRGB.r) * finalBlend;
        const g = dominantRGB.g + (accentRGB.g - dominantRGB.g) * finalBlend;
        const b = dominantRGB.b + (accentRGB.b - dominantRGB.b) * finalBlend;
        
        colorAttr.setXYZ(i, r, g, b);
      }
      
      positions.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.computeVertexNormals(); // Recalculate normals for smooth appearance
      
      renderer.render(scene, camera);
    };
    
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      threeSceneRef.current = null;
    };
  }, [visualizerType, showVisualizer, currentMix, orbWireframe, orbRadius]);

  // Setup WhiteCap visualizer
  useEffect(() => {
    if (!whitecapCanvasRef.current || visualizerType !== 'web' || !showVisualizer) return;

    // Create scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    const container = whitecapCanvasRef.current;
    const size = Math.min(container.clientWidth, container.clientHeight);
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    camera.position.z = 5;
    camera.lookAt(0, 0, 0);

    // Parse album artwork colors
    const parseRGB = (rgbString: string) => {
      const match = rgbString.match(/\d+/g);
      if (match && match.length >= 3) {
        return {
          r: parseInt(match[0]) / 255,
          g: parseInt(match[1]) / 255,
          b: parseInt(match[2]) / 255
        };
      }
      return { r: 1, g: 0.5, b: 0 }; // Fallback warm color
    };
    
    const dominantRGB = parseRGB(dominantColor);
    const accentRGB = parseRGB(accentColor);

    // Create complex wireframe geometry
    const segmentCount = 64; // Number of radial segments
    const ringCount = 24; // Number of concentric rings
    const vertices: number[] = [];
    const colors: number[] = [];

    // Generate vertices for wireframe mesh
    for (let ring = 0; ring < ringCount; ring++) {
      const radius = (ring / ringCount) * 3;
      for (let seg = 0; seg <= segmentCount; seg++) {
        const theta = (seg / segmentCount) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const y = Math.sin(theta) * radius;
        const z = 0;
        
        vertices.push(x, y, z);
        
        // Initial colors (will be animated)
        colors.push(dominantRGB.r, dominantRGB.g, dominantRGB.b);
      }
    }

    // Create indices for line segments
    const indices: number[] = [];
    
    // Radial lines
    for (let seg = 0; seg < segmentCount; seg++) {
      for (let ring = 0; ring < ringCount - 1; ring++) {
        const current = ring * (segmentCount + 1) + seg;
        const next = (ring + 1) * (segmentCount + 1) + seg;
        indices.push(current, next);
      }
    }
    
    // Ring lines
    for (let ring = 0; ring < ringCount; ring++) {
      for (let seg = 0; seg < segmentCount; seg++) {
        const current = ring * (segmentCount + 1) + seg;
        const next = ring * (segmentCount + 1) + seg + 1;
        indices.push(current, next);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    const wireframe = new THREE.LineSegments(geometry, material);
    const group = new THREE.Group();
    group.add(wireframe);
    scene.add(group);

    // Animation loop
    let frameId: number;
    let time = 0;
    
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      time += 0.01;
      
      // Get current audio data
      const currentAudioData = audioDataRef.current;
      
      // Separate frequency bands
      const bassEnd = Math.floor(currentAudioData.length * 0.15); // 0-15%
      const midEnd = Math.floor(currentAudioData.length * 0.6); // 15-60%
      
      // Calculate average for each band
      let bassSum = 0, midSum = 0, highSum = 0;
      let bassCount = 0, midCount = 0, highCount = 0;
      
      for (let i = 0; i < currentAudioData.length; i++) {
        if (i < bassEnd) {
          bassSum += currentAudioData[i];
          bassCount++;
        } else if (i < midEnd) {
          midSum += currentAudioData[i];
          midCount++;
        } else {
          highSum += currentAudioData[i];
          highCount++;
        }
      }
      
      const bassAvg = bassCount > 0 ? bassSum / bassCount / 255 : 0;
      const midAvg = midCount > 0 ? midSum / midCount / 255 : 0;
      const highAvg = highCount > 0 ? highSum / highCount / 255 : 0;
      
      // Update geometry based on audio
      const positions = geometry.attributes.position;
      const colorAttr = geometry.attributes.color;
      
      let vertexIndex = 0;
      for (let ring = 0; ring < ringCount; ring++) {
        const ringPercent = ring / ringCount;
        const baseRadius = ringPercent * 3;
        
        for (let seg = 0; seg <= segmentCount; seg++) {
          const theta = (seg / segmentCount) * Math.PI * 2;
          
          // Bass controls overall scale and pulse
          const bassPulse = 1 + bassAvg * whitecapBassPulseRef.current;
          
          // Mid frequencies control radial extension (wings/spokes)
          const midModulation = midAvg * Math.sin(theta * 3 + time) * whitecapMidExtensionRef.current;
          
          // High frequencies add shimmer/noise
          const highNoise = highAvg * (Math.sin(theta * 8 + time * 5) * whitecapHighShimmerRef.current);
          
          const finalRadius = baseRadius * bassPulse + midModulation + highNoise;
          
          const x = Math.cos(theta) * finalRadius;
          const y = Math.sin(theta) * finalRadius;
          const z = Math.sin(ring * 0.5 + time + bassAvg * 2) * 0.3; // Add wave motion
          
          positions.setXYZ(vertexIndex, x, y, z);
          
          // Color based on position and audio
          let r, g, b;
          
          if (whitecapColorModeRef.current) {
            // Rainbow HSL mode (same as Chrysalis)
            const hue = ((seg / segmentCount) * 360 + ring * 15) % 360; // Spiral color pattern
            const saturation = 0.8;
            const lightness = 0.5 + bassAvg * 0.2; // Audio reactive brightness
            
            // Convert HSL to RGB
            const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
            const x_val = c * (1 - Math.abs(((hue / 60) % 2) - 1));
            const m = lightness - c / 2;
            
            let r1, g1, b1;
            if (hue < 60) { r1 = c; g1 = x_val; b1 = 0; }
            else if (hue < 120) { r1 = x_val; g1 = c; b1 = 0; }
            else if (hue < 180) { r1 = 0; g1 = c; b1 = x_val; }
            else if (hue < 240) { r1 = 0; g1 = x_val; b1 = c; }
            else if (hue < 300) { r1 = x_val; g1 = 0; b1 = c; }
            else { r1 = c; g1 = 0; b1 = x_val; }
            
            r = r1 + m;
            g = g1 + m;
            b = b1 + m;
          } else {
            // Original album color mode
            const colorBlend = ringPercent;
            const warmIntensity = bassAvg * (1 - colorBlend);
            const coolIntensity = highAvg * colorBlend;
            
            r = dominantRGB.r * (0.5 + warmIntensity) + accentRGB.r * coolIntensity;
            g = dominantRGB.g * (0.5 + warmIntensity) + accentRGB.g * coolIntensity;
            b = dominantRGB.b * (0.5 + warmIntensity) + accentRGB.b * coolIntensity;
          }
          
          colorAttr.setXYZ(vertexIndex, r, g, b);
          vertexIndex++;
        }
      }
      
      positions.needsUpdate = true;
      colorAttr.needsUpdate = true;
      
      // Continuous rotation
      group.rotation.z += whitecapRotationSpeedRef.current;
      
      renderer.render(scene, camera);
    };
    
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [visualizerType, showVisualizer, dominantColor, accentColor, currentMix]);

  // Terrain Visualizer (3D Audio Waves)
  useEffect(() => {
    if (!terrainCanvasRef.current || visualizerType !== 'terrain' || !showVisualizer) return;

    const container = terrainCanvasRef.current;
    container.style.cursor = 'grab';
    container.style.touchAction = 'none';
    
    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false, // Disabled for performance
      alpha: true,
      powerPreference: 'high-performance'
    });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    
    // Add lighting for depth perception
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 5);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0x4466ff, 0.3);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);
    
    // Camera control state - elevated angle looking down at terrain
    let cameraRotation = { x: 0.840, y: 1.102 };
    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };
    
    // Mouse/touch controls
    const onMouseDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      container.style.cursor = 'grabbing';
      const pos = 'touches' in e ? e.touches[0] : e;
      lastMousePos = { x: pos.clientX, y: pos.clientY };
    };
    
    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const pos = 'touches' in e ? e.touches[0] : e;
      const deltaX = pos.clientX - lastMousePos.x;
      const deltaY = pos.clientY - lastMousePos.y;
      
      cameraRotation.y += deltaX * 0.005;
      cameraRotation.x += deltaY * 0.005;
      cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));
      
      lastMousePos = { x: pos.clientX, y: pos.clientY };
    };
    
    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };
    
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('touchstart', onMouseDown);
    container.addEventListener('touchmove', onMouseMove);
    container.addEventListener('touchend', onMouseUp);
    
    const updateCameraPosition = () => {
      const distance = terrainCameraDistanceRef.current;
      const autoRotation = terrainAutoRotationRef.current;
      
      // Apply auto-rotation if not dragging
      if (!isDragging) {
        cameraRotation.y += autoRotation;
      }
      
      // Calculate camera position
      camera.position.x = distance * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);
      camera.position.y = distance * Math.sin(cameraRotation.x);
      camera.position.z = distance * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
      camera.lookAt(0, 0, -5);
    };
    
    updateCameraPosition();
    
    // Parse colors for material - helper function
    const parseRGB = (rgbString: string) => {
      const match = rgbString.match(/\d+/g);
      if (match && match.length >= 3) {
        return {
          r: parseInt(match[0]) / 255,
          g: parseInt(match[1]) / 255,
          b: parseInt(match[2]) / 255
        };
      }
      return { r: 1, g: 0.5, b: 0 };
    };
    
    // Terrain parameters (heavily reduced for performance)
    const segmentsX = 32; // Number of points per line (reduced from 64)
    const segmentsZ = 20; // Number of lines in history (reduced from 40)
    const width = 10;
    const depth = 20;
    
    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(width, depth, segmentsX - 1, segmentsZ - 1);
    geometry.rotateX(-Math.PI / 2); // Make it horizontal
    
    // Store original positions for wave decay
    const positions = geometry.attributes.position;
    const waveHistory: number[][] = [];
    
    // Initialize wave history with flat lines
    for (let i = 0; i < segmentsZ; i++) {
      waveHistory.push(new Array(segmentsX).fill(0));
    }
    
    // Create material with vertex colors (initialize with gray, will be updated in animate)
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      colors[i * 3] = 0.5;
      colors[i * 3 + 1] = 0.5;
      colors[i * 3 + 2] = 0.5;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create materials for different render modes with lighting support
    const meshMaterial = new THREE.MeshPhongMaterial({
      vertexColors: true,
      wireframe: terrainRenderModeRef.current === 'wireframe',
      transparent: true,
      opacity: terrainRenderModeRef.current === 'wireframe' ? 0.8 : 1.0,
      side: THREE.DoubleSide,
      shininess: 30,
      flatShading: false
    });
    
    const pointsMaterial = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.15,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    });
    
    // Create both mesh and points objects
    const terrain = new THREE.Mesh(geometry, meshMaterial);
    const terrainPoints = new THREE.Points(geometry, pointsMaterial);
    terrain.position.z = -depth / 2;
    terrainPoints.position.z = -depth / 2;
    
    // Add the appropriate object based on render mode
    const currentMode = terrainRenderModeRef.current;
    if (currentMode === 'grid') {
      scene.add(terrainPoints);
    } else {
      scene.add(terrain);
    }
    
    let lastUpdateTime = Date.now();
    let frameCount = 0;
    
    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      const currentTime = Date.now();
      const currentAudioData = audioDataRef.current;
      const currentAmplitude = terrainAmplitudeRef.current;
      const currentDecay = terrainDecayRef.current;
      const currentSpeed = terrainSpeedRef.current;
      
      // Get current colors from refs for dynamic updates
      const dominantRGB = parseRGB(dominantColorRef.current);
      const accentRGB = parseRGB(accentColorRef.current);
      
      // Update camera position every frame for smooth rotation
      updateCameraPosition();
      
      // Update wave history at specified interval
      const shouldUpdateWave = currentTime - lastUpdateTime >= 1000 / currentSpeed;
      if (shouldUpdateWave) {
        // Shift all waves back (toward camera)
        waveHistory.pop();
        
        // Downsample audio data to match segmentsX (32 points instead of 64)
        const newWave: number[] = [];
        const step = Math.floor(currentAudioData.length / segmentsX);
        for (let i = 0; i < segmentsX; i++) {
          const index = Math.floor(i * step);
          newWave.push((currentAudioData[index] || 0) / 255 * currentAmplitude);
        }
        waveHistory.unshift(newWave);
        
        lastUpdateTime = currentTime;
      }
      
      // Update geometry vertices and colors EVERY FRAME for fluid animation
      const colorAttr = geometry.attributes.color;
      
      // Calculate interpolation factor for smooth transitions between wave updates
      const timeSinceLastUpdate = currentTime - lastUpdateTime;
      const updateInterval = 1000 / currentSpeed;
      const interpolationFactor = Math.min(1, timeSinceLastUpdate / updateInterval);
      
      // Pre-calculate decay factors
      const decayFactors: number[] = [];
      for (let z = 0; z < segmentsZ; z++) {
        decayFactors[z] = Math.pow(currentDecay, z);
      }
      
      // Also get current live audio data for front wave interpolation
      const liveWave: number[] = [];
      const step = Math.floor(currentAudioData.length / segmentsX);
      for (let i = 0; i < segmentsX; i++) {
        const index = Math.floor(i * step);
        liveWave.push((currentAudioData[index] || 0) / 255 * currentAmplitude);
      }
      
      for (let z = 0; z < segmentsZ; z++) {
        const decayFactor = decayFactors[z];
        // Depth gradient: 0 at front (closest), 1 at back (farthest)
        const depthGradient = z / (segmentsZ - 1);
        
        for (let x = 0; x < segmentsX; x++) {
          const index = z * segmentsX + x;
          
          // Get wave height from history
          let waveHeight = (waveHistory[z][x] || 0) * decayFactor;
          
          // Interpolate the front wave with live audio data for ultra-smooth animation
          if (z === 0) {
            const targetHeight = liveWave[x] || 0;
            waveHeight = waveHeight + (targetHeight - waveHeight) * interpolationFactor;
          }
          
          // Update Y position
          positions.setY(index, waveHeight);
          
          // Create multi-dimensional gradient mapping
          // Height intensity: higher waves get more accent color
          const heightIntensity = Math.min(1, Math.max(0, waveHeight / currentAmplitude));
          
          // Create dramatic color gradient for visibility
          // Front (z=0) uses accent color, back (z=max) uses dominant color
          let r, g, b;
          
          if (heightIntensity > 0.7) {
            // High peaks: bright accent color
            r = accentRGB.r * 1.5;
            g = accentRGB.g * 1.5;
            b = accentRGB.b * 1.5;
          } else {
            // Base color: blend between accent (front) and dominant (back) based on depth
            r = accentRGB.r * (1 - depthGradient) + dominantRGB.r * depthGradient;
            g = accentRGB.g * (1 - depthGradient) + dominantRGB.g * depthGradient;
            b = accentRGB.b * (1 - depthGradient) + dominantRGB.b * depthGradient;
            
            // Add height-based brightening
            const brighten = heightIntensity * 0.4;
            r += brighten;
            g += brighten;
            b += brighten;
          }
          
          // Clamp values
          r = Math.min(1, Math.max(0, r));
          g = Math.min(1, Math.max(0, g));
          b = Math.min(1, Math.max(0, b));
          
          colorAttr.setXYZ(index, r, g, b);
        }
      }
      
      positions.needsUpdate = true;
      colorAttr.needsUpdate = true;
      geometry.computeVertexNormals(); // Compute normals for proper lighting
      
      // Handle render mode changes
      const currentMode = terrainRenderModeRef.current;
      const isGridMode = currentMode === 'grid';
      const shouldShowPoints = isGridMode && !scene.children.includes(terrainPoints);
      const shouldShowMesh = !isGridMode && !scene.children.includes(terrain);
      
      if (shouldShowPoints) {
        scene.remove(terrain);
        scene.add(terrainPoints);
      } else if (shouldShowMesh) {
        scene.remove(terrainPoints);
        scene.add(terrain);
      }
      
      // Update mesh material if wireframe/surface mode changed
      if (!isGridMode) {
        const shouldBeWireframe = currentMode === 'wireframe';
        if (meshMaterial.wireframe !== shouldBeWireframe) {
          meshMaterial.wireframe = shouldBeWireframe;
          meshMaterial.opacity = shouldBeWireframe ? 0.8 : 1.0;
          meshMaterial.needsUpdate = true;
        }
      }
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      geometry.dispose();
      meshMaterial.dispose();
      pointsMaterial.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [visualizerType, showVisualizer, dominantColor, accentColor, currentMix]);

  // Chrysalis Visualizer (Spherical Frequency Contours)
  useEffect(() => {
    if (!chrysalisCanvasRef.current || visualizerType !== 'chrysalis' || !showVisualizer) return;

    const container = chrysalisCanvasRef.current;
    container.style.cursor = 'grab';
    container.style.touchAction = 'none';
    
    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    container.appendChild(renderer.domElement);
    
    // Camera position
    camera.position.z = 12;
    
    // Group to hold all contour loops
    const chrysalisGroup = new THREE.Group();
    scene.add(chrysalisGroup);
    
    // Mouse/touch control state
    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };
    let userRotation = { x: 0, y: 0 };
    
    // Mouse/touch controls
    const onMouseDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      container.style.cursor = 'grabbing';
      const pos = 'touches' in e ? e.touches[0] : e;
      lastMousePos = { x: pos.clientX, y: pos.clientY };
    };
    
    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const pos = 'touches' in e ? e.touches[0] : e;
      const deltaX = pos.clientX - lastMousePos.x;
      const deltaY = pos.clientY - lastMousePos.y;
      
      userRotation.y += deltaX * 0.005;
      userRotation.x += deltaY * 0.005;
      
      lastMousePos = { x: pos.clientX, y: pos.clientY };
    };
    
    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };
    
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('touchstart', onMouseDown);
    container.addEventListener('touchmove', onMouseMove);
    container.addEventListener('touchend', onMouseUp);
    
    // Handle window resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Camera view switching function
    (window as any).chrysalisCameraView = (axis: 'x' | 'y' | 'z') => {
      switch (axis) {
        case 'x':
          // View from X axis (side view)
          userRotation.x = 0;
          userRotation.y = Math.PI / 2;
          break;
        case 'y':
          // View from Y axis (top view)
          userRotation.x = -Math.PI / 2;
          userRotation.y = 0;
          break;
        case 'z':
          // View from Z axis (front view)
          userRotation.x = 0;
          userRotation.y = 0;
          break;
      }
    };
    
    // Simple noise function (Perlin-like)
    const noise = (x: number, y: number, seed: number): number => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
      return n - Math.floor(n);
    };
    
    // Get HSL color based on hue
    const getColorFromHue = (hue: number): THREE.Color => {
      return new THREE.Color().setHSL(hue / 360, 0.8, 0.6);
    };
    
    // Create a single vertical circle loop (like a standing bread slice)
    const createContourLoop = (
      sliceAngle: number,
      distanceFromCenter: number,
      loopRadius: number,
      vertices: number,
      color: THREE.Color,
      noiseScale: number,
      seed: number
    ): THREE.LineLoop => {
      const points: THREE.Vector3[] = [];
      
      // Generate vertices in a vertical circle
      for (let i = 0; i < vertices; i++) {
        const t = (i / vertices) * Math.PI * 2; // 0 to 2π around the circle
        
        // Vertical circle in YZ plane, then rotate to slice angle
        const localY = loopRadius * Math.sin(t);
        const localZ = loopRadius * Math.cos(t);
        
        // Add Perlin-like noise to radius for organic irregularity
        const noiseValue = noise(
          t * 2, 
          sliceAngle * 3, 
          seed
        );
        const radiusVariation = 1 + (noiseValue - 0.5) * noiseScale;
        
        // Apply noise to the local Z (depth) coordinate
        const noisyZ = localZ * radiusVariation;
        
        // Position at distance from center, rotated by slice angle
        const x = (distanceFromCenter + noisyZ) * Math.cos(sliceAngle);
        const z = (distanceFromCenter + noisyZ) * Math.sin(sliceAngle);
        const y = localY;
        
        points.push(new THREE.Vector3(x, y, z));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.7,
        linewidth: 2
      });
      
      const loop = new THREE.LineLoop(geometry, material);
      return loop;
    };
    
    // Store loops for animation updates
    const loops: { 
      loop: THREE.LineLoop; 
      baseY: number; 
      baseRadius: number; 
      freqIndex: number;
      vertices: number;
      seed: number;
    }[] = [];
    
    // Initialize loops
    const initializeLoops = () => {
      const numLoops = chrysalisSlicesRef.current;
      const loopRadius = 5; // Radius of each vertical circle
      const maxDistance = 4; // Maximum distance from center
      const verticesPerLoop = 80; // 50-100 vertices for smoothness
      
      // Clear existing loops
      loops.forEach(loopData => {
        chrysalisGroup.remove(loopData.loop);
        loopData.loop.geometry.dispose();
        (loopData.loop.material as THREE.Material).dispose();
      });
      loops.length = 0;
      
      for (let i = 0; i < numLoops; i++) {
        // Slice angle around the center (360° distribution)
        const sliceAngle = (i / numLoops) * Math.PI * 2;
        
        // Distance from center - using spherical profile
        // Outer slices closer to center, creates sphere-like arrangement
        const ratio = i / (numLoops - 1);
        const distanceFromCenter = maxDistance * Math.sin(ratio * Math.PI);
        
        // Map frequency: distribute frequencies
        const freqIndex = i;
        
        // Color: cycle through hue spectrum (0-360 degrees)
        const hue = (i / numLoops) * 360;
        const color = getColorFromHue(hue);
        
        const loop = createContourLoop(
          sliceAngle,
          distanceFromCenter,
          loopRadius,
          verticesPerLoop,
          color,
          chrysalisWavinessRef.current, // Use waviness as noise scale
          i * 100 // Unique seed for each loop
        );
        
        chrysalisGroup.add(loop);
        loops.push({ 
          loop, 
          baseY: 0,
          baseRadius: loopRadius,
          freqIndex,
          vertices: verticesPerLoop,
          seed: i * 100
        });
      }
    };
    
    initializeLoops();
    
    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      const currentAudioData = audioDataRef.current;
      const noiseScale = chrysalisWavinessRef.current;
      const rotationSpeed = chrysalisRotationSpeedRef.current;
      const pulseIntensity = chrysalisPulseIntensityRef.current;
      const currentSlices = chrysalisSlicesRef.current;
      
      // Reinitialize loops if the number changed
      if (loops.length !== currentSlices) {
        initializeLoops();
      }
      
      // Apply user rotation and auto-rotation
      if (!isDragging && rotationSpeed > 0) {
        userRotation.y += rotationSpeed;
      }
      
      chrysalisGroup.rotation.x = userRotation.x;
      chrysalisGroup.rotation.y = userRotation.y;
      
      // Update each loop based on its frequency band
      loops.forEach((loopData, index) => {
        // Get frequency value for this loop
        const freqBandIndex = Math.floor((loopData.freqIndex / loops.length) * currentAudioData.length);
        const freqIndex = Math.min(freqBandIndex, currentAudioData.length - 1);
        const freqValue = (currentAudioData[freqIndex] || 0) / 255;
        
        // Calculate slice angle for this loop
        const sliceAngle = (index / loops.length) * Math.PI * 2;
        
        // Distance from center with spherical profile
        const ratio = index / (loops.length - 1);
        const maxDistance = 4;
        const distanceFromCenter = maxDistance * Math.sin(ratio * Math.PI);
        
        // Modulate loop radius based on frequency amplitude
        const animatedRadius = loopData.baseRadius * (1 + freqValue * pulseIntensity);
        
        // Regenerate loop vertices with animated radius
        const points: THREE.Vector3[] = [];
        const time = Date.now() * 0.001;
        
        for (let i = 0; i < loopData.vertices; i++) {
          const t = (i / loopData.vertices) * Math.PI * 2;
          
          // Vertical circle
          const localY = animatedRadius * Math.sin(t);
          const localZ = animatedRadius * Math.cos(t);
          
          // Animated noise
          const noiseValue = noise(
            t * 2 + time * 0.2, 
            sliceAngle * 3, 
            loopData.seed
          );
          const radiusVariation = 1 + (noiseValue - 0.5) * noiseScale;
          const noisyZ = localZ * radiusVariation;
          
          // Position at distance from center, rotated by slice angle
          const x = (distanceFromCenter + noisyZ) * Math.cos(sliceAngle);
          const z = (distanceFromCenter + noisyZ) * Math.sin(sliceAngle);
          const y = localY;
          
          points.push(new THREE.Vector3(x, y, z));
        }
        
        // Update geometry
        loopData.loop.geometry.setFromPoints(points);
        
        // Update material opacity based on frequency (more active = brighter)
        const material = loopData.loop.material as THREE.LineBasicMaterial;
        material.opacity = 0.5 + freqValue * 0.4;
      });
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      loops.forEach(loopData => {
        loopData.loop.geometry.dispose();
        (loopData.loop.material as THREE.Material).dispose();
      });
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseUp);
      container.removeEventListener('touchstart', onMouseDown);
      container.removeEventListener('touchmove', onMouseMove);
      container.removeEventListener('touchend', onMouseUp);
      window.removeEventListener('resize', handleResize);
      delete (window as any).chrysalisCameraView;
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [visualizerType, showVisualizer, currentMix]);

  // Sonic Galaxy Visualizer
  useEffect(() => {
    if (!sonicGalaxyCanvasRef.current || visualizerType !== 'sonicGalaxy' || !showVisualizer) return;

    const container = sonicGalaxyCanvasRef.current;
    
    // Create visualizer instance
    const visualizer = new SonicGalaxyVisualizer(
      container,
      {
        particleCount: galaxyParticleCount,
        attractorCount: galaxyAttractorCount,
        bassGravity: galaxyBassGravity,
        midSpin: galaxyMidSpin,
        maxSpeed: galaxyMaxSpeed,
        velocityDamping: galaxyDamping,
        particleSize: galaxyParticleSize,
        cameraSpeed: galaxyCameraSpeed,
        boundSize: galaxyBoundSize,
        beatSensitivity: galaxyBeatSensitivity
      },
      {
        dominant: dominantColorRef.current,
        accent: accentColorRef.current
      }
    );
    
    // Start the visualizer (init + animation loop)
    visualizer.start();
    
    // Store visualizer for cleanup
    (window as any).sonicGalaxyVisualizer = visualizer;
    
    // Audio data update loop (separate from render loop)
    let frameId = 0;
    const updateAudio = () => {
      frameId = requestAnimationFrame(updateAudio);
      
      // Get audio data from existing refs
      const currentAudioData = audioDataRef.current;
      
      // Calculate frequency band averages from audio data
      const bassAvg = currentAudioData.slice(0, 10).reduce((a, b) => a + b, 0) / 10 * 2.55;
      const midAvg = currentAudioData.slice(10, 30).reduce((a, b) => a + b, 0) / 20 * 2.55;
      const highAvg = currentAudioData.slice(30, 64).reduce((a, b) => a + b, 0) / 34 * 2.55;
      
      // Feed audio data to visualizer
      visualizer.setAudioData({
        frequencyData: new Uint8Array(64),
        audioData: currentAudioData,
        bassAvg,
        midAvg,
        highAvg,
        averageFrequency: 0,
        normalizedFrequency: 0,
        isPlaying
      });
    };
    
    updateAudio();
    
    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      visualizer.destroy();
      delete (window as any).sonicGalaxyVisualizer;
    };
  }, [visualizerType, showVisualizer, currentMix, galaxyParticleCount, galaxyAttractorCount,
      galaxyBassGravity, galaxyMidSpin, galaxyMaxSpeed, galaxyDamping, galaxyParticleSize,
      galaxyCameraSpeed, galaxyBoundSize, galaxyBeatSensitivity, isPlaying]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      
      // Track pause event
      if (typeof window !== 'undefined' && window.clarity && currentMix) {
        window.clarity('event', 'song_paused', currentMix.title);
      }
    } else {
      try {
        // Resume audio context if suspended
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        await audio.play();
        setIsPlaying(true);
        
        // Track play event
        if (typeof window !== 'undefined' && window.clarity && currentMix) {
          window.clarity('event', 'song_played', currentMix.title);
        }
      } catch (error) {
        console.log("Play failed:", error);
      }
    }
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
    
    // Track skip backward
    if (typeof window !== 'undefined' && window.clarity && currentMix) {
      window.clarity('event', 'skip_backward', currentMix.title);
    }
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
    
    // Track skip forward
    if (typeof window !== 'undefined' && window.clarity && currentMix) {
      window.clarity('event', 'skip_forward', currentMix.title);
    }
  };

  const playNext = () => {
    if (currentIndex < filteredMixes.length - 1) {
      handleMixSelect(filteredMixes[currentIndex + 1], true);
    }
  };

  const playPrevious = () => {
    const audio = audioRef.current;
    // If more than 3 seconds into the song, restart it; otherwise go to previous
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
    } else if (currentIndex > 0) {
      handleMixSelect(filteredMixes[currentIndex - 1], true);
    }
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

  const handleMixSelect = (mix: Mix, preserveView: boolean = false) => {
    setCurrentMix(mix);
    // Reset progress when selecting new mix
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    // Extract colors from album art
    extractColors(mix.cover);
    
    // Always show visualizer and detail view when selecting a new track
    setShowDetail(true);
    setShowVisualizer(true);
    
    // Track song selection in Clarity
    if (typeof window !== 'undefined' && window.clarity) {
      window.clarity('event', 'song_selected', mix.title);
    }
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
    
    // Track progress bar scrubbing
    if (typeof window !== 'undefined' && window.clarity && currentMix) {
      window.clarity('event', 'progress_scrubbed', currentMix.title);
    }
  };

  // Dynamically load Google Font
  useEffect(() => {
    const fontFamily = currentFont.replace(/ /g, '+');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, [currentFont]);

  // Debug mode keyboard shortcut (Cmd/Ctrl + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative" style={{ fontFamily: currentFont }}>
      {/* Background Album Cover */}
      {currentMix && (
        <div 
          className="fixed inset-0 z-0 transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${currentMix.cover})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Dark overlay with blur */}
          <div className="absolute inset-0 bg-black/75 backdrop-blur-3xl"></div>
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10 p-4">
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" onClick={() => setShowDetail(false)}>
          <img src="https://media.parttimechiller.com/logo3.png" alt="Part Time Chiller" className="h-10 sm:h-12" />
          <span className="text-base sm:text-xl font-bold hidden sm:inline">Part Time Chiller</span>
          {showDebug && (
            <select
              value={currentFont}
              onChange={(e) => setCurrentFont(e.target.value)}
              className="ml-2 px-2 py-1 text-xs rounded border border-neutral-700 bg-black/50 backdrop-blur hover:border-white transition-colors cursor-pointer focus:outline-none focus:border-white"
              title="Select Font (Debug Mode)"
            >
              {fonts.map(font => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center justify-center flex-1">
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
        </div>
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

      <div className="space-y-2 pb-28">
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
                <h2 className="text-md font-medium leading-tight">{mix.title}</h2>
                <p className="text-xs text-neutral-400">{mix.description} • {mix.duration}</p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                mix.type === 'mix' 
                  ? 'border-purple-500/40 text-purple-400/90' 
                  : 'border-blue-500/40 text-blue-400/90'
              }`}>
                {mix.type}
              </span>
            </div>
          </div>
        ))}
      </div>

      {currentMix && (
        <>
          {/* Waveform Visualizer - Only show when detail view is active */}
          {showDetail && (
            <div className="fixed bottom-20 left-0 right-0 h-24 pointer-events-none">
              {/* Gradient background for better visibility */}
              <div 
                className="absolute inset-0" 
                style={{
                  background: `linear-gradient(to top, ${dominantColor}15, transparent)`,
                }}
              />
              <div className="relative h-full flex items-end justify-center gap-1.5 px-4">
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
            </div>
          )}

          {/* Player Bar */}
          <div 
            className="fixed bottom-0 left-0 right-0 px-4 py-3 flex items-center space-x-4 backdrop-blur-xl transition-all duration-500"
            style={{ 
              background: `linear-gradient(to right, ${dominantColor}25, ${accentColor}25)`,
              borderColor: `${dominantColor}30`
            }}
          >
          <button
            className="p-0 m-0 border-none bg-transparent"
            onClick={() => setShowDetail(true)}
            aria-label="Open detailed player"
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
                const sibling = (e.currentTarget as HTMLElement).nextElementSibling;
                sibling?.classList.remove('hidden');
              }}
            />
          </button>
          <div className="w-12 h-12 rounded bg-neutral-700 flex items-center justify-center hidden">
            <span className="text-xs text-neutral-400">🎵</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate overflow-hidden text-ellipsis whitespace-nowrap">{currentMix.title}</div>
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
              onClick={playPrevious}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`
              }}
              aria-label="Previous track"
              disabled={currentIndex === 0}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`,
              }}
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            <button
              onClick={playNext}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`
              }}
              aria-label="Next track"
              disabled={currentIndex === filteredMixes.length - 1}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
          </div>
          <audio ref={audioRef} src={currentMix.audio} preload="metadata" crossOrigin="anonymous" />
        </div>
        </>
      )}
      {currentMix && showDetail && (
        <div className="fixed inset-0 z-50 flex flex-col">
          {/* Background with gradient from album art */}
          <div 
            className="absolute inset-0 transition-opacity duration-1000"
            style={{
              backgroundImage: `url(${currentMix.cover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-3xl"></div>
          </div>
          
          <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowDetail(false)}>
              <img src="/ptc-player/logo3.png" alt="PTC" className="h-10 w-10" />
              <span className="text-lg font-bold">Part Time Chiller</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVisualizer(!showVisualizer)}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                title={showVisualizer ? 'Show Album Art' : 'Show Visualizer'}
              >
                {showVisualizer ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                )}
              </button>
              {showVisualizer && (
                <>
                  <button
                    onClick={() => setVisualizerType(v => v === 'bars' ? 'orb' : v === 'orb' ? 'web' : v === 'web' ? 'terrain' : v === 'terrain' ? 'chrysalis' : v === 'chrysalis' ? 'sonicGalaxy' : 'bars')}
                    className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                    title={`Current: ${visualizerType === 'bars' ? 'Bars' : visualizerType === 'orb' ? 'Orb' : visualizerType === 'web' ? 'Web' : visualizerType === 'terrain' ? 'Terrain' : visualizerType === 'chrysalis' ? 'Chrysalis' : 'Sonic Galaxy'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      // Randomize visualizer type
                      const types: VisualizerType[] = ['bars', 'orb', 'web', 'terrain', 'chrysalis', 'sonicGalaxy'];
                      const randomType = types[Math.floor(Math.random() * types.length)];
                      setVisualizerType(randomType);
                      
                      // Randomize settings based on type
                      if (randomType === 'bars') {
                        setBarsScale(Math.random() * 2 + 0.5);
                        setBarsSmoothness(Math.random() * 0.5 + 0.05);
                        setBarsWidth(Math.floor(Math.random() * 11) + 2);
                      } else if (randomType === 'web') {
                        setWhitecapBassPulse(Math.random() * 2 + 1);
                        setWhitecapMidExtension(Math.random() * 1.5 + 0.5);
                        setWhitecapHighShimmer(Math.random() * 1.5 + 0.5);
                        setWhitecapRotationSpeed(Math.random() * 0.015 + 0.005);
                      } else if (randomType === 'terrain') {
                        setTerrainAmplitude(Math.random() * 4 + 1);
                        setTerrainSpeed(Math.random() * 19 + 1);
                        setTerrainDecay(Math.random() * 0.14 + 0.85);
                        setTerrainCameraDistance(Math.random() * 10 + 5);
                        setTerrainAutoRotation(Math.random() * 0.01);
                        const modes: Array<'grid' | 'wireframe' | 'surface'> = ['grid', 'wireframe', 'surface'];
                        setTerrainRenderMode(modes[Math.floor(Math.random() * modes.length)]);
                      } else if (randomType === 'chrysalis') {
                        setChrysalisSlices(Math.floor(Math.random() * 7) * 8 + 16);
                        setChrysalisWaviness(Math.random());
                        setChrysalisRotationSpeed(Math.random() * 0.01);
                        setChrysalisPulseIntensity(Math.random() * 1.5);
                        setChrysalisLineThickness(Math.random() * 4.5 + 0.5);
                      }
                    }}
                    className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                    title="Randomize Visualizer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowControls(!showControls)}
                    className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                    title={showControls ? 'Hide Controls' : 'Show Controls'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Control Panel */}
          {showControls && showVisualizer && (
            <div className="absolute top-20 right-4 w-72 p-4 rounded-lg backdrop-blur-xl bg-black/60 border border-white/10 z-20 space-y-3">
              <div className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {visualizerType === 'bars' ? 'Bars' : visualizerType === 'orb' ? 'Orb' : visualizerType === 'web' ? 'Web' : visualizerType === 'terrain' ? 'Terrain' : visualizerType === 'chrysalis' ? 'Chrysalis' : 'Sonic Galaxy'} Controls
              </div>
              
              {/* Bars Controls */}
              {visualizerType === 'bars' && (
                <>
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Bar Height</span>
                      <span className="font-mono">{barsScale.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={barsScale}
                      onChange={(e) => setBarsScale(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Smoothness</span>
                      <span className="font-mono">{barsSmoothness.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={barsSmoothness}
                      onChange={(e) => setBarsSmoothness(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Bar Width</span>
                      <span className="font-mono">{barsWidth}px</span>
                    </label>
                    <input
                      type="range"
                      min="4"
                      max="60"
                      step="2"
                      value={barsWidth}
                      onChange={(e) => setBarsWidth(parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center justify-between text-xs text-white/70">
                      <span>Rainbow Colors</span>
                      <button
                        onClick={() => setBarsColorMode(!barsColorMode)}
                        className={`px-3 py-1 rounded transition-all duration-300 text-xs font-medium ${
                          barsColorMode 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                            : 'bg-white/10 hover:bg-white/20 text-white/70'
                        }`}
                      >
                        {barsColorMode ? 'ON' : 'OFF'}
                      </button>
                    </label>
                  </div>
                  
                  <button
                    onClick={() => {
                      setBarsScale(1.0);
                      setBarsSmoothness(1.0);
                      setBarsWidth(4);
                      setBarsColorMode(false);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                </>
              )}
              

              
              {/* Orb Controls */}
              {visualizerType === 'orb' && (
                <>
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Audio Intensity</span>
                      <span className="font-mono">{freqMultiplier.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={freqMultiplier}
                      onChange={(e) => setFreqMultiplier(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Surface Detail</span>
                      <span className="font-mono">{noiseMultiplier.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={noiseMultiplier}
                      onChange={(e) => setNoiseMultiplier(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Animation Speed</span>
                      <span className="font-mono">{timeSpeed.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={timeSpeed}
                      onChange={(e) => setTimeSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Rotation Speed</span>
                      <span className="font-mono">{(autoRotationSpeed * 1000).toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.01"
                      step="0.0005"
                      value={autoRotationSpeed}
                      onChange={(e) => setAutoRotationSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Orb Radius</span>
                      <span className="font-mono">{orbRadius.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      value={orbRadius}
                      onChange={(e) => setOrbRadius(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <button
                    onClick={() => setOrbWireframe(!orbWireframe)}
                    className={`w-full px-3 py-2 rounded text-sm font-medium transition-all ${
                      orbWireframe
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-white'
                        : 'text-white hover:bg-white/10'
                    }`}
                    style={!orbWireframe ? {
                      background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`,
                    } : undefined}
                  >
                    {orbWireframe ? 'Wireframe Mode' : 'Solid Mode'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setFreqMultiplier(3.6);
                      setNoiseMultiplier(0.55);
                      setTimeSpeed(2.0);
                      setAutoRotationSpeed(0.003);
                      setOrbRadius(2.0);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                </>
              )}
               
              {/* Web Controls */}
              {visualizerType === 'web' && (
                <>
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Bass Pulse</span>
                      <span className="font-mono">{whitecapBassPulse.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={whitecapBassPulse}
                      onChange={(e) => setWhitecapBassPulse(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Mid Extension</span>
                      <span className="font-mono">{whitecapMidExtension.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={whitecapMidExtension}
                      onChange={(e) => setWhitecapMidExtension(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>High Shimmer</span>
                      <span className="font-mono">{whitecapHighShimmer.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.025"
                      value={whitecapHighShimmer}
                      onChange={(e) => setWhitecapHighShimmer(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Rotation Speed</span>
                      <span className="font-mono">{(whitecapRotationSpeed * 1000).toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.01"
                      step="0.0005"
                      value={whitecapRotationSpeed}
                      onChange={(e) => setWhitecapRotationSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center justify-between text-xs text-white/70">
                      <span>Rainbow Colors</span>
                      <button
                        onClick={() => setWhitecapColorMode(!whitecapColorMode)}
                        className={`px-3 py-1 rounded transition-all duration-300 text-xs font-medium ${
                          whitecapColorMode 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                            : 'bg-white/10 hover:bg-white/20 text-white/70'
                        }`}
                      >
                        {whitecapColorMode ? 'ON' : 'OFF'}
                      </button>
                    </label>
                  </div>
                  
                  <button
                    onClick={() => {
                      setWhitecapBassPulse(0.4);
                      setWhitecapMidExtension(0.5);
                      setWhitecapHighShimmer(0.1);
                      setWhitecapRotationSpeed(0.002);
                      setWhitecapColorMode(false);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                </>
              )}
              
              {/* Terrain Controls */}
              {visualizerType === 'terrain' && (
                <>
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Wave Amplitude</span>
                      <span className="font-mono">{terrainAmplitude.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={terrainAmplitude}
                      onChange={(e) => setTerrainAmplitude(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Wave Speed</span>
                      <span className="font-mono">{terrainSpeed.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="20"
                      step="0.5"
                      value={terrainSpeed}
                      onChange={(e) => setTerrainSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Wave Decay</span>
                      <span className="font-mono">{terrainDecay.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.85"
                      max="0.99"
                      step="0.01"
                      value={terrainDecay}
                      onChange={(e) => setTerrainDecay(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Camera Distance</span>
                      <span className="font-mono">{terrainCameraDistance.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="15"
                      step="0.5"
                      value={terrainCameraDistance}
                      onChange={(e) => setTerrainCameraDistance(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Auto Rotation</span>
                      <span className="font-mono">{terrainAutoRotation.toFixed(4)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.01"
                      step="0.0005"
                      value={terrainAutoRotation}
                      onChange={(e) => setTerrainAutoRotation(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center justify-between text-xs text-white/70">
                      <span>Render Mode</span>
                      <button
                        onClick={() => {
                          const modes: Array<'grid' | 'wireframe' | 'surface'> = ['grid', 'wireframe', 'surface'];
                          const currentIndex = modes.indexOf(terrainRenderMode);
                          const nextIndex = (currentIndex + 1) % modes.length;
                          setTerrainRenderMode(modes[nextIndex]);
                        }}
                        className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-all duration-300 text-xs font-medium capitalize"
                      >
                        {terrainRenderMode}
                      </button>
                    </label>
                  </div>
                  
                  <button
                    onClick={() => {
                      setTerrainAmplitude(3.9);
                      setTerrainSpeed(17.5);
                      setTerrainDecay(0.95);
                      setTerrainCameraDistance(9.5);
                      setTerrainAutoRotation(0.0005);
                      setTerrainRenderMode('wireframe');
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                </>
              )}
              
              {/* Chrysalis Controls */}
              {visualizerType === 'chrysalis' && (
                <>
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Contour Loops</span>
                      <span className="font-mono">{chrysalisSlices}</span>
                    </label>
                    <input
                      type="range"
                      min="16"
                      max="64"
                      step="8"
                      value={chrysalisSlices}
                      onChange={(e) => setChrysalisSlices(parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Noise Scale</span>
                      <span className="font-mono">{chrysalisWaviness.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={chrysalisWaviness}
                      onChange={(e) => setChrysalisWaviness(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Rotation Speed</span>
                      <span className="font-mono">{chrysalisRotationSpeed.toFixed(4)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.01"
                      step="0.0005"
                      value={chrysalisRotationSpeed}
                      onChange={(e) => setChrysalisRotationSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Pulse Intensity</span>
                      <span className="font-mono">{chrysalisPulseIntensity.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.1"
                      value={chrysalisPulseIntensity}
                      onChange={(e) => setChrysalisPulseIntensity(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Line Thickness</span>
                      <span className="font-mono">{chrysalisLineThickness.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={chrysalisLineThickness}
                      onChange={(e) => setChrysalisLineThickness(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center justify-between text-xs text-white/70 mb-2">
                      <span>Camera View</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined' && (window as any).chrysalisCameraView) {
                            (window as any).chrysalisCameraView('x');
                          }
                        }}
                        className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                      >
                        X
                      </button>
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined' && (window as any).chrysalisCameraView) {
                            (window as any).chrysalisCameraView('y');
                          }
                        }}
                        className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                      >
                        Y
                      </button>
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined' && (window as any).chrysalisCameraView) {
                            (window as any).chrysalisCameraView('z');
                          }
                        }}
                        className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                      >
                        Z
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setChrysalisSlices(56);
                      setChrysalisWaviness(0.05);
                      setChrysalisRotationSpeed(0.003);
                      setChrysalisPulseIntensity(0.7);
                      setChrysalisLissajousA(3);
                      setChrysalisLissajousB(4);
                      setChrysalisLineThickness(2);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                </>
              )}
              
              {/* Sonic Galaxy Controls */}
              {visualizerType === 'sonicGalaxy' && (
                <>
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Particle Count</span>
                      <span className="font-mono">{galaxyParticleCount.toLocaleString()}</span>
                    </label>
                    <input
                      type="range"
                      min="10000"
                      max="100000"
                      step="10000"
                      value={galaxyParticleCount}
                      onChange={(e) => setGalaxyParticleCount(parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Attractors</span>
                      <span className="font-mono">{galaxyAttractorCount}</span>
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="6"
                      step="1"
                      value={galaxyAttractorCount}
                      onChange={(e) => setGalaxyAttractorCount(parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Bass Gravity</span>
                      <span className="font-mono">{galaxyBassGravity.toFixed(1)}x</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={galaxyBassGravity}
                      onChange={(e) => setGalaxyBassGravity(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Mid Spin</span>
                      <span className="font-mono">{galaxyMidSpin.toFixed(1)}x</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={galaxyMidSpin}
                      onChange={(e) => setGalaxyMidSpin(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Max Speed</span>
                      <span className="font-mono">{galaxyMaxSpeed}</span>
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      step="0.5"
                      value={galaxyMaxSpeed}
                      onChange={(e) => setGalaxyMaxSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Damping</span>
                      <span className="font-mono">{galaxyDamping.toFixed(3)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.2"
                      step="0.01"
                      value={galaxyDamping}
                      onChange={(e) => setGalaxyDamping(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Particle Size</span>
                      <span className="font-mono">{galaxyParticleSize.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={galaxyParticleSize}
                      onChange={(e) => setGalaxyParticleSize(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Camera Speed</span>
                      <span className="font-mono">{galaxyCameraSpeed.toFixed(4)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.02"
                      step="0.001"
                      value={galaxyCameraSpeed}
                      onChange={(e) => setGalaxyCameraSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Bound Size</span>
                      <span className="font-mono">{galaxyBoundSize}</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="20"
                      step="1"
                      value={galaxyBoundSize}
                      onChange={(e) => setGalaxyBoundSize(parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Beat Sensitivity</span>
                      <span className="font-mono">{galaxyBeatSensitivity.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={galaxyBeatSensitivity}
                      onChange={(e) => setGalaxyBeatSensitivity(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <button
                    onClick={() => {
                      setGalaxyParticleCount(10000);
                      setGalaxyAttractorCount(3);
                      setGalaxyBassGravity(2.0);
                      setGalaxyMidSpin(2.0);
                      setGalaxyMaxSpeed(3);
                      setGalaxyDamping(0.05);
                      setGalaxyParticleSize(0.5);
                      setGalaxyCameraSpeed(0.004);
                      setGalaxyBoundSize(11);
                      setGalaxyBeatSensitivity(1.8);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                  
                  <button
                    onClick={() => setShowDebugPanel(!showDebugPanel)}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    {showDebugPanel ? '✕ Hide Debug Panel' : '⚙ Show Debug Panel'}
                  </button>
                </>
              )}
            </div>
          )}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 gap-6">
            {!showVisualizer ? (
              <img
                src={currentMix.cover}
                alt={currentMix.title}
                className="w-[80vw] max-w-md aspect-square object-cover rounded shadow-xl"
                style={{ boxShadow: `0 0 0 3px ${accentColor}40` }}
              />
            ) : visualizerType === 'bars' ? (
              <div 
                ref={barsContainerRef}
                className="w-full max-w-3xl aspect-square max-h-[60vh] flex items-end justify-between px-0"
                key={`bars-${barsColorMode}`}
              >
                {audioData.map((value, index) => {
                  const scale = Math.min(1.0, Math.max(0.02, (value / 255) * barsScale));
                  
                  // Calculate HSL color (same as Chrysalis)
                  let barColor;
                  if (barsColorMode) {
                    const hue = (index / audioData.length) * 360;
                    const saturation = 80;
                    const lightness = 60;
                    barColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                  } else {
                    barColor = `linear-gradient(to top, ${dominantColor}, ${accentColor})`;
                  }
                  
                  return (
                    <div
                      key={index}
                      className="h-full origin-bottom rounded-t-md"
                      style={{
                        width: `${barsWidth}px`,
                        maxWidth: `${barsWidth}px`,
                        minWidth: `${barsWidth}px`,
                        transform: `scaleY(${scale})`,
                        background: barColor,
                        opacity: isPlaying ? 0.95 : 0.5,
                        transition: `transform ${barsSmoothness * 100}ms ease-out`
                      }}
                    />
                  );
                })}
              </div>
            
            ) : visualizerType === 'orb' ? (
              <div 
                ref={threeCanvasRef}
                className="w-full max-w-3xl aspect-square max-h-[60vh] flex items-center justify-center cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
              />
            ) : visualizerType === 'web' ? (
              <div 
                ref={whitecapCanvasRef}
                className="w-full max-w-3xl aspect-square max-h-[60vh] flex items-center justify-center mx-auto"
              />
            ) : visualizerType === 'terrain' ? (
              <div 
                ref={terrainCanvasRef}
                className="w-full max-w-3xl aspect-square max-h-[60vh] flex items-center justify-center"
              />
            ) : visualizerType === 'chrysalis' ? (
              <div 
                ref={chrysalisCanvasRef}
                className="w-full max-w-3xl aspect-square max-h-[60vh] flex items-center justify-center"
              />
            ) : visualizerType === 'sonicGalaxy' ? (
              <div className="relative w-full max-w-3xl aspect-square max-h-[60vh]">
                <div 
                  ref={sonicGalaxyCanvasRef}
                  className="w-full h-full flex items-center justify-center"
                />
                {/* Debug Panel */}
                {showDebugPanel && (
                  <div className="absolute top-0 left-0 bg-black/80 backdrop-blur-sm p-3 rounded text-xs font-mono text-white/70 space-y-1 border border-white/10">
                  <div className="text-white/90 font-bold mb-2">Debug Values</div>
                  <div>Particle Count: <span className="text-white">{galaxyParticleCount}</span></div>
                  <div>Attractors: <span className="text-white">{galaxyAttractorCount}</span></div>
                  <div>Bass Gravity: <span className="text-white">{galaxyBassGravity.toFixed(1)}x</span></div>
                  <div>Mid Spin: <span className="text-white">{galaxyMidSpin.toFixed(1)}x</span></div>
                  <div>Max Speed: <span className="text-white">{galaxyMaxSpeed}</span></div>
                  <div>Damping: <span className="text-white">{galaxyDamping.toFixed(3)}</span></div>
                  <div>Particle Size: <span className="text-white">{galaxyParticleSize.toFixed(1)}</span></div>
                  <div>Camera Speed: <span className="text-white">{galaxyCameraSpeed.toFixed(4)}</span></div>
                  <div>Bound Size: <span className="text-white">{galaxyBoundSize}</span></div>
                  <div>Beat Sensitivity: <span className="text-white">{galaxyBeatSensitivity.toFixed(1)}</span></div>
                  <div className="pt-2 mt-2 border-t border-white/20">
                    <div>Bass Avg: <span className="text-white">{audioData.length > 0 ? Math.floor(audioData.slice(0, 8).reduce((a, b) => a + b, 0) / 8) : 0}</span></div>
                    <div>Mid Avg: <span className="text-white">{audioData.length > 0 ? Math.floor(audioData.slice(8, 32).reduce((a, b) => a + b, 0) / 24) : 0}</span></div>
                    <div>High Avg: <span className="text-white">{audioData.length > 0 ? Math.floor(audioData.slice(32).reduce((a, b) => a + b, 0) / (audioData.length - 32)) : 0}</span></div>
                  </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <div className="relative z-10 px-4 py-6 border-t border-neutral-800/50">
            <div className="w-full max-w-3xl mx-auto space-y-4">
              <div className="text-center text-xl font-semibold truncate">{currentMix.title}</div>
              <div 
                className="w-full h-2 bg-black/40 rounded-full overflow-hidden cursor-pointer"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(to right, ${dominantColor}, ${accentColor})`
                  }}
                />
              </div>
              <div className="flex justify-between items-center text-sm text-neutral-300">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setShowDetail(false)}
                  className="w-12 h-12 rounded-full flex items-center justify-center bg-neutral-800/80 hover:bg-neutral-700 text-white transition-colors backdrop-blur"
                  aria-label="Show playlist"
                  title="Show playlist"
                >
                  <img src="/ptc-player/playlist.svg" alt="Playlist" className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4">
                  <button
                    onClick={playPrevious}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`
                    }}
                    disabled={currentIndex === 0}
                    aria-label="Previous track"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                    </svg>
                  </button>
                  <button
                    onClick={togglePlay}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`,
                    }}
                  >
                    {isPlaying ? (
                      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                      </svg>
                    ) : (
                      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={playNext}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})`
                    }}
                    disabled={currentIndex === filteredMixes.length - 1}
                    aria-label="Next track"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                    </svg>
                  </button>
                </div>
                <a
                  href={currentMix?.audio}
                  download={currentMix?.title}
                  className="w-12 h-12 rounded-full flex items-center justify-center bg-neutral-800/80 hover:bg-neutral-700 text-white transition-colors backdrop-blur"
                  aria-label="Download track"
                  title="Download track"
                >
                  <img src="/ptc-player/download.svg" alt="Download" className="w-6 h-6" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
