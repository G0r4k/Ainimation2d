import { useState, useRef } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { AgentAPIConfig, AgentProvider } from '../engine/types';
import { ModelsPanel } from './ModelsPanel';
import { NgrokPanel } from './NgrokPanel';

export function SidePanel() {
  const store = useAnimationStore();
  const scene = store.getActiveScene();
  const char = store.getActiveCharacter();
  const bone = char?.bones.find(b => b.id === store.selectedBoneId);
  const anim = char?.animations.find(a => a.id === store.selectedAnimationId);
  const keyframe = anim?.keyframes.find(kf => kf.id === store.selectedKeyframeId);

  const tools = [
    { id: 'select' as const, icon: '⊹', label: 'Seleccionar (V)' },
    { id: 'move' as const, icon: '✥', label: 'Mover (G)' },
    { id: 'rotate' as const, icon: '↻', label: 'Rotar (R)' },
    { id: 'scale' as const, icon: '⤡', label: 'Escalar (S)' },
    { id: 'bone' as const, icon: '🦴', label: 'Crear Hueso (B)' },
  ];

  return (
    <div className="w-72 bg-gray-850 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* Tools */}
      <div className="p-2 border-b border-gray-700">
        <div className="flex gap-1 flex-wrap">
          {tools.map(t => (
            <button key={t.id} onClick={() => store.setTool(t.id)} className={`w-9 h-9 flex items-center justify-center rounded text-lg transition-colors ${store.tool === t.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`} title={t.label}>{t.icon}</button>
          ))}
          <button onClick={() => store.toggleGrid()} className={`w-9 h-9 flex items-center justify-center rounded text-sm ${store.showGrid ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-500'}`} title="Grilla">#</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-gray-800 overflow-x-auto">
        {(['characters', 'backgrounds', 'cameras', 'agents', 'models', 'ngrok'] as const).map(tab => (
          <button key={tab} onClick={() => store.setActiveTab(tab as any)} className={`flex-1 py-2 text-[10px] font-medium transition-colors whitespace-nowrap px-2 ${store.activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}>
            {tab === 'characters' ? '👤' : tab === 'backgrounds' ? '🏞️' : tab === 'cameras' ? '📷' : tab === 'agents' ? '🤖' : tab === 'models' ? '📋' : '🔗'} 
            <span className="hidden sm:inline">{tab === 'characters' ? 'Personajes' : tab === 'backgrounds' ? 'Fondos' : tab === 'cameras' ? 'Cámaras' : tab === 'agents' ? 'Agentes' : tab === 'models' ? 'Modelos' : 'Ngrok'}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {store.activeTab === 'characters' && <CharactersTab />}
        {store.activeTab === 'backgrounds' && <BackgroundsTab />}
        {store.activeTab === 'cameras' && <CamerasTab />}
        {store.activeTab === 'agents' && <AgentsTab />}
        {store.activeTab === 'models' && <ModelsPanel />}
        {store.activeTab === 'ngrok' && <NgrokPanel />}
      </div>

      {/* Properties */}
      <div className="p-3 border-t border-gray-700 max-h-64 overflow-y-auto">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Propiedades</h3>
        {bone && (
          <div className="space-y-2">
            <div><label className="text-[9px] text-gray-500">Nombre</label><input type="text" value={bone.name} onChange={e => store.updateBoneName(bone.id, e.target.value)} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none" /></div>
            <div className="flex gap-1">
              <div className="flex-1"><span className="text-[8px] text-red-400">X</span><input type="number" value={Math.round(bone.localTransform.position.x)} onChange={e => store.updateBoneTransform(bone.id, { position: { ...bone.localTransform.position, x: +e.target.value } })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1 py-0.5 border border-gray-600 focus:outline-none" /></div>
              <div className="flex-1"><span className="text-[8px] text-green-400">Y</span><input type="number" value={Math.round(bone.localTransform.position.y)} onChange={e => store.updateBoneTransform(bone.id, { position: { ...bone.localTransform.position, y: +e.target.value } })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1 py-0.5 border border-gray-600 focus:outline-none" /></div>
            </div>
            <div><span className="text-[9px] text-gray-500">Rotación°</span><input type="number" value={Math.round(bone.localTransform.rotation * 180 / Math.PI * 10) / 10} onChange={e => store.updateBoneTransform(bone.id, { rotation: +e.target.value * Math.PI / 180 })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none" /></div>
            
            {/* Slot properties */}
            {char && (() => {
              const slot = char.slots.find(s => s.boneId === bone.id);
              if (!slot) {
                const hasAssets = store.project.assets.length > 0;
                return (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[9px] text-gray-400 font-medium">🖼️ Sprite</span>
                      <span className="text-[8px] text-gray-500 bg-gray-700 px-1 rounded">No asignado</span>
                    </div>
                    {hasAssets ? (
                      <div className="space-y-1">
                        <p className="text-[8px] text-gray-500">Selecciona un asset abajo:</p>
                        <div className="grid grid-cols-4 gap-0.5 max-h-16 overflow-y-auto">
                          {store.project.assets.map(asset => (
                            <button
                              key={asset.id}
                              onClick={() => store.addSlot(bone.id, asset.id)}
                              className="aspect-square bg-gray-700 rounded border border-gray-600 hover:border-blue-500 hover:scale-110 transition-all overflow-hidden"
                              title={`Asociar ${asset.name}`}
                            >
                              <img src={asset.src} alt={asset.name} className="w-full h-full object-contain" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[8px] text-gray-600">
                        Importa imágenes en el panel de Assets (abajo) primero
                      </p>
                    )}
                  </div>
                );
              }
              const asset = store.project.assets.find(a => a.id === slot.assetId);
              return (
                <div className="pt-2 border-t border-gray-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[9px] text-blue-400 font-semibold flex items-center gap-1">
                      🖼️ Sprite Asignado
                      <span className="text-[7px] bg-blue-900/50 text-blue-300 px-1 rounded">✓</span>
                    </h4>
                  </div>
                  {asset && (
                    <div className="flex items-center gap-1.5 bg-gray-700/50 rounded p-1">
                      <img src={asset.src} alt={asset.name} className="w-10 h-10 object-contain bg-gray-800 rounded border border-gray-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] text-gray-200 font-medium truncate">{asset.name}</div>
                        <div className="text-[8px] text-gray-500">{asset.width}×{asset.height}px</div>
                      </div>
                      <button
                        onClick={() => store.removeSlot(slot.id)}
                        className="text-[9px] text-red-400 hover:text-red-300 bg-red-900/30 px-1.5 py-0.5 rounded hover:bg-red-900/50"
                        title="Quitar sprite"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      <div className="flex-1">
                        <label className="text-[8px] text-red-400 block">Offset X</label>
                        <input type="number" value={slot.offset.x} onChange={e => store.updateSlot(slot.id, { offset: { ...slot.offset, x: +e.target.value } })} className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-1.5 py-0.5 border border-gray-600 focus:border-blue-500 focus:outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[8px] text-green-400 block">Offset Y</label>
                        <input type="number" value={slot.offset.y} onChange={e => store.updateSlot(slot.id, { offset: { ...slot.offset, y: +e.target.value } })} className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-1.5 py-0.5 border border-gray-600 focus:border-blue-500 focus:outline-none" />
                      </div>
                    </div>
                    
                    {/* Dimensiones del Sprite */}
                    {asset && (
                    <div className="bg-purple-900/20 border border-purple-800/30 rounded p-1.5 space-y-1">
                      <label className="text-[8px] text-purple-300 font-semibold block">📐 Dimensiones del Sprite</label>
                      <div className="flex gap-1">
                        <div className="flex-1">
                          <label className="text-[8px] text-red-400 block">Ancho</label>
                          <input 
                            type="number" 
                            value={Math.round(asset.width * slot.scale.x)} 
                            onChange={e => store.updateSlot(slot.id, { scale: { ...slot.scale, x: +e.target.value / asset.width } })} 
                            className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-1.5 py-0.5 border border-gray-600 focus:border-blue-500 focus:outline-none" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[8px] text-green-400 block">Alto</label>
                          <input 
                            type="number" 
                            value={Math.round(asset.height * slot.scale.y)} 
                            onChange={e => store.updateSlot(slot.id, { scale: { ...slot.scale, y: +e.target.value / asset.height } })} 
                            className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-1.5 py-0.5 border border-gray-600 focus:border-blue-500 focus:outline-none" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[8px] text-gray-400 block">Escala Uniforme: {(slot.scale.x * 100).toFixed(0)}%</label>
                        <input 
                          type="range" 
                          min="10" 
                          max="300" 
                          step="5" 
                          value={slot.scale.x * 100} 
                          onChange={e => {
                            const newScale = +e.target.value / 100;
                            store.updateSlot(slot.id, { scale: { x: newScale, y: newScale } });
                          }} 
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
                        />
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => store.updateSlot(slot.id, { scale: { x: 0.5, y: 0.5 } })}
                          className="flex-1 text-[8px] bg-gray-700 text-gray-300 rounded px-1 py-0.5 hover:bg-gray-600"
                        >
                          50%
                        </button>
                        <button 
                          onClick={() => store.updateSlot(slot.id, { scale: { x: 1, y: 1 } })}
                          className="flex-1 text-[8px] bg-gray-700 text-gray-300 rounded px-1 py-0.5 hover:bg-gray-600"
                        >
                          100%
                        </button>
                        <button 
                          onClick={() => store.updateSlot(slot.id, { scale: { x: 1.5, y: 1.5 } })}
                          className="flex-1 text-[8px] bg-gray-700 text-gray-300 rounded px-1 py-0.5 hover:bg-gray-600"
                        >
                          150%
                        </button>
                        <button 
                          onClick={() => store.updateSlot(slot.id, { scale: { x: 2, y: 2 } })}
                          className="flex-1 text-[8px] bg-gray-700 text-gray-300 rounded px-1 py-0.5 hover:bg-gray-600"
                        >
                          200%
                        </button>
                      </div>
                    </div>
                    )}
                    
                    <div>
                      <label className="text-[8px] text-gray-400 block">Opacidad: {(slot.opacity * 100).toFixed(0)}%</label>
                      <input type="range" min="0" max="1" step="0.05" value={slot.opacity} onChange={e => store.updateSlot(slot.id, { opacity: +e.target.value })} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div>
                      <label className="text-[8px] text-gray-400 block">Modo de Mezcla</label>
                      <select value={slot.blendMode} onChange={e => store.updateSlot(slot.id, { blendMode: e.target.value as any })} className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-1.5 py-0.5 border border-gray-600 focus:border-blue-500 focus:outline-none">
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiply (Multiplicar)</option>
                        <option value="screen">Screen (Pantalla)</option>
                        <option value="overlay">Overlay (Superponer)</option>
                        <option value="lighter">Add (Agregar)</option>
                      </select>
                    </div>
                  </div>
                  <div className="bg-blue-900/20 border border-blue-800/30 rounded p-1.5">
                    <p className="text-[8px] text-blue-300 leading-tight">
                      💡 La imagen se mueve con el hueso. Ajusta el offset para posicionarla.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {keyframe && (
          <div className="space-y-2">
            <div><label className="text-[9px] text-gray-500">Frame</label><input type="number" value={keyframe.time} onChange={e => store.updateKeyframe(keyframe.id, { time: +e.target.value })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none" /></div>
            <div><label className="text-[9px] text-gray-500">Easing</label>
              <select value={keyframe.easing} onChange={e => store.updateKeyframe(keyframe.id, { easing: e.target.value as any })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none">
                <option value="linear">Linear</option><option value="easeIn">Ease In</option><option value="easeOut">Ease Out</option><option value="easeInOut">Ease In/Out</option><option value="bezier">Bezier</option><option value="elastic">Elastic</option><option value="bounce">Bounce</option>
              </select>
            </div>
            <button onClick={() => store.removeKeyframe(keyframe.id)} className="w-full bg-red-900/30 text-red-400 text-xs rounded px-2 py-1 hover:bg-red-900/50">Eliminar Keyframe</button>
          </div>
        )}
        {!bone && !keyframe && <p className="text-[10px] text-gray-500 italic">Selecciona un hueso o keyframe</p>}
      </div>
    </div>
  );
}

function CharactersTab() {
  const store = useAnimationStore();
  const scene = store.getActiveScene();
  if (!scene) return <p className="p-3 text-xs text-gray-500">Sin escena</p>;

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase">Personajes</h3>
        <button onClick={() => store.addCharacter()} className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded">+ Nuevo</button>
      </div>
      {/* Scene selector */}
      <div className="mb-2">
        <label className="text-[9px] text-gray-500">Escena</label>
        <div className="flex gap-1 flex-wrap mt-1">
          {store.project.scenes.map(s => (
            <button key={s.id} onClick={() => store.setActiveScene(s.id)} className={`text-[10px] px-2 py-0.5 rounded ${s.id === store.project.activeSceneId ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>{s.name}</button>
          ))}
          <button onClick={() => store.addScene(`Escena ${store.project.scenes.length + 1}`)} className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-green-400 hover:bg-gray-600">+</button>
        </div>
      </div>
      {/* Characters */}
      <div className="space-y-1">
        {scene.characters.map(char => (
          <div key={char.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group ${char.id === store.selectedCharacterId ? 'bg-blue-900/30 border border-blue-700' : 'hover:bg-gray-700/50 border border-transparent'}`} onClick={() => store.selectCharacter(char.id)}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: char.color }} />
            <span className="text-xs text-gray-200 flex-1 truncate">{char.name}</span>
            <button onClick={e => { e.stopPropagation(); store.selectCharacter(char.id); }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white text-[10px]">⚙</button>
            {scene.characters.length > 1 && <button onClick={e => { e.stopPropagation(); store.removeCharacter(char.id); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-[10px]">✕</button>}
          </div>
        ))}
      </div>
      {/* Bone hierarchy */}
      {store.selectedCharacterId && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[10px] font-semibold text-gray-400">Huesos</h4>
            <button onClick={() => store.addBone(store.selectedBoneId)} className="text-[9px] text-blue-400 hover:text-blue-300">+ Hueso</button>
          </div>
          <div className="space-y-0.5">
            {(() => {
              const selectedChar = scene.characters.find(c => c.id === store.selectedCharacterId);
              return renderBoneTree(
                selectedChar?.bones || [],
                null,
                store.selectedBoneId,
                store.selectBone,
                store.removeBone,
                0,
                selectedChar?.slots || [],
                store.project.assets
              );
            })()}
          </div>
        </div>
      )}
      {/* Animations */}
      {store.selectedCharacterId && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[10px] font-semibold text-gray-400">Animaciones</h4>
            <button onClick={() => store.addAnimation(`Anim ${scene.characters.find(c => c.id === store.selectedCharacterId)?.animations.length || 0}`)} className="text-[9px] text-green-400 hover:text-green-300">+ Anim</button>
          </div>
          <div className="space-y-0.5">
            {scene.characters.find(c => c.id === store.selectedCharacterId)?.animations.map(a => (
              <div key={a.id} className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ${a.id === store.selectedAnimationId ? 'bg-green-900/30 text-green-300' : 'text-gray-400 hover:bg-gray-700/50'}`} onClick={() => store.selectAnimation(a.id)}>
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-[9px] text-gray-500">{a.keyframes.length}kf</span>
                <button onClick={e => { e.stopPropagation(); store.removeAnimation(a.id); }} className="text-red-400 hover:text-red-300 text-[10px]">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderBoneTree(
  bones: { id: string; name: string; parentId: string | null; color: string; locked: boolean; visible: boolean }[],
  parentId: string | null,
  selectedId: string | null,
  selectBone: (id: string | null) => void,
  removeBone: (id: string) => void,
  depth: number,
  slots: { boneId: string; assetId: string | null }[] = [],
  assets: { id: string; name: string; src: string }[] = []
) {
  return bones.filter(b => b.parentId === parentId).map(bone => {
    const slot = slots.find(s => s.boneId === bone.id);
    const hasSprite = slot?.assetId != null;
    const spriteAsset = hasSprite ? assets.find(a => a.id === slot!.assetId) : null;
    
    return (
      <div key={bone.id}>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer text-[11px] group ${bone.id === selectedId ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300 hover:bg-gray-700/50'}`} style={{ paddingLeft: `${depth * 10 + 8}px` }} onClick={() => selectBone(bone.id)}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bone.color }} />
          <span className="truncate flex-1">{bone.name}</span>
          {hasSprite && spriteAsset && (
            <img src={spriteAsset.src} alt="" className="w-3 h-3 object-contain rounded border border-blue-500/50" title={`Sprite: ${spriteAsset.name}`} />
          )}
          {hasSprite && !spriteAsset && <span className="text-[8px]">🖼</span>}
          {!bone.visible && <span className="text-[8px] text-gray-500">👁</span>}
          {bone.locked && <span className="text-[8px]">🔒</span>}
          <button onClick={e => { e.stopPropagation(); removeBone(bone.id); }} className="opacity-0 group-hover:opacity-100 text-red-400 text-[10px]">✕</button>
        </div>
        {renderBoneTree(bones, bone.id, selectedId, selectBone, removeBone, depth + 1, slots, assets)}
      </div>
    );
  });
}

function BackgroundsTab() {
  const store = useAnimationStore();
  const scene = store.getActiveScene();
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!scene) return null;

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const assetId = `bg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          store.addAsset({
            id: assetId,
            name: file.name.replace(/\.[^.]+$/, ''),
            type: 'image',
            src,
            width: img.width,
            height: img.height,
          });
          store.addBackground({
            name: file.name.replace(/\.[^.]+$/, ''),
            type: 'image',
            assetId,
            visible: true,
            opacity: 1,
            zIndex: scene.backgrounds.length,
          });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase">Capas de Fondo</h3>
        <div className="flex gap-1">
          <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-green-400 hover:text-green-300 bg-green-900/20 px-2 py-0.5 rounded" title="Importar imagen como fondo">🖼️</button>
          <button onClick={() => store.addBackground({ name: `Capa ${scene.backgrounds.length + 1}`, type: 'color', color: '#333333', zIndex: scene.backgrounds.length })} className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded">+ Capa</button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageImport} className="hidden" />
      <div className="space-y-1">
        {[...scene.backgrounds].sort((a, b) => b.zIndex - a.zIndex).map(bg => (
          <div key={bg.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${bg.id === store.selectedBackgroundId ? 'bg-purple-900/30 border border-purple-700' : 'hover:bg-gray-700/50 border border-transparent'}`} onClick={() => store.selectBackground(bg.id)}>
            <div className="w-4 h-4 rounded" style={{ background: bg.type === 'gradient' ? `linear-gradient(${bg.gradientAngle || 0}deg, ${(bg.gradientColors || ['#333', '#666']).join(',')})` : bg.color || '#666' }} />
            <span className="text-xs text-gray-200 flex-1 truncate">{bg.name}</span>
            <button onClick={e => { e.stopPropagation(); store.updateBackground(bg.id, { visible: !bg.visible }); }} className={`text-[10px] ${bg.visible ? 'text-gray-400' : 'text-gray-600'}`}>{bg.visible ? '👁' : '👁‍🗨'}</button>
            <button onClick={e => { e.stopPropagation(); store.removeBackground(bg.id); }} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
          </div>
        ))}
      </div>
      {store.selectedBackgroundId && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
          {(() => {
            const bg = scene.backgrounds.find(b => b.id === store.selectedBackgroundId);
            if (!bg) return null;
            return (
              <>
                <div><label className="text-[9px] text-gray-500">Nombre</label><input type="text" value={bg.name} onChange={e => store.updateBackground(bg.id, { name: e.target.value })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none" /></div>
                <div><label className="text-[9px] text-gray-500">Tipo</label>
                  <select value={bg.type} onChange={e => store.updateBackground(bg.id, { type: e.target.value as any })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none">
                    <option value="color">Color</option><option value="gradient">Gradiente</option><option value="image">Imagen</option><option value="parallax">Parallax</option>
                  </select>
                </div>
                <div><label className="text-[9px] text-gray-500">Opacidad</label><input type="range" min="0" max="1" step="0.05" value={bg.opacity} onChange={e => store.updateBackground(bg.id, { opacity: +e.target.value })} className="w-full" /></div>
                <div><label className="text-[9px] text-gray-500">Z-Index</label><input type="number" value={bg.zIndex} onChange={e => store.updateBackground(bg.id, { zIndex: +e.target.value })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none" /></div>
                {bg.type === 'color' && <div><label className="text-[9px] text-gray-500">Color</label><input type="color" value={bg.color || '#333333'} onChange={e => store.updateBackground(bg.id, { color: e.target.value })} className="w-full h-8 rounded" /></div>}
                {bg.type === 'gradient' && (
                  <div><label className="text-[9px] text-gray-500">Colores (separados por coma)</label><input type="text" value={(bg.gradientColors || []).join(',')} onChange={e => store.updateBackground(bg.id, { gradientColors: e.target.value.split(',').map(s => s.trim()) })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none" /></div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function CamerasTab() {
  const store = useAnimationStore();
  const scene = store.getActiveScene();
  if (!scene) return null;

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase">Cámaras</h3>
        <button onClick={() => store.addCamera(`Cámara ${scene.cameras.length + 1}`)} className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded">+ Cámara</button>
      </div>
      <div className="space-y-1">
        {scene.cameras.map(cam => (
          <div key={cam.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${cam.id === scene.activeCameraId ? 'bg-red-900/30 border border-red-700' : 'hover:bg-gray-700/50 border border-transparent'}`} onClick={() => { store.selectCamera(cam.id); store.setActiveCamera(cam.id); }}>
            <span className="text-sm">📷</span>
            <span className="text-xs text-gray-200 flex-1 truncate">{cam.name}</span>
            {cam.id === scene.activeCameraId && <span className="text-[8px] text-red-400 bg-red-900/30 px-1 rounded">ACTIVA</span>}
            {scene.cameras.length > 1 && <button onClick={e => { e.stopPropagation(); store.removeCamera(cam.id); }} className="text-[10px] text-red-400 hover:text-red-300">✕</button>}
          </div>
        ))}
      </div>
      {store.selectedCameraId && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
          {(() => {
            const cam = scene.cameras.find(c => c.id === store.selectedCameraId);
            if (!cam) return null;
            return (
              <>
                <div><label className="text-[9px] text-gray-500">Nombre</label><input type="text" value={cam.name} onChange={e => store.updateCamera(cam.id, { name: e.target.value })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none" /></div>
                <div className="flex gap-1">
                  <div className="flex-1"><span className="text-[8px] text-red-400">X</span><input type="number" value={Math.round(cam.position.x)} onChange={e => store.updateCamera(cam.id, { position: { ...cam.position, x: +e.target.value } })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1 py-0.5 border border-gray-600 focus:outline-none" /></div>
                  <div className="flex-1"><span className="text-[8px] text-green-400">Y</span><input type="number" value={Math.round(cam.position.y)} onChange={e => store.updateCamera(cam.id, { position: { ...cam.position, y: +e.target.value } })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1 py-0.5 border border-gray-600 focus:outline-none" /></div>
                </div>
                <div><label className="text-[9px] text-gray-500">Zoom</label><input type="range" min="0.2" max="3" step="0.1" value={cam.zoom} onChange={e => store.updateCamera(cam.id, { zoom: +e.target.value })} className="w-full" /><span className="text-[9px] text-gray-500">{cam.zoom.toFixed(1)}x</span></div>
                <div><label className="text-[9px] text-gray-500">Rotación°</label><input type="number" value={Math.round(cam.rotation * 180 / Math.PI * 10) / 10} onChange={e => store.updateCamera(cam.id, { rotation: +e.target.value * Math.PI / 180 })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none" /></div>
                <div className="flex gap-1">
                  <div className="flex-1"><label className="text-[8px] text-gray-500">Ancho</label><input type="number" value={cam.viewportWidth} onChange={e => store.updateCamera(cam.id, { viewportWidth: +e.target.value })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1 py-0.5 border border-gray-600 focus:outline-none" /></div>
                  <div className="flex-1"><label className="text-[8px] text-gray-500">Alto</label><input type="number" value={cam.viewportHeight} onChange={e => store.updateCamera(cam.id, { viewportHeight: +e.target.value })} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-1 py-0.5 border border-gray-600 focus:outline-none" /></div>
                </div>
                <button onClick={() => store.setActiveCamera(cam.id)} className={`w-full text-xs rounded px-2 py-1.5 ${cam.id === scene.activeCameraId ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'}`}>{cam.id === scene.activeCameraId ? '✓ Cámara Activa' : 'Activar Cámara'}</button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function AgentsTab() {
  const store = useAnimationStore();
  const [editingApi, setEditingApi] = useState<string | null>(null);
  const [newApi, setNewApi] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedApiForTask, setSelectedApiForTask] = useState(store.agentConfig.defaultApiId || '');

  const providerLabels: Record<AgentProvider, string> = { 
    ollama: '🏠 Ollama', 
    groq: '⚡ Groq', 
    huggingface: '🤗 HuggingFace', 
    openai: '🧠 OpenAI', 
    claude: '🟣 Claude', 
    openrouter: '🌐 OpenRouter',
    opencode: '💻 OpenCode',
    ngrok: '🔗 Ngrok',
    custom: '🔧 Custom' 
  };

  const handleRunTask = async () => {
    if (!prompt.trim() || !selectedApiForTask) return;
    store.addAgentTask({ name: prompt.slice(0, 40), description: '', prompt, apiConfigId: selectedApiForTask });
    const tasks = store.agentConfig.tasks;
    const lastTask = tasks[tasks.length - 1];
    if (lastTask) await store.runAgentTask(lastTask.id);
    setPrompt('');
  };

  return (
    <div className="p-2 space-y-3">
      {/* Quick AI Task */}
      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-3 border border-purple-800/30">
        <h3 className="text-[10px] font-semibold text-purple-300 uppercase mb-2">🤖 Asistente IA</h3>
        <select value={selectedApiForTask} onChange={e => setSelectedApiForTask(e.target.value)} className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 mb-2 focus:outline-none">
          {store.agentConfig.apis.filter(a => a.enabled).map(api => (
            <option key={api.id} value={api.id}>{api.name} ({api.model})</option>
          ))}
        </select>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe la animación que quieres generar..." className="w-full bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 focus:border-purple-500 focus:outline-none resize-none h-16 mb-2" />
        <div className="flex gap-1 flex-wrap mb-2">
          {['Genera un ciclo de caminata', 'Crea una animación idle', 'Sugiere keyframes para un salto', 'Genera lip-sync básico'].map(s => (
            <button key={s} onClick={() => setPrompt(s)} className="text-[9px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded hover:bg-gray-600 hover:text-white">{s}</button>
          ))}
        </div>
        <button onClick={handleRunTask} disabled={!prompt.trim() || !selectedApiForTask} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded px-3 py-1.5 font-medium hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
          🚀 Ejecutar
        </button>
      </div>

      {/* Task results */}
      {store.agentConfig.tasks.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-[10px] font-semibold text-gray-400">Tareas recientes</h4>
          {store.agentConfig.tasks.slice(-3).reverse().map(task => (
            <div key={task.id} className={`p-2 rounded text-[10px] ${task.status === 'completed' ? 'bg-green-900/20 border border-green-800/30' : task.status === 'error' ? 'bg-red-900/20 border border-red-800/30' : task.status === 'running' ? 'bg-yellow-900/20 border border-yellow-800/30' : 'bg-gray-800 border border-gray-700'}`}>
              <div className="flex items-center gap-1">
                <span>{task.status === 'completed' ? '✅' : task.status === 'error' ? '❌' : task.status === 'running' ? '⏳' : '⏸️'}</span>
                <span className="text-gray-300 truncate flex-1">{task.name}</span>
                <button onClick={() => store.removeAgentTask(task.id)} className="text-gray-500 hover:text-red-400">✕</button>
              </div>
              {task.result && <pre className="mt-1 text-gray-400 whitespace-pre-wrap max-h-20 overflow-y-auto bg-black/20 rounded p-1">{task.result.slice(0, 300)}</pre>}
              {task.error && <p className="mt-1 text-red-400">{task.error}</p>}
            </div>
          ))}
        </div>
      )}

      {/* API Configs */}
      <div className="border-t border-gray-700 pt-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase">APIs Configuradas</h3>
          <button onClick={() => setNewApi(!newApi)} className="text-[10px] text-blue-400 hover:text-blue-300">+ Nueva</button>
        </div>
        <div className="space-y-1">
          {store.agentConfig.apis.map(api => (
            <div key={api.id} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer ${api.enabled ? 'bg-gray-700/50' : 'bg-gray-800/50 opacity-50'}`} onClick={() => setEditingApi(editingApi === api.id ? null : api.id)}>
              <span className="flex-1 truncate text-gray-300">{providerLabels[api.provider]} {api.name}</span>
              {api.id === store.agentConfig.defaultApiId && <span className="text-[8px] text-yellow-400">★</span>}
              <button onClick={e => { e.stopPropagation(); store.updateAgentAPI(api.id, { enabled: !api.enabled }); }} className={`w-4 h-2.5 rounded-full ${api.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
            </div>
          ))}
        </div>

        {/* Edit API */}
        {editingApi && (
          <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-600 space-y-1.5">
            {(() => {
              const api = store.agentConfig.apis.find(a => a.id === editingApi);
              if (!api) return null;
              return (
                <>
                  <input type="text" value={api.name} onChange={e => store.updateAgentAPI(api.id, { name: e.target.value })} placeholder="Nombre" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none" />
                  <select value={api.provider} onChange={e => store.updateAgentAPI(api.id, { provider: e.target.value as AgentProvider })} className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none">
                    <option value="ollama">Ollama (Local)</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="groq">Groq</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude</option>
                    <option value="huggingface">HuggingFace</option>
                    <option value="opencode">OpenCode</option>
                    <option value="ngrok">Ngrok Tunnel</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input type="text" value={api.baseUrl} onChange={e => store.updateAgentAPI(api.id, { baseUrl: e.target.value })} placeholder="Base URL" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none" />
                  <input type="password" value={api.apiKey || ''} onChange={e => store.updateAgentAPI(api.id, { apiKey: e.target.value })} placeholder="API Key (opcional)" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none" />
                  <input type="text" value={api.model} onChange={e => store.updateAgentAPI(api.id, { model: e.target.value })} placeholder="Modelo" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none" />
                  <div className="flex gap-1">
                    <div className="flex-1"><label className="text-[8px] text-gray-500">Max Tokens</label><input type="number" value={api.maxTokens} onChange={e => store.updateAgentAPI(api.id, { maxTokens: +e.target.value })} className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-1 py-0.5 border border-gray-600 focus:outline-none" /></div>
                    <div className="flex-1"><label className="text-[8px] text-gray-500">Temp</label><input type="number" step="0.1" min="0" max="2" value={api.temperature} onChange={e => store.updateAgentAPI(api.id, { temperature: +e.target.value })} className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-1 py-0.5 border border-gray-600 focus:outline-none" /></div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => store.setDefaultAgentAPI(api.id)} className="flex-1 text-[9px] bg-yellow-900/30 text-yellow-400 rounded px-2 py-1 hover:bg-yellow-900/50">★ Default</button>
                    <button onClick={() => { store.removeAgentAPI(api.id); setEditingApi(null); }} className="text-[9px] bg-red-900/30 text-red-400 rounded px-2 py-1 hover:bg-red-900/50">Eliminar</button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* New API form */}
        {newApi && (
          <div className="mt-2 p-2 bg-gray-800 rounded border border-blue-700 space-y-1.5">
            <input type="text" placeholder="Nombre de la API" id="newApiName" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none" />
            <select id="newApiProvider" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none">
              <option value="ollama">Ollama (Local)</option>
              <option value="openrouter">OpenRouter</option>
              <option value="groq">Groq</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="huggingface">HuggingFace</option>
              <option value="opencode">OpenCode</option>
              <option value="ngrok">Ngrok Tunnel</option>
              <option value="custom">Custom</option>
            </select>
            <input type="text" placeholder="Base URL" id="newApiUrl" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none" />
            <input type="password" placeholder="API Key" id="newApiKey" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none" />
            <input type="text" placeholder="Modelo" id="newApiModel" className="w-full bg-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 border border-gray-600 focus:outline-none" />
            <button onClick={() => {
              const name = (document.getElementById('newApiName') as HTMLInputElement)?.value || 'Nueva API';
              const provider = (document.getElementById('newApiProvider') as HTMLSelectElement)?.value as AgentProvider;
              const baseUrl = (document.getElementById('newApiUrl') as HTMLInputElement)?.value || '';
              const apiKey = (document.getElementById('newApiKey') as HTMLInputElement)?.value || '';
              const model = (document.getElementById('newApiModel') as HTMLInputElement)?.value || '';
              store.addAgentAPI({ name, provider, baseUrl, apiKey, model, maxTokens: 2048, temperature: 0.7, enabled: true });
              setNewApi(false);
            }} className="w-full bg-blue-600 text-white text-[10px] rounded px-2 py-1 hover:bg-blue-500">Crear API</button>
          </div>
        )}
      </div>
    </div>
  );
}
