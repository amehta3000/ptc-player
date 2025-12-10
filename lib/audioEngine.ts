/**
 * Audio Engine - Core audio analysis and frequency mapping
 * Provides standardized audio data processing for all visualizers
 */

export interface AudioAnalysis {
  // Raw frequency data
  frequencyData: Uint8Array;
  
  // Processed audio bars (64 bars with logarithmic frequency spacing)
  audioData: number[];
  
  // Frequency bands
  bassAvg: number;      // 20-250 Hz
  midAvg: number;       // 250-2000 Hz
  highAvg: number;      // 2000-16000 Hz
  
  // Overall metrics
  averageFrequency: number;
  normalizedFrequency: number;
  
  // Playback state
  isPlaying: boolean;
}

export class AudioEngine {
  private analyser: AnalyserNode;
  private frequencyData: Uint8Array<ArrayBuffer>;
  private audioContext: AudioContext;
  private barCount: number = 64;
  
  constructor(audioContext: AudioContext, analyser: AnalyserNode, barCount: number = 64) {
    this.audioContext = audioContext;
    this.analyser = analyser;
    this.barCount = barCount;
    this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
  }
  
  /**
   * Get current audio analysis
   */
  getAnalysis(isPlaying: boolean): AudioAnalysis {
    this.analyser.getByteFrequencyData(this.frequencyData);
    
    return {
      frequencyData: this.frequencyData,
      audioData: this.mapFrequenciesToBars(),
      bassAvg: this.getFrequencyBandAverage(20, 250),
      midAvg: this.getFrequencyBandAverage(250, 2000),
      highAvg: this.getFrequencyBandAverage(2000, 16000),
      averageFrequency: this.getAverageFrequency(),
      normalizedFrequency: this.getAverageFrequency() / 255,
      isPlaying
    };
  }
  
  /**
   * Map frequency bins to audio bars using logarithmic spacing
   * Optimized for better bass response and full spectrum coverage
   */
  private mapFrequenciesToBars(): number[] {
    const audioData: number[] = [];
    const sampleRate = this.audioContext.sampleRate;
    const nyquist = sampleRate / 2;
    const binCount = this.analyser.frequencyBinCount;
    
    // Frequency range: 20Hz to 16kHz
    const minFreq = 20;
    const maxFreq = 16000;
    
    // Split into two regions for better frequency distribution
    const bassBarCount = Math.floor(this.barCount * 0.4); // 40% for bass (20-800Hz)
    const highBarCount = this.barCount - bassBarCount; // 60% for mids/highs (800-16kHz)
    
    // Process bass region (20-800Hz) with gentle logarithmic curve
    const bassMaxFreq = 800;
    for (let i = 0; i < bassBarCount; i++) {
      const logProgress = i / (bassBarCount - 1);
      const sqrtProgress = Math.sqrt(logProgress);
      const freq = minFreq * Math.pow(bassMaxFreq / minFreq, sqrtProgress);
      const binIndex = Math.floor((freq / nyquist) * binCount);
      audioData.push(this.frequencyData[Math.min(binIndex, binCount - 1)]);
    }
    
    // Process mid/high region (800-16kHz) with standard logarithmic spacing
    for (let i = 0; i < highBarCount; i++) {
      const logProgress = i / (highBarCount - 1);
      const freq = bassMaxFreq * Math.pow(maxFreq / bassMaxFreq, logProgress);
      const binIndex = Math.floor((freq / nyquist) * binCount);
      audioData.push(this.frequencyData[Math.min(binIndex, binCount - 1)]);
    }
    
    return audioData;
  }
  
  /**
   * Get average frequency value for a specific frequency band
   */
  private getFrequencyBandAverage(minFreq: number, maxFreq: number): number {
    const sampleRate = this.audioContext.sampleRate;
    const nyquist = sampleRate / 2;
    const binCount = this.analyser.frequencyBinCount;
    
    const minBin = Math.floor((minFreq / nyquist) * binCount);
    const maxBin = Math.floor((maxFreq / nyquist) * binCount);
    
    let sum = 0;
    let count = 0;
    
    for (let i = minBin; i <= maxBin && i < binCount; i++) {
      sum += this.frequencyData[i];
      count++;
    }
    
    return count > 0 ? sum / count / 255 : 0; // Normalized 0-1
  }
  
  /**
   * Get overall average frequency
   */
  private getAverageFrequency(): number {
    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return sum / this.frequencyData.length;
  }
  
  /**
   * Update bar count (for responsive layouts)
   */
  setBarCount(count: number) {
    this.barCount = count;
  }
}
