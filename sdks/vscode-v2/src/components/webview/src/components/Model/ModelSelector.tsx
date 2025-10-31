import React from 'react'
import { Select, Typography } from 'antd'
import { useCurrentProvider, useCurrentModel, useProviders } from '../../store'
import { webViewService } from '../../services/webviewService'

const { Text } = Typography

/**
 * Model selector component
 * Displays current model information and allows model switching
 */
export const ModelSelector: React.FC = () => {
  const currentProvider = useCurrentProvider()
  const currentModel = useCurrentModel()
  const providers = useProviders()

  // Get all available models from all providers
  const allModels = React.useMemo(() => {
    const models: Array<{ id: string, name: string, providerId: string, providerName: string }> = []
    if (providers && Array.isArray(providers)) {
      providers.forEach((provider, index) => {
        if (provider && provider.models) {
          Object.values(provider.models).forEach(model => {
            if (model) {
              models.push({
                id: model.id,
                name: model.name,
                providerId: provider.id,
                providerName: provider.name
              })
            }
          })
        } else {
          webViewService.postMessage({
            type: 'debug',
            message: `🐛 Frontend: Provider at index ${index} is invalid: ${JSON.stringify(provider)}`
          })
        }
      })
    }
    return models
  }, [providers])

  const currentValue = React.useMemo(() => {
    if (!currentModel || !currentProvider) return 'Loading...'
    
    // Return the format expected by Select component: providerId/modelId
    return `${currentProvider.id}/${currentModel.id}`
  }, [currentModel, currentProvider])

  const handleModelChange = (value: string) => {
    // Send debug info to backend via debug message
    webViewService.postMessage({
      type: 'debug',
      message: `🐛 Frontend: ModelSelector handleModelChange called with value: ${value}`
    })
    
    const [providerId, modelId] = value.split('/')
    
    // Find the model directly from providers using providerId and modelId
    const provider = providers.find(p => p.id === providerId)
    if (!provider || !provider.models) {
      webViewService.postMessage({
        type: 'debug',
        message: `🐛 Frontend: Provider not found: ${providerId}`
      })
      return
    }
    
    const selectedModel = Object.values(provider.models).find(m => m.id === modelId)
    
    webViewService.postMessage({
      type: 'debug',
      message: `🐛 Frontend: Selected model: ${JSON.stringify(selectedModel)}`
    })
    
    if (selectedModel) {
      const message = {
        type: 'switchModel',
        data: {
          providerId: providerId,
          modelId: modelId
        }
      }
      webViewService.postMessage({
        type: 'debug',
        message: `🐛 Frontend: Sending switchModel message: ${JSON.stringify(message)}`
      })
      webViewService.postMessage(message)
    } else {
      webViewService.postMessage({
        type: 'debug',
        message: `🐛 Frontend: Model not found: ${modelId} in provider ${providerId}`
      })
    }
  }

  return (
    <Select
      value={currentValue}
      style={{ width: 200 }}
      onChange={handleModelChange}
      placeholder="Select model"
      showSearch
      filterOption={(input, option) =>
        (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
      }
    >
      {providers.map(provider => (
        <Select.OptGroup key={provider.id} label={provider.name}>
          {provider.models && Object.values(provider.models).map(model => (
                 <Select.Option 
                   key={`${provider.id}/${model.id}`} 
                   value={`${provider.id}/${model.id}`}
                 >
                   <Text style={{ color: '#cccccc' }}>
                     {model.name}
                   </Text>
                 </Select.Option>
          ))}
        </Select.OptGroup>
      ))}
    </Select>
  )
}
