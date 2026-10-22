import { useState } from 'react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: '🦴 Sistema de Huesos',
      description: 'Crea esqueletos con jerarquía padre-hijo. Cada hueso puede tener hijos que heredan su transformación.',
      tips: [
        'Usa la herramienta "Hueso" (B) para crear nuevos huesos',
        'Haz click en un hueso padre antes de crear un hijo',
        'La jerarquía se muestra en el panel lateral',
      ],
    },
    {
      title: '🎬 Animación con Keyframes',
      description: 'Crea animaciones definiendo poses clave. El sistema interpola automáticamente entre ellas.',
      tips: [
        'Selecciona un hueso y presiona K para agregar un keyframe',
        'Mueve el playhead en el timeline y cambia la pose',
        'Cambia el easing de cada keyframe para diferentes efectos',
      ],
    },
    {
      title: '🎮 Controles',
      description: 'Usa atajos de teclado para trabajar más rápido.',
      tips: [
        'V: Seleccionar | G: Mover | R: Rotar | S: Escalar',
        'B: Crear hueso | K: Agregar keyframe',
        'Espacio: Play/Pause | Ctrl+S: Guardar proyecto',
      ],
    },
    {
      title: '📤 Exportación',
      description: 'Exporta tus animaciones en múltiples formatos.',
      tips: [
        'Video WebM para compartir animaciones',
        'Sprite Sheets para videojuegos',
        'Secuencia PNG para edición posterior',
        'JSON para reutilizar en el editor',
      ],
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl p-8 w-[480px] shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
            🎬
          </div>
          <h1 className="text-2xl font-bold text-white">MotionForge 2D</h1>
          <p className="text-sm text-gray-400 mt-1">Motor de Animación 2D con IA</p>
        </div>

        {/* Step content */}
        <div className="bg-gray-700/30 rounded-xl p-4 mb-6">
          <h3 className="text-base font-semibold text-white mb-2">{currentStep.title}</h3>
          <p className="text-sm text-gray-300 mb-3">{currentStep.description}</p>
          <ul className="space-y-1.5">
            {currentStep.tips.map((tip, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">▸</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-blue-500 w-6' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {step === 0 ? 'Cerrar' : '← Anterior'}
          </button>
          
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all"
            >
              ¡Empezar a Animar! 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
