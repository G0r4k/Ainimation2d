import { useEffect, useCallback, useState } from 'react';
import { Canvas } from './components/Canvas';
import { Timeline } from './components/Timeline';
import { SidePanel } from './components/SidePanel';
import { ExportModal } from './components/ExportModal';
import { WelcomeModal } from './components/WelcomeModal';
import { useAnimationStore } from './stores/animationStore';

function App() {
  const [showExport, setShowExport] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const store = useAnimationStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    switch (e.key.toLowerCase()) {
      case 'v': store.setTool('select'); break;
      case 'g': store.setTool('move'); break;
      case 'r': store.setTool('rotate'); break;
      case 's': if (!e.ctrlKey && !e.metaKey) store.setTool('scale'); else { e.preventDefault(); handleSave(); } break;
      case 'b': store.setTool('bone'); break;
      case 'k': if (store.selectedBoneId && store.selectedAnimationId) store.addKeyframe(store.selectedBoneId, Math.round(store.currentTime)); break;
      case ' ': e.preventDefault(); store.setPlaying(!store.isPlaying); break;
      case 'delete': case 'backspace': if (store.selectedKeyframeId) store.removeKeyframe(store.selectedKeyframeId); break;
    }
  }, [store]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSave = () => {
    const json = store.exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${store.project.name}.json`; a.click();
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => store.importProject(ev.target?.result as string);
      reader.readAsText(file);
    };
    input.click();
  };

  const scene = store.getActiveScene();
  const char = store.getActiveCharacter();

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden select-none">
      {/* Top Bar */}
      <header className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-3 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded flex items-center justify-center text-xs font-bold">M</div>
          <span className="text-sm font-semibold text-gray-200">MotionForge 2D</span>
          <span className="text-[9px] text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded">PRO</span>
        </div>
        <div className="w-px h-5 bg-gray-600" />
        <div className="flex items-center gap-1">
          <button onClick={handleSave} className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">💾 Guardar</button>
          <button onClick={handleLoad} className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">📂 Cargar</button>
          <button onClick={() => setShowExport(true)} className="px-2 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded transition-colors">📤 Exportar</button>
        </div>
        <div className="w-px h-5 bg-gray-600" />
        <span className="text-xs text-gray-500">{store.project.name}</span>
        {scene && <span className="text-[10px] text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded">🎬 {scene.name}</span>}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-500">
          <span>👤 {scene?.characters.length || 0}</span>
          <span>🏞️ {scene?.backgrounds.length || 0}</span>
          <span>📷 {scene?.cameras.length || 0}</span>
          <span>🦴 {char?.bones.length || 0}</span>
          <span>⭐ {char?.animations.find(a => a.id === store.selectedAnimationId)?.keyframes.length || 0}</span>
          <span className="text-green-400">🤖 {store.agentConfig.apis.filter(a => a.enabled).length} APIs</span>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <SidePanel />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Canvas />
          <Timeline />
        </div>
      </div>

      {/* Status bar */}
      <footer className="h-6 bg-gray-800 border-t border-gray-700 flex items-center px-3 text-[10px] text-gray-500 gap-4 flex-shrink-0">
        <span>⌨️ V:Seleccionar G:Mover R:Rotar S:Escalar B:Hueso K:Keyframe Espacio:Play Ctrl+S:Guardar</span>
        <span className="ml-auto">MotionForge 2D Pro v2.0.0</span>
      </footer>

      <ExportModal isOpen={showExport} onClose={() => setShowExport(false)} />
      <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
}

export default App;
