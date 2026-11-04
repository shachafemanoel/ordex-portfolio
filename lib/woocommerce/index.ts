export function getWooCommerceClient() {
  if (process.env.TENANT_ENFORCEMENT === 'true') throw new Error('Global WooCommerce connection is disabled in tenant runtime');
  const baseUrl = process.env.WOO_BASE_URL;
  const consumerKey = process.env.WOO_CONSUMER_KEY;
  const consumerSecret = process.env.WOO_CONSUMER_SECRET;

  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error('WooCommerce not configured: missing WOO_BASE_URL, WOO_CONSUMER_KEY, or WOO_CONSUMER_SECRET');
  }

  return {
    baseUrl,
    consumerKey,
    consumerSecret,
    get: async (_endpoint: string) => { throw new Error('WooCommerce client not implemented'); },
    post: async (_endpoint: string, _data: unknown) => { throw new Error('WooCommerce client not implemented'); },
    put: async (_endpoint: string, _data: unknown) => { throw new Error('WooCommerce client not implemented'); },
  };
}

export const wooCommerceClient = {
  get: async (_endpoint: string) => { throw new Error('WooCommerce client not configured'); },
  post: async (_endpoint: string, _data: unknown) => { throw new Error('WooCommerce client not configured'); },
  put: async (_endpoint: string, _data: unknown) => { throw new Error('WooCommerce client not configured'); },
};
