"use client";

import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function CallAudioPlayer({
  label,
  meta,
  src
}: {
  label: string;
  meta: string;
  src: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const bars = useMemo(
    () => Array.from({ length: 64 }, (_, index) => 22 + ((index * 19) % 64)),
    []
  );
  const progress = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncTime = () => setCurrentTime(audio.currentTime);
    const syncDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const markPlaying = () => setIsPlaying(true);
    const markPaused = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("play", markPlaying);
    audio.addEventListener("pause", markPaused);
    audio.addEventListener("ended", markPaused);

    return () => {
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("play", markPlaying);
      audio.removeEventListener("pause", markPaused);
      audio.removeEventListener("ended", markPaused);
    };
  }, [src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }

  return (
    <div className="customAudioPlayer">
      <audio ref={audioRef} preload="metadata" src={src} />
      <button
        className="audioPlayButton"
        type="button"
        onClick={togglePlayback}
        aria-label={isPlaying ? "Pause recording" : "Play recording"}
      >
        {isPlaying ? <Pause size={28} aria-hidden /> : <Play size={28} aria-hidden />}
      </button>

      <div className="customAudioBody">
        <div className="customAudioHeader">
          <div>
            <strong>{label}</strong>
            <span>{meta}</span>
          </div>
          <div className="audioTime">
            <span>{formatDuration(currentTime)}</span>
            <small>/ {formatDuration(duration)}</small>
          </div>
        </div>

        <button
          className="audioWaveButton"
          type="button"
          aria-label="Seek recording"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            seek(Math.max(0, Math.min(duration, duration * ratio)));
          }}
        >
          {bars.map((height, index) => (
            <i
              className={index / bars.length <= progress ? "played" : ""}
              key={index}
              style={{ "--h": `${height}%` } as React.CSSProperties}
            />
          ))}
        </button>

        <div className="audioSeekRow">
          <Volume2 size={18} aria-hidden />
          <input
            aria-label="Recording progress"
            max={duration || 0}
            min={0}
            onChange={(event) => seek(Number(event.target.value))}
            step="0.1"
            type="range"
            value={duration > 0 ? currentTime : 0}
          />
        </div>
      </div>
    </div>
  );
}

function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
