export interface Vector2 {
  x: number;
  y: number;
}

export interface Transform {
  position: Vector2;
  rotation: number; // radians
  scale: Vector2;
}

export interface BoneData {
  id: string;
  name: string;
  parentId: string | null;
  localTransform: Transform;
  globalTransform: Transform;
  length: number;
  color: string;
}

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier';

export interface BezierControlPoints {
  cp1: Vector2;
  cp2: Vector2;
}

export interface KeyframeData {
  id: string;
  boneId: string;
  time: number; // frame number
  transform: Transform;
  easing: EasingType;
  bezierPoints?: BezierControlPoints;
}

export interface AnimationData {
  id: string;
  name: string;
  duration: number; // in frames
  fps: number;
  keyframes: KeyframeData[];
  loop: boolean;
}

export interface AssetData {
  id: string;
  name: string;
  type: 'image';
  src: string;
  width: number;
  height: number;
}

export interface SlotData {
  id: string;
  boneId: string;
  assetId: string | null;
  offset: Vector2;
  scale: Vector2;
  rotation: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  opacity: number;
}

export interface SkeletonData {
  id: string;
  name: string;
  bones: BoneData[];
  slots: SlotData[];
  animations: AnimationData[];
  assets: AssetData[];
}

export interface ProjectData {
  id: string;
  name: string;
  skeletons: SkeletonData[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
}
