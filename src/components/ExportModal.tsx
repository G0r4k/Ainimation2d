import { useState, useRef, useCallback } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { Bone, calculateAllGlobalTransforms } from '../engine/Bone';
import { getEasingValue, lerpTransform } from '../engine/interpolation';
import { KeyframeData, Transform } from '../engine/types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'gif' | 'spritesheet' | 'png_sequence' | 'json';

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('gif');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    project,
    selectedSkeletonId,
    selectedAnimationId,
  } = useAnimationStore();

  const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
  const animation = skeleton?.animations.find(a => a.id === selectedAnimationId);

  const getInterpolatedTransform = useCallback((boneId: string, time: number, anim: typeof animation): Transform | null => {
    if (!anim) return null;

    const boneKeyframes = anim.keyframes
      .filter(kf => kf.boneId === boneId)
      .sort((a, b) => a.time - b.time);

    if (boneKeyframes.length === 0) return null;
    if (boneKeyframes.length === 1) return boneKeyframes[0].transform;

    let prevKf: KeyframeData | null = null;
    let nextKf: KeyframeData | null = null;

    for (let i = 0; i < boneKeyframes.length; i++) {
      if (boneKeyframes[i].time <= time) prevKf = boneKeyframes[i];
      if (boneKeyframes[i].time >= time && !nextKf) nextKf = boneKeyframes[i];
    }

    if (!prevKf) return boneKeyframes[0].transform;
    if (!nextKf) return boneKeyframes[boneKeyframes.length - 1].transform;
    if (prevKf.id === nextKf.id) return prevKf.transform;

    const t = (time - prevKf.time) / (nextKf.time - prevKf.time);
    const easedT = getEasingValue(t, prevKf.easing, prevKf.bezierPoints);

    return lerpTransform(prevKf.transform, nextKf.transform, easedT);
  }, []);

  const renderFrame = useCallback((canvas: HTMLCanvasElement, time: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !skeleton || !animation) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = project.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Build bone map
    const boneMap = new Map<string, Bone>();
    skeleton.bones.forEach(boneData => {
      const bone = new Bone(boneData);
      const interpolated = getInterpolatedTransform(bone.id, time, animation);
      if (interpolated) {
        bone.localTransform = { ...interpolated };
      }
      boneMap.set(bone.id, bone);
    });

    calculateAllGlobalTransforms(boneMap);

    // Draw bones
    boneMap.forEach((bone) => {
      const pos = bone.globalTransform.position;
      const end = bone.getEndPoint();

      // Draw bone line
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = bone.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Draw joint
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = bone.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw end
      ctx.beginPath();
      ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = bone.color;
      ctx.fill();
    });
  }, [skeleton, animation, project.backgroundColor, getInterpolatedTransform]);

  const handleExport = async () => {
    if (!animation || !skeleton) return;

    setIsExporting(true);
    setProgress(0);
    setStatus('Preparando frames...');

    const canvas = document.createElement('canvas');
    canvas.width = project.canvasWidth;
    canvas.height = project.canvasHeight;

    const totalFrames = animation.duration;
    const frames: ImageData[] = [];

    // Render all frames
    for (let i = 0; i <= totalFrames; i++) {
      renderFrame(canvas, i);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
      setProgress((i / totalFrames) * 70);
      setStatus(`Renderizando frame ${i}/${totalFrames}...`);
      
      // Yield to UI
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    setStatus('Generando archivo...');
    setProgress(80);

    if (format === 'spritesheet') {
      await exportSpriteSheet(canvas, frames, animation);
    } else if (format === 'png_sequence') {
      await exportPNGSequence(canvas, frames);
    } else if (format === 'json') {
      exportJSON();
    } else {
      // GIF - export as animated canvas recording
      await exportAnimatedGIF(canvas, frames, animation);
    }

    setProgress(100);
    setStatus('¡Exportación completada!');
    
    setTimeout(() => {
      setIsExporting(false);
      onClose();
    }, 1500);
  };

  const exportSpriteSheet = async (canvas: HTMLCanvasElement, frames: ImageData[], anim: typeof animation) => {
    if (!anim) return;
    const cols = Math.ceil(Math.sqrt(anim.duration));
    const rows = Math.ceil(anim.duration / cols);
    
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = canvas.width * cols;
    sheetCanvas.height = canvas.height * rows;
    const ctx = sheetCanvas.getContext('2d')!;

    frames.forEach((frame, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(frame, 0, 0);
      ctx.drawImage(tempCanvas, col * canvas.width, row * canvas.height);
    });

    // Download sprite sheet
    const link = document.createElement('a');
    link.download = `${project.name}_spritesheet.png`;
    link.href = sheetCanvas.toDataURL('image/png');
    link.click();

    // Also download metadata JSON
    const metadata = {
      frames: anim.duration,
      frameWidth: canvas.width,
      frameHeight: canvas.height,
      columns: cols,
      rows: rows,
      fps: anim.fps,
    };
    const metaLink = document.createElement('a');
    metaLink.download = `${project.name}_spritesheet.json`;
    metaLink.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(metadata, null, 2));
    metaLink.click();
  };

  const exportPNGSequence = async (_canvas: HTMLCanvasElement, frames: ImageData[]) => {
    for (let i = 0; i < frames.length; i++) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = project.canvasWidth;
      tempCanvas.height = project.canvasHeight;
      const ctx = tempCanvas.getContext('2d')!;
      ctx.putImageData(frames[i], 0, 0);
      
      const link = document.createElement('a');
      link.download = `frame_${String(i).padStart(4, '0')}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      setProgress(80 + (i / frames.length) * 20);
    }
  };

  const exportJSON = () => {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${project.name}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAnimatedGIF = async (canvas: HTMLCanvasElement, frames: ImageData[], anim: typeof animation) => {
    if (!anim) return;
    // Export as WebM video using MediaRecorder
    const stream = canvas.captureStream(anim.fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${project.name}.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      stream.getTracks().forEach(t => t.stop());
    };

    recorder.start();

    // Play frames
    const ctx = canvas.getContext('2d')!;
    for (let i = 0; i < frames.length; i++) {
      ctx.putImageData(frames[i], 0, 0);
      setProgress(80 + (i / frames.length) * 20);
      await new Promise(resolve => setTimeout(resolve, 1000 / anim.fps));
    }

    recorder.stop();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-96 shadow-2xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Exportar Animación</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {!isExporting ? (
          <>
            {/* Format selection */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">Formato de exportación</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'gif' as const, label: 'Video (WebM)', icon: '🎬', desc: 'Animación en video' },
                  { id: 'spritesheet' as const, label: 'Sprite Sheet', icon: '🎮', desc: 'Para videojuegos' },
                  { id: 'png_sequence' as const, label: 'Secuencia PNG', icon: '🖼️', desc: 'Frames individuales' },
                  { id: 'json' as const, label: 'JSON', icon: '📄', desc: 'Formato del proyecto' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`p-3 rounded-lg text-left transition-all ${
                      format === f.id
                        ? 'bg-blue-600/20 border-blue-500 border'
                        : 'bg-gray-700/50 border border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-lg mb-1">{f.icon}</div>
                    <div className="text-xs font-medium text-white">{f.label}</div>
                    <div className="text-[10px] text-gray-400">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="mb-4 p-3 bg-gray-700/30 rounded-lg">
              <div className="text-xs text-gray-400 space-y-1">
                <div>📐 Resolución: {project.canvasWidth}×{project.canvasHeight}</div>
                <div>🎞️ Frames: {animation?.duration || 0}</div>
                <div>⚡ FPS: {animation?.fps || 24}</div>
                <div>🔄 Loop: {animation?.loop ? 'Sí' : 'No'}</div>
              </div>
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={!animation}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-lg font-medium hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Exportar
            </button>
          </>
        ) : (
          <div className="py-4">
            <div className="text-center mb-4">
              <div className="text-sm text-gray-300 mb-1">{status}</div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">{Math.round(progress)}%</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
