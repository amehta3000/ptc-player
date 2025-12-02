import React, { useState, useRef, useEffect } from "react";
import { Mix, mixes } from "../data/mixes";
import * as THREE from 'three';

type FilterType = 'all' | 'mix' | 'track';
type VisualizerType = 'bars' | 'radial' | 'threejs' | 'whitecap';

// Declare Clarity type
declare global {
  interface Window {
    clarity?: (action: string, ...args: any[]) => void;
  }
}

export default function Mixes() {
  const [currentMix, setCurrentMix] = useState<Mix | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showDetail, setShowDetail] = useState<boolean>(true);
  const [showVisualizer, setShowVisualizer] = useState<boolean>(false);
  const [visualizerType, setVisualizerType] = useState<VisualizerType>('bars');
  
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
  const threeSceneRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; mesh: THREE.Mesh; originalPositions: Float32Array } | null>(null);
  const audioDataRef = useRef<number[]>(Array(32).fill(0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dominantColor, setDominantColor] = useState<string>('rgb(115, 115, 115)');
  const [accentColor, setAccentColor] = useState<string>('rgb(163, 163, 163)');
  const [audioData, setAudioData] = useState<number[]>(Array(32).fill(0));
  
  // Visualizer control parameters
  const [showControls, setShowControls] = useState<boolean>(false);
  
  // Three.js sphere controls
  const [freqMultiplier, setFreqMultiplier] = useState<number>(1.5);
  const [noiseMultiplier, setNoiseMultiplier] = useState<number>(0.3);
  const [timeSpeed, setTimeSpeed] = useState<number>(0.5);
  const [autoRotationSpeed, setAutoRotationSpeed] = useState<number>(0.002);
  
  // Bars visualizer controls
  const [barsScale, setBarsScale] = useState<number>(1.0);
  const [barsSmoothness, setBarsSmoothness] = useState<number>(0.8);
  
  // Radial visualizer controls
  const [radialIntensity, setRadialIntensity] = useState<number>(1.0);
  const [radialTimeSpeed, setRadialTimeSpeed] = useState<number>(0.5);
  
  // WhiteCap visualizer controls
  const [whitecapBassPulse, setWhitecapBassPulse] = useState<number>(0.4);
  const [whitecapMidExtension, setWhitecapMidExtension] = useState<number>(0.5);
  const [whitecapHighShimmer, setWhitecapHighShimmer] = useState<number>(0.1);
  const [whitecapRotationSpeed, setWhitecapRotationSpeed] = useState<number>(0.002);
  
  // Refs for real-time parameter access in animation loop
  const freqMultiplierRef = useRef<number>(1.5);
  const noiseMultiplierRef = useRef<number>(0.3);
  const timeSpeedRef = useRef<number>(0.5);
  const autoRotationSpeedRef = useRef<number>(0.002);
  const barsScaleRef = useRef<number>(1.0);
  const barsSmoothnessRef = useRef<number>(0.8);
  const radialIntensityRef = useRef<number>(1.0);
  const radialTimeSpeedRef = useRef<number>(0.5);
  const whitecapBassPulseRef = useRef<number>(0.4);
  const whitecapMidExtensionRef = useRef<number>(0.5);
  const whitecapHighShimmerRef = useRef<number>(0.1);
  const whitecapRotationSpeedRef = useRef<number>(0.002);
  
  // Update refs when state changes
  useEffect(() => {
    freqMultiplierRef.current = freqMultiplier;
    noiseMultiplierRef.current = noiseMultiplier;
    timeSpeedRef.current = timeSpeed;
    autoRotationSpeedRef.current = autoRotationSpeed;
    barsScaleRef.current = barsScale;
    barsSmoothnessRef.current = barsSmoothness;
    radialIntensityRef.current = radialIntensity;
    radialTimeSpeedRef.current = radialTimeSpeed;
    whitecapBassPulseRef.current = whitecapBassPulse;
    whitecapMidExtensionRef.current = whitecapMidExtension;
    whitecapHighShimmerRef.current = whitecapHighShimmer;
    whitecapRotationSpeedRef.current = whitecapRotationSpeed;
  }, [freqMultiplier, noiseMultiplier, timeSpeed, autoRotationSpeed, barsScale, barsSmoothness, radialIntensity, radialTimeSpeed, whitecapBassPulse, whitecapMidExtension, whitecapHighShimmer, whitecapRotationSpeed]);
  
  // Update ref whenever audioData changes
  useEffect(() => {
    audioDataRef.current = audioData;
  }, [audioData]);
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
          // bufferLength = 128 (FFT 256 / 2)
          // We want: more bins for lows/mids, fewer but well-represented highs
          const bars: number[] = new Array(barCount);
          
          for (let i = 0; i < barCount; i++) {
            // Map bar index to frequency bins using exponential curve
            // This gives us good bass separation AND proper high-frequency response
            const percent = i / barCount;
            const percentNext = (i + 1) / barCount;
            
            // Use exponential mapping: first half gets linear, second half gets exponential
            // This balances bass detail with high frequency coverage
            let start, end;
            
            if (i < barCount / 2) {
              // First 16 bars: more linear for bass/low-mid detail
              start = Math.floor((percent * 2) * (bufferLength * 0.3));
              end = Math.floor((percentNext * 2) * (bufferLength * 0.3));
            } else {
              // Last 16 bars: exponential for mids/highs
              const adjustedPercent = (percent - 0.5) * 2; // 0 to 1 for second half
              const adjustedPercentNext = (percentNext - 0.5) * 2;
              start = Math.floor(bufferLength * 0.3 + Math.pow(adjustedPercent, 1.5) * (bufferLength * 0.7));
              end = Math.floor(bufferLength * 0.3 + Math.pow(adjustedPercentNext, 1.5) * (bufferLength * 0.7));
            }
            
            let sum = 0;
            let count = 0;
            
            // Ensure we sample at least one bin
            const rangeEnd = Math.max(end, start + 1);
            
            for (let j = start; j < rangeEnd && j < bufferLength; j++) {
              sum += dataArray[j];
              count++;
            }
            
            bars[i] = count > 0 ? sum / count : 0;
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
    if (!threeCanvasRef.current || visualizerType !== 'threejs' || !showVisualizer) return;

    // Create scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    const container = threeCanvasRef.current;
    const size = Math.min(container.clientWidth, container.clientHeight);
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Create sphere geometry using IcosahedronGeometry for more uniform vertex distribution
    const radius = 2;
    const detailLevel = 6; // Higher subdivision level for more triangles and detail
    const geometry = new THREE.IcosahedronGeometry(radius, detailLevel);
    
    // Store original positions for animation
    const originalPositions = new Float32Array(geometry.attributes.position.array);
    
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
      return { r: 0, g: 1, b: 1 }; // Fallback cyan
    };
    
    const dominantRGB = parseRGB(dominantColor);
    const accentRGB = parseRGB(accentColor);
    
    // Add vertex colors initialized with dominant color
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = dominantRGB.r;
      colors[i + 1] = dominantRGB.g;
      colors[i + 2] = dominantRGB.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create material with wireframe and vertex colors
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
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

    // Animation loop
    let frameId: number;
    
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      // Get current values from refs for real-time updates
      const currentAutoRotationSpeed = autoRotationSpeedRef.current;
      const currentTimeSpeed = timeSpeedRef.current;
      const currentFreqMultiplier = freqMultiplierRef.current;
      const currentNoiseMultiplier = noiseMultiplierRef.current;
      
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
  }, [visualizerType, showVisualizer, dominantColor, accentColor]);

  // Setup WhiteCap visualizer
  useEffect(() => {
    if (!whitecapCanvasRef.current || visualizerType !== 'whitecap' || !showVisualizer) return;

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
          const colorBlend = ringPercent; // Inner = warm, outer = cool
          
          // Bass = warm (dominant color), High = cool (accent color)
          const warmIntensity = bassAvg * (1 - colorBlend);
          const coolIntensity = highAvg * colorBlend;
          
          const r = dominantRGB.r * (0.5 + warmIntensity) + accentRGB.r * coolIntensity;
          const g = dominantRGB.g * (0.5 + warmIntensity) + accentRGB.g * coolIntensity;
          const b = dominantRGB.b * (0.5 + warmIntensity) + accentRGB.b * coolIntensity;
          
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
  }, [visualizerType, showVisualizer, dominantColor, accentColor]);

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
    
    // Only reset view states if not preserving (e.g., clicking from playlist)
    if (!preserveView) {
      setShowDetail(false);
      setShowVisualizer(false);
    }
    
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
        <div className="flex items-center space-x-2 sm:space-x-3">
          <img src="https://media.parttimechiller.com/logo3.png" alt="Part Time Chiller" className="h-10 sm:h-12" />
          <span className="text-base sm:text-xl font-bold hidden sm:inline">PartTimeChiller</span>
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
                  <span className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                    mix.type === 'mix' 
                      ? 'border-purple-500/40 text-purple-400/90' 
                      : 'border-blue-500/40 text-blue-400/90'
                  }`}>
                    {mix.type}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">{mix.description} • {mix.duration}</p>
              </div>
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
            <div className="flex items-center gap-3">
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
                    onClick={() => setVisualizerType(v => v === 'bars' ? 'radial' : v === 'radial' ? 'threejs' : v === 'threejs' ? 'whitecap' : 'bars')}
                    className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                    title={`Current: ${visualizerType === 'bars' ? 'Bars' : visualizerType === 'radial' ? 'Radial' : visualizerType === 'threejs' ? '3D Sphere' : 'WhiteCap'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                Visualizer Controls
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
                  
                  <button
                    onClick={() => {
                      setBarsScale(1.0);
                      setBarsSmoothness(0.8);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                </>
              )}
              
              {/* Radial Controls */}
              {visualizerType === 'radial' && (
                <>
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Intensity</span>
                      <span className="font-mono">{radialIntensity.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={radialIntensity}
                      onChange={(e) => setRadialIntensity(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-xs text-white/70 mb-1">
                      <span>Animation Speed</span>
                      <span className="font-mono">{radialTimeSpeed.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={radialTimeSpeed}
                      onChange={(e) => setRadialTimeSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                      style={{ accentColor: dominantColor }}
                    />
                  </div>
                  
                  <button
                    onClick={() => {
                      setRadialIntensity(1.0);
                      setRadialTimeSpeed(0.5);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                </>
              )}
              
              {/* Three.js Sphere Controls */}
              {visualizerType === 'threejs' && (
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
                  
                  <button
                    onClick={() => {
                      setFreqMultiplier(1.5);
                      setNoiseMultiplier(0.3);
                      setTimeSpeed(0.5);
                      setAutoRotationSpeed(0.002);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
                  </button>
                </>
              )}
              
              {/* WhiteCap Controls */}
              {visualizerType === 'whitecap' && (
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
                  
                  <button
                    onClick={() => {
                      setWhitecapBassPulse(0.4);
                      setWhitecapMidExtension(0.5);
                      setWhitecapHighShimmer(0.1);
                      setWhitecapRotationSpeed(0.002);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
                  >
                    Reset to Defaults
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
              <div className="w-full max-w-3xl h-64 sm:h-80 md:h-96 flex items-end justify-center gap-1.5 px-4">
                {audioData.map((value, index) => {
                  const scale = Math.max(0.08, (value / 255) * barsScale);
                  return (
                    <div
                      key={index}
                      className="flex-1 h-full origin-bottom rounded-t-md"
                      style={{
                        transform: `scaleY(${scale})`,
                        background: `linear-gradient(to top, ${dominantColor}, ${accentColor})`,
                        opacity: isPlaying ? 0.95 : 0.5,
                        transition: `transform ${barsSmoothness * 100}ms ease-out`
                      }}
                    />
                  );
                })}
              </div>
            ) : visualizerType === 'radial' ? (
              <div className="w-full max-w-md aspect-square flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 400 400">
                  <defs>
                    <linearGradient id="radialGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={dominantColor} />
                      <stop offset="100%" stopColor={accentColor} />
                    </linearGradient>
                  </defs>
                  {audioData.map((value, index) => {
                    const barCount = audioData.length;
                    // Perfectly space bars around the circle
                    const angle = ((index + 0.5) / barCount) * 360; // Center each bar in its segment
                    const angleRad = (angle * Math.PI) / 180;
                    
                    // Normalize frequency value (0 to 1)
                    const normalizedFreq = value / 255;
                    
                    // Add traveling wave effect (matches sphere algorithm)
                    const time = Date.now() * 0.001 * radialTimeSpeed;
                    const wavePosition = (time * 2) % (Math.PI * 2);
                    const waveFactor = Math.sin(angleRad * 3 + wavePosition) * 0.5 + 0.5; // 0 to 1
                    
                    // Add noise for organic movement (matches sphere)
                    const noise = 
                      Math.sin(angleRad * 3 + time * 0.5) * 0.1 +
                      Math.sin(angleRad * 4 + time * 0.7) * 0.08;
                    
                    // Calculate displacement - more reactive with higher multipliers
                    const freqDisplacement = normalizedFreq * radialIntensity * waveFactor * 0.8;
                    const noiseDisplacement = noise * radialIntensity * 0.5;
                    const displacement = freqDisplacement + noiseDisplacement;
                    
                    // Apply to radius with better scaling
                    const innerRadius = 60;
                    const maxExtension = 140; // Increased for more visible movement
                    const baseScale = 0.15; // Minimum extension
                    const scale = baseScale + displacement;
                    const outerRadius = innerRadius + (scale * maxExtension);
                    
                    // Calculate bar width based on circle circumference for perfect spacing
                    const circumference = 2 * Math.PI * innerRadius;
                    const barWidth = Math.max(4, (circumference / barCount) * 0.6); // 60% of segment width
                    
                    const x1 = 200 + innerRadius * Math.cos(angleRad - Math.PI / 2);
                    const y1 = 200 + innerRadius * Math.sin(angleRad - Math.PI / 2);
                    const x2 = 200 + outerRadius * Math.cos(angleRad - Math.PI / 2);
                    const y2 = 200 + outerRadius * Math.sin(angleRad - Math.PI / 2);
                    
                    return (
                      <line
                        key={index}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="url(#radialGradient)"
                        strokeWidth={barWidth}
                        strokeLinecap="round"
                        opacity={isPlaying ? 0.95 : 0.5}
                      />
                    );
                  })}
                  {/* Center circle */}
                  <circle
                    cx="200"
                    cy="200"
                    r="55"
                    fill="none"
                    stroke={dominantColor}
                    strokeWidth="2"
                    opacity="0.3"
                  />
                </svg>
              </div>
            ) : visualizerType === 'threejs' ? (
              <div 
                ref={threeCanvasRef}
                className="w-full max-w-md aspect-square flex items-center justify-center cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
              />
            ) : (
              <div 
                ref={whitecapCanvasRef}
                className="w-full max-w-md aspect-square flex items-center justify-center"
              />
            )}
          </div>
          <div className="relative z-10 px-4 py-6 border-t border-neutral-800/50">
            {/* Footer with Playlist and Download */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setShowDetail(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-neutral-800/80 hover:bg-neutral-700 text-white transition-colors backdrop-blur"
                aria-label="Show playlist"
                title="Show playlist"
              >
                <img src="/ptc-player/playlist.svg" alt="Playlist" className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (currentMix?.audio) {
                    window.open(currentMix.audio, '_blank');
                  }
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-neutral-800/80 hover:bg-neutral-700 text-white transition-colors backdrop-blur"
                aria-label="Download track"
                title="Download track"
              >
                <img src="/ptc-player/download.svg" alt="Download" className="w-5 h-5" />
              </button>
            </div>
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
              <div className="flex items-center justify-center gap-4 pt-2">
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
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
