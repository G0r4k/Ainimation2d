import { useState } from 'react';

interface Props { isOpen: boolean; onClose: () => void; }

export function WelcomeModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState(0);
  if (!isOpen) return null;

  const steps = [
    { title: '👤 Personajes & Escenas', desc: 'Crea múltiples personajes con esqueletos jerárquicos. Organiza tu proyecto en escenas con transiciones.', tips: ['Cada personaje tiene su propio esqueleto y animaciones', 'Agrega múltiples escenas con transiciones (fade, slide, dissolve)', 'Los personajes se pueden posicionar, escalar y rotar en la escena', 'Z-Index para controlar el orden de renderizado'] },
    { title: '🏞️ Fondos & Capas', desc: 'Sistema de fondos multicapa con gradientes, colores sólidos, imágenes y parallax.', tips: ['Agrega capas de fondo con diferentes tipos (color, gradiente, imagen, parallax)', 'Controla opacidad y z-index de cada capa', 'Los fondos con parallax se mueven a diferente velocidad que la cámara', 'Ideal para crear profundidad en tus escenas'] },
    { title: '📷 Sistema de Cámaras', desc: 'Múltiples cámaras con zoom, rotación, follow-target y viewport personalizable.', tips: ['Crea múltiples cámaras y cambia entre ellas', 'Cada cámara tiene posición, zoom, rotación y viewport', 'Las cámaras pueden seguir personajes (follow-target)', 'El viewport de la cámara se muestra como un rectángulo rojo en el canvas'] },
    { title: '🤖 Modo Agente IA', desc: 'Configura APIs de IA (locales y remotas) para generar animaciones automáticamente.', tips: ['Ollama: Modelos locales 100% gratis (llama3, mistral, phi-3)', 'Groq: API gratuita con límites generosos', 'HuggingFace: Inferencia gratuita', 'OpenAI y Claude: APIs de pago con máxima calidad', 'Cualquier API compatible con OpenAI puede conectarse'] },
    { title: '🎬 Animación & Export', desc: 'Timeline profesional con keyframes, easing curves y exportación a múltiples formatos.', tips: ['V:Seleccionar G:Mover R:Rotar S:Escalar B:Hueso K:Keyframe', 'Espacio: Play/Pause | Ctrl+S: Guardar proyecto', 'Exporta a WebM, Sprite Sheets, Secuencia PNG o JSON', 'Easing: Linear, Ease In/Out, Bezier, Elastic, Bounce'] },
  ];

  const s = steps[step];
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl p-8 w-[520px] shadow-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">🎬</div>
          <h1 className="text-2xl font-bold text-white">MotionForge 2D <span className="text-purple-400">Pro</span></h1>
          <p className="text-sm text-gray-400 mt-1">Motor de Animación 2D con IA • Escenas • Cámaras • Agentes</p>
        </div>
        <div className="bg-gray-700/30 rounded-xl p-4 mb-6">
          <h3 className="text-base font-semibold text-white mb-2">{s.title}</h3>
          <p className="text-sm text-gray-300 mb-3">{s.desc}</p>
          <ul className="space-y-1.5">{s.tips.map((t, i) => <li key={i} className="text-xs text-gray-400 flex items-start gap-2"><span className="text-blue-400 mt-0.5">▸</span>{t}</li>)}</ul>
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {steps.map((_, i) => <button key={i} onClick={() => setStep(i)} className={`h-2 rounded-full transition-all ${i === step ? 'bg-blue-500 w-6' : 'bg-gray-600 w-2 hover:bg-gray-500'}`} />)}
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose()} className="px-4 py-2 text-sm text-gray-400 hover:text-white">{step === 0 ? 'Cerrar' : '← Anterior'}</button>
          {step < steps.length - 1 ? <button onClick={() => setStep(step + 1)} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500">Siguiente →</button> : <button onClick={onClose} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-lg hover:from-purple-500 hover:to-blue-500">¡Empezar! 🚀</button>}
        </div>
      </div>
    </div>
  );
}
