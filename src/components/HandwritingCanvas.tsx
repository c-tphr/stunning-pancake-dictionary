import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { HandwritingSample } from '../api';
import Button from './Button';

type Point = { x: number; y: number; t: number };
type Stroke = Point[];

const CANVAS_SIZE = 280;
const DEBOUNCE_MS = 400;

interface HandwritingCanvasProps {
  onSample: (sample: HandwritingSample | null) => void;
}

/** Reads the resolved color of a token off <html> so canvas ink follows the theme. */
function readColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

export default function HandwritingCanvas({ onSample }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 米字格 guide.
    ctx.strokeStyle = readColor('--color-hairline-soft') || '#f0efed';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(4, 4, CANVAS_SIZE - 8, CANVAS_SIZE - 8);
    ctx.beginPath();
    ctx.moveTo(CANVAS_SIZE / 2, 4);
    ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE - 4);
    ctx.moveTo(4, CANVAS_SIZE / 2);
    ctx.lineTo(CANVAS_SIZE - 4, CANVAS_SIZE / 2);
    ctx.moveTo(4, 4);
    ctx.lineTo(CANVAS_SIZE - 4, CANVAS_SIZE - 4);
    ctx.moveTo(CANVAS_SIZE - 4, 4);
    ctx.lineTo(4, CANVAS_SIZE - 4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ink strokes.
    ctx.strokeStyle = readColor('--color-ink') || '#0c0a09';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * CANVAS_SIZE, stroke[0].y * CANVAS_SIZE);
      for (const p of stroke.slice(1)) ctx.lineTo(p.x * CANVAS_SIZE, p.y * CANVAS_SIZE);
      ctx.stroke();
    }
  };

  // Redraw when the theme flips so ink/guide colors stay correct (§9 binding rule).
  useEffect(() => {
    draw();
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleRecognize = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (strokesRef.current.length === 0) {
        onSample(null);
        return;
      }
      onSample({ strokes: strokesRef.current.map((s) => [...s]), width: CANVAS_SIZE, height: CANVAS_SIZE });
    }, DEBOUNCE_MS);
  };

  const pointFromEvent = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      t: e.timeStamp,
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.setPointerCapture(e.pointerId);
    currentStrokeRef.current = [pointFromEvent(e)];
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    currentStrokeRef.current.push(pointFromEvent(e));
    draw();
    // Live preview of the in-progress stroke.
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && currentStrokeRef.current.length > 0) {
      ctx.strokeStyle = readColor('--color-ink') || '#0c0a09';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const [first, ...rest] = currentStrokeRef.current;
      ctx.moveTo(first.x * CANVAS_SIZE, first.y * CANVAS_SIZE);
      for (const p of rest) ctx.lineTo(p.x * CANVAS_SIZE, p.y * CANVAS_SIZE);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!currentStrokeRef.current) return;
    if (currentStrokeRef.current.length > 1) {
      strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
      setStrokeCount(strokesRef.current.length);
      scheduleRecognize();
    }
    currentStrokeRef.current = null;
    draw();
  };

  const handleUndo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    draw();
    scheduleRecognize();
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    strokesRef.current = [];
    setStrokeCount(0);
    draw();
    onSample(null);
  };

  return (
    <div className="handwriting-canvas-card">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Handwriting input area — draw a Chinese character"
        className="handwriting-canvas"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="handwriting-controls">
        <Button variant="outline" onClick={handleUndo} disabled={strokeCount === 0}>
          Undo stroke
        </Button>
        <Button variant="text" onClick={handleClear} disabled={strokeCount === 0}>
          Clear
        </Button>
        <span className="caption handwriting-stroke-count">
          {strokeCount} {strokeCount === 1 ? 'stroke' : 'strokes'}
        </span>
      </div>
    </div>
  );
}
