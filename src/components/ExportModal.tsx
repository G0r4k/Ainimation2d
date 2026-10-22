import { useState, useCallback } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { Bone, calculateAllGlobalTransforms } from '../engine/Bone';
import { getEasingValue, lerpTransform } from '../engine/interpolation';
import { KeyframeData, Transform, BoneData } from '../engine/types';

interface Props { isOpen: boolean; onClose: () => void; }

export function ExportModal({ isOpen, onClose }: Props) {
  const [format, setFormat] = useState<'webm' | 'spritesheet' | 'png' | 'json'>('webm');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const store = useAnimationStore();
  const scene = store.getActiveScene();
  const char = store.getActiveCharacter();

  const getInterp = useCallback((boneId: string, time: number, bones: BoneData[], kfs: KeyframeData[]): Transform | null => {
    const bkfs = kfs.filter(k => k.boneId === boneId).sort((a, b) => a.time - b.time);
    if (bkfs.length === 0) return null;
    if (bkfs.length === 1) return bkfs[0].transform;
    let prev: KeyframeData | null = null, next: KeyframeData | null = null;
    for (const kf of bkfs) { if (kf.time <= time) prev = kf; if (kf.time >= time && !next) next = kf; }
    if (!prev) return bkfs[0].transform;
    if (!next) return bkfs[bkfs.length - 1].transform;
    if (prev.id === next.id) return prev.transform;
    const t = (time - prev.time) / (next.time - prev.time);
    return lerpTransform(prev.transform, next.transform, getEasingValue(t, prev.easing, prev.bezierPoints));
  }, []);

  const renderFrame = useCallback((canvas: HTMLCanvasElement, time: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !scene || !char) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Background
    const bgs = [...scene.backgrounds].sort((a, b) => a.zIndex - b.zIndex);
    bgs.forEach(bg => {
      if (!bg.visible) return;
      ctx.save(); ctx.globalAlpha = bg.opacity;
      if (bg.type === 'color' && bg.color) { ctx.fillStyle = bg.color; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      else if (bg.type === 'gradient' && bg.gradientColors) {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bg.gradientColors.forEach((c, i) => grad.addColorStop(i / (bg.gradientColors!.length - 1), c));
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
    });
    // Characters
    const sortedChars = [...scene.characters].sort((a, b) => a.zIndex - b.zIndex);
    sortedChars.forEach(c => {
      if (!c.visible) return;
      ctx.save();
      ctx.translate(c.position.x, c.position.y); ctx.rotate(c.rotation); ctx.scale(c.scale.x, c.scale.y); ctx.translate(-c.position.x, -c.position.y);
      const boneMap = new Map<string, Bone>();
      const allKf = c.animations.find(a => a.id === store.selectedAnimationId)?.keyframes || [];
      c.bones.forEach(bd => {
        const bone = new Bone(bd);
        const interp = getInterp(bone.id, time, c.bones, allKf);
        if (interp) bone.localTransform = { ...interp };
        boneMap.set(bone.id, bone);
      });
      calculateAllGlobalTransforms(boneMap);
      boneMap.forEach(bone => {
        if (!bone.visible) return;
        const pos = bone.globalTransform.position;
        const end = bone.getEndPoint();
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = bone.color; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2); ctx.fillStyle = bone.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(end.x, end.y, 3, 0, Math.PI * 2); ctx.fillStyle = bone.color; ctx.fill();
      });
      ctx.restore();
    });
  }, [scene, char, store.selectedAnimationId, getInterp]);

  const handleExport = async () => {
    if (!scene || !char) return;
    setIsExporting(true); setProgress(0); setStatus('Preparando...');
    const canvas = document.createElement('canvas');
    canvas.width = store.project.canvasWidth; canvas.height = store.project.canvasHeight;
    const duration = scene.duration;
    const fps = scene.fps;

    if (format === 'json') {
      const json = store.exportProject();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${store.project.name}.json`; a.click();
      setIsExporting(false); onClose(); return;
    }

    const frames: ImageData[] = [];
    for (let i = 0; i <= duration; i++) {
      renderFrame(canvas, i);
      const ctx = canvas.getContext('2d');
      if (ctx) frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      setProgress((i / duration) * 70); setStatus(`Frame ${i}/${duration}`);
      await new Promise(r => setTimeout(r, 5));
    }

    setStatus('Generando archivo...'); setProgress(80);

    if (format === 'spritesheet') {
      const cols = Math.ceil(Math.sqrt(duration));
      const rows = Math.ceil(duration / cols);
      const sheet = document.createElement('canvas');
      sheet.width = canvas.width * cols; sheet.height = canvas.height * rows;
      const sctx = sheet.getContext('2d')!;
      frames.forEach((f, i) => {
        const tc = document.createElement('canvas'); tc.width = canvas.width; tc.height = canvas.height;
        tc.getContext('2d')!.putImageData(f, 0, 0);
        sctx.drawImage(tc, (i % cols) * canvas.width, Math.floor(i / cols) * canvas.height);
      });
      const a = document.createElement('a'); a.href = sheet.toDataURL('image/png'); a.download = `${store.project.name}_sprites.png`; a.click();
    } else if (format === 'png') {
      for (let i = 0; i < frames.length; i++) {
        const tc = document.createElement('canvas'); tc.width = canvas.width; tc.height = canvas.height;
        tc.getContext('2d')!.putImageData(frames[i], 0, 0);
        const a = document.createElement('a'); a.href = tc.toDataURL('image/png'); a.download = `frame_${String(i).padStart(4, '0')}.png`; a.click();
        await new Promise(r => setTimeout(r, 30));
        setProgress(80 + (i / frames.length) * 20);
      }
    } else {
      // WebM
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${store.project.name}.webm`; a.click();
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      const ctx = canvas.getContext('2d')!;
      for (let i = 0; i < frames.length; i++) {
        ctx.putImageData(frames[i], 0, 0);
        setProgress(80 + (i / frames.length) * 20);
        await new Promise(r => setTimeout(r, 1000 / fps));
      }
      recorder.stop();
    }

    setProgress(100); setStatus('¡Completado!');
    setTimeout(() => { setIsExporting(false); onClose(); }, 1500);
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-96 shadow-2xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">📤 Exportar</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        {!isExporting ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[{ id: 'webm' as const, icon: '🎬', label: 'Video WebM', desc: 'Animación en video' }, { id: 'spritesheet' as const, icon: '🎮', label: 'Sprite Sheet', desc: 'Para videojuegos' }, { id: 'png' as const, icon: '🖼️', label: 'Secuencia PNG', desc: 'Frames individuales' }, { id: 'json' as const, icon: '📄', label: 'JSON', desc: 'Proyecto completo' }].map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)} className={`p-3 rounded-lg text-left transition-all ${format === f.id ? 'bg-blue-600/20 border-blue-500 border' : 'bg-gray-700/50 border border-gray-600 hover:border-gray-500'}`}>
                  <div className="text-lg mb-1">{f.icon}</div><div className="text-xs font-medium text-white">{f.label}</div><div className="text-[10px] text-gray-400">{f.desc}</div>
                </button>
              ))}
            </div>
            <div className="mb-4 p-3 bg-gray-700/30 rounded-lg text-xs text-gray-400 space-y-1">
              <div>📐 {store.project.canvasWidth}×{store.project.canvasHeight} | 🎞️ {scene?.duration || 0} frames | ⚡ {scene?.fps || 24} FPS</div>
              <div>👤 {scene?.characters.length || 0} personajes | 🏞️ {scene?.backgrounds.length || 0} fondos | 📷 {scene?.cameras.length || 0} cámaras</div>
            </div>
            <button onClick={handleExport} disabled={!scene} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-lg font-medium hover:from-blue-500 hover:to-purple-500 disabled:opacity-50">Exportar</button>
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="text-sm text-gray-300 mb-2">{status}</div>
            <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="text-xs text-gray-500 mt-1">{Math.round(progress)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}
