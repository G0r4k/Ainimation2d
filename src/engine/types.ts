// ============================================================
// MOTIONFORGE 2D - TIPOS EXPANDIDOS
// ============================================================

export interface Vector2 {
  x: number;
  y: number;
}

export interface Transform {
  position: Vector2;
  rotation: number;
  scale: Vector2;
}

// ---- BONES & SKELETONS ----
export interface BoneData {
  id: string;
  name: string;
  parentId: string | null;
  localTransform: Transform;
  globalTransform: Transform;
  length: number;
  color: string;
  locked: boolean;
  visible: boolean;
}

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier' | 'elastic' | 'bounce';

export interface BezierControlPoints {
  cp1: Vector2;
  cp2: Vector2;
}

export interface KeyframeData {
  id: string;
  boneId: string;
  time: number;
  transform: Transform;
  easing: EasingType;
  bezierPoints?: BezierControlPoints;
  opacity?: number;
}

export interface AnimationData {
  id: string;
  name: string;
  duration: number;
  fps: number;
  keyframes: KeyframeData[];
  loop: boolean;
}

export interface AssetData {
  id: string;
  name: string;
  type: 'image' | 'sprite_sheet' | 'audio';
  src: string;
  width: number;
  height: number;
  frames?: number;
  frameWidth?: number;
  frameHeight?: number;
}

export interface SlotData {
  id: string;
  boneId: string;
  assetId: string | null;
  offset: Vector2;
  scale: Vector2;
  rotation: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
  opacity: number;
  zIndex: number;
}

// ---- CHARACTER ----
export interface CharacterData {
  id: string;
  name: string;
  bones: BoneData[];
  slots: SlotData[];
  animations: AnimationData[];
  visible: boolean;
  locked: boolean;
  position: Vector2;
  scale: Vector2;
  rotation: number;
  zIndex: number;
  color: string;
}

// ---- BACKGROUND / LAYER ----
export type BackgroundType = 'color' | 'image' | 'gradient' | 'parallax';

export interface BackgroundLayer {
  id: string;
  name: string;
  type: BackgroundType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  // Color/gradient
  color?: string;
  gradientColors?: string[];
  gradientAngle?: number;
  // Image
  assetId?: string;
  // Parallax
  parallaxFactor?: Vector2;
  scrollOffset?: Vector2;
  // Tile
  tiled?: boolean;
  tileSpacing?: Vector2;
  // Animation
  animated?: boolean;
  animationSpeed?: number;
}

// ---- CAMERA ----
export interface CameraData {
  id: string;
  name: string;
  position: Vector2;
  zoom: number;
  rotation: number;
  viewportWidth: number;
  viewportHeight: number;
  followTargetId?: string;
  followSmoothness: number;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  shake?: {
    intensity: number;
    duration: number;
  };
  active: boolean;
}

export interface CameraKeyframe {
  id: string;
  time: number;
  position: Vector2;
  zoom: number;
  rotation: number;
  easing: EasingType;
}

export interface CameraAnimation {
  id: string;
  name: string;
  duration: number;
  keyframes: CameraKeyframe[];
  loop: boolean;
}

// ---- SCENE ----
export interface SceneData {
  id: string;
  name: string;
  characters: CharacterData[];
  backgrounds: BackgroundLayer[];
  cameras: CameraData[];
  cameraAnimations: CameraAnimation[];
  activeCameraId: string | null;
  duration: number;
  fps: number;
  transition?: {
    type: 'fade' | 'slide' | 'dissolve' | 'none';
    duration: number;
  };
}

// ---- TRANSITION ----
export interface SceneTransition {
  type: 'fade' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down' | 'dissolve' | 'zoom_in' | 'zoom_out' | 'none';
  duration: number;
  easing: EasingType;
}

// ---- PROJECT ----
export interface ProjectData {
  id: string;
  name: string;
  scenes: SceneData[];
  activeSceneId: string | null;
  assets: AssetData[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  metadata: {
    author: string;
    version: string;
    created: string;
    modified: string;
    description: string;
  };
}

// ---- AGENT SYSTEM ----
export type AgentProvider = 'ollama' | 'groq' | 'huggingface' | 'openai' | 'claude' | 'openrouter' | 'opencode' | 'ngrok' | 'custom';

export interface AIModel {
  id: string;
  name: string;
  provider: AgentProvider;
  description?: string;
  contextLength?: number;
  pricing?: {
    input?: number;
    output?: number;
  };
  capabilities?: string[];
  status?: 'stable' | 'beta' | 'deprecated';
}

export interface NgrokTunnel {
  id: string;
  name: string;
  localPort: number;
  publicUrl?: string;
  status: 'inactive' | 'starting' | 'active' | 'error';
  authToken?: string;
  region?: string;
  protocol?: 'http' | 'tcp';
}

export interface AgentAPIConfig {
  id: string;
  name: string;
  provider: AgentProvider;
  baseUrl: string;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  customHeaders?: Record<string, string>;
  customBody?: Record<string, unknown>;
  ngrokTunnelId?: string;
}

export interface AgentTask {
  id: string;
  name: string;
  description: string;
  prompt: string;
  apiConfigId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AgentAction {
  type: 'generate_animation' | 'suggest_keyframes' | 'complete_animation' | 'generate_walk_cycle' | 'generate_idle' | 'lip_sync' | 'custom';
  params: Record<string, unknown>;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
}

export interface AgentSystemConfig {
  apis: AgentAPIConfig[];
  ngrokTunnels: NgrokTunnel[];
  tasks: AgentTask[];
  webhooks: WebhookConfig[];
  defaultApiId: string | null;
  autoSave: boolean;
  queueEnabled: boolean;
}

// ---- UI STATE ----
export interface UIState {
  selectedCharacterId: string | null;
  selectedBoneId: string | null;
  selectedAnimationId: string | null;
  selectedKeyframeId: string | null;
  selectedBackgroundId: string | null;
  selectedCameraId: string | null;
  activeTab: 'characters' | 'backgrounds' | 'cameras' | 'agents' | 'models' | 'ngrok';
  rightPanel: 'properties' | 'assets' | 'agents';
}
