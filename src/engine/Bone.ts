import { BoneData, Vector2, Transform } from './types';

export class Bone {
  id: string;
  name: string;
  parentId: string | null;
  localTransform: Transform;
  globalTransform: Transform;
  length: number;
  color: string;
  locked: boolean;
  visible: boolean;

  constructor(data: BoneData) {
    this.id = data.id;
    this.name = data.name;
    this.parentId = data.parentId;
    this.localTransform = { ...data.localTransform };
    this.globalTransform = { ...data.globalTransform };
    this.length = data.length;
    this.color = data.color;
    this.locked = data.locked ?? false;
    this.visible = data.visible ?? true;
  }

  calculateGlobalTransform(bones: Map<string, Bone>): Transform {
    if (!this.parentId) {
      this.globalTransform = { ...this.localTransform };
      return this.globalTransform;
    }
    const parent = bones.get(this.parentId);
    if (!parent) {
      this.globalTransform = { ...this.localTransform };
      return this.globalTransform;
    }
    const pg = parent.globalTransform;
    const cos = Math.cos(pg.rotation);
    const sin = Math.sin(pg.rotation);
    const rotatedPos = {
      x: this.localTransform.position.x * cos - this.localTransform.position.y * sin,
      y: this.localTransform.position.x * sin + this.localTransform.position.y * cos,
    };
    this.globalTransform = {
      position: {
        x: pg.position.x + rotatedPos.x * pg.scale.x,
        y: pg.position.y + rotatedPos.y * pg.scale.y,
      },
      rotation: pg.rotation + this.localTransform.rotation,
      scale: {
        x: pg.scale.x * this.localTransform.scale.x,
        y: pg.scale.y * this.localTransform.scale.y,
      },
    };
    return this.globalTransform;
  }

  getEndPoint(): Vector2 {
    const cos = Math.cos(this.globalTransform.rotation);
    const sin = Math.sin(this.globalTransform.rotation);
    return {
      x: this.globalTransform.position.x + cos * this.length * this.globalTransform.scale.x,
      y: this.globalTransform.position.y + sin * this.length * this.globalTransform.scale.y,
    };
  }

  toData(): BoneData {
    return {
      id: this.id,
      name: this.name,
      parentId: this.parentId,
      localTransform: { ...this.localTransform },
      globalTransform: { ...this.globalTransform },
      length: this.length,
      color: this.color,
      locked: this.locked,
      visible: this.visible,
    };
  }
}

export function calculateAllGlobalTransforms(bones: Map<string, Bone>): void {
  const calculated = new Set<string>();
  function calc(id: string) {
    if (calculated.has(id)) return;
    const bone = bones.get(id);
    if (!bone) return;
    if (bone.parentId) calc(bone.parentId);
    bone.calculateGlobalTransform(bones);
    calculated.add(id);
  }
  bones.forEach((_, id) => calc(id));
}
