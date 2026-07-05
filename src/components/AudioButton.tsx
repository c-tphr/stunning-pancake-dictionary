import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { api, type PronunciationClip } from '../api';
import { useToast } from '../hooks/useToast';

interface AudioButtonProps {
  /** The Chinese text to pronounce (headword or example sentence). */
  text: string;
  /** 32px circle for headwords, 24px for example sentences. */
  size?: 'md' | 'sm';
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <polygon points="3.6,2.2 10,6 3.6,9.8" fill="currentColor" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="audio-wave">
      <rect x="1.5" y="3" width="2" height="6" rx="1" fill="currentColor" />
      <rect x="5" y="1.5" width="2" height="9" rx="1" fill="currentColor" />
      <rect x="8.5" y="3" width="2" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Circular pronunciation button (voice-icon-circular pattern). Click to play, click again to stop. */
export default function AudioButton({ text, size = 'md' }: AudioButtonProps) {
  const [playing, setPlaying] = useState(false);
  const clipRef = useRef<PronunciationClip | null>(null);
  const { showToast } = useToast();

  // Cut audio if the entry unmounts mid-playback (navigation away).
  useEffect(() => () => clipRef.current?.stop(), []);

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (playing) {
      clipRef.current?.stop();
      setPlaying(false);
      return;
    }
    try {
      const clip = await api.getPronunciation(text);
      clipRef.current = clip;
      setPlaying(true);
      await clip.play();
    } catch {
      showToast('Audio unavailable');
    } finally {
      setPlaying(false);
    }
  };

  return (
    <button
      type="button"
      className={`audio-button audio-button-${size}${playing ? ' is-playing' : ''}`}
      onClick={handleClick}
      title={playing ? 'Stop' : 'Play pronunciation'}
      aria-label={playing ? `Stop pronunciation of ${text}` : `Play pronunciation of ${text}`}
      aria-pressed={playing}
    >
      {playing ? <WaveIcon /> : <PlayIcon />}
    </button>
  );
}
