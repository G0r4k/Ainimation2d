import { useRef } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { v4 as uuidv4 } from 'uuid';

export function AssetsPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    project,
    selectedSkeletonId,
    addAsset,
    removeAsset,
    addSlot,
  } = useAnimationStore();

  const skeleton = project.skeletons.find(s => s.id === selectedSkeletonId);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          addAsset({
            id: uuidv4(),
            name: file.name,
            type: 'image',
            src: ev.target?.result as string,
            width: img.width,
            height: img.height,
          });
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachToBone = (assetId: string) => {
    if (!skeleton) return;
    // Find first bone without a slot, or the selected bone
    const selectedBoneId = useAnimationStore.getState().selectedBoneId;
    const boneId = selectedBoneId || skeleton.bones[0]?.id;
    if (boneId) {
      addSlot(boneId, assetId);
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-850">
      <div className="p-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase">Assets</h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded"
          >
            + Importar
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileImport}
          className="hidden"
        />

        {skeleton && skeleton.assets.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
            {skeleton.assets.map(asset => (
              <div
                key={asset.id}
                className="relative group aspect-square bg-gray-700 rounded overflow-hidden border border-gray-600 hover:border-blue-500 cursor-pointer"
              >
                <img
                  src={asset.src}
                  alt={asset.name}
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                  <button
                    onClick={() => handleAttachToBone(asset.id)}
                    className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded"
                    title="Asociar a hueso"
                  >
                    🦴
                  </button>
                  <button
                    onClick={() => removeAsset(asset.id)}
                    className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                  <span className="text-[8px] text-gray-300 truncate block">{asset.name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 italic">
            Importa imágenes PNG, JPG o SVG
          </p>
        )}
      </div>
    </div>
  );
}
