import { useRef, useCallback } from 'react';
import { useAnimationStore } from '../stores/animationStore';

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const store = useAnimationStore();
  const scene = store.getActiveScene();
  const char = store.getActiveCharacter();
  const anim = char?.animations.find(a => a.id === store.selectedAnimationId);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!anim || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(anim.duration, (x / rect.width) * anim.duration));
    store.setCurrentTime(newTime);
  }, [anim, store]);

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1 || !anim || !timelineRef.current) return;
    handleClick(e);
  }, [anim, handleClick]);

  return (
    <div className="h-56 bg-gray-900 border-t border-gray-700 flex flex-col">
      {/* Controls */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border-b border-gray-700 flex-wrap">
        <button onClick={() => store.setCurrentTime(0)} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Inicio">⏮</button>
        <button onClick={() => store.setCurrentTime(Math.max(0, store.currentTime - 1))} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Anterior">⏪</button>
        <button onClick={() => store.setPlaying(!store.isPlaying)} className={`p-1.5 rounded ${store.isPlaying ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'}`} title={store.isPlaying ? 'Pausar' : 'Play'}>{store.isPlaying ? '⏸' : '▶'}</button>
        <button onClick={() => store.setCurrentTime(Math.min(anim?.duration || 60, store.currentTime + 1))} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Siguiente">⏩</button>
        <button onClick={() => anim && store.setCurrentTime(anim.duration)} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Final">⏭</button>
        <div className="w-px h-5 bg-gray-600" />
        <button onClick={() => store.setLoop(!store.loop)} className={`p-1 rounded ${store.loop ? 'text-blue-400 bg-blue-900/30' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title="Loop">🔁</button>
        <select value={store.playbackSpeed} onChange={e => store.setPlaybackSpeed(+e.target.value)} className="bg-gray-700 text-gray-300 text-[10px] rounded px-1 py-0.5 border border-gray-600">
          <option value={0.25}>0.25x</option><option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option><option value={4}>4x</option>
        </select>
        <div className="w-px h-5 bg-gray-600" />
        <button onClick={() => store.selectedBoneId && anim && store.addKeyframe(store.selectedBoneId, Math.round(store.currentTime))} disabled={!store.selectedBoneId || !anim} className="p-1 text-yellow-400 hover:text-yellow-300 hover:bg-gray-700 rounded disabled:opacity-30" title="Keyframe (K)">⭐</button>
        <button onClick={() => store.selectedKeyframeId && store.removeKeyframe(store.selectedKeyframeId)} disabled={!store.selectedKeyframeId} className="p-1 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded disabled:opacity-30" title="Eliminar KF">🗑</button>
        <div className="w-px h-5 bg-gray-600" />
        <select value={store.selectedAnimationId || ''} onChange={e => store.selectAnimation(e.target.value || null)} className="bg-gray-700 text-gray-300 text-[10px] rounded px-1 py-0.5 border border-gray-600 max-w-24">
          <option value="">Sin animación</option>
          {char?.animations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={() => store.addAnimation(`Anim ${(char?.animations.length || 0) + 1}`)} disabled={!char} className="p-1 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded disabled:opacity-30" title="Nueva animación">+</button>
        <div className="ml-auto text-[10px] text-gray-400 font-mono">{store.currentTime.toFixed(1)} / {anim?.duration || scene?.duration || 60}f</div>
      </div>

      {/* Tracks */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-36 border-r border-gray-700 overflow-y-auto flex-shrink-0">
          {char ? char.bones.map(bone => (
            <div key={bone.id} className={`h-6 flex items-center px-2 text-[10px] border-b border-gray-800 ${bone.id === store.selectedBoneId ? 'bg-blue-900/30 text-blue-300' : 'text-gray-400'}`}>
              <div className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: bone.color }} />
              <span className="truncate">{bone.name}</span>
            </div>
          )) : <div className="p-2 text-[10px] text-gray-500">Sin personaje</div>}
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-auto relative">
          {anim && char ? (
            <>
              <div className="h-5 bg-gray-800 border-b border-gray-700 relative sticky top-0 z-10">
                {Array.from({ length: anim.duration + 1 }, (_, i) => (
                  <div key={i} className="absolute top-0 h-full flex items-end" style={{ left: `${(i / anim.duration) * 100}%` }}>
                    {i % 5 === 0 && <span className="text-[8px] text-gray-500 ml-0.5">{i}</span>}
                    <div className={`w-px ${i % 10 === 0 ? 'h-2.5 bg-gray-600' : 'h-1 bg-gray-700'}`} />
                  </div>
                ))}
              </div>
              <div ref={timelineRef} className="relative" onClick={handleClick} onMouseMove={handleDrag}>
                {char.bones.map(bone => {
                  const kfs = anim.keyframes.filter(kf => kf.boneId === bone.id);
                  return (
                    <div key={bone.id} className={`h-6 border-b border-gray-800 relative ${bone.id === store.selectedBoneId ? 'bg-blue-900/10' : ''}`}>
                      {kfs.map(kf => (
                        <div key={kf.id} className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 cursor-pointer transition-all ${kf.id === store.selectedKeyframeId ? 'bg-yellow-400 scale-125' : 'bg-yellow-600 hover:bg-yellow-500 hover:scale-110'}`} style={{ left: `${(kf.time / anim.duration) * 100}%` }} onClick={e => { e.stopPropagation(); store.selectKeyframe(kf.id); store.setCurrentTime(kf.time); }} />
                      ))}
                    </div>
                  );
                })}
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20" style={{ left: `${(store.currentTime / anim.duration) * 100}%` }}>
                  <div className="absolute -top-0.5 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rotate-45" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xs">{char ? 'Selecciona o crea una animación' : 'Selecciona un personaje'}</div>
          )}
        </div>
      </div>
    </div>
  );
}
