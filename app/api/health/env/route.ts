// No NextResponse import; use standard Response

export const dynamic = 'force-dynamic';

export async function GET() {
  const envs = process.env;
  const present = (key: string) => {
    const v = envs[key];
    return typeof v === 'string' && v.length > 0;
  };

  const data = {
    database: present('DATABASE_URL'),
    jwtSecret: present('JWT_SECRET'),
    redis: present('REDIS_URL') || (present('REDISHOST') && present('REDISPORT')),
    wooCommerce: {
      url: present('WOOCOMMERCE_STORE_URL'),
      key: present('WOOCOMMERCE_KEY'),
      password: present('WOOCOMMERCE_PASSWORD'),
      configured:
        present('WOOCOMMERCE_STORE_URL') &&
        present('WOOCOMMERCE_KEY') &&
        present('WOOCOMMERCE_PASSWORD'),
    },
    mapboxToken: present('MAPBOX') || present('NEXT_PUBLIC_MAPBOX_TOKEN'),
    nodeEnv: process.env.NODE_ENV || 'development',
  };

  return Response.json({ success: true, data });
}
