import { useRef, useState, useCallback } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { v4 as uuidv4 } from 'uuid';
import { AssetData } from '../engine/types';

export function AssetsPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'asset' | 'background' | 'sprite'>('asset');
  const store = useAnimationStore();
  const char = store.getActiveCharacter();
  const scene = store.getActiveScene();

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const asset: AssetData = {
          id: uuidv4(),
          name: file.name.replace(/\.[^.]+$/, ''),
          type: 'image',
          src,
          width: img.width,
          height: img.height,
        };
        store.addAsset(asset);

        // Auto-apply based on mode
        if (importMode === 'background' && scene) {
          store.addBackground({
            name: asset.name,
            type: 'image',
            assetId: asset.id,
            visible: true,
            opacity: 1,
            zIndex: scene.backgrounds.length,
          });
        } else if (importMode === 'sprite' && char && store.selectedBoneId) {
          // Will be handled via slot system
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [store, importMode, scene, char]);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) processFile(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) processFile(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleUseAsBackground = (assetId: string) => {
    const asset = store.project.assets.find(a => a.id === assetId);
    if (!asset || !scene) return;
    store.addBackground({
      name: asset.name,
      type: 'image',
      assetId: asset.id,
      visible: true,
      opacity: 1,
      zIndex: scene.backgrounds.length,
    });
  };

  const handleAttachToBone = (assetId: string) => {
    if (!char || !store.selectedBoneId) return;
    const bone = char.bones.find(b => b.id === store.selectedBoneId);
    if (!bone) return;
    // Find or create slot for this bone
    const existingSlot = char.slots.find(s => s.boneId === store.selectedBoneId);
    if (existingSlot) {
      store.updateSlot(existingSlot.id, { assetId });
    } else {
      store.addSlot(store.selectedBoneId, assetId);
    }
  };

  return (
    <div
      className={`border-t border-gray-700 bg-gray-850 transition-colors ${dragOver ? 'bg-blue-900/20 border-blue-600' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Header */}
      <div className="p-2 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
            📁 Biblioteca de Assets
            <span className="text-[9px] text-gray-500 font-normal">({store.project.assets.length})</span>
          </h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded hover:bg-blue-900/40 transition-colors"
          >
            + Importar
          </button>
        </div>

        {/* Import mode */}
        <div className="flex gap-1 mb-2">
          {[
            { id: 'asset' as const, label: '📦 Solo Asset', desc: 'Guardar en biblioteca' },
            { id: 'background' as const, label: '🏞️ Fondo', desc: 'Como fondo de escena' },
            { id: 'sprite' as const, label: '🦴 Sprite', desc: 'Asociar a hueso' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setImportMode(m.id)}
              className={`flex-1 text-[9px] px-1.5 py-1 rounded transition-colors ${importMode === m.id ? 'bg-blue-600/30 text-blue-300 border border-blue-600' : 'bg-gray-700/50 text-gray-400 border border-transparent hover:bg-gray-700'}`}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.json,.svg"
          multiple
          onChange={handleFileImport}
          className="hidden"
        />
      </div>

      {/* Drop zone / Asset grid */}
      <div className="p-2">
        {store.project.assets.length === 0 ? (
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="text-2xl mb-1">📁</div>
            <p className="text-[10px] text-gray-400">
              Arrastra imágenes aquí o haz click en <span className="text-blue-400">+ Importar</span>
            </p>
            <p className="text-[9px] text-gray-500 mt-1">PNG, JPG, SVG, GIF</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
            {store.project.assets.map(asset => (
              <div
                key={asset.id}
                className={`relative group aspect-square bg-gray-700 rounded overflow-hidden border cursor-pointer transition-all ${
                  selectedAsset === asset.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-600 hover:border-gray-400'
                }`}
                onClick={() => setSelectedAsset(selectedAsset === asset.id ? null : asset.id)}
              >
                <img src={asset.src} alt={asset.name} className="w-full h-full object-contain" />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-0.5 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUseAsBackground(asset.id); }}
                    className="text-[8px] bg-green-600/80 text-white px-1.5 py-0.5 rounded hover:bg-green-500"
                    title="Usar como fondo"
                  >
                    🏞️ Fondo
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAttachToBone(asset.id); }}
                    disabled={!store.selectedBoneId}
                    className="text-[8px] bg-blue-600/80 text-white px-1.5 py-0.5 rounded hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Asociar a hueso seleccionado"
                  >
                    🦴 Sprite
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); store.removeAsset(asset.id); }}
                    className="text-[8px] bg-red-600/80 text-white px-1.5 py-0.5 rounded hover:bg-red-500"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
                {/* Name label */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-0.5 py-0.5">
                  <span className="text-[7px] text-gray-300 truncate block">{asset.name}</span>
                </div>
                {/* Size badge */}
                <div className="absolute top-0 right-0 bg-black/60 px-0.5 py-0 rounded-bl">
                  <span className="text-[6px] text-gray-400">{asset.width}×{asset.height}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected asset details */}
      {selectedAsset && (
        <div className="px-2 pb-2 border-t border-gray-700 pt-2">
          {(() => {
            const asset = store.project.assets.find(a => a.id === selectedAsset);
            if (!asset) return null;
            return (
              <div className="flex gap-2">
                <img src={asset.src} alt={asset.name} className="w-12 h-12 object-contain bg-gray-700 rounded" />
                <div className="flex-1 text-[10px] text-gray-300 space-y-0.5">
                  <div className="font-medium truncate">{asset.name}</div>
                  <div className="text-gray-500">{asset.width} × {asset.height}px</div>
                  <div className="text-gray-500">Tipo: {asset.type}</div>
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => handleUseAsBackground(asset.id)} className="text-[9px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded hover:bg-green-900/50">🏞️ Fondo</button>
                    <button onClick={() => handleAttachToBone(asset.id)} disabled={!store.selectedBoneId} className="text-[9px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded hover:bg-blue-900/50 disabled:opacity-30">🦴 Sprite</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tips */}
      <div className="px-2 pb-2">
        <p className="text-[8px] text-gray-500 leading-tight">
          💡 <b>Tip:</b> Selecciona un hueso y un asset, luego click "🦴 Sprite" para asociar la imagen al hueso. Usa "🏞️ Fondo" para agregar como capa de fondo.
        </p>
      </div>
    </div>
  );
}
