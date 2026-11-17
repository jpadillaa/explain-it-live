type Environment = Record<string, string | undefined>;

type Provider = { url: string; model: string; headers: Record<string, string> };
export function getProvider(env: Environment = process.env): Provider | { error: string } | null {
  const endpoint = env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureKey = env.AZURE_OPENAI_API_KEY?.trim();
  if (endpoint || azureKey) {
    if (!endpoint || !azureKey) {
      return { error: 'Completa AZURE_OPENAI_ENDPOINT y AZURE_OPENAI_API_KEY en .env.' };
    }
    const deployment = env.AZURE_OPENAI_DEPLOYMENT_1?.trim();
    if (!deployment) return { error: 'Completa AZURE_OPENAI_DEPLOYMENT_1 en .env.' };
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) throw new Error();
      const path = url.pathname.replace(/\/+$/, '');
      if (path !== '' && path !== '/openai/v1') throw new Error();
      return {
        url: `${url.origin}/openai/v1/chat/completions`,
        model: deployment,
        headers: { 'api-key': azureKey, 'Content-Type': 'application/json' },
      };
    } catch {
      return { error: 'AZURE_OPENAI_ENDPOINT debe ser la URL HTTPS del recurso o su base /openai/v1/.' };
    }
  }
  if (!env.TUTOR_API_KEY) return null;
  return {
    url: `${(env.TUTOR_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`,
    model: env.TUTOR_MODEL || 'gpt-4.1-mini',
    headers: { Authorization: `Bearer ${env.TUTOR_API_KEY}`, 'Content-Type': 'application/json' },
  };
}
