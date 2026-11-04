<?php
/** Plugin Name: Retzef local pilot store */
// Only for the local pilot store that scripts/demo/local.sh runs with WordPress Playground on
// http://localhost. It lets the store and the local Retzef talk to each other on this Mac.
if (!defined('ABSPATH') || !defined('RETZEF_APP_PORT')) { exit; }

// WooCommerce accepts REST keys as Basic auth only over HTTPS, and this store is local http.
if (str_contains($_SERVER['REQUEST_URI'] ?? '', '/wp-json/wc/')) {
    $_SERVER['HTTPS'] = 'on';
}

// Send order events to Retzef when they happen instead of waiting for WP-Cron.
add_filter('woocommerce_webhook_deliver_async', '__return_false');

// WordPress refuses outgoing requests to the machine itself and to non-standard ports.
add_filter('http_request_host_is_external', function ($external, $host) {
    return $external || in_array($host, ['localhost', '127.0.0.1'], true);
}, 10, 2);
add_filter('http_allowed_safe_ports', function ($ports) {
    return array_merge($ports, [(int) RETZEF_APP_PORT]);
});
