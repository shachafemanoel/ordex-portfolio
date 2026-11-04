// The guided demo exposes only the active order path. Tested independently of authentication.
export function isMvpApiAllowed(pathname: string, method: string): boolean {
  const allowed = [
    /^\/api\/orders$/,
    /^\/api\/orders\/(dashboard|export|today)$/,
    /^\/api\/orders\/[^/]+(?:\/(?:status(?:\/revert)?|override-status|transition|address|contact|payment|schedule(?:\/recommendations)?|notes|history|priority|items(?:\/(?:batch|[^/]+(?:\/allocation)?))?|checklist|cancel|unhold|transitions\/(?:hold|resume|cancel)))?$/,
    /^\/api\/health(?:\/worker)?$/,
    /^\/api\/auth\/(login|logout|me|tenants|tenant)$/,
    /^\/api\/tenants(?:\/|$)/,
    /^\/api\/invitations\/accept$/,
    /^\/api\/webhooks\/woocommerce\/[^/]+$/,
    /^\/api\/integrations\/woocommerce(?:\/(?:test|preview|import|jobs(?:\/[^/]+\/retry)?))?$/,
    /^\/api\/(customers|products|skus|labels|users|search)(?:\/|$)/,
    /^\/api\/v1\/ops(?:\/|$)/,
    /^\/api\/deliveries\/session$/,
    /^\/api\/(settings\/store|store\/settings)$/,
  ];
  // Order endpoints that write a status without the validated transition. None has a UI
  // caller in the MVP; status changes go through /api/orders/:id/status and friends.
  const bypassesStatusRules = [
    /^\/api\/orders\/[^/]+\/drill(?:\/|$)/,
    /^\/api\/orders\/[^/]+\/transitions\/(mark-ready|schedule|confirm-schedule|start-installation|complete)$/,
    /^\/api\/orders\/demo(?:\/|$)/,
  ];
  const frozenOrderFeatures =
    /\/api\/orders\/[^/]+\/(operational-email|operational-whatsapp|reminder|workflow|tasks)(?:\/|$)/.test(
      pathname
    );
  const frozenUserTokens = /^\/api\/users\/[^/]+\/token$/.test(pathname);
  const writesStatusDirectly =
    method !== 'GET' &&
    (/^\/api\/orders\/[^/]+\/history$/.test(pathname) || pathname === '/api/orders/bulk');
  return !(
    !allowed.some((pattern) => pattern.test(pathname)) ||
    (pathname.startsWith('/api/users') && method !== 'GET') ||
    bypassesStatusRules.some((pattern) => pattern.test(pathname)) ||
    writesStatusDirectly ||
    frozenOrderFeatures ||
    frozenUserTokens
  );
}
