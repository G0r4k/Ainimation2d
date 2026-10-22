import { useAnimationStore } from '../stores/animationStore';
import { AssetsPanel } from './AssetsPanel';

export function SidePanel() {
  const {
    project,
    selectedSkeletonId,
    selectedBoneId,
    selectedAnimationId,
    selectedKeyframeId,
    tool,
    showGrid,
    setTool,
    toggleGrid,
    addBone,
    removeBone,
    selectBone,
    updateBoneTransform,
    updateBoneName,
    updateKeyframe,
    removeKeyframe,
  } = useAnimationStore();

  const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
  const bone = skeleton?.bones.find(b => b.id === selectedBoneId);
  const animation = skeleton?.animations.find(a => a.id === selectedAnimationId);
  const keyframe = animation?.keyframes.find(kf => kf.id === selectedKeyframeId);

  const tools: { id: typeof tool; icon: string; label: string }[] = [
    { id: 'select', icon: '⊹', label: 'Seleccionar (V)' },
    { id: 'move', icon: '✥', label: 'Mover (G)' },
    { id: 'rotate', icon: '↻', label: 'Rotar (R)' },
    { id: 'scale', icon: '⤡', label: 'Escalar (S)' },
    { id: 'bone', icon: '🦴', label: 'Crear Hueso (B)' },
  ];

  return (
    <div className="w-64 bg-gray-850 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* Tools */}
      <div className="p-2 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Herramientas</h3>
        <div className="flex gap-1 flex-wrap">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`w-9 h-9 flex items-center justify-center rounded text-lg transition-colors ${
                tool === t.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
          <button
            onClick={toggleGrid}
            className={`w-9 h-9 flex items-center justify-center rounded text-sm transition-colors ${
              showGrid
                ? 'bg-gray-600 text-white'
                : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
            }`}
            title="Mostrar grilla"
          >
            #
          </button>
        </div>
      </div>

      {/* Bone Hierarchy */}
      <div className="flex-1 overflow-y-auto border-b border-gray-700">
        <div className="p-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">Esqueleto</h3>
            <button
              onClick={() => addBone(selectedBoneId)}
              disabled={!skeleton}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-30"
              title="Agregar hueso"
            >
              + Hueso
            </button>
          </div>
          {skeleton ? (
            <div className="space-y-0.5">
              {renderBoneTree(skeleton.bones, null, selectedBoneId, selectBone, removeBone, 0)}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Sin esqueleto seleccionado</p>
          )}
        </div>
      </div>

      {/* Properties Panel */}
      <div className="p-3 overflow-y-auto max-h-72">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Propiedades</h3>
        
        {bone && (
          <div className="space-y-3">
            {/* Bone name */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Nombre</label>
              <input
                type="text"
                value={bone.name}
                onChange={(e) => updateBoneName(bone.id, e.target.value)}
                className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Position */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Posición</label>
              <div className="flex gap-1">
                <div className="flex-1">
                  <span className="text-[9px] text-red-400">X</span>
                  <input
                    type="number"
                    value={Math.round(bone.localTransform.position.x)}
                    onChange={(e) => updateBoneTransform(bone.id, {
                      position: { ...bone.localTransform.position, x: Number(e.target.value) }
                    })}
                    className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1.5 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[9px] text-green-400">Y</span>
                  <input
                    type="number"
                    value={Math.round(bone.localTransform.position.y)}
                    onChange={(e) => updateBoneTransform(bone.id, {
                      position: { ...bone.localTransform.position, y: Number(e.target.value) }
                    })}
                    className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1.5 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Rotación (grados)</label>
              <input
                type="number"
                value={Math.round((bone.localTransform.rotation * 180 / Math.PI) * 10) / 10}
                onChange={(e) => updateBoneTransform(bone.id, {
                  rotation: Number(e.target.value) * Math.PI / 180
                })}
                className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Scale */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Escala</label>
              <div className="flex gap-1">
                <div className="flex-1">
                  <span className="text-[9px] text-red-400">X</span>
                  <input
                    type="number"
                    step="0.1"
                    value={bone.localTransform.scale.x}
                    onChange={(e) => updateBoneTransform(bone.id, {
                      scale: { ...bone.localTransform.scale, x: Number(e.target.value) }
                    })}
                    className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1.5 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[9px] text-green-400">Y</span>
                  <input
                    type="number"
                    step="0.1"
                    value={bone.localTransform.scale.y}
                    onChange={(e) => updateBoneTransform(bone.id, {
                      scale: { ...bone.localTransform.scale, y: Number(e.target.value) }
                    })}
                    className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1.5 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Length */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Longitud</label>
              <input
                type="number"
                value={bone.length}
                onChange={(e) => {
                  const { project, selectedSkeletonId } = useAnimationStore.getState();
                  const sk = project.skeletons.find(s => s.id === selectedSkeletonId);
                  if (sk) {
                    const b = sk.bones.find(bb => bb.id === bone.id);
                    if (b) b.length = Number(e.target.value);
                    useAnimationStore.setState({ project: { ...project } });
                  }
                }}
                className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Keyframe properties */}
        {keyframe && (
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-700">
            <h4 className="text-[10px] text-yellow-400 font-semibold">Keyframe</h4>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Frame</label>
              <input
                type="number"
                value={keyframe.time}
                onChange={(e) => updateKeyframe(keyframe.id, { time: Number(e.target.value) })}
                className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Easing</label>
              <select
                value={keyframe.easing}
                onChange={(e) => updateKeyframe(keyframe.id, { easing: e.target.value as any })}
                className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="linear">Linear</option>
                <option value="easeIn">Ease In</option>
                <option value="easeOut">Ease Out</option>
                <option value="easeInOut">Ease In/Out</option>
                <option value="bezier">Bezier</option>
              </select>
            </div>
            <button
              onClick={() => removeKeyframe(keyframe.id)}
              className="w-full bg-red-900/30 text-red-400 text-xs rounded px-2 py-1.5 hover:bg-red-900/50 transition-colors"
            >
              Eliminar Keyframe
            </button>
          </div>
        )}

        {!bone && !keyframe && (
          <p className="text-xs text-gray-500 italic">Selecciona un hueso o keyframe</p>
        )}
      </div>

      {/* Assets Panel */}
      <AssetsPanel />
    </div>
  );
}

function renderBoneTree(
  bones: { id: string; name: string; parentId: string | null; color: string }[],
  parentId: string | null,
  selectedBoneId: string | null,
  selectBone: (id: string | null) => void,
  removeBone: (id: string) => void,
  depth: number
) {
  const children = bones.filter(b => b.parentId === parentId);
  
  return children.map(bone => (
    <div key={bone.id}>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs group ${
          bone.id === selectedBoneId
            ? 'bg-blue-600/30 text-blue-300'
            : 'text-gray-300 hover:bg-gray-700/50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => selectBone(bone.id)}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: bone.color }}
        />
        <span className="truncate flex-1">{bone.name}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeBone(bone.id);
          }}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-[10px]"
        >
          ✕
        </button>
      </div>
      {renderBoneTree(bones, bone.id, selectedBoneId, selectBone, removeBone, depth + 1)}
    </div>
  ));
}
