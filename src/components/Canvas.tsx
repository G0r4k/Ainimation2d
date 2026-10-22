import { useRef, useEffect, useCallback, useState } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { Bone, calculateAllGlobalTransforms } from '../engine/Bone';
import { getEasingValue, lerpTransform } from '../engine/interpolation';
import { KeyframeData, Transform, BoneData, BackgroundLayer, CameraData } from '../engine/types';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const store = useAnimationStore();

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getInterpolatedTransform = useCallback((boneId: string, time: number, bones: BoneData[], animKeyframes: KeyframeData[]): Transform | null => {
    const boneKeyframes = animKeyframes.filter(kf => kf.boneId === boneId).sort((a, b) => a.time - b.time);
    if (boneKeyframes.length === 0) return null;
    if (boneKeyframes.length === 1) return boneKeyframes[0].transform;
    let prevKf: KeyframeData | null = null;
    let nextKf: KeyframeData | null = null;
    for (const kf of boneKeyframes) {
      if (kf.time <= time) prevKf = kf;
      if (kf.time >= time && !nextKf) nextKf = kf;
    }
    if (!prevKf) return boneKeyframes[0].transform;
    if (!nextKf) return boneKeyframes[boneKeyframes.length - 1].transform;
    if (prevKf.id === nextKf.id) return prevKf.transform;
    const t = (time - prevKf.time) / (nextKf.time - prevKf.time);
    const easedT = getEasingValue(t, prevKf.easing, prevKf.bezierPoints);
    return lerpTransform(prevKf.transform, nextKf.transform, easedT);
  }, []);

  // Playback
  useEffect(() => {
    if (!store.isPlaying) return;
    const scene = store.getActiveScene();
    if (!scene) return;
    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      const fps = scene.fps * store.playbackSpeed;
      const newTime = store.currentTime + delta * fps;
      if (newTime >= scene.duration) {
        if (store.loop) store.setCurrentTime(0);
        else { store.setCurrentTime(scene.duration); store.setPlaying(false); }
      } else store.setCurrentTime(newTime);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(animFrameRef.current); lastTimeRef.current = 0; };
  }, [store.isPlaying, store.currentTime, store.playbackSpeed, store.loop]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scene = store.getActiveScene();
    if (!scene) return;
    const camera = store.getActiveCamera();

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.fillStyle = store.project.backgroundColor;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Apply camera transform
    ctx.save();
    if (camera) {
      const cx = canvasSize.width / 2;
      const cy = canvasSize.height / 2;
      ctx.translate(cx, cy);
      ctx.scale(camera.zoom * store.zoom, camera.zoom * store.zoom);
      ctx.rotate(camera.rotation);
      ctx.translate(-camera.position.x + store.panOffset.x, -camera.position.y + store.panOffset.y);
    } else {
      ctx.translate(store.panOffset.x, store.panOffset.y);
      ctx.scale(store.zoom, store.zoom);
    }

    // Draw grid
    if (store.showGrid) drawGrid(ctx, canvasSize.width, canvasSize.height, store.zoom);

    // Draw backgrounds
    const sortedBgs = [...scene.backgrounds].sort((a, b) => a.zIndex - b.zIndex);
    sortedBgs.forEach(bg => {
      if (bg.visible) drawBackground(ctx, bg, canvasSize, store.project.assets);
    });

    // Draw characters
    const sortedChars = [...scene.characters].sort((a, b) => a.zIndex - b.zIndex);
    sortedChars.forEach(char => {
      if (!char.visible) return;
      ctx.save();
      ctx.translate(char.position.x, char.position.y);
      ctx.rotate(char.rotation);
      ctx.scale(char.scale.x, char.scale.y);
      ctx.translate(-char.position.x, -char.position.y);

      const boneMap = new Map<string, Bone>();
      const allKeyframes = char.animations.find(a => a.id === store.selectedAnimationId)?.keyframes || [];
      char.bones.forEach(bd => {
        const bone = new Bone(bd);
        const interp = getInterpolatedTransform(bone.id, store.currentTime, char.bones, allKeyframes);
        if (interp) bone.localTransform = { ...interp };
        boneMap.set(bone.id, bone);
      });
      calculateAllGlobalTransforms(boneMap);
      boneMap.forEach(bone => {
        if (!bone.visible) return;
        drawBone(ctx, bone, boneMap, bone.id === store.selectedBoneId);
      });
      ctx.restore();
    });

    // Camera viewport indicator
    if (camera) {
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
      ctx.lineWidth = 2 / (store.zoom * camera.zoom);
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(
        camera.position.x - camera.viewportWidth / 2,
        camera.position.y - camera.viewportHeight / 2,
        camera.viewportWidth,
        camera.viewportHeight
      );
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [canvasSize, store.project, store.currentTime, store.zoom, store.panOffset, store.showGrid, store.selectedBoneId, store.selectedAnimationId, store.getActiveScene, store.getActiveCamera, getInterpolatedTransform]);

  // Mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - store.panOffset.x) / store.zoom;
    const mouseY = (e.clientY - rect.top - store.panOffset.y) / store.zoom;
    const scene = store.getActiveScene();
    if (!scene) return;

    if (store.tool === 'bone' && e.button === 0) {
      store.addBone(store.selectedBoneId);
      return;
    }

    if (store.tool === 'select' || store.tool === 'move') {
      let closestBone: string | null = null;
      let closestDist = 20;
      let closestCharId: string | null = null;

      scene.characters.forEach(char => {
        if (!char.visible) return;
        const boneMap = new Map<string, Bone>();
        const allKf = char.animations.find(a => a.id === store.selectedAnimationId)?.keyframes || [];
        char.bones.forEach(bd => {
          const bone = new Bone(bd);
          const interp = getInterpolatedTransform(bone.id, store.currentTime, char.bones, allKf);
          if (interp) bone.localTransform = { ...interp };
          boneMap.set(bone.id, bone);
        });
        calculateAllGlobalTransforms(boneMap);
        boneMap.forEach(bone => {
          const dx = mouseX - bone.globalTransform.position.x;
          const dy = mouseY - bone.globalTransform.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) { closestDist = dist; closestBone = bone.id; closestCharId = char.id; }
        });
      });

      if (closestBone) {
        store.selectCharacter(closestCharId);
        store.selectBone(closestBone);
        setIsDragging(true);
        setDragStart({ x: mouseX, y: mouseY });
      } else {
        store.selectBone(null);
        setIsDragging(true);
        setDragStart({ x: e.clientX - store.panOffset.x, y: e.clientY - store.panOffset.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    if (store.tool === 'move' && store.selectedBoneId) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - store.panOffset.x) / store.zoom;
      const mouseY = (e.clientY - rect.top - store.panOffset.y) / store.zoom;
      const dx = mouseX - dragStart.x;
      const dy = mouseY - dragStart.y;
      const char = store.getActiveCharacter();
      if (char) {
        const bone = char.bones.find(b => b.id === store.selectedBoneId);
        if (bone) {
          store.updateBoneTransform(store.selectedBoneId, { position: { x: bone.localTransform.position.x + dx, y: bone.localTransform.position.y + dy } });
          setDragStart({ x: mouseX, y: mouseY });
        }
      }
    } else if (store.tool === 'rotate' && store.selectedBoneId) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - store.panOffset.x) / store.zoom;
      const mouseY = (e.clientY - rect.top - store.panOffset.y) / store.zoom;
      const char = store.getActiveCharacter();
      if (char) {
        const bone = char.bones.find(b => b.id === store.selectedBoneId);
        if (bone) {
          const angle = Math.atan2(mouseY - bone.globalTransform.position.y, mouseX - bone.globalTransform.position.x);
          store.updateBoneTransform(store.selectedBoneId, { rotation: angle });
        }
      }
    } else {
      store.setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); store.setZoom(store.zoom * (e.deltaY > 0 ? 0.9 : 1.1)); };

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-gray-900">
      <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="absolute inset-0 cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} />
      <div className="absolute top-2 left-2 text-xs text-gray-400 bg-black/50 px-2 py-1 rounded pointer-events-none">
        Zoom: {(store.zoom * 100).toFixed(0)}% | Frame: {store.currentTime.toFixed(1)} | Cámara: {store.getActiveCamera()?.name || 'Ninguna'}
      </div>
    </div>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, zoom: number) {
  const gs = 50;
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1 / zoom;
  for (let x = 0; x < w / zoom + 200; x += gs) { ctx.beginPath(); ctx.moveTo(x - 100, -100); ctx.lineTo(x - 100, h / zoom + 100); ctx.stroke(); }
  for (let y = 0; y < h / zoom + 200; y += gs) { ctx.beginPath(); ctx.moveTo(-100, y - 100); ctx.lineTo(w / zoom + 100, y - 100); ctx.stroke(); }
}

function drawBackground(ctx: CanvasRenderingContext2D, bg: BackgroundLayer, size: { width: number; height: number }, assets: { id: string; src: string }[]) {
  ctx.save();
  ctx.globalAlpha = bg.opacity;
  if (bg.type === 'color' && bg.color) {
    ctx.fillStyle = bg.color;
    ctx.fillRect(-200, -200, size.width + 400, size.height + 400);
  } else if (bg.type === 'gradient' && bg.gradientColors) {
    const angle = (bg.gradientAngle || 0) * Math.PI / 180;
    const gx = Math.cos(angle);
    const gy = Math.sin(angle);
    const grad = ctx.createLinearGradient(size.width / 2 - gx * 300, size.height / 2 - gy * 300, size.width / 2 + gx * 300, size.height / 2 + gy * 300);
    bg.gradientColors.forEach((c, i) => grad.addColorStop(i / (bg.gradientColors!.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(-200, -200, size.width + 400, size.height + 400);
  } else if (bg.type === 'image' && bg.assetId) {
    const asset = assets.find(a => a.id === bg.assetId);
    if (asset) {
      const img = new Image();
      img.src = asset.src;
      ctx.drawImage(img, 0, 0, size.width, size.height);
    }
  }
  ctx.restore();
}

function drawBone(ctx: CanvasRenderingContext2D, bone: Bone, boneMap: Map<string, Bone>, isSelected: boolean) {
  const pos = bone.globalTransform.position;
  const end = bone.getEndPoint();
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = isSelected ? '#FFD700' : bone.color;
  ctx.lineWidth = isSelected ? 3 : 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  const sz = isSelected ? 8 : 6;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - sz); ctx.lineTo(pos.x + sz, pos.y); ctx.lineTo(pos.x, pos.y + sz); ctx.lineTo(pos.x - sz, pos.y); ctx.closePath();
  ctx.fillStyle = isSelected ? '#FFD700' : bone.color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? '#FFD700' : bone.color;
  ctx.fill();
  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'center';
  ctx.fillText(bone.name, pos.x, pos.y - 12);
  if (bone.locked) {
    ctx.fillStyle = 'rgba(255,100,100,0.8)';
    ctx.fillText('🔒', pos.x + 15, pos.y - 12);
  }
}
