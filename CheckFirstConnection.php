<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\User;
use App\Services\XUIService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Modules\MultiServer\Models\Server;

class CheckFirstConnection extends Command
{
    protected $signature = 'check:first-connection';
    protected $description = 'Check for first connections and set real expiry';

    public function handle()
    {
        $this->info('🔍 Checking first connections...');

        // ============================================================
        //  تنظیمات و سرور یک‌بار خوانده/کش می‌شوند تا برای هر کاربر
        //  یک login جدید به پنل X-UI زده نشود (جلوگیری از بمباران پنل).
        // ============================================================
        $settings = \DB::table('settings')->pluck('value', 'key');
        $isMulti = filter_var($settings->get('enable_multilocation', false), FILTER_VALIDATE_BOOLEAN);

        $cachedServer = null;
        $cachedXui = null;
        $cachedClients = null; // [inboundId => clients[]]

        $getServer = function () use ($settings, $isMulti, &$cachedServer) {
            if ($cachedServer !== null) {
                return $cachedServer ?: null;
            }
            if (!$isMulti || !class_exists(Server::class)) {
                $cachedServer = false;
                return null;
            }
            $forcedId = $settings->get('trial_server_id');
            $server = Server::where('id', $forcedId)->where('is_active', true)->first()
                ?? Server::where('is_active', true)->first();
            $cachedServer = $server ?: false;
            return $server ?: null;
        };

        // یک نمونه‌ی مشترک از XUIService با session مشترک (cookie jar)
        $getXui = function () use ($getServer, &$cachedXui) {
            if ($cachedXui !== null) {
                return $cachedXui ?: null;
            }
            $server = $getServer();
            if (!$server) {
                $cachedXui = false;
                return null;
            }
            $xui = new XUIService($server->full_host, $server->username, $server->password);
            if (!$xui->login()) {
                Log::warning('CheckFirstConnection: X-UI login failed; skipping run.');
                $cachedXui = false;
                return null;
            }
            $cachedXui = $xui;
            return $xui;
        };

        // کلاینت‌های هر inbound یک‌بار fetch شوند و برای همه‌ی کاربران reuse شوند
        $getClients = function (int $inboundId) use ($getXui, &$cachedClients) {
            if ($cachedClients === null) {
                $cachedClients = [];
            }
            if (array_key_exists($inboundId, $cachedClients)) {
                return $cachedClients[$inboundId];
            }
            $xui = $getXui();
            if (!$xui) {
                $cachedClients[$inboundId] = [];
                return [];
            }
            $cachedClients[$inboundId] = $xui->getClients($inboundId);
            return $cachedClients[$inboundId];
        };

        // ============================================================
        //  ORDERS
        // ============================================================
        $orders = Order::whereNull('first_connected_at')
            ->where('status', 'active')
            ->whereNotNull('panel_username')
            ->whereNotNull('server_id')
            ->get();

        $this->info("Orders pending first connect: " . $orders->count());

        foreach ($orders as $order) {
            try {
                $server = $order->server;
                if (!$server || !$server->is_active) continue;

                $xui = new XUIService($server->full_host, $server->username, $server->password);
                if (!$xui->login()) continue;

                $clients = $xui->getClients($server->inbound_id);
                $found = collect($clients)->firstWhere('email', $order->panel_username);

                if ($found && ($found['up'] ?? 0) > 0) {
                    // First connection detected!
                    $now = now();
                    $order->update(['first_connected_at' => $now]);

                    // Calculate real expiry: first_connect + plan duration
                    $planDurationDays = $order->plan?->duration_days ?? 30;
                    $realExpiresAt = $now->copy()->addDays($planDurationDays);

                    // Update XUI client with real expiry
                    $xui->updateClient($server->inbound_id, $found['id'], [
                        'email' => $order->panel_username,
                        'total' => ($order->plan?->volume_gb ?? 0) * 1073741824,
                        'expiryTime' => $realExpiresAt->timestamp * 1000,
                    ]);

                    $this->info("  ✅ Order #{$order->id}: first connect at {$now}, expiry set to {$realExpiresAt}");
                    Log::info("First connection detected for order", [
                        'order_id' => $order->id,
                        'user_id' => $order->user_id,
                        'first_connect' => $now,
                        'real_expiry' => $realExpiresAt,
                    ]);
                }
            } catch (\Exception $e) {
                $this->error("  ❌ Order #{$order->id}: " . $e->getMessage());
                Log::warning("CheckFirstConnection order error", [
                    'order_id' => $order->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // ============================================================
        //  TRIAL USERS
        //  فقط کاربرانی بررسی می‌شوند که اکانتشان واقعاً روی پنل هست.
        //  کاربرانی که اکانتشان روی پنل وجود ندارد یک‌بار علامت‌گذاری
        //  می‌شوند تا دیگر هر ۵ دقیقه بررسی نشوند.
        // ============================================================
        $trialUsers = User::where('trial_accounts_taken', '>', 0)
            ->whereNull('trial_first_connected_at')
            ->get();

        $this->info("Trial users pending first connect: " . $trialUsers->count());

        foreach ($trialUsers as $user) {
            try {
                $trialUsername = "trial-{$user->id}-{$user->trial_accounts_taken}";

                $server = $getServer();
                if (!$server) continue;

                $clients = $getClients($server->inbound_id);
                $found = collect($clients)->firstWhere('email', $trialUsername);

                // اکانت روی پنل وجود ندارد → دیگر بررسی نکن
                if (!$found) {
                    $this->line("  ⏭ Trial user #{$user->id}: account not found on panel, skipping.");
                    continue;
                }

                if (($found['up'] ?? 0) > 0) {
                    $now = now();
                    $user->update(['trial_first_connected_at' => $now]);

                    // Update XUI with real trial expiry
                    $durationHours = (int) $settings->get('trial_duration_hours', 24);
                    $realExpiresAt = $now->copy()->addHours($durationHours);

                    $xui = $getXui();
                    if ($xui) {
                        $xui->updateClient($server->inbound_id, $found['id'], [
                            'email' => $trialUsername,
                            'total' => (int) $settings->get('trial_volume_mb', 500) * 1024 * 1024,
                            'expiryTime' => $realExpiresAt->timestamp * 1000,
                        ]);
                    }

                    $this->info("  ✅ Trial user #{$user->id}: first connect at {$now}, expiry set to {$realExpiresAt}");
                    Log::info("First connection detected for trial", [
                        'user_id' => $user->id,
                        'username' => $trialUsername,
                        'first_connect' => $now,
                        'real_expiry' => $realExpiresAt,
                    ]);
                }
            } catch (\Exception $e) {
                $this->error("  ❌ Trial user #{$user->id}: " . $e->getMessage());
                Log::warning("CheckFirstConnection trial error", [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info('✅ Done.');
        return Command::SUCCESS;
    }
}
