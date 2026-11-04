<?php
/** Plugin Name: Retzef synthetic demo safety */
if (!defined('ABSPATH')) { exit; }
// The local Playground store passes these as PHP constants instead of environment variables.
$demo_id = getenv('RETZEF_DEMO_ID') ?: (defined('RETZEF_DEMO_ID') ? RETZEF_DEMO_ID : '');
$demo_environment = getenv('RETZEF_DEMO_ENVIRONMENT') ?: (defined('RETZEF_DEMO_ENVIRONMENT') ? RETZEF_DEMO_ENVIRONMENT : '');
if (!$demo_id || $demo_environment !== 'true') {
    wp_die('This image requires an explicitly identified synthetic demo environment.');
}
// No WordPress/WooCommerce emails, including account/order emails.
add_filter('pre_wp_mail', '__return_true');
add_filter('woocommerce_email_enabled', '__return_false');
// Only offline demonstration methods. There is no real payment gateway in this image.
add_filter('woocommerce_available_payment_gateways', function ($gateways) {
    return array_intersect_key($gateways, array_flip(['bacs', 'cheque', 'cod']));
});
add_action('template_redirect', function () {
    if (function_exists('is_checkout') && is_checkout() && !current_user_can('manage_woocommerce')) {
        auth_redirect();
        exit;
    }
});
add_filter('rest_pre_dispatch', function ($result, $server, $request) {
    if (str_starts_with($request->get_route(), '/wc/store/') && !current_user_can('manage_woocommerce')) {
        return new WP_Error('demo_admin_only', 'Synthetic demonstration checkout is administrator-only.', ['status' => 403]);
    }
    return $result;
}, 10, 3);
add_action('init', function () {
    if (get_option('retzef_demo_maintenance') && !(defined('WP_CLI') && WP_CLI)) {
        status_header(503);
        exit('Demo maintenance in progress.');
    }
});
add_action('wp_body_open', function () {
    echo '<p dir="rtl" style="padding:12px;text-align:center;background:#fff3cd;color:#212121">חנות הדגמה — נתונים פיקטיביים בלבד. אין חיובים אמיתיים.</p>';
});
add_action('rest_api_init', function () use ($demo_id) {
    register_rest_route('retzef-demo/v1', '/guard', [
        'methods' => 'GET', 'permission_callback' => '__return_true',
        'callback' => function () use ($demo_id) {
            return ['demoId' => $demo_id, 'syntheticOnly' => true, 'paymentsDisabled' => true, 'emailDisabled' => true, 'checkoutAdminOnly' => true];
        },
    ]);
});
