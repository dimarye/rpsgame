import { useCallback, useRef } from 'react';

const SOUND_PROFILES = {
  scratch: {
    type: 'sawtooth',
    startFreq: 320,
    endFreq: 120,
    duration: 0.18,
    startGain: 0.25,
    endGain: 0.02,
  },
  impact: {
    type: 'square',
    startFreq: 200,
    endFreq: 60,
    duration: 0.22,
    startGain: 0.3,
    endGain: 0.01,
  },
  victory: {
    type: 'triangle',
    startFreq: 280,
    endFreq: 520,
    duration: 0.35,
    startGain: 0.2,
    endGain: 0.02,
  },
};

const useSketchSound = () => {
  const audioCtxRef = useRef(null);

  const playSound = useCallback((type) => {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextClass();
    }

    const ctx = audioCtxRef.current;
    const profile = SOUND_PROFILES[type];
    if (!profile) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = profile.type;
    osc.frequency.setValueAtTime(profile.startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      profile.endFreq,
      ctx.currentTime + profile.duration
    );

    gain.gain.setValueAtTime(profile.startGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      profile.endGain,
      ctx.currentTime + profile.duration
    );

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + profile.duration);
  }, []);

  return playSound;
};

export default useSketchSound;
