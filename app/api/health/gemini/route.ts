import { getFeatureEnv } from '@/lib/envConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getFeatureEnv('geminiAI');
  const configured = Boolean(env?.GEMINI_API_KEY);

  return Response.json({
    configured,
    ok: false,
    error: 'Gemini AI integration has been removed',
    model: null,
  });
}
