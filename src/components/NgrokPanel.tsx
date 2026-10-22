import { useState } from 'react';
import { useAnimationStore } from '../stores/animationStore';

export function NgrokPanel() {
  const store = useAnimationStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTunnel, setNewTunnel] = useState({
    name: '',
    localPort: 11434,
    authToken: '',
    region: 'us',
    protocol: 'http' as 'http' | 'tcp',
  });

  const handleAddTunnel = () => {
    if (!newTunnel.name || !newTunnel.localPort) return;
    
    store.addNgrokTunnel({
      name: newTunnel.name,
      localPort: newTunnel.localPort,
      authToken: newTunnel.authToken,
      region: newTunnel.region,
      protocol: newTunnel.protocol,
    });
    
    setNewTunnel({ name: '', localPort: 11434, authToken: '', region: 'us', protocol: 'http' });
    setShowAddForm(false);
  };

  const handleStartTunnel = async (id: string) => {
    await store.startNgrokTunnel(id);
  };

  const handleStopTunnel = (id: string) => {
    store.stopNgrokTunnel(id);
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-gray-400 uppercase">
          🔗 Túneles Ngrok
        </label>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded"
        >
          {showAddForm ? '✕ Cancelar' : '+ Nuevo Túnel'}
        </button>
      </div>

      {/* Add tunnel form */}
      {showAddForm && (
        <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3 space-y-2">
          <div>
            <label className="text-[9px] text-gray-400 block mb-0.5">Nombre</label>
            <input
              type="text"
              value={newTunnel.name}
              onChange={e => setNewTunnel({ ...newTunnel, name: e.target.value })}
              placeholder="Ej: Ollama Local"
              className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400 block mb-0.5">Puerto Local</label>
            <input
              type="number"
              value={newTunnel.localPort}
              onChange={e => setNewTunnel({ ...newTunnel, localPort: +e.target.value })}
              placeholder="11434"
              className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400 block mb-0.5">Auth Token (opcional)</label>
            <input
              type="password"
              value={newTunnel.authToken}
              onChange={e => setNewTunnel({ ...newTunnel, authToken: e.target.value })}
              placeholder="Tu token de ngrok"
              className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[9px] text-gray-400 block mb-0.5">Región</label>
              <select
                value={newTunnel.region}
                onChange={e => setNewTunnel({ ...newTunnel, region: e.target.value })}
                className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="us">United States</option>
                <option value="eu">Europe</option>
                <option value="ap">Asia/Pacific</option>
                <option value="au">Australia</option>
                <option value="sa">South America</option>
                <option value="jp">Japan</option>
                <option value="in">India</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-gray-400 block mb-0.5">Protocolo</label>
              <select
                value={newTunnel.protocol}
                onChange={e => setNewTunnel({ ...newTunnel, protocol: e.target.value as 'http' | 'tcp' })}
                className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="http">HTTP</option>
                <option value="tcp">TCP</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleAddTunnel}
            disabled={!newTunnel.name || !newTunnel.localPort}
            className="w-full bg-blue-600 text-white text-xs rounded px-3 py-1.5 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Crear Túnel
          </button>
        </div>
      )}

      {/* Tunnels list */}
      <div className="space-y-2">
        {store.agentConfig.ngrokTunnels.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-2xl mb-2">🔗</div>
            <p className="text-xs text-gray-400">No hay túneles configurados</p>
            <p className="text-[10px] text-gray-500 mt-1">
              Crea túneles para exponer APIs locales (como Ollama) a internet
            </p>
          </div>
        ) : (
          store.agentConfig.ngrokTunnels.map(tunnel => (
            <div
              key={tunnel.id}
              className={`bg-gray-700/30 border rounded-lg p-3 ${
                tunnel.status === 'active' ? 'border-green-600' :
                tunnel.status === 'starting' ? 'border-yellow-600' :
                tunnel.status === 'error' ? 'border-red-600' :
                'border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-xs font-medium text-white">{tunnel.name}</div>
                  <div className="text-[10px] text-gray-400">
                    localhost:{tunnel.localPort} → {(tunnel.protocol || 'http').toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                    tunnel.status === 'active' ? 'bg-green-900/50 text-green-300' :
                    tunnel.status === 'starting' ? 'bg-yellow-900/50 text-yellow-300' :
                    tunnel.status === 'error' ? 'bg-red-900/50 text-red-300' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {tunnel.status === 'active' ? '✓ Activo' :
                     tunnel.status === 'starting' ? '⏳ Iniciando' :
                     tunnel.status === 'error' ? '✕ Error' :
                     '⏸ Inactivo'}
                  </span>
                </div>
              </div>

              {tunnel.publicUrl && (
                <div className="mb-2">
                  <div className="text-[9px] text-gray-400 mb-0.5">URL Pública:</div>
                  <div className="flex items-center gap-1">
                    <code className="flex-1 bg-gray-800 text-green-300 text-[10px] px-2 py-1 rounded truncate">
                      {tunnel.publicUrl}
                    </code>
                    <button
                      onClick={() => handleCopyUrl(tunnel.publicUrl!)}
                      className="text-[9px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-500"
                    >
                      📋 Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-1">
                {tunnel.status === 'inactive' || tunnel.status === 'error' ? (
                  <button
                    onClick={() => handleStartTunnel(tunnel.id)}
                    className="flex-1 bg-green-600 text-white text-[10px] rounded px-2 py-1 hover:bg-green-500"
                  >
                    ▶ Iniciar
                  </button>
                ) : tunnel.status === 'active' ? (
                  <button
                    onClick={() => handleStopTunnel(tunnel.id)}
                    className="flex-1 bg-red-600 text-white text-[10px] rounded px-2 py-1 hover:bg-red-500"
                  >
                    ⏸ Detener
                  </button>
                ) : null}
                <button
                  onClick={() => store.removeNgrokTunnel(tunnel.id)}
                  className="text-[10px] bg-gray-700 text-gray-400 px-2 py-1 rounded hover:bg-gray-600 hover:text-red-400"
                >
                  🗑 Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded p-2 space-y-1">
        <p className="text-[9px] text-blue-300 leading-tight">
          💡 <b>Ngrok</b> permite exponer APIs locales (como Ollama) a internet de forma segura.
        </p>
        <p className="text-[9px] text-blue-300 leading-tight">
          🔧 <b>Uso:</b> Instala ngrok, ejecuta tu API local, luego crea un túnel aquí para obtener una URL pública.
        </p>
        <p className="text-[9px] text-blue-300 leading-tight">
          📝 <b>Ejemplo:</b> Para Ollama en puerto 11434, crea un túnel HTTP y usa la URL pública en la configuración de API.
        </p>
      </div>
    </div>
  );
}
