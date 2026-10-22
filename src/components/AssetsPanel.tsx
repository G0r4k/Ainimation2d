import { useRef, useState } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { v4 as uuidv4 } from 'uuid';
import { imageCache } from '../engine/ImageCache';

export function AssetsPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const store = useAnimationStore();
  const char = store.getActiveCharacter();
  const scene = store.getActiveScene();
  const assets = store.project.assets;

  const importFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          // Pre-cache the image
          imageCache.get(src);
          store.addAsset({
            id: uuidv4(),
            name: file.name.replace(/\.[^.]+$/, ''),
            type: 'image',
            src,
            width: img.width,
            height: img.height,
          });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) importFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) importFiles(e.dataTransfer.files);
  };

  const handleUseAsBackground = (assetId: string) => {
    if (!scene) return;
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    store.addBackground({
      name: asset.name,
      type: 'image',
      assetId: asset.id,
      visible: true,
      opacity: 1,
      zIndex: scene.backgrounds.length,
    });
    store.setActiveTab('backgrounds');
  };

  const handleAttachToBone = (assetId: string) => {
    if (!char || !store.selectedBoneId) return;
    const existingSlot = char.slots.find(s => s.boneId === store.selectedBoneId);
    if (existingSlot) {
      store.updateSlot(existingSlot.id, { assetId });
    } else {
      store.addSlot(store.selectedBoneId, assetId);
    }
  };

  return (
    <div
      className={`border-t border-gray-700 bg-gray-850 transition-colors ${dragOver ? 'bg-blue-900/20 border-blue-500' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      {/* Header */}
      <div className="p-2 border-b border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-semibold text-gray-300 uppercase flex items-center gap-1">
            📁 Assets
            <span className="text-[9px] text-gray-500 font-normal">({assets.length})</span>
          </h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded hover:bg-blue-900/50 transition-colors font-medium"
          >
            + Importar
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        <p className="text-[8px] text-gray-500">Arrastra imágenes aquí o click en Importar</p>
      </div>

      {/* Assets Grid */}
      <div className="p-2">
        {assets.length === 0 ? (
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-3 text-center hover:border-gray-500 transition-colors">
            <div className="text-xl mb-1">🖼️</div>
            <p className="text-[9px] text-gray-400">Sin imágenes importadas</p>
            <p className="text-[8px] text-gray-500 mt-0.5">PNG, JPG, SVG, GIF</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
            {assets.map(asset => (
              <div
                key={asset.id}
                className={`relative group aspect-square bg-gray-700 rounded overflow-hidden border cursor-pointer transition-all ${
                  selectedAsset === asset.id
                    ? 'border-blue-400 ring-1 ring-blue-400 scale-105'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                onClick={() => setSelectedAsset(selectedAsset === asset.id ? null : asset.id)}
              >
                <img src={asset.src} alt={asset.name} className="w-full h-full object-contain" />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-0.5 transition-opacity p-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUseAsBackground(asset.id); }}
                    className="text-[7px] bg-green-600/90 text-white px-1 py-0.5 rounded w-full text-center hover:bg-green-500"
                    title="Usar como fondo"
                  >
                    🏞️ Fondo
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAttachToBone(asset.id); }}
                    disabled={!store.selectedBoneId}
                    className="text-[7px] bg-blue-600/90 text-white px-1 py-0.5 rounded w-full text-center hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Asociar a hueso"
                  >
                    🦴 Sprite
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); store.removeAsset(asset.id); }}
                    className="text-[7px] bg-red-600/90 text-white px-1 py-0.5 rounded w-full text-center hover:bg-red-500"
                  >
                    ✕
                  </button>
                </div>
                {/* Name */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-0.5 py-0.5">
                  <span className="text-[6px] text-white truncate block">{asset.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Asset Details & Actions */}
      {selectedAsset && (() => {
        const asset = assets.find(a => a.id === selectedAsset);
        if (!asset) return null;
        return (
          <div className="px-2 pb-2 border-t border-gray-700 pt-2">
            <div className="flex gap-2">
              <img src={asset.src} alt={asset.name} className="w-14 h-14 object-contain bg-gray-700 rounded border border-gray-600" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-white font-medium truncate">{asset.name}</div>
                <div className="text-[9px] text-gray-400">{asset.width} × {asset.height}px</div>
                <div className="flex gap-1 mt-1.5">
                  <button
                    onClick={() => handleUseAsBackground(asset.id)}
                    className="flex-1 text-[9px] bg-green-900/40 text-green-300 border border-green-700/50 rounded px-1.5 py-1 hover:bg-green-900/60 transition-colors text-center"
                  >
                    🏞️ Fondo
                  </button>
                  <button
                    onClick={() => handleAttachToBone(asset.id)}
                    disabled={!store.selectedBoneId}
                    className="flex-1 text-[9px] bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded px-1.5 py-1 hover:bg-blue-900/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-center"
                  >
                    🦴 Sprite
                  </button>
                </div>
              </div>
            </div>
            {/* Context hint */}
            <div className="mt-1.5 p-1.5 bg-gray-800 rounded text-[8px] text-gray-400 leading-tight">
              {store.selectedBoneId ? (
                <span>💡 <b>🦴 Sprite</b>: Asocia esta imagen al hueso <b className="text-blue-300">{char?.bones.find(b => b.id === store.selectedBoneId)?.name}</b>. Se moverá con el hueso.</span>
              ) : (
                <span>💡 <b>🏞️ Fondo</b>: Agrega esta imagen como capa de fondo. <b>🦴 Sprite</b>: Selecciona un hueso primero.</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Quick Help */}
      {assets.length > 0 && !selectedAsset && (
        <div className="px-2 pb-2">
          <div className="p-1.5 bg-gray-800/50 rounded text-[8px] text-gray-500 leading-tight space-y-0.5">
            <div>📌 <b>Selecciona una imagen</b> para ver opciones</div>
            <div>🏞️ <b>Fondo</b>: Imagen de fondo de escena</div>
            <div>🦴 <b>Sprite</b>: Imagen asociada a un hueso</div>
          </div>
        </div>
      )}
    </div>
  );
}
