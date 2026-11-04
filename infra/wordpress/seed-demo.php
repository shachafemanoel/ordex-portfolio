<?php
// Run explicitly with wp eval-file. Startup never seeds the shop.
if (!(defined('WP_CLI') && WP_CLI)) { throw new Exception('CLI only'); }
$id = getenv('RETZEF_DEMO_ID');
$url = rtrim(getenv('RETZEF_DEMO_STORE_URL') ?: '', '/');
if (!$id || getenv('RETZEF_DEMO_ENVIRONMENT') !== 'true' || !$url || rtrim(get_option('home'), '/') !== $url) {
    throw new Exception('Refusing an unidentified store');
}
if (!class_exists('WooCommerce')) { throw new Exception('WooCommerce is required'); }
$marker = get_option('retzef_demo_id');
if (!$marker) {
    if (wc_get_orders(['limit' => 1, 'return' => 'ids']) || get_posts(['post_type' => 'product', 'numberposts' => 1])) {
        throw new Exception('Initial marking refuses a nonempty store');
    }
    add_option('retzef_demo_id', $id, '', false);
} elseif ($marker !== $id) { throw new Exception('Store marker mismatch'); }
update_option('woocommerce_currency', 'ILS');
update_option('woocommerce_enable_guest_checkout', 'no');
update_option('woocommerce_enable_checkout_signup_and_login_from_checkout', 'no');
foreach ([['RETZEF-DEMO-SOFA', 'ספת הדגמה', '450.00'], ['RETZEF-DEMO-TABLE', 'שולחן הדגמה', '250.00']] as $fixture) {
    $existing = wc_get_product_id_by_sku($fixture[0]);
    if ($existing && !get_post_meta($existing, '_retzef_demo_fixture', true)) { throw new Exception('Non-demo SKU collision'); }
    $product = $existing ? wc_get_product($existing) : new WC_Product_Simple();
    $product->set_name($fixture[1]); $product->set_sku($fixture[0]); $product->set_regular_price($fixture[2]);
    $product->set_status('publish'); $product->set_manage_stock(true); $product->set_stock_quantity(10);
    $product->update_meta_data('_retzef_demo_fixture', $id); $product->save();
}
WP_CLI::success('Synthetic catalog loaded. Create fictional orders as an authenticated shop administrator. No payment or email gateway is enabled.');
