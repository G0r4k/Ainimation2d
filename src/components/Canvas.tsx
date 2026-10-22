import { useRef, useEffect, useCallback, useState } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { Bone, calculateAllGlobalTransforms } from '../engine/Bone';
import { getEasingValue, lerpTransform } from '../engine/interpolation';
import { KeyframeData, Transform } from '../engine/types';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const {
    project,
    selectedSkeletonId,
    selectedBoneId,
    selectedAnimationId,
    currentTime,
    isPlaying,
    playbackSpeed,
    loop,
    zoom,
    panOffset,
    tool,
    showGrid,
    selectBone,
    updateBoneTransform,
    addBone,
    setCurrentTime,
    setPlaying,
    setPanOffset,
    setZoom,
  } = useAnimationStore();

  // Resize handler
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

  // Get interpolated transform for a bone at current time
  const getInterpolatedTransform = useCallback((boneId: string, time: number): Transform | null => {
    if (!selectedSkeletonId || !selectedAnimationId) return null;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return null;

    const animation = skeleton.animations.find(a => a.id === selectedAnimationId);
    if (!animation) return null;

    const boneKeyframes = animation.keyframes
      .filter(kf => kf.boneId === boneId)
      .sort((a, b) => a.time - b.time);

    if (boneKeyframes.length === 0) return null;
    if (boneKeyframes.length === 1) return boneKeyframes[0].transform;

    // Find surrounding keyframes
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
  }, [project, selectedSkeletonId, selectedAnimationId]);

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const animation = skeleton.animations.find(a => a.id === selectedAnimationId);
    if (!animation) return;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const framesPerSecond = animation.fps * playbackSpeed;
      const newTime = currentTime + delta * framesPerSecond;

      if (newTime >= animation.duration) {
        if (loop) {
          setCurrentTime(0);
        } else {
          setCurrentTime(animation.duration);
          setPlaying(false);
        }
      } else {
        setCurrentTime(newTime);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = 0;
    };
  }, [isPlaying, currentTime, playbackSpeed, loop, selectedSkeletonId, selectedAnimationId, project, setCurrentTime, setPlaying]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Background
    ctx.fillStyle = project.backgroundColor;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Apply zoom and pan
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    if (showGrid) {
      drawGrid(ctx, canvasSize.width, canvasSize.height, zoom);
    }

    // Draw skeleton
    if (selectedSkeletonId) {
      const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
      if (skeleton) {
        // Build bone map with interpolated transforms
        const boneMap = new Map<string, Bone>();
        skeleton.bones.forEach(boneData => {
          const bone = new Bone(boneData);
          // Apply interpolated transform if playing or animation exists
          if (selectedAnimationId) {
            const interpolated = getInterpolatedTransform(bone.id, currentTime);
            if (interpolated) {
              bone.localTransform = { ...interpolated };
            }
          }
          boneMap.set(bone.id, bone);
        });

        // Calculate global transforms
        calculateAllGlobalTransforms(boneMap);

        // Draw bones
        boneMap.forEach((bone) => {
          const isSelected = bone.id === selectedBoneId;
          drawBone(ctx, bone, boneMap, isSelected);
        });

        // Draw slots (sprites)
        skeleton.slots.forEach(slot => {
          const bone = boneMap.get(slot.boneId);
          if (bone && slot.assetId) {
            drawSlot(ctx, slot, bone, skeleton);
          }
        });
      }
    }

    ctx.restore();
  }, [canvasSize, project, selectedSkeletonId, selectedBoneId, selectedAnimationId, currentTime, zoom, panOffset, showGrid, tool, getInterpolatedTransform]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - panOffset.x) / zoom;
    const mouseY = (e.clientY - rect.top - panOffset.y) / zoom;

    if (tool === 'bone' && e.button === 0) {
      // Add bone at click position
      addBone(selectedBoneId);
      return;
    }

    if (tool === 'select' || tool === 'move') {
      // Try to select a bone
      const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
      if (skeleton) {
        const boneMap = new Map<string, Bone>();
        skeleton.bones.forEach(boneData => {
          const bone = new Bone(boneData);
          if (selectedAnimationId) {
            const interpolated = getInterpolatedTransform(bone.id, currentTime);
            if (interpolated) bone.localTransform = { ...interpolated };
          }
          boneMap.set(bone.id, bone);
        });
        calculateAllGlobalTransforms(boneMap);

        let closestBone: string | null = null;
        let closestDist = 20; // hit radius

        boneMap.forEach((bone) => {
          const dist = Math.sqrt(
            Math.pow(mouseX - bone.globalTransform.position.x, 2) +
            Math.pow(mouseY - bone.globalTransform.position.y, 2)
          );
          if (dist < closestDist) {
            closestDist = dist;
            closestBone = bone.id;
          }
        });

        if (closestBone) {
          selectBone(closestBone);
          setIsDragging(true);
          setDragStart({ x: mouseX, y: mouseY });
        } else {
          selectBone(null);
        }
      }
    }

    // Pan with middle mouse or when no bone selected
    if (e.button === 1 || (e.button === 0 && !selectedBoneId && tool === 'select')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    if (tool === 'move' && selectedBoneId) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - panOffset.x) / zoom;
      const mouseY = (e.clientY - rect.top - panOffset.y) / zoom;

      const dx = mouseX - dragStart.x;
      const dy = mouseY - dragStart.y;

      const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
      if (skeleton) {
        const bone = skeleton.bones.find(b => b.id === selectedBoneId);
        if (bone) {
          updateBoneTransform(selectedBoneId, {
            position: {
              x: bone.localTransform.position.x + dx,
              y: bone.localTransform.position.y + dy,
            },
          });
          setDragStart({ x: mouseX, y: mouseY });
        }
      }
    } else if (tool === 'rotate' && selectedBoneId) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - panOffset.x) / zoom;
      const mouseY = (e.clientY - rect.top - panOffset.y) / zoom;

      const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
      if (skeleton) {
        const bone = skeleton.bones.find(b => b.id === selectedBoneId);
        if (bone) {
          const angle = Math.atan2(mouseY - bone.globalTransform.position.y, mouseX - bone.globalTransform.position.x);
          updateBoneTransform(selectedBoneId, { rotation: angle });
        }
      }
    } else {
      // Pan
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  };

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-gray-900">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      {/* Info overlay */}
      <div className="absolute top-2 left-2 text-xs text-gray-400 bg-black/50 px-2 py-1 rounded">
        Zoom: {(zoom * 100).toFixed(0)}% | Frame: {currentTime.toFixed(1)}
      </div>
    </div>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, zoom: number) {
  const gridSize = 50;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1 / zoom;

  for (let x = 0; x < width / zoom; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height / zoom);
    ctx.stroke();
  }

  for (let y = 0; y < height / zoom; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width / zoom, y);
    ctx.stroke();
  }

  // Origin crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  ctx.moveTo(width / (2 * zoom), 0);
  ctx.lineTo(width / (2 * zoom), height / zoom);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, height / (2 * zoom));
  ctx.lineTo(width / zoom, height / (2 * zoom));
  ctx.stroke();
}

function drawBone(
  ctx: CanvasRenderingContext2D,
  bone: Bone,
  boneMap: Map<string, Bone>,
  isSelected: boolean
) {
  const pos = bone.globalTransform.position;
  const end = bone.getEndPoint();

  // Draw bone line
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = isSelected ? '#FFD700' : bone.color;
  ctx.lineWidth = isSelected ? 3 : 2;
  ctx.stroke();

  // Draw diamond shape for bone
  const size = isSelected ? 8 : 6;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - size);
  ctx.lineTo(pos.x + size, pos.y);
  ctx.lineTo(pos.x, pos.y + size);
  ctx.lineTo(pos.x - size, pos.y);
  ctx.closePath();
  ctx.fillStyle = isSelected ? '#FFD700' : bone.color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw end joint
  ctx.beginPath();
  ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? '#FFD700' : bone.color;
  ctx.fill();

  // Draw bone name
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'center';
  ctx.fillText(bone.name, pos.x, pos.y - 12);

  // Draw connection to parent
  if (bone.parentId) {
    const parent = boneMap.get(bone.parentId);
    if (parent) {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(parent.globalTransform.position.x, parent.globalTransform.position.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: { assetId: string | null; offset: { x: number; y: number }; scale: { x: number; y: number }; rotation: number; opacity: number },
  bone: Bone,
  skeleton: { assets: { id: string; src: string; width: number; height: number }[] }
) {
  if (!slot.assetId) return;
  const asset = skeleton.assets.find(a => a.id === slot.assetId);
  if (!asset) return;

  // Draw placeholder rectangle for the asset
  ctx.save();
  ctx.translate(
    bone.globalTransform.position.x + slot.offset.x,
    bone.globalTransform.position.y + slot.offset.y
  );
  ctx.rotate(bone.globalTransform.rotation + slot.rotation);
  ctx.scale(
    bone.globalTransform.scale.x * slot.scale.x,
    bone.globalTransform.scale.y * slot.scale.y
  );
  ctx.globalAlpha = slot.opacity;

  // Draw a colored rectangle as placeholder
  ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
  ctx.fillRect(-asset.width / 2, -asset.height / 2, asset.width, asset.height);
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-asset.width / 2, -asset.height / 2, asset.width, asset.height);

  ctx.restore();
}
