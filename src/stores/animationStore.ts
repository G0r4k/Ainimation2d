import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  BoneData,
  AnimationData,
  KeyframeData,
  Transform,
  EasingType,
  AssetData,
  SlotData,
  ProjectData,
} from '../engine/types';
import { getDefaultTransform } from '../engine/interpolation';

interface AnimationState {
  // Project
  project: ProjectData;
  selectedSkeletonId: string | null;
  selectedBoneId: string | null;
  selectedAnimationId: string | null;
  selectedKeyframeId: string | null;

  // Playback
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  loop: boolean;

  // UI
  zoom: number;
  panOffset: { x: number; y: number };
  tool: 'select' | 'move' | 'rotate' | 'scale' | 'bone';
  showGrid: boolean;

  // History (undo/redo)
  history: string[];
  historyIndex: number;

  // Actions
  createProject: (name: string) => void;
  addBone: (parentId: string | null, name?: string) => void;
  removeBone: (boneId: string) => void;
  selectBone: (boneId: string | null) => void;
  updateBoneTransform: (boneId: string, transform: Partial<Transform>) => void;
  updateBoneName: (boneId: string, name: string) => void;
  selectAnimation: (animationId: string | null) => void;
  createAnimation: (name: string, duration?: number) => void;
  removeAnimation: (animationId: string) => void;
  addKeyframe: (boneId: string, time: number, transform?: Transform) => void;
  removeKeyframe: (keyframeId: string) => void;
  updateKeyframe: (keyframeId: string, updates: Partial<KeyframeData>) => void;
  selectKeyframe: (keyframeId: string | null) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setTool: (tool: 'select' | 'move' | 'rotate' | 'scale' | 'bone') => void;
  toggleGrid: () => void;
  addAsset: (asset: AssetData) => void;
  removeAsset: (assetId: string) => void;
  addSlot: (boneId: string, assetId: string | null) => void;
  updateSlot: (slotId: string, updates: Partial<SlotData>) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
}

const BONE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

function createDefaultProject(): ProjectData {
  return {
    id: uuidv4(),
    name: 'Nuevo Proyecto',
    skeletons: [],
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: '#1a1a2e',
  };
}

function createDefaultSkeleton(): { id: string; name: string; bones: BoneData[]; slots: SlotData[]; animations: AnimationData[]; assets: AssetData[] } {
  const rootBoneId = uuidv4();
  return {
    id: uuidv4(),
    name: 'Personaje',
    bones: [
      {
        id: rootBoneId,
        name: 'Root',
        parentId: null,
        localTransform: {
          position: { x: 400, y: 400 },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
        globalTransform: {
          position: { x: 400, y: 400 },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
        length: 50,
        color: BONE_COLORS[0],
      },
    ],
    slots: [],
    animations: [],
    assets: [],
  };
}

export const useAnimationStore = create<AnimationState>((set, get) => ({
  project: createDefaultProject(),
  selectedSkeletonId: null,
  selectedBoneId: null,
  selectedAnimationId: null,
  selectedKeyframeId: null,
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 1,
  loop: true,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  tool: 'select',
  showGrid: true,
  history: [],
  historyIndex: -1,

  createProject: (name: string) => {
    const project = createDefaultProject();
    project.name = name;
    const skeleton = createDefaultSkeleton();
    
    // Add extra bones for demo
    const bone2Id = uuidv4();
    const bone3Id = uuidv4();
    const bone4Id = uuidv4();
    const bone5Id = uuidv4();
    
    skeleton.bones.push(
      {
        id: bone2Id,
        name: 'Torso',
        parentId: skeleton.bones[0].id,
        localTransform: {
          position: { x: 0, y: -60 },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
        globalTransform: {
          position: { x: 400, y: 340 },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
        length: 60,
        color: BONE_COLORS[1],
      },
      {
        id: bone3Id,
        name: 'Cabeza',
        parentId: bone2Id,
        localTransform: {
          position: { x: 0, y: -70 },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
        globalTransform: {
          position: { x: 400, y: 270 },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
        length: 30,
        color: BONE_COLORS[2],
      },
      {
        id: bone4Id,
        name: 'Brazo Der',
        parentId: bone2Id,
        localTransform: {
          position: { x: 30, y: 0 },
          rotation: 0.5,
          scale: { x: 1, y: 1 },
        },
        globalTransform: {
          position: { x: 430, y: 340 },
          rotation: 0.5,
          scale: { x: 1, y: 1 },
        },
        length: 50,
        color: BONE_COLORS[3],
      },
      {
        id: bone5Id,
        name: 'Brazo Izq',
        parentId: bone2Id,
        localTransform: {
          position: { x: -30, y: 0 },
          rotation: -0.5,
          scale: { x: 1, y: 1 },
        },
        globalTransform: {
          position: { x: 370, y: 340 },
          rotation: -0.5,
          scale: { x: 1, y: 1 },
        },
        length: 50,
        color: BONE_COLORS[4],
      }
    );
    
    // Create a demo animation with keyframes
    const demoAnimId = uuidv4();
    const rootId = skeleton.bones[0].id;
    
    skeleton.animations.push({
      id: demoAnimId,
      name: 'Idle',
      duration: 48,
      fps: 24,
      loop: true,
      keyframes: [
        // Root bone - subtle bob
        { id: uuidv4(), boneId: rootId, time: 0, transform: { position: { x: 400, y: 400 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: rootId, time: 12, transform: { position: { x: 400, y: 395 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: rootId, time: 24, transform: { position: { x: 400, y: 400 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: rootId, time: 36, transform: { position: { x: 400, y: 395 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: rootId, time: 48, transform: { position: { x: 400, y: 400 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        // Torso - slight sway
        { id: uuidv4(), boneId: bone2Id, time: 0, transform: { position: { x: 0, y: -60 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone2Id, time: 12, transform: { position: { x: 0, y: -60 }, rotation: 0.05, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone2Id, time: 24, transform: { position: { x: 0, y: -60 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone2Id, time: 36, transform: { position: { x: 0, y: -60 }, rotation: -0.05, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone2Id, time: 48, transform: { position: { x: 0, y: -60 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        // Head - look around
        { id: uuidv4(), boneId: bone3Id, time: 0, transform: { position: { x: 0, y: -70 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone3Id, time: 16, transform: { position: { x: 0, y: -70 }, rotation: 0.15, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone3Id, time: 32, transform: { position: { x: 0, y: -70 }, rotation: -0.15, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone3Id, time: 48, transform: { position: { x: 0, y: -70 }, rotation: 0, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        // Right arm - swing
        { id: uuidv4(), boneId: bone4Id, time: 0, transform: { position: { x: 30, y: 0 }, rotation: 0.5, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone4Id, time: 12, transform: { position: { x: 30, y: 0 }, rotation: 0.8, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone4Id, time: 24, transform: { position: { x: 30, y: 0 }, rotation: 0.5, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone4Id, time: 36, transform: { position: { x: 30, y: 0 }, rotation: 0.2, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone4Id, time: 48, transform: { position: { x: 30, y: 0 }, rotation: 0.5, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        // Left arm - opposite swing
        { id: uuidv4(), boneId: bone5Id, time: 0, transform: { position: { x: -30, y: 0 }, rotation: -0.5, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone5Id, time: 12, transform: { position: { x: -30, y: 0 }, rotation: -0.2, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone5Id, time: 24, transform: { position: { x: -30, y: 0 }, rotation: -0.5, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone5Id, time: 36, transform: { position: { x: -30, y: 0 }, rotation: -0.8, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
        { id: uuidv4(), boneId: bone5Id, time: 48, transform: { position: { x: -30, y: 0 }, rotation: -0.5, scale: { x: 1, y: 1 } }, easing: 'easeInOut' },
      ],
    });
    
    project.skeletons.push(skeleton);
    set({
      project,
      selectedSkeletonId: skeleton.id,
      selectedBoneId: skeleton.bones[0]?.id || null,
      selectedAnimationId: demoAnimId,
    });
  },

  addBone: (parentId: string | null, name?: string) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const parentBone = parentId ? skeleton.bones.find(b => b.id === parentId) : undefined;
    const position = parentBone
      ? { x: parentBone.localTransform.position.x + parentBone.length, y: parentBone.localTransform.position.y }
      : { x: 400, y: 300 };

    const newBone: BoneData = {
      id: uuidv4(),
      name: name || `Bone_${skeleton.bones.length}`,
      parentId,
      localTransform: {
        position: parentBone ? { x: parentBone.length, y: 0 } : position,
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
      globalTransform: {
        position,
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
      length: 50,
      color: BONE_COLORS[skeleton.bones.length % BONE_COLORS.length],
    };

    skeleton.bones.push(newBone);
    set({ project: { ...project }, selectedBoneId: newBone.id });
  },

  removeBone: (boneId: string) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    // Remove bone and all children
    const toRemove = new Set<string>();
    const allBones = skeleton.bones;
    function findChildren(id: string) {
      toRemove.add(id);
      allBones.filter(b => b.parentId === id).forEach(b => findChildren(b.id));
    }
    findChildren(boneId);

    skeleton.bones = skeleton.bones.filter(b => !toRemove.has(b.id));
    skeleton.slots = skeleton.slots.filter(s => !toRemove.has(s.boneId));

    // Remove keyframes for removed bones
    skeleton.animations.forEach(anim => {
      anim.keyframes = anim.keyframes.filter(kf => !toRemove.has(kf.boneId));
    });

    set({
      project: { ...project },
      selectedBoneId: null,
      selectedKeyframeId: null,
    });
  },

  selectBone: (boneId: string | null) => {
    set({ selectedBoneId: boneId });
  },

  updateBoneTransform: (boneId: string, transform: Partial<Transform>) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const bone = skeleton.bones.find(b => b.id === boneId);
    if (!bone) return;

    if (transform.position) bone.localTransform.position = { ...transform.position };
    if (transform.rotation !== undefined) bone.localTransform.rotation = transform.rotation;
    if (transform.scale) bone.localTransform.scale = { ...transform.scale };

    set({ project: { ...project } });
  },

  updateBoneName: (boneId: string, name: string) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const bone = skeleton.bones.find(b => b.id === boneId);
    if (!bone) return;

    bone.name = name;
    set({ project: { ...project } });
  },

  selectAnimation: (animationId: string | null) => {
    set({ selectedAnimationId: animationId, selectedKeyframeId: null, currentTime: 0 });
  },

  createAnimation: (name: string, duration: number = 60) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const newAnimation: AnimationData = {
      id: uuidv4(),
      name,
      duration,
      fps: 24,
      keyframes: [],
      loop: true,
    };

    skeleton.animations.push(newAnimation);
    set({ project: { ...project }, selectedAnimationId: newAnimation.id });
  },

  removeAnimation: (animationId: string) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    skeleton.animations = skeleton.animations.filter(a => a.id !== animationId);
    set({
      project: { ...project },
      selectedAnimationId: null,
      selectedKeyframeId: null,
    });
  },

  addKeyframe: (boneId: string, time: number, transform?: Transform) => {
    const { project, selectedSkeletonId, selectedAnimationId } = get();
    if (!selectedSkeletonId || !selectedAnimationId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const animation = skeleton.animations.find(a => a.id === selectedAnimationId);
    if (!animation) return;

    const bone = skeleton.bones.find(b => b.id === boneId);
    if (!bone) return;

    // Remove existing keyframe at same time for same bone
    animation.keyframes = animation.keyframes.filter(
      kf => !(kf.boneId === boneId && kf.time === time)
    );

    const newKeyframe: KeyframeData = {
      id: uuidv4(),
      boneId,
      time,
      transform: transform ? { ...transform } : { ...bone.localTransform },
      easing: 'easeInOut',
    };

    animation.keyframes.push(newKeyframe);
    animation.keyframes.sort((a, b) => a.time - b.time);

    set({ project: { ...project }, selectedKeyframeId: newKeyframe.id });
  },

  removeKeyframe: (keyframeId: string) => {
    const { project, selectedSkeletonId, selectedAnimationId } = get();
    if (!selectedSkeletonId || !selectedAnimationId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const animation = skeleton.animations.find(a => a.id === selectedAnimationId);
    if (!animation) return;

    animation.keyframes = animation.keyframes.filter(kf => kf.id !== keyframeId);
    set({ project: { ...project }, selectedKeyframeId: null });
  },

  updateKeyframe: (keyframeId: string, updates: Partial<KeyframeData>) => {
    const { project, selectedSkeletonId, selectedAnimationId } = get();
    if (!selectedSkeletonId || !selectedAnimationId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const animation = skeleton.animations.find(a => a.id === selectedAnimationId);
    if (!animation) return;

    const keyframe = animation.keyframes.find(kf => kf.id === keyframeId);
    if (!keyframe) return;

    if (updates.time !== undefined) keyframe.time = updates.time;
    if (updates.transform) keyframe.transform = { ...updates.transform };
    if (updates.easing) keyframe.easing = updates.easing;
    if (updates.bezierPoints) keyframe.bezierPoints = { ...updates.bezierPoints };

    animation.keyframes.sort((a, b) => a.time - b.time);
    set({ project: { ...project } });
  },

  selectKeyframe: (keyframeId: string | null) => {
    set({ selectedKeyframeId: keyframeId });
  },

  setCurrentTime: (time: number) => {
    set({ currentTime: time });
  },

  setPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  setLoop: (loop: boolean) => {
    set({ loop });
  },

  setZoom: (zoom: number) => {
    set({ zoom: Math.max(0.1, Math.min(5, zoom)) });
  },

  setPanOffset: (offset: { x: number; y: number }) => {
    set({ panOffset: offset });
  },

  setTool: (tool: 'select' | 'move' | 'rotate' | 'scale' | 'bone') => {
    set({ tool });
  },

  toggleGrid: () => {
    set({ showGrid: !get().showGrid });
  },

  addAsset: (asset: AssetData) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    skeleton.assets.push(asset);
    set({ project: { ...project } });
  },

  removeAsset: (assetId: string) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    skeleton.assets = skeleton.assets.filter(a => a.id !== assetId);
    skeleton.slots = skeleton.slots.filter(s => s.assetId !== assetId);
    set({ project: { ...project } });
  },

  addSlot: (boneId: string, assetId: string | null) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const newSlot: SlotData = {
      id: uuidv4(),
      boneId,
      assetId,
      offset: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      blendMode: 'normal',
      opacity: 1,
    };

    skeleton.slots.push(newSlot);
    set({ project: { ...project } });
  },

  updateSlot: (slotId: string, updates: Partial<SlotData>) => {
    const { project, selectedSkeletonId } = get();
    if (!selectedSkeletonId) return;

    const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
    if (!skeleton) return;

    const slot = skeleton.slots.find(s => s.id === slotId);
    if (!slot) return;

    Object.assign(slot, updates);
    set({ project: { ...project } });
  },

  exportProject: () => {
    const { project } = get();
    return JSON.stringify(project, null, 2);
  },

  importProject: (json: string) => {
    try {
      const project = JSON.parse(json) as ProjectData;
      set({
        project,
        selectedSkeletonId: project.skeletons[0]?.id || null,
        selectedBoneId: null,
        selectedAnimationId: null,
        selectedKeyframeId: null,
        currentTime: 0,
        isPlaying: false,
      });
    } catch (e) {
      console.error('Error importing project:', e);
    }
  },
}));
