<?php
/**
 * Plugin Name: BlackVault Pay
 * Description: Take VET or B3TR in WooCommerce. The customer pays in the BlackVault wallet; the order is marked paid when the payment is on VeChain.
 * Version: 1.0.0
 * Requires Plugins: woocommerce
 * License: MIT
 *
 * How it works: at checkout the plugin asks the BlackVault server for an order (the amount in VET or
 * B3TR at today's price, with its own last digits) and sends the customer to BlackVault to pay it.
 * The server sees the payment arrive; this plugin asks for the status on the thank-you page and every
 * five minutes. The shop's key can only make orders and read their status: it moves no money, and
 * the money goes straight to the shop's own address.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_filter('cron_schedules', function ($s) {
    $s['blackvault_five_minutes'] = ['interval' => 300, 'display' => 'Every five minutes (BlackVault Pay)'];
    return $s;
});

register_activation_hook(__FILE__, function () {
    if (!wp_next_scheduled('blackvault_pay_check')) {
        wp_schedule_event(time() + 300, 'blackvault_five_minutes', 'blackvault_pay_check');
    }
});

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('blackvault_pay_check');
});

add_filter('woocommerce_payment_gateways', function ($gateways) {
    $gateways[] = 'WC_Gateway_BlackVault';
    return $gateways;
});

add_action('plugins_loaded', function () {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }

    class WC_Gateway_BlackVault extends WC_Payment_Gateway
    {
        public function __construct()
        {
            $this->id = 'blackvault';
            $this->method_title = 'BlackVault Pay';
            $this->method_description = 'VET or B3TR on VeChain, paid in the BlackVault wallet. Make the shop in BlackVault (More, Web shop) and paste its details here.';
            $this->has_fields = false;
            $this->supports = ['products'];
            $this->init_form_fields();
            $this->init_settings();
            $this->title = $this->get_option('title');
            $this->description = $this->get_option('description');
            add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
            add_action('woocommerce_thankyou_' . $this->id, [$this, 'thankyou']);
        }

        public function init_form_fields()
        {
            $this->form_fields = [
                'enabled' => ['title' => 'Enable', 'type' => 'checkbox', 'label' => 'Take payments with BlackVault', 'default' => 'no'],
                'title' => ['title' => 'Title', 'type' => 'text', 'default' => 'Pay with VeChain (BlackVault)'],
                'description' => ['title' => 'Description', 'type' => 'textarea', 'default' => 'Pay in VET or B3TR with the BlackVault wallet.'],
                'api' => ['title' => 'Server', 'type' => 'text', 'default' => 'https://wallet.blackvemarket.com', 'description' => 'As shown in BlackVault, under Web shop.'],
                'shop_id' => ['title' => 'Shop ID', 'type' => 'text', 'default' => ''],
                'api_key' => ['title' => 'Key', 'type' => 'password', 'default' => ''],
                'symbol' => ['title' => 'Paid in', 'type' => 'select', 'options' => ['VET' => 'VET', 'B3TR' => 'B3TR'], 'default' => 'VET'],
            ];
        }

        public function is_available()
        {
            if (!parent::is_available()) {
                return false;
            }
            // prices in euros or dollars, the two the server can price in
            return in_array(get_woocommerce_currency(), ['EUR', 'USD'], true) && $this->get_option('shop_id') && $this->get_option('api_key');
        }

        private function base()
        {
            $base = rtrim((string) $this->get_option('api'), '/');
            return preg_match('#^https://[^\s/]+#', $base) ? $base : '';
        }

        private function call($method, $path, $body = null)
        {
            $base = $this->base();
            if (!$base) {
                return null;
            }
            $args = [
                'method' => $method,
                'timeout' => 15,
                'headers' => ['Authorization' => 'Bearer ' . $this->get_option('api_key'), 'Content-Type' => 'application/json'],
            ];
            if ($body !== null) {
                $args['body'] = wp_json_encode($body);
            }
            $r = wp_remote_request($base . $path, $args);
            if (is_wp_error($r)) {
                return null;
            }
            return ['code' => (int) wp_remote_retrieve_response_code($r), 'data' => json_decode(wp_remote_retrieve_body($r), true)];
        }

        public function process_payment($order_id)
        {
            $order = wc_get_order($order_id);
            // a new reference per attempt: a customer who comes back gets a fresh amount
            $ref = 'wc-' . $order_id . '-' . time();
            $r = $this->call('POST', '/shop/' . rawurlencode($this->get_option('shop_id')) . '/orders', [
                'ref' => $ref,
                'amount' => (float) $order->get_total(),
                'currency' => $order->get_currency(),
                'symbol' => $this->get_option('symbol'),
                'returnUrl' => $this->get_return_url($order),
            ]);
            if (!$r || $r['code'] !== 200 || empty($r['data']['token'])) {
                wc_add_notice('Paying with VeChain is not possible right now. Please try again, or choose another way to pay.', 'error');
                return ['result' => 'failure'];
            }
            $amount = $r['data']['amount'] . ' ' . $r['data']['symbol'];
            $order->update_meta_data('_blackvault_ref', $ref);
            $order->update_meta_data('_blackvault_amount', $amount);
            $order->update_status('pending', sprintf('BlackVault: waiting for exactly %s.', $amount));
            $order->save();
            return [
                'result' => 'success',
                'redirect' => $this->base() . '/#/checkout/' . rawurlencode($r['data']['token']),
            ];
        }

        /** asks the server about an order; marks it paid or failed; returns the status */
        public function check($order)
        {
            $ref = $order->get_meta('_blackvault_ref');
            if (!$ref || $order->is_paid()) {
                return $order->is_paid() ? 'paid' : '';
            }
            $r = $this->call('GET', '/shop/' . rawurlencode($this->get_option('shop_id')) . '/orders/' . rawurlencode($ref));
            if (!$r || $r['code'] !== 200) {
                return '';
            }
            $status = isset($r['data']['status']) ? $r['data']['status'] : '';
            if ($status === 'paid') {
                $tx = isset($r['data']['txId']) ? (string) $r['data']['txId'] : '';
                $order->payment_complete($tx);
                $order->add_order_note('BlackVault: paid on VeChain. https://vechainstats.com/transaction/' . rawurlencode($tx) . '/');
            } elseif ($status === 'expired' && $order->has_status('pending')) {
                $order->update_status('failed', 'BlackVault: not paid in time.');
            }
            return $status;
        }

        public function thankyou($order_id)
        {
            $order = wc_get_order($order_id);
            $status = $this->check($order);
            if ($status === 'paid' || $order->is_paid()) {
                echo '<p><strong>Your VeChain payment has arrived. Thank you!</strong></p>';
            } elseif ($status === 'expired') {
                echo '<p>This payment window has closed. Please place the order again.</p>';
            } else {
                // while waiting: look again in a moment
                echo '<meta http-equiv="refresh" content="10">';
                echo '<p>Waiting for your payment of <strong>' . esc_html($order->get_meta('_blackvault_amount')) . '</strong> on VeChain. This page updates by itself.</p>';
            }
        }
    }
});

// every five minutes: the orders of the last day still waiting
add_action('blackvault_pay_check', function () {
    if (!function_exists('wc_get_orders') || !class_exists('WC_Gateway_BlackVault')) {
        return;
    }
    $gateway = new WC_Gateway_BlackVault();
    $orders = wc_get_orders([
        'status' => ['pending'],
        'payment_method' => 'blackvault',
        'limit' => 50,
        'date_created' => '>' . (time() - DAY_IN_SECONDS),
    ]);
    foreach ($orders as $order) {
        $gateway->check($order);
    }
});
