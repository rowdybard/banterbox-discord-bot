import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Key, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  AlertTriangle,
  Shield,
  Zap,
  Mic,
  Save,
  Trash2
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

interface ApiKey {
  id: string;
  provider: 'openai' | 'elevenlabs';
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

interface ApiKeyForm {
  openai: string;
  elevenlabs: string;
}

export default function ApiKeyManager() {
  const { user } = useAuth();
  const [showKeys, setShowKeys] = useState(false);
  const [formData, setFormData] = useState<ApiKeyForm>({
    openai: '',
    elevenlabs: ''
  });
  const [errors, setErrors] = useState<Partial<ApiKeyForm>>({});

  // Fetch existing API keys
  const { data: apiKeys, refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await fetch('/api/billing/api-keys');
      if (!response.ok) throw new Error('Failed to fetch API keys');
      return response.json();
    },
    enabled: !!user
  });

  // Save API keys mutation
  const saveKeysMutation = useMutation({
    mutationFn: async (keys: ApiKeyForm) => {
      const response = await fetch('/api/billing/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys)
      });
      if (!response.ok) throw new Error('Failed to save API keys');
      return response.json();
    },
    onSuccess: () => {
      refetch();
      setFormData({ openai: '', elevenlabs: '' });
      setErrors({});
    }
  });

  // Test API keys mutation
  const testKeysMutation = useMutation({
    mutationFn: async (keys: ApiKeyForm) => {
      const response = await fetch('/api/billing/test-api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys)
      });
      if (!response.ok) throw new Error('Failed to test API keys');
      return response.json();
    }
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await fetch(`/api/billing/api-keys/${provider}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete API key');
      return response.json();
    },
    onSuccess: () => {
      refetch();
    }
  });

  const validateForm = () => {
    const newErrors: Partial<ApiKeyForm> = {};
    
    if (formData.openai && !formData.openai.startsWith('sk-')) {
      newErrors.openai = 'OpenAI API key must start with "sk-"';
    }
    
    if (formData.elevenlabs && formData.elevenlabs.length < 20) {
      newErrors.elevenlabs = 'ElevenLabs API key appears to be invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    
    const keysToSave: Partial<ApiKeyForm> = {};
    if (formData.openai) keysToSave.openai = formData.openai;
    if (formData.elevenlabs) keysToSave.elevenlabs = formData.elevenlabs;
    
    saveKeysMutation.mutate(keysToSave);
  };

  const handleTest = () => {
    if (!validateForm()) return;
    
    const keysToTest: Partial<ApiKeyForm> = {};
    if (formData.openai) keysToTest.openai = formData.openai;
    if (formData.elevenlabs) keysToTest.elevenlabs = formData.elevenlabs;
    
    testKeysMutation.mutate(keysToTest);
  };

  const getExistingKey = (provider: string) => {
    return apiKeys?.find((key: ApiKey) => key.provider === provider);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!user || user.subscriptionTier !== 'byok') {
    return (
      <Card className="bg-dark-lighter/50 border-gray-700">
        <CardContent className="p-6">
          <div className="text-center">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              API Key Management
            </h3>
            <p className="text-gray-400 mb-4">
              This feature is only available for "Bring Your Own Key" subscribers.
            </p>
            <Button 
              className="bg-green-400 hover:bg-green-500 text-white"
              onClick={() => window.location.href = '/pricing'}
            >
              Upgrade to BYOK
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            API Key Management
          </h2>
          <p className="text-gray-400">
            Securely manage your OpenAI and ElevenLabs API keys
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowKeys(!showKeys)}
          className="border-gray-600 text-gray-300"
        >
          {showKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {showKeys ? 'Hide Keys' : 'Show Keys'}
        </Button>
      </div>

      {/* Security Notice */}
      <Alert className="bg-blue-900/20 border-blue-500/30">
        <Shield className="w-4 h-4 text-blue-400" />
        <AlertDescription className="text-blue-300">
          Your API keys are encrypted and stored securely. We never log or display your keys in plain text.
        </AlertDescription>
      </Alert>

      {/* Current Keys */}
      <Card className="bg-dark-lighter/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Current API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OpenAI Key */}
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Zap className="w-5 h-5 text-blue-400" />
              <div>
                <h4 className="text-white font-medium">OpenAI API Key</h4>
                <p className="text-sm text-gray-400">
                  {getExistingKey('openai') ? (
                    <>
                      Last used: {getExistingKey('openai').lastUsedAt ? formatDate(getExistingKey('openai').lastUsedAt) : 'Never'}
                      {getExistingKey('openai').isActive && (
                        <Badge variant="secondary" className="ml-2 bg-green-500/20 text-green-400">
                          Active
                        </Badge>
                      )}
                    </>
                  ) : (
                    'No key configured'
                  )}
                </p>
              </div>
            </div>
            {getExistingKey('openai') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteKeyMutation.mutate('openai')}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* ElevenLabs Key */}
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Mic className="w-5 h-5 text-purple-400" />
              <div>
                <h4 className="text-white font-medium">ElevenLabs API Key</h4>
                <p className="text-sm text-gray-400">
                  {getExistingKey('elevenlabs') ? (
                    <>
                      Last used: {getExistingKey('elevenlabs').lastUsedAt ? formatDate(getExistingKey('elevenlabs').lastUsedAt) : 'Never'}
                      {getExistingKey('elevenlabs').isActive && (
                        <Badge variant="secondary" className="ml-2 bg-green-500/20 text-green-400">
                          Active
                        </Badge>
                      )}
                    </>
                  ) : (
                    'No key configured'
                  )}
                </p>
              </div>
            </div>
            {getExistingKey('elevenlabs') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteKeyMutation.mutate('elevenlabs')}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add New Keys */}
      <Card className="bg-dark-lighter/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Add New API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OpenAI Key Input */}
          <div className="space-y-2">
            <Label htmlFor="openai-key" className="text-white">
              OpenAI API Key
            </Label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showKeys ? "text" : "password"}
                placeholder="sk-..."
                value={formData.openai}
                onChange={(e) => setFormData({ ...formData, openai: e.target.value })}
                className={`bg-gray-800 border-gray-600 text-white ${errors.openai ? 'border-red-500' : ''}`}
              />
              {errors.openai && (
                <p className="text-red-400 text-sm mt-1">{errors.openai}</p>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">OpenAI Platform</a>
            </p>
          </div>

          {/* ElevenLabs Key Input */}
          <div className="space-y-2">
            <Label htmlFor="elevenlabs-key" className="text-white">
              ElevenLabs API Key
            </Label>
            <div className="relative">
              <Input
                id="elevenlabs-key"
                type={showKeys ? "text" : "password"}
                placeholder="Your ElevenLabs API key"
                value={formData.elevenlabs}
                onChange={(e) => setFormData({ ...formData, elevenlabs: e.target.value })}
                className={`bg-gray-800 border-gray-600 text-white ${errors.elevenlabs ? 'border-red-500' : ''}`}
              />
              {errors.elevenlabs && (
                <p className="text-red-400 text-sm mt-1">{errors.elevenlabs}</p>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Get your API key from <a href="https://elevenlabs.io/speech-synthesis" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ElevenLabs Dashboard</a>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleTest}
              disabled={testKeysMutation.isPending || (!formData.openai && !formData.elevenlabs)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {testKeysMutation.isPending ? 'Testing...' : 'Test Keys'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveKeysMutation.isPending || (!formData.openai && !formData.elevenlabs)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saveKeysMutation.isPending ? 'Saving...' : 'Save Keys'}
            </Button>
          </div>

          {/* Test Results */}
          {testKeysMutation.data && (
            <Alert className={`${testKeysMutation.data.success ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
              {testKeysMutation.data.success ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <X className="w-4 h-4 text-red-400" />
              )}
              <AlertDescription className={testKeysMutation.data.success ? 'text-green-300' : 'text-red-300'}>
                {testKeysMutation.data.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Messages */}
          {(saveKeysMutation.error || testKeysMutation.error) && (
            <Alert className="bg-red-900/20 border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {saveKeysMutation.error?.message || testKeysMutation.error?.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Usage Information */}
      <Card className="bg-dark-lighter/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Usage Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              • <strong>OpenAI API:</strong> Used for generating banter responses and text-to-speech
            </p>
            <p>
              • <strong>ElevenLabs API:</strong> Used for premium voice synthesis and custom voice cloning
            </p>
            <p>
              • <strong>Billing:</strong> You are responsible for all charges from OpenAI and ElevenLabs
            </p>
            <p>
              • <strong>Security:</strong> Keys are encrypted and only used for API calls to the respective services
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
