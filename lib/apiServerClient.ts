import { headers } from 'next/headers';

async function apiServer(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const headersList = await headers();
  const cookie = headersList.get('cookie');

  const newOptions: RequestInit = {
    ...options,
    headers: {
      ...options.headers,
      cookie: cookie || '',
    },
  };

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, newOptions);

  return response;
}

export default apiServer;
