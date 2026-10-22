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
  const {
    project,
    selectedSkeletonId,
    selectedBoneId,
    setTool,
    addKeyframe,
    currentTime,
    createProject,
    exportProject,
    importProject,
  } = useAnimationStore();

  // Initialize project
  useEffect(() => {
    if (project.skeletons.length === 0) {
      createProject('Mi Animación');
    }
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'v':
        setTool('select');
        break;
      case 'g':
        setTool('move');
        break;
      case 'r':
        setTool('rotate');
        break;
      case 's':
        if (!e.ctrlKey && !e.metaKey) {
          setTool('scale');
        } else {
          // Save project
          e.preventDefault();
          const json = exportProject();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${project.name}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
        break;
      case 'b':
        setTool('bone');
        break;
      case 'k': {
        // Add keyframe
        if (selectedBoneId && selectedSkeletonId) {
          const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);
          if (skeleton) {
            const animation = skeleton.animations[0];
            if (animation) {
              addKeyframe(selectedBoneId, Math.round(currentTime));
            }
          }
        }
        break;
      }
      case ' ':
        e.preventDefault();
        useAnimationStore.getState().setPlaying(!useAnimationStore.getState().isPlaying);
        break;
      case 'delete':
      case 'backspace': {
        const state = useAnimationStore.getState();
        if (state.selectedKeyframeId) {
          useAnimationStore.getState().removeKeyframe(state.selectedKeyframeId);
        }
        break;
      }
    }
  }, [setTool, selectedBoneId, selectedSkeletonId, currentTime, addKeyframe, project, exportProject]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const json = ev.target?.result as string;
        importProject(json);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden select-none">
      {/* Top Bar */}
      <header className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-3 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded flex items-center justify-center text-xs font-bold">
            M
          </div>
          <span className="text-sm font-semibold text-gray-200">MotionForge 2D</span>
        </div>

        <div className="w-px h-5 bg-gray-600" />

        {/* Menu items */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleExport}
            className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            💾 Guardar
          </button>
          <button
            onClick={handleImport}
            className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            📂 Cargar
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="px-2 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded transition-colors"
          >
            📤 Exportar
          </button>
        </div>

        <div className="w-px h-5 bg-gray-600" />

        {/* Project name */}
        <span className="text-xs text-gray-500">{project.name}</span>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            Huesos: {project.skeletons.find(s => s.id === selectedSkeletonId)?.bones.length || 0}
          </span>
          <span className="text-[10px] text-gray-500">
            Keyframes: {(() => {
              const sk = project.skeletons.find(s => s.id === selectedSkeletonId);
              const anim = sk?.animations[0];
              return anim?.keyframes.length || 0;
            })()}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Side Panel */}
        <SidePanel />

        {/* Canvas + Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas */}
          <Canvas />

          {/* Timeline */}
          <Timeline />
        </div>
      </div>

      {/* Status bar */}
      <footer className="h-6 bg-gray-800 border-t border-gray-700 flex items-center px-3 text-[10px] text-gray-500 gap-4 flex-shrink-0">
        <span>⌨️ V:Seleccionar G:Mover R:Rotar S:Escalar B:Hueso K:Keyframe Espacio:Play</span>
        <span className="ml-auto">MotionForge 2D v0.1.0</span>
      </footer>

      {/* Export Modal */}
      <ExportModal isOpen={showExport} onClose={() => setShowExport(false)} />

      {/* Welcome Modal */}
      <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
}

export default App;
