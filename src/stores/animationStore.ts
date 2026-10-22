import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  BoneData, AnimationData, KeyframeData, Transform, EasingType,
  AssetData, SlotData, ProjectData, SceneData, CharacterData,
  BackgroundLayer, CameraData, CameraAnimation, AgentSystemConfig,
  AgentAPIConfig, AgentTask, WebhookConfig, AgentProvider, AIModel, NgrokTunnel,
} from '../engine/types';
import { getDefaultTransform } from '../engine/interpolation';

const BONE_COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#F0B27A','#82E0AA'];
const CHAR_COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD'];

function createDefaultCharacter(name: string, pos = { x: 400, y: 400 }): CharacterData {
  const rootId = uuidv4();
  const torsoId = uuidv4();
  const headId = uuidv4();
  const armLId = uuidv4();
  const armRId = uuidv4();
  const legLId = uuidv4();
  const legRId = uuidv4();

  const bones: BoneData[] = [
    { id: rootId, name: 'Root', parentId: null, localTransform: { position: pos, rotation: 0, scale: { x: 1, y: 1 } }, globalTransform: { position: pos, rotation: 0, scale: { x: 1, y: 1 } }, length: 40, color: BONE_COLORS[0], locked: false, visible: true },
    { id: torsoId, name: 'Torso', parentId: rootId, localTransform: { position: { x: 0, y: -50 }, rotation: 0, scale: { x: 1, y: 1 } }, globalTransform: { position: { x: pos.x, y: pos.y - 50 }, rotation: 0, scale: { x: 1, y: 1 } }, length: 55, color: BONE_COLORS[1], locked: false, visible: true },
    { id: headId, name: 'Cabeza', parentId: torsoId, localTransform: { position: { x: 0, y: -60 }, rotation: 0, scale: { x: 1, y: 1 } }, globalTransform: { position: { x: pos.x, y: pos.y - 110 }, rotation: 0, scale: { x: 1, y: 1 } }, length: 25, color: BONE_COLORS[2], locked: false, visible: true },
    { id: armLId, name: 'Brazo Izq', parentId: torsoId, localTransform: { position: { x: -25, y: 0 }, rotation: -0.4, scale: { x: 1, y: 1 } }, globalTransform: { position: { x: pos.x - 25, y: pos.y - 50 }, rotation: -0.4, scale: { x: 1, y: 1 } }, length: 45, color: BONE_COLORS[3], locked: false, visible: true },
    { id: armRId, name: 'Brazo Der', parentId: torsoId, localTransform: { position: { x: 25, y: 0 }, rotation: 0.4, scale: { x: 1, y: 1 } }, globalTransform: { position: { x: pos.x + 25, y: pos.y - 50 }, rotation: 0.4, scale: { x: 1, y: 1 } }, length: 45, color: BONE_COLORS[4], locked: false, visible: true },
    { id: legLId, name: 'Pierna Izq', parentId: rootId, localTransform: { position: { x: -15, y: 0 }, rotation: 1.57, scale: { x: 1, y: 1 } }, globalTransform: { position: { x: pos.x - 15, y: pos.y }, rotation: 1.57, scale: { x: 1, y: 1 } }, length: 50, color: BONE_COLORS[5], locked: false, visible: true },
    { id: legRId, name: 'Pierna Der', parentId: rootId, localTransform: { position: { x: 15, y: 0 }, rotation: 1.57, scale: { x: 1, y: 1 } }, globalTransform: { position: { x: pos.x + 15, y: pos.y }, rotation: 1.57, scale: { x: 1, y: 1 } }, length: 50, color: BONE_COLORS[6], locked: false, visible: true },
  ];

  return {
    id: uuidv4(),
    name,
    bones,
    slots: [],
    animations: [],
    visible: true,
    locked: false,
    position: pos,
    scale: { x: 1, y: 1 },
    rotation: 0,
    zIndex: 0,
    color: CHAR_COLORS[0],
  };
}

function createDefaultScene(name: string): SceneData {
  const char = createDefaultCharacter('Personaje 1');
  const camId = uuidv4();
  return {
    id: uuidv4(),
    name,
    characters: [char],
    backgrounds: [
      { id: uuidv4(), name: 'Fondo', type: 'gradient', visible: true, locked: false, opacity: 1, zIndex: -10, gradientColors: ['#1a1a2e', '#16213e', '#0f3460'], gradientAngle: 180 },
      { id: uuidv4(), name: 'Suelo', type: 'color', visible: true, locked: false, opacity: 0.8, zIndex: -5, color: '#2d3436' },
    ],
    cameras: [
      { id: camId, name: 'Principal', position: { x: 400, y: 300 }, zoom: 1, rotation: 0, viewportWidth: 800, viewportHeight: 600, followSmoothness: 0.1, active: true },
    ],
    cameraAnimations: [],
    activeCameraId: camId,
    duration: 120,
    fps: 24,
    transition: { type: 'fade', duration: 0.5 },
  };
}

function createDefaultProject(): ProjectData {
  const scene = createDefaultScene('Escena 1');
  return {
    id: uuidv4(),
    name: 'Mi Proyecto',
    scenes: [scene],
    activeSceneId: scene.id,
    assets: [],
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: '#1a1a2e',
    metadata: { author: '', version: '1.0.0', created: new Date().toISOString(), modified: new Date().toISOString(), description: '' },
  };
}

interface AppState {
  project: ProjectData;
  // Selections
  selectedCharacterId: string | null;
  selectedBoneId: string | null;
  selectedAnimationId: string | null;
  selectedKeyframeId: string | null;
  selectedBackgroundId: string | null;
  selectedCameraId: string | null;
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
  activeTab: 'characters' | 'backgrounds' | 'cameras' | 'agents' | 'models' | 'ngrok';
  // Agent system
  agentConfig: AgentSystemConfig;
  // Helpers
  getActiveScene: () => SceneData | undefined;
  getActiveCharacter: () => CharacterData | undefined;
  getActiveCamera: () => CameraData | undefined;
  // Project actions
  createProject: (name: string) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
  // Scene actions
  addScene: (name: string) => void;
  removeScene: (id: string) => void;
  setActiveScene: (id: string) => void;
  // Character actions
  addCharacter: (name?: string) => void;
  removeCharacter: (id: string) => void;
  selectCharacter: (id: string | null) => void;
  updateCharacterPosition: (id: string, pos: { x: number; y: number }) => void;
  // Bone actions
  addBone: (parentId: string | null, name?: string) => void;
  removeBone: (boneId: string) => void;
  selectBone: (id: string | null) => void;
  updateBoneTransform: (boneId: string, t: Partial<Transform>) => void;
  updateBoneName: (boneId: string, name: string) => void;
  toggleBoneLock: (boneId: string) => void;
  toggleBoneVisibility: (boneId: string) => void;
  // Animation actions
  addAnimation: (name: string, duration?: number) => void;
  removeAnimation: (id: string) => void;
  selectAnimation: (id: string | null) => void;
  addKeyframe: (boneId: string, time: number, transform?: Transform) => void;
  removeKeyframe: (id: string) => void;
  updateKeyframe: (id: string, updates: Partial<KeyframeData>) => void;
  selectKeyframe: (id: string | null) => void;
  // Background actions
  addBackground: (layer: Partial<BackgroundLayer>) => void;
  removeBackground: (id: string) => void;
  updateBackground: (id: string, updates: Partial<BackgroundLayer>) => void;
  selectBackground: (id: string | null) => void;
  // Camera actions
  addCamera: (name: string) => void;
  removeCamera: (id: string) => void;
  selectCamera: (id: string | null) => void;
  updateCamera: (id: string, updates: Partial<CameraData>) => void;
  setActiveCamera: (id: string) => void;
  // Asset actions
  addAsset: (asset: AssetData) => void;
  removeAsset: (id: string) => void;
  addSlot: (boneId: string, assetId: string | null) => void;
  updateSlot: (slotId: string, updates: Partial<SlotData>) => void;
  removeSlot: (slotId: string) => void;
  // Playback
  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setPlaybackSpeed: (s: number) => void;
  setLoop: (l: boolean) => void;
  // UI
  setZoom: (z: number) => void;
  setPanOffset: (o: { x: number; y: number }) => void;
  setTool: (t: 'select' | 'move' | 'rotate' | 'scale' | 'bone') => void;
  toggleGrid: () => void;
  setActiveTab: (t: 'characters' | 'backgrounds' | 'cameras' | 'agents' | 'models' | 'ngrok') => void;
  // Agent actions
  addAgentAPI: (config: Omit<AgentAPIConfig, 'id'>) => void;
  removeAgentAPI: (id: string) => void;
  updateAgentAPI: (id: string, updates: Partial<AgentAPIConfig>) => void;
  setDefaultAgentAPI: (id: string | null) => void;
  addAgentTask: (task: Omit<AgentTask, 'id' | 'status' | 'createdAt'>) => void;
  runAgentTask: (taskId: string) => Promise<void>;
  removeAgentTask: (id: string) => void;
  addWebhook: (config: Omit<WebhookConfig, 'id'>) => void;
  removeWebhook: (id: string) => void;
  updateWebhook: (id: string, updates: Partial<WebhookConfig>) => void;
  // Ngrok actions
  addNgrokTunnel: (tunnel: Omit<NgrokTunnel, 'id' | 'status' | 'publicUrl'>) => void;
  removeNgrokTunnel: (id: string) => void;
  startNgrokTunnel: (id: string) => Promise<void>;
  stopNgrokTunnel: (id: string) => void;
  // Model listing
  fetchModelsForProvider: (provider: AgentProvider, apiKey?: string, baseUrl?: string) => Promise<AIModel[]>;
}

export const useAnimationStore = create<AppState>((set, get) => ({
  project: createDefaultProject(),
  selectedCharacterId: null,
  selectedBoneId: null,
  selectedAnimationId: null,
  selectedKeyframeId: null,
  selectedBackgroundId: null,
  selectedCameraId: null,
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 1,
  loop: true,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  tool: 'select',
  showGrid: true,
  activeTab: 'characters',
  agentConfig: {
    apis: [
      { id: 'ollama-local', name: 'Ollama Local', provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3', maxTokens: 2048, temperature: 0.7, enabled: true },
      { id: 'groq-free', name: 'Groq (Gratis)', provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', model: 'llama-3.1-70b-versatile', maxTokens: 4096, temperature: 0.7, enabled: false },
      { id: 'hf-free', name: 'HuggingFace', provider: 'huggingface', baseUrl: 'https://api-inference.huggingface.co/models', apiKey: '', model: 'mistralai/Mistral-7B-Instruct-v0.2', maxTokens: 2048, temperature: 0.7, enabled: false },
      { id: 'openai-api', name: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', maxTokens: 4096, temperature: 0.7, enabled: false },
      { id: 'claude-api', name: 'Claude', provider: 'claude', baseUrl: 'https://api.anthropic.com/v1', apiKey: '', model: 'claude-3-5-sonnet-20241022', maxTokens: 4096, temperature: 0.7, enabled: false },
      { id: 'openrouter-api', name: 'OpenRouter', provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', model: 'openai/gpt-4o-mini', maxTokens: 4096, temperature: 0.7, enabled: false },
      { id: 'opencode-api', name: 'OpenCode', provider: 'opencode', baseUrl: 'https://api.opencode.ai/v1', apiKey: '', model: 'codellama-34b', maxTokens: 4096, temperature: 0.7, enabled: false },
    ],
    ngrokTunnels: [],
    tasks: [],
    webhooks: [],
    defaultApiId: 'ollama-local',
    autoSave: true,
    queueEnabled: true,
  },

  getActiveScene: () => {
    const { project } = get();
    return project.scenes.find(s => s.id === project.activeSceneId);
  },
  getActiveCharacter: () => {
    const scene = get().getActiveScene();
    if (!scene) return undefined;
    return scene.characters.find(c => c.id === get().selectedCharacterId) || scene.characters[0];
  },
  getActiveCamera: () => {
    const scene = get().getActiveScene();
    if (!scene) return undefined;
    return scene.cameras.find(c => c.id === scene.activeCameraId);
  },

  createProject: (name: string) => {
    const project = createDefaultProject();
    project.name = name;
    const scene = project.scenes[0];
    set({ project, selectedCharacterId: scene.characters[0].id, selectedBoneId: scene.characters[0].bones[0].id });
  },

  exportProject: () => JSON.stringify(get().project, null, 2),
  importProject: (json: string) => {
    try {
      const project = JSON.parse(json) as ProjectData;
      const scene = project.scenes[0];
      set({ project, selectedCharacterId: scene?.characters[0]?.id || null, selectedBoneId: null, selectedAnimationId: null, selectedKeyframeId: null, currentTime: 0, isPlaying: false });
    } catch (e) { console.error(e); }
  },

  addScene: (name: string) => {
    const { project } = get();
    const scene = createDefaultScene(name);
    project.scenes.push(scene);
    set({ project: { ...project }, activeTab: 'characters' });
  },
  removeScene: (id: string) => {
    const { project } = get();
    if (project.scenes.length <= 1) return;
    project.scenes = project.scenes.filter(s => s.id !== id);
    if (project.activeSceneId === id) project.activeSceneId = project.scenes[0].id;
    set({ project: { ...project } });
  },
  setActiveScene: (id: string) => {
    set({ project: { ...get().project, activeSceneId: id }, selectedCharacterId: null, selectedBoneId: null, selectedAnimationId: null, currentTime: 0 });
  },

  addCharacter: (name?: string) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const char = createDefaultCharacter(name || `Personaje ${scene.characters.length + 1}`, { x: 300 + scene.characters.length * 100, y: 400 });
    char.color = CHAR_COLORS[scene.characters.length % CHAR_COLORS.length];
    scene.characters.push(char);
    set({ project: { ...get().project }, selectedCharacterId: char.id, selectedBoneId: char.bones[0].id });
  },
  removeCharacter: (id: string) => {
    const scene = get().getActiveScene();
    if (!scene || scene.characters.length <= 1) return;
    scene.characters = scene.characters.filter(c => c.id !== id);
    set({ project: { ...get().project }, selectedCharacterId: scene.characters[0]?.id || null, selectedBoneId: null });
  },
  selectCharacter: (id: string | null) => set({ selectedCharacterId: id, selectedBoneId: null, selectedAnimationId: null }),
  updateCharacterPosition: (id: string, pos: { x: number; y: number }) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const char = scene.characters.find(c => c.id === id);
    if (char) { char.position = pos; set({ project: { ...get().project } }); }
  },

  addBone: (parentId: string | null, name?: string) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const parent = parentId ? char.bones.find(b => b.id === parentId) : undefined;
    const pos = parent ? { x: parent.localTransform.position.x + parent.length, y: parent.localTransform.position.y } : { x: 400, y: 300 };
    const newBone: BoneData = {
      id: uuidv4(), name: name || `Hueso_${char.bones.length}`, parentId,
      localTransform: { position: parent ? { x: parent.length, y: 0 } : pos, rotation: 0, scale: { x: 1, y: 1 } },
      globalTransform: { position: pos, rotation: 0, scale: { x: 1, y: 1 } },
      length: 50, color: BONE_COLORS[char.bones.length % BONE_COLORS.length], locked: false, visible: true,
    };
    char.bones.push(newBone);
    set({ project: { ...get().project }, selectedBoneId: newBone.id });
  },
  removeBone: (boneId: string) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const toRemove = new Set<string>();
    const allBones = char.bones;
    function findChildren(id: string) { toRemove.add(id); allBones.filter(b => b.parentId === id).forEach(b => findChildren(b.id)); }
    findChildren(boneId);
    char.bones = char.bones.filter(b => !toRemove.has(b.id));
    char.slots = char.slots.filter(s => !toRemove.has(s.boneId));
    char.animations.forEach(a => { a.keyframes = a.keyframes.filter(kf => !toRemove.has(kf.boneId)); });
    set({ project: { ...get().project }, selectedBoneId: null, selectedKeyframeId: null });
  },
  selectBone: (id: string | null) => set({ selectedBoneId: id }),
  updateBoneTransform: (boneId: string, t: Partial<Transform>) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const bone = char.bones.find(b => b.id === boneId);
    if (!bone) return;
    if (t.position) bone.localTransform.position = { ...t.position };
    if (t.rotation !== undefined) bone.localTransform.rotation = t.rotation;
    if (t.scale) bone.localTransform.scale = { ...t.scale };
    set({ project: { ...get().project } });
  },
  updateBoneName: (boneId: string, name: string) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const bone = char.bones.find(b => b.id === boneId);
    if (bone) { bone.name = name; set({ project: { ...get().project } }); }
  },
  toggleBoneLock: (boneId: string) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const bone = char.bones.find(b => b.id === boneId);
    if (bone) { bone.locked = !bone.locked; set({ project: { ...get().project } }); }
  },
  toggleBoneVisibility: (boneId: string) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const bone = char.bones.find(b => b.id === boneId);
    if (bone) { bone.visible = !bone.visible; set({ project: { ...get().project } }); }
  },

  addAnimation: (name: string, duration = 60) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const anim: AnimationData = { id: uuidv4(), name, duration, fps: 24, keyframes: [], loop: true };
    char.animations.push(anim);
    set({ project: { ...get().project }, selectedAnimationId: anim.id });
  },
  removeAnimation: (id: string) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    char.animations = char.animations.filter(a => a.id !== id);
    set({ project: { ...get().project }, selectedAnimationId: null, selectedKeyframeId: null });
  },
  selectAnimation: (id: string | null) => set({ selectedAnimationId: id, selectedKeyframeId: null, currentTime: 0 }),
  addKeyframe: (boneId: string, time: number, transform?: Transform) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const anim = char.animations.find(a => a.id === get().selectedAnimationId);
    if (!anim) return;
    const bone = char.bones.find(b => b.id === boneId);
    if (!bone) return;
    anim.keyframes = anim.keyframes.filter(kf => !(kf.boneId === boneId && kf.time === time));
    const kf: KeyframeData = { id: uuidv4(), boneId, time, transform: transform || { ...bone.localTransform }, easing: 'easeInOut' };
    anim.keyframes.push(kf);
    anim.keyframes.sort((a, b) => a.time - b.time);
    set({ project: { ...get().project }, selectedKeyframeId: kf.id });
  },
  removeKeyframe: (id: string) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const anim = char.animations.find(a => a.id === get().selectedAnimationId);
    if (!anim) return;
    anim.keyframes = anim.keyframes.filter(kf => kf.id !== id);
    set({ project: { ...get().project }, selectedKeyframeId: null });
  },
  updateKeyframe: (id: string, updates: Partial<KeyframeData>) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const anim = char.animations.find(a => a.id === get().selectedAnimationId);
    if (!anim) return;
    const kf = anim.keyframes.find(k => k.id === id);
    if (!kf) return;
    if (updates.time !== undefined) kf.time = updates.time;
    if (updates.transform) kf.transform = { ...updates.transform };
    if (updates.easing) kf.easing = updates.easing;
    anim.keyframes.sort((a, b) => a.time - b.time);
    set({ project: { ...get().project } });
  },
  selectKeyframe: (id: string | null) => set({ selectedKeyframeId: id }),

  addBackground: (layer: Partial<BackgroundLayer>) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const bg: BackgroundLayer = { id: uuidv4(), name: layer.name || 'Capa', type: layer.type || 'color', visible: true, locked: false, opacity: 1, zIndex: layer.zIndex || 0, ...layer };
    scene.backgrounds.push(bg);
    set({ project: { ...get().project } });
  },
  removeBackground: (id: string) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    scene.backgrounds = scene.backgrounds.filter(b => b.id !== id);
    set({ project: { ...get().project } });
  },
  updateBackground: (id: string, updates: Partial<BackgroundLayer>) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const bg = scene.backgrounds.find(b => b.id === id);
    if (bg) { Object.assign(bg, updates); set({ project: { ...get().project } }); }
  },
  selectBackground: (id: string | null) => set({ selectedBackgroundId: id }),

  addCamera: (name: string) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const cam: CameraData = { id: uuidv4(), name, position: { x: 400, y: 300 }, zoom: 1, rotation: 0, viewportWidth: 800, viewportHeight: 600, followSmoothness: 0.1, active: false };
    scene.cameras.push(cam);
    set({ project: { ...get().project } });
  },
  removeCamera: (id: string) => {
    const scene = get().getActiveScene();
    if (!scene || scene.cameras.length <= 1) return;
    scene.cameras = scene.cameras.filter(c => c.id !== id);
    if (scene.activeCameraId === id) scene.activeCameraId = scene.cameras[0].id;
    set({ project: { ...get().project } });
  },
  selectCamera: (id: string | null) => set({ selectedCameraId: id }),
  updateCamera: (id: string, updates: Partial<CameraData>) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const cam = scene.cameras.find(c => c.id === id);
    if (cam) { Object.assign(cam, updates); set({ project: { ...get().project } }); }
  },
  setActiveCamera: (id: string) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    scene.cameras.forEach(c => c.active = c.id === id);
    scene.activeCameraId = id;
    set({ project: { ...get().project } });
  },

  addAsset: (asset: AssetData) => {
    const { project } = get();
    project.assets.push(asset);
    set({ project: { ...project } });
  },
  removeAsset: (id: string) => {
    const { project } = get();
    project.assets = project.assets.filter(a => a.id !== id);
    set({ project: { ...project } });
  },
  addSlot: (boneId: string, assetId: string | null) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const slot: SlotData = {
      id: uuidv4(),
      boneId,
      assetId,
      offset: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      blendMode: 'normal',
      opacity: 1,
      zIndex: char.slots.length,
    };
    char.slots.push(slot);
    set({ project: { ...get().project } });
  },
  updateSlot: (slotId: string, updates: Partial<SlotData>) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    const slot = char.slots.find(s => s.id === slotId);
    if (slot) { Object.assign(slot, updates); set({ project: { ...get().project } }); }
  },
  removeSlot: (slotId: string) => {
    const char = get().getActiveCharacter();
    if (!char) return;
    char.slots = char.slots.filter(s => s.id !== slotId);
    set({ project: { ...get().project } });
  },

  setCurrentTime: (t: number) => set({ currentTime: t }),
  setPlaying: (p: boolean) => set({ isPlaying: p }),
  setPlaybackSpeed: (s: number) => set({ playbackSpeed: s }),
  setLoop: (l: boolean) => set({ loop: l }),
  setZoom: (z: number) => set({ zoom: Math.max(0.1, Math.min(5, z)) }),
  setPanOffset: (o: { x: number; y: number }) => set({ panOffset: o }),
  setTool: (t: 'select' | 'move' | 'rotate' | 'scale' | 'bone') => set({ tool: t }),
  toggleGrid: () => set({ showGrid: !get().showGrid }),
  setActiveTab: (t: 'characters' | 'backgrounds' | 'cameras' | 'agents' | 'models' | 'ngrok') => set({ activeTab: t }),

  addAgentAPI: (config: Omit<AgentAPIConfig, 'id'>) => {
    const { agentConfig } = get();
    agentConfig.apis.push({ ...config, id: uuidv4() });
    set({ agentConfig: { ...agentConfig } });
  },
  removeAgentAPI: (id: string) => {
    const { agentConfig } = get();
    agentConfig.apis = agentConfig.apis.filter(a => a.id !== id);
    if (agentConfig.defaultApiId === id) agentConfig.defaultApiId = agentConfig.apis[0]?.id || null;
    set({ agentConfig: { ...agentConfig } });
  },
  updateAgentAPI: (id: string, updates: Partial<AgentAPIConfig>) => {
    const { agentConfig } = get();
    const api = agentConfig.apis.find(a => a.id === id);
    if (api) { Object.assign(api, updates); set({ agentConfig: { ...agentConfig } }); }
  },
  setDefaultAgentAPI: (id: string | null) => {
    const { agentConfig } = get();
    agentConfig.defaultApiId = id;
    set({ agentConfig: { ...agentConfig } });
  },
  addAgentTask: (task: Omit<AgentTask, 'id' | 'status' | 'createdAt'>) => {
    const { agentConfig } = get();
    agentConfig.tasks.push({ ...task, id: uuidv4(), status: 'idle', createdAt: new Date().toISOString() });
    set({ agentConfig: { ...agentConfig } });
  },
  runAgentTask: async (taskId: string) => {
    const { agentConfig } = get();
    const task = agentConfig.tasks.find(t => t.id === taskId);
    if (!task) return;
    const api = agentConfig.apis.find(a => a.id === task.apiConfigId);
    if (!api) { task.status = 'error'; task.error = 'API no encontrada'; set({ agentConfig: { ...agentConfig } }); return; }
    task.status = 'running';
    set({ agentConfig: { ...agentConfig } });
    try {
      let response: Response;
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...api.customHeaders };
      if (api.apiKey) {
        if (api.provider === 'claude') headers['x-api-key'] = api.apiKey;
        else headers['Authorization'] = `Bearer ${api.apiKey}`;
      }
      const body = { model: api.model, messages: [{ role: 'user', content: task.prompt }], max_tokens: api.maxTokens, temperature: api.temperature, ...api.customBody };
      if (api.provider === 'ollama') {
        response = await fetch(`${api.baseUrl}/api/chat`, { method: 'POST', headers, body: JSON.stringify({ model: api.model, messages: [{ role: 'user', content: task.prompt }], stream: false }) });
      } else if (api.provider === 'claude') {
        headers['anthropic-version'] = '2023-06-01';
        response = await fetch(`${api.baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify({ ...body, system: 'Eres un asistente de animación 2D.' }) });
      } else {
        response = await fetch(`${api.baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
      }
      const data = await response.json();
      if (api.provider === 'ollama') task.result = data.message?.content || JSON.stringify(data);
      else if (api.provider === 'claude') task.result = data.content?.[0]?.text || JSON.stringify(data);
      else task.result = data.choices?.[0]?.message?.content || JSON.stringify(data);
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
    } catch (e: unknown) {
      task.status = 'error';
      task.error = e instanceof Error ? e.message : 'Error desconocido';
    }
    set({ agentConfig: { ...agentConfig } });
  },
  removeAgentTask: (id: string) => {
    const { agentConfig } = get();
    agentConfig.tasks = agentConfig.tasks.filter(t => t.id !== id);
    set({ agentConfig: { ...agentConfig } });
  },
  addWebhook: (config: Omit<WebhookConfig, 'id'>) => {
    const { agentConfig } = get();
    agentConfig.webhooks.push({ ...config, id: uuidv4() });
    set({ agentConfig: { ...agentConfig } });
  },
  removeWebhook: (id: string) => {
    const { agentConfig } = get();
    agentConfig.webhooks = agentConfig.webhooks.filter(w => w.id !== id);
    set({ agentConfig: { ...agentConfig } });
  },
  updateWebhook: (id: string, updates: Partial<WebhookConfig>) => {
    const { agentConfig } = get();
    const wh = agentConfig.webhooks.find(w => w.id === id);
    if (wh) { Object.assign(wh, updates); set({ agentConfig: { ...agentConfig } }); }
  },

  // Ngrok tunnel management
  addNgrokTunnel: (tunnel: Omit<NgrokTunnel, 'id' | 'status' | 'publicUrl'>) => {
    const { agentConfig } = get();
    agentConfig.ngrokTunnels.push({ ...tunnel, id: uuidv4(), status: 'inactive' });
    set({ agentConfig: { ...agentConfig } });
  },
  removeNgrokTunnel: (id: string) => {
    const { agentConfig } = get();
    agentConfig.ngrokTunnels = agentConfig.ngrokTunnels.filter(t => t.id !== id);
    set({ agentConfig: { ...agentConfig } });
  },
  startNgrokTunnel: async (id: string) => {
    const { agentConfig } = get();
    const tunnel = agentConfig.ngrokTunnels.find(t => t.id === id);
    if (!tunnel) return;
    
    tunnel.status = 'starting';
    set({ agentConfig: { ...agentConfig } });
    
    try {
      // Simulate ngrok tunnel creation (in real implementation, this would call ngrok API)
      // For now, we'll simulate a successful tunnel
      await new Promise(resolve => setTimeout(resolve, 1500));
      tunnel.status = 'active';
      tunnel.publicUrl = `https://${Math.random().toString(36).substring(7)}.ngrok-free.app`;
      set({ agentConfig: { ...agentConfig } });
    } catch (error) {
      tunnel.status = 'error';
      set({ agentConfig: { ...agentConfig } });
    }
  },
  stopNgrokTunnel: (id: string) => {
    const { agentConfig } = get();
    const tunnel = agentConfig.ngrokTunnels.find(t => t.id === id);
    if (tunnel) {
      tunnel.status = 'inactive';
      tunnel.publicUrl = undefined;
      set({ agentConfig: { ...agentConfig } });
    }
  },

  // Fetch available models for a provider
  fetchModelsForProvider: async (provider: AgentProvider, apiKey?: string, baseUrl?: string): Promise<AIModel[]> => {
    const defaultUrls: Record<string, string> = {
      ollama: 'http://localhost:11434',
      openrouter: 'https://openrouter.ai/api/v1',
      groq: 'https://api.groq.com/openai/v1',
      openai: 'https://api.openai.com/v1',
      claude: 'https://api.anthropic.com/v1',
      huggingface: 'https://api-inference.huggingface.co',
      opencode: 'https://api.opencode.ai/v1',
    };

    const url = baseUrl || defaultUrls[provider] || '';
    
    try {
      console.log(`Fetching models for ${provider} from ${url}`);
      
      switch (provider) {
        case 'ollama': {
          const response = await fetch(`${url}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (!response.ok) {
            throw new Error(`Ollama responded with status ${response.status}`);
          }
          
          const data = await response.json();
          console.log('Ollama models response:', data);
          
          return (data.models || []).map((m: any) => ({
            id: m.name,
            name: m.name,
            provider: 'ollama',
            description: m.details ? `Modelo local: ${m.details.family || 'desconocido'}` : 'Modelo local Ollama',
            contextLength: m.details?.parameter_size ? parseInt(m.details.parameter_size) : undefined,
            capabilities: ['local', 'free', 'offline'],
            status: 'stable' as const,
          }));
        }
        
        case 'openrouter': {
          // OpenRouter no requiere API key para listar modelos
          const response = await fetch(`${url}/models`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (!response.ok) {
            throw new Error(`OpenRouter responded with status ${response.status}`);
          }
          
          const data = await response.json();
          console.log('OpenRouter models response:', data);
          
          return (data.data || []).map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            provider: 'openrouter',
            description: m.description || `Modelo ${m.id}`,
            contextLength: m.context_length,
            pricing: m.pricing ? {
              input: parseFloat(m.pricing.prompt) * 1000000,
              output: parseFloat(m.pricing.completion) * 1000000,
            } : undefined,
            capabilities: m.architecture?.modality ? [m.architecture.modality] : [],
            status: 'stable' as const,
          }));
        }
        
        case 'groq': {
          if (!apiKey) {
            throw new Error('API key requerida para Groq');
          }
          
          const response = await fetch(`${url}/models`, {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
          });
          
          if (!response.ok) {
            throw new Error(`Groq responded with status ${response.status}`);
          }
          
          const data = await response.json();
          console.log('Groq models response:', data);
          
          return (data.data || []).map((m: any) => ({
            id: m.id,
            name: m.id,
            provider: 'groq',
            description: `Modelo Groq: ${m.id}`,
            capabilities: ['fast', 'optimized'],
            status: 'stable' as const,
          }));
        }
        
        case 'openai': {
          if (!apiKey) {
            throw new Error('API key requerida para OpenAI');
          }
          
          const response = await fetch(`${url}/models`, {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
          });
          
          if (!response.ok) {
            throw new Error(`OpenAI responded with status ${response.status}`);
          }
          
          const data = await response.json();
          console.log('OpenAI models response:', data);
          
          return (data.data || [])
            .filter((m: any) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('chatgpt-'))
            .map((m: any) => ({
              id: m.id,
              name: m.id,
              provider: 'openai',
              description: `Modelo OpenAI: ${m.id}`,
              capabilities: ['multimodal', 'function-calling'],
              status: 'stable' as const,
            }));
        }
        
        case 'claude': {
          // Claude no tiene endpoint público para listar modelos
          // Retornamos lista predefinida
          return [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude', description: 'Modelo más capaz de Anthropic', contextLength: 200000, capabilities: ['vision', 'computer-use'], status: 'stable' as const },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'claude', description: 'Modelo rápido y económico', contextLength: 200000, capabilities: ['fast', 'efficient'], status: 'stable' as const },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'claude', description: 'Modelo premium de Anthropic', contextLength: 200000, capabilities: ['reasoning', 'analysis'], status: 'stable' as const },
          ];
        }
        
        case 'huggingface': {
          if (!apiKey) {
            throw new Error('API key requerida para HuggingFace');
          }
          
          const response = await fetch(`${url}/models?pipeline=text-generation&limit=50`, {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
          });
          
          if (!response.ok) {
            throw new Error(`HuggingFace responded with status ${response.status}`);
          }
          
          const data = await response.json();
          console.log('HuggingFace models response:', data);
          
          return (data || []).map((m: any) => ({
            id: m.modelId || m.id,
            name: m.modelId || m.id,
            provider: 'huggingface',
            description: `Modelo HuggingFace: ${m.modelId || m.id}`,
            capabilities: ['open-source', 'community'],
            status: 'stable' as const,
          }));
        }
        
        case 'opencode': {
          // OpenCode no tiene endpoint público, retornamos lista predefinida
          return [
            { id: 'codellama-34b', name: 'CodeLlama 34B', provider: 'opencode', description: 'Modelo especializado en código', contextLength: 16384, capabilities: ['code', 'programming'], status: 'stable' as const },
            { id: 'deepseek-coder-33b', name: 'DeepSeek Coder 33B', provider: 'opencode', description: 'Modelo de código avanzado', contextLength: 16384, capabilities: ['code', 'infilling'], status: 'stable' as const },
            { id: 'starcoder-15b', name: 'StarCoder 15B', provider: 'opencode', description: 'Modelo de código open-source', contextLength: 8192, capabilities: ['code', 'open-source'], status: 'stable' as const },
          ];
        }
        
        default:
          console.warn(`Provider ${provider} not supported for model listing`);
          return [];
      }
    } catch (error) {
      console.error(`Error fetching models for ${provider}:`, error);
      // Lanzar el error para que el componente pueda mostrarlo
      throw error;
    }
  },
}));
