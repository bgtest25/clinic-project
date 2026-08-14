import { useEffect, useRef, useState } from 'react';

const BAR_COUNT = 20;

export function LevelMeter({ stream, active }: { stream: MediaStream; active: boolean }) {
  const [level, setLevel] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
      setLevel(Math.min(1, avg / 128));
      frameRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      source.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [stream, active]);

  const activeBars = Math.round(level * BAR_COUNT);

  return (
    <div className="level-meter" role="img" aria-label={active ? 'Microphone input level' : 'Microphone idle'}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span key={i} className={`level-bar ${i < activeBars ? 'is-active' : ''}`} />
      ))}
    </div>
  );
}
