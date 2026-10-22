import { useState, useEffect } from 'react';
import { useAnimationStore } from '../stores/animationStore';
import { AgentProvider, AIModel } from '../engine/types';

export function ModelsPanel() {
  const store = useAnimationStore();
  const [selectedProvider, setSelectedProvider] = useState<AgentProvider>('openrouter');
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const providers: { id: AgentProvider; name: string; icon: string; needsKey: boolean }[] = [
    { id: 'openrouter', name: 'OpenRouter', icon: '🌐', needsKey: true },
    { id: 'ollama', name: 'Ollama (Local)', icon: '🏠', needsKey: false },
    { id: 'groq', name: 'Groq', icon: '⚡', needsKey: true },
    { id: 'openai', name: 'OpenAI', icon: '🧠', needsKey: true },
    { id: 'claude', name: 'Claude', icon: '🟣', needsKey: true },
    { id: 'huggingface', name: 'HuggingFace', icon: '🤗', needsKey: true },
    { id: 'opencode', name: 'OpenCode', icon: '💻', needsKey: true },
  ];

  const fetchModels = async () => {
    setLoading(true);
    setModels([]);
    
    const providerConfig = providers.find(p => p.id === selectedProvider);
    const api = store.agentConfig.apis.find(a => a.provider === selectedProvider);
    
    const fetchedModels = await store.fetchModelsForProvider(
      selectedProvider,
      api?.apiKey,
      api?.baseUrl
    );
    
    setModels(fetchedModels);
    setLoading(false);
  };

  useEffect(() => {
    fetchModels();
  }, [selectedProvider]);

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUseModel = (model: AIModel) => {
    // Create or update API config with this model
    const existingApi = store.agentConfig.apis.find(a => a.provider === model.provider);
    if (existingApi) {
      store.updateAgentAPI(existingApi.id, { model: model.id });
    } else {
      const providerConfig = providers.find(p => p.id === model.provider);
      store.addAgentAPI({
        name: `${providerConfig?.name || model.provider} - ${model.name}`,
        provider: model.provider,
        baseUrl: getBaseUrlForProvider(model.provider),
        model: model.id,
        maxTokens: 4096,
        temperature: 0.7,
        enabled: true,
      });
    }
  };

  const getBaseUrlForProvider = (provider: AgentProvider): string => {
    switch (provider) {
      case 'ollama': return 'http://localhost:11434';
      case 'openrouter': return 'https://openrouter.ai/api/v1';
      case 'groq': return 'https://api.groq.com/openai/v1';
      case 'openai': return 'https://api.openai.com/v1';
      case 'claude': return 'https://api.anthropic.com/v1';
      case 'huggingface': return 'https://api-inference.huggingface.co/models';
      case 'opencode': return 'https://api.opencode.ai/v1';
      default: return '';
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* Provider selector */}
      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-2">
          📋 Modelos Disponibles por Plataforma
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProvider(p.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] transition-all ${
                selectedProvider === p.id
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500'
                  : 'bg-gray-700/50 text-gray-400 border border-transparent hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <span>{p.icon}</span>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="🔍 Buscar modelos..."
          className="w-full bg-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Models list */}
      <div className="max-h-80 overflow-y-auto space-y-1.5">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2 animate-pulse">⏳</div>
            <p className="text-xs text-gray-400">Cargando modelos...</p>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">📭</div>
            <p className="text-xs text-gray-400">No se encontraron modelos</p>
            {providers.find(p => p.id === selectedProvider)?.needsKey && (
              <p className="text-[10px] text-gray-500 mt-1">
                Configura una API key en la sección de APIs
              </p>
            )}
          </div>
        ) : (
          filteredModels.map(model => (
            <div
              key={model.id}
              className="bg-gray-700/30 border border-gray-600 rounded-lg p-2.5 hover:border-blue-500/50 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{model.name}</div>
                  <div className="text-[9px] text-gray-400 font-mono truncate">{model.id}</div>
                </div>
                <button
                  onClick={() => handleUseModel(model)}
                  className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-500 whitespace-nowrap flex-shrink-0"
                >
                  Usar
                </button>
              </div>
              
              {model.description && (
                <p className="text-[10px] text-gray-400 mb-1.5 line-clamp-2">{model.description}</p>
              )}
              
              <div className="flex flex-wrap gap-1 mb-1.5">
                {model.contextLength && (
                  <span className="text-[8px] bg-purple-900/30 text-purple-300 px-1.5 py-0.5 rounded">
                    📏 {model.contextLength.toLocaleString()} tokens
                  </span>
                )}
                {model.pricing?.input !== undefined && (
                  <span className="text-[8px] bg-green-900/30 text-green-300 px-1.5 py-0.5 rounded">
                    💰 ${model.pricing.input.toFixed(2)}/1M in
                  </span>
                )}
                {model.pricing?.output !== undefined && (
                  <span className="text-[8px] bg-yellow-900/30 text-yellow-300 px-1.5 py-0.5 rounded">
                    💰 ${model.pricing.output.toFixed(2)}/1M out
                  </span>
                )}
                {model.capabilities?.map((cap, i) => (
                  <span key={i} className="text-[8px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">
                    ✨ {cap}
                  </span>
                ))}
                {model.status && (
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                    model.status === 'stable' ? 'bg-green-900/30 text-green-300' :
                    model.status === 'beta' ? 'bg-yellow-900/30 text-yellow-300' :
                    'bg-red-900/30 text-red-300'
                  }`}>
                    {model.status === 'stable' ? '✓' : model.status === 'beta' ? '🧪' : '⚠️'} {model.status}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded p-2">
        <p className="text-[9px] text-blue-300 leading-tight">
          💡 <b>Tip:</b> Click en "Usar" para configurar automáticamente una API con este modelo. 
          Los modelos se obtienen en tiempo real desde cada plataforma.
        </p>
      </div>
    </div>
  );
}
