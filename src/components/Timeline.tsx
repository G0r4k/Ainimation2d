import { useRef, useCallback } from 'react';
import { useAnimationStore } from '../stores/animationStore';

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const {
    project,
    selectedSkeletonId,
    selectedAnimationId,
    selectedBoneId,
    selectedKeyframeId,
    currentTime,
    isPlaying,
    loop,
    playbackSpeed,
    setCurrentTime,
    setPlaying,
    setLoop,
    setPlaybackSpeed,
    addKeyframe,
    removeKeyframe,
    selectKeyframe,
    createAnimation,
    removeAnimation,
    selectAnimation,
  } = useAnimationStore();

  const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
  const animation = skeleton?.animations.find(a => a.id === selectedAnimationId);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!animation || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frameWidth = rect.width / animation.duration;
    const newTime = Math.max(0, Math.min(animation.duration, x / frameWidth));
    setCurrentTime(newTime);
  }, [animation, setCurrentTime]);

  const handleTimelineDrag = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1 || !animation || !timelineRef.current) return;
    handleTimelineClick(e);
  }, [animation, handleTimelineClick]);

  const handleAddKeyframe = () => {
    if (!selectedBoneId || !animation) return;
    addKeyframe(selectedBoneId, Math.round(currentTime));
  };

  const handleRemoveKeyframe = () => {
    if (!selectedKeyframeId) return;
    removeKeyframe(selectedKeyframeId);
  };

  const handleCreateAnimation = () => {
    const name = `Animación ${skeleton?.animations.length || 0 + 1}`;
    createAnimation(name);
  };

  const handleRemoveAnimation = () => {
    if (!selectedAnimationId) return;
    removeAnimation(selectedAnimationId);
  };

  return (
    <div className="h-64 bg-gray-900 border-t border-gray-700 flex flex-col">
      {/* Timeline Controls */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
        {/* Playback controls */}
        <button
          onClick={() => setCurrentTime(0)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Ir al inicio"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 4h2v12H5V4zm3 0l9 6-9 6V4z" />
          </svg>
        </button>
        <button
          onClick={() => setCurrentTime(Math.max(0, currentTime - 1))}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Frame anterior"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M12 5l-7 5 7 5V5z" />
          </svg>
        </button>
        <button
          onClick={() => setPlaying(!isPlaying)}
          className={`p-2 rounded transition-colors ${isPlaying ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>
        <button
          onClick={() => setCurrentTime(Math.min(animation?.duration || 60, currentTime + 1))}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Frame siguiente"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 5l7 5-7 5V5z" />
          </svg>
        </button>
        <button
          onClick={() => animation && setCurrentTime(animation.duration)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Ir al final"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 4h2v12h-2V4zm-10 0l9 6-9 6V4z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Loop toggle */}
        <button
          onClick={() => setLoop(!loop)}
          className={`p-1.5 rounded transition-colors ${loop ? 'text-blue-400 bg-blue-900/30' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
          title="Loop"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Speed control */}
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          className="bg-gray-700 text-gray-300 text-xs rounded px-2 py-1 border border-gray-600"
        >
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Keyframe controls */}
        <button
          onClick={handleAddKeyframe}
          disabled={!selectedBoneId || !animation}
          className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Agregar keyframe"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2l2.5 5.5L18 10l-5.5 2.5L10 18l-2.5-5.5L2 10l5.5-2.5L10 2z" />
          </svg>
        </button>
        <button
          onClick={handleRemoveKeyframe}
          disabled={!selectedKeyframeId}
          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Eliminar keyframe"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Animation selector */}
        <select
          value={selectedAnimationId || ''}
          onChange={(e) => selectAnimation(e.target.value || null)}
          className="bg-gray-700 text-gray-300 text-xs rounded px-2 py-1 border border-gray-600 max-w-32"
        >
          <option value="">Sin animación</option>
          {skeleton?.animations.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          onClick={handleCreateAnimation}
          disabled={!skeleton}
          className="p-1.5 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded transition-colors disabled:opacity-30"
          title="Nueva animación"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={handleRemoveAnimation}
          disabled={!selectedAnimationId}
          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors disabled:opacity-30"
          title="Eliminar animación"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Time display */}
        <div className="ml-auto text-xs text-gray-400 font-mono">
          {currentTime.toFixed(1)} / {animation?.duration || 60} frames
        </div>
      </div>

      {/* Timeline tracks */}
      <div className="flex-1 flex overflow-hidden">
        {/* Bone labels */}
        <div className="w-40 bg-gray-850 border-r border-gray-700 overflow-y-auto flex-shrink-0">
          {skeleton && animation ? (
            skeleton.bones.map(bone => (
              <div
                key={bone.id}
                className={`h-8 flex items-center px-2 text-xs border-b border-gray-800 ${
                  bone.id === selectedBoneId ? 'bg-blue-900/30 text-blue-300' : 'text-gray-400'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: bone.color }}
                />
                <span className="truncate">{bone.name}</span>
              </div>
            ))
          ) : (
            <div className="p-3 text-xs text-gray-500">
              Selecciona un esqueleto y crea una animación
            </div>
          )}
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto relative">
          {animation && skeleton ? (
            <>
              {/* Frame ruler */}
              <div className="h-6 bg-gray-800 border-b border-gray-700 relative sticky top-0 z-10">
                {Array.from({ length: animation.duration + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-end"
                    style={{ left: `${(i / animation.duration) * 100}%` }}
                  >
                    {i % 5 === 0 && (
                      <span className="text-[9px] text-gray-500 ml-0.5">{i}</span>
                    )}
                    <div className={`w-px ${i % 10 === 0 ? 'h-3 bg-gray-600' : 'h-1.5 bg-gray-700'}`} />
                  </div>
                ))}
              </div>

              {/* Tracks */}
              <div
                ref={timelineRef}
                className="relative"
                onClick={handleTimelineClick}
                onMouseMove={handleTimelineDrag}
              >
                {skeleton.bones.map(bone => {
                  const boneKeyframes = animation.keyframes.filter(kf => kf.boneId === bone.id);
                  return (
                    <div
                      key={bone.id}
                      className={`h-8 border-b border-gray-800 relative ${
                        bone.id === selectedBoneId ? 'bg-blue-900/10' : ''
                      }`}
                    >
                      {/* Keyframes */}
                      {boneKeyframes.map(kf => (
                        <div
                          key={kf.id}
                          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 cursor-pointer transition-all ${
                            kf.id === selectedKeyframeId
                              ? 'bg-yellow-400 scale-125'
                              : 'bg-yellow-600 hover:bg-yellow-500 hover:scale-110'
                          }`}
                          style={{ left: `${(kf.time / animation.duration) * 100}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectKeyframe(kf.id);
                            setCurrentTime(kf.time);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
                  style={{ left: `${(currentTime / animation.duration) * 100}%` }}
                >
                  <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {skeleton ? 'Crea una animación para ver el timeline' : 'Selecciona un esqueleto'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
