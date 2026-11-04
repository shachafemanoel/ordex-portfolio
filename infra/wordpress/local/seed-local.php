<?php
// Seeds the local pilot store once, from blueprint.json during `npm run demo setup`.
// Synthetic catalog only. Writes the store admin password and REST keys to /retzef/store.json,
// which local.sh adds to the demo credentials.
require '/wordpress/wp-load.php';
if (!class_exists('WooCommerce')) { throw new Exception('WooCommerce is required'); }
if (!defined('RETZEF_DEMO_ID') || get_option('retzef_demo_id')) { throw new Exception('Refusing an unidentified or seeded store'); }
add_option('retzef_demo_id', RETZEF_DEMO_ID, '', false);

update_option('blogname', 'חנות הדגמה של רהיטי הדגמה');
update_option('woocommerce_currency', 'ILS');
update_option('woocommerce_default_country', 'IL');
update_option('woocommerce_calc_taxes', 'no');
update_option('woocommerce_enable_guest_checkout', 'no');
update_option('woocommerce_onboarding_profile', ['skipped' => true]);
update_option('woocommerce_cod_settings', ['enabled' => 'yes', 'title' => 'תשלום במזומן בעת המסירה']);
// The demo's payment method: on hold until the transfer arrives, then "processing" sets the paid date.
update_option('woocommerce_bacs_settings', ['enabled' => 'yes', 'title' => 'העברה בנקאית']);

foreach ([
    ['RETZEF-DEMO-SOFA', 'ספה פינתית', '5200.00'],
    ['RETZEF-DEMO-ARMCHAIR', 'כורסת קריאה', '1800.00'],
    ['RETZEF-DEMO-COFFEE', 'שולחן קפה', '950.00'],
] as [$sku, $name, $price]) {
    $product = new WC_Product_Simple();
    $product->set_name($name);
    $product->set_sku($sku);
    $product->set_regular_price($price);
    $product->set_status('publish');
    $product->set_manage_stock(true);
    $product->set_stock_quantity(10);
    $product->update_meta_data('_retzef_demo_fixture', RETZEF_DEMO_ID);
    $product->save();
}

// The same records WooCommerce writes when an admin creates REST keys in its settings.
global $wpdb;
$consumer_key = 'ck_' . wc_rand_hash();
$consumer_secret = 'cs_' . wc_rand_hash();
$wpdb->insert($wpdb->prefix . 'woocommerce_api_keys', [
    'user_id' => 1,
    'description' => 'Retzef local demo',
    'permissions' => 'read_write',
    'consumer_key' => wc_api_hash($consumer_key),
    'consumer_secret' => $consumer_secret,
    'truncated_key' => substr($consumer_key, -7),
]);

$password = wp_generate_password(16, false);
wp_set_password($password, 1);
file_put_contents('/retzef/store.json', json_encode([
    'adminUser' => get_userdata(1)->user_login,
    'adminPassword' => $password,
    'consumerKey' => $consumer_key,
    'consumerSecret' => $consumer_secret,
]));
