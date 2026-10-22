import { BoneData, Transform, Vector2 } from './types';

/**
 * Bone class for skeletal animation
 */
export class Bone {
  id: string;
  name: string;
  parentId: string | null;
  localTransform: Transform;
  globalTransform: Transform;
  length: number;
  color: string;

  constructor(data: BoneData) {
    this.id = data.id;
    this.name = data.name;
    this.parentId = data.parentId;
    this.localTransform = { ...data.localTransform };
    this.globalTransform = { ...data.globalTransform };
    this.length = data.length;
    this.color = data.color;
  }

  /**
   * Calculate global transform based on parent chain
   */
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

    const parentGlobal = parent.globalTransform;

    // Apply parent rotation to local position
    const cos = Math.cos(parentGlobal.rotation);
    const sin = Math.sin(parentGlobal.rotation);
    const rotatedPos = {
      x: this.localTransform.position.x * cos - this.localTransform.position.y * sin,
      y: this.localTransform.position.x * sin + this.localTransform.position.y * cos,
    };

    this.globalTransform = {
      position: {
        x: parentGlobal.position.x + rotatedPos.x * parentGlobal.scale.x,
        y: parentGlobal.position.y + rotatedPos.y * parentGlobal.scale.y,
      },
      rotation: parentGlobal.rotation + this.localTransform.rotation,
      scale: {
        x: parentGlobal.scale.x * this.localTransform.scale.x,
        y: parentGlobal.scale.y * this.localTransform.scale.y,
      },
    };

    return this.globalTransform;
  }

  /**
   * Get the end point of the bone (tip)
   */
  getEndPoint(): Vector2 {
    const cos = Math.cos(this.globalTransform.rotation);
    const sin = Math.sin(this.globalTransform.rotation);
    return {
      x: this.globalTransform.position.x + cos * this.length * this.globalTransform.scale.x,
      y: this.globalTransform.position.y + sin * this.length * this.globalTransform.scale.y,
    };
  }

  /**
   * Convert to data object
   */
  toData(): BoneData {
    return {
      id: this.id,
      name: this.name,
      parentId: this.parentId,
      localTransform: { ...this.localTransform },
      globalTransform: { ...this.globalTransform },
      length: this.length,
      color: this.color,
    };
  }
}

/**
 * Calculate all global transforms for a skeleton
 */
export function calculateAllGlobalTransforms(bones: Map<string, Bone>): void {
  // First pass: calculate in order (parents before children)
  const calculated = new Set<string>();
  
  function calculateRecursive(boneId: string) {
    if (calculated.has(boneId)) return;
    
    const bone = bones.get(boneId);
    if (!bone) return;
    
    if (bone.parentId) {
      calculateRecursive(bone.parentId);
    }
    
    bone.calculateGlobalTransform(bones);
    calculated.add(boneId);
  }
  
  bones.forEach((_, id) => calculateRecursive(id));
}
