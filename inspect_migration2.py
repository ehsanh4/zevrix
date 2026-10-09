import sqlite3, os, subprocess, glob

DB = '/root/v2ray_bot/bot_database.db'
BASE = '/root/v2ray_bot'

def mask(k, v):
    if v is None:
        return None
    if isinstance(v, str) and len(v) > 6 and any(s in k.lower() for s in ('token', 'key', 'secret', 'password', 'pass')):
        return v[:4] + '...(' + str(len(v)) + ' chars)'
    return v

print('===== systemd unit =====')
try:
    print(open('/etc/systemd/system/v2raybot.service').read())
except Exception as e:
    print('err', e)

print('===== any other systemd units for this bot =====')
print(subprocess.run(['systemctl', 'list-units', '--type=service', '--no-pager'], capture_output=True, text=True).stdout)

print('===== listening ports =====')
print(subprocess.run(['ss', '-tlnp'], capture_output=True, text=True).stdout)

print('===== nginx / caddy / apache? =====')
for s in ('nginx', 'caddy', 'apache2', 'httpd'):
    r = subprocess.run(['systemctl', 'is-active', s], capture_output=True, text=True)
    if r.returncode == 0:
        print(s, '->', r.stdout.strip())

print('===== .env keys (values masked) =====')
for line in open(os.path.join(BASE, '.env'), encoding='utf-8', errors='replace'):
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    if '=' in line:
        k, v = line.split('=', 1)
        print(k, '=', mask(k, v))

print()
print('===== config.py: how token/db are resolved =====')
src = open(os.path.join(BASE, 'config.py'), encoding='utf-8', errors='replace').read()
for i, line in enumerate(src.splitlines(), 1):
    low = line.lower()
    if any(w in low for w in ('bot_token', 'database', 'db_path', 'getenv', 'environ', 'fsm', 'sqlite')):
        print(f'{i:4d}: {line}')

print()
print('===== all .db / .sqlite files under project =====')
for p in sorted(glob.glob(BASE + '/**/*.db', recursive=True)) + sorted(glob.glob(BASE + '/**/*.sqlite*', recursive=True)):
    print(os.path.relpath(p, BASE), os.path.getsize(p), 'bytes')

print()
print('===== is app.js git-tracked? =====')
r = subprocess.run(['git', '-C', BASE, 'ls-files', '--error-unmatch', 'app.js'], capture_output=True, text=True)
print('app.js tracked:', bool(r.stdout.strip()), r.stderr.strip()[:80])
r = subprocess.run(['git', '-C', BASE, 'status', '--porcelain'], capture_output=True, text=True)
print('dirty files:')
print(r.stdout)

print()
print('===== backup.py: what it backs up / where it sends =====')
src = open(os.path.join(BASE, 'backup.py'), encoding='utf-8', errors='replace').read()
for i, line in enumerate(src.splitlines(), 1):
    low = line.lower()
    if any(w in low for w in ('def ', 'telegram', 'send_document', 'backup', 'path', 'db', 'zip', 'restore')):
        print(f'{i:4d}: {line[:160]}')

print()
print('===== manage.sh commands =====')
src = open(os.path.join(BASE, 'manage.sh'), encoding='utf-8', errors='replace').read()
import re
for m in re.finditer(r'^\s*(case|"[a-z_\-]+"\)|[a-z_\-]+\)\s*$)', src, re.M):
    print(m.group(0).strip())

print()
print('===== install.sh headline =====')
src = open(os.path.join(BASE, 'install.sh'), encoding='utf-8', errors='replace').read()
print(src[:1200])

print()
print('===== settings keys only =====')
con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = con.cursor()
try:
    keys = [r[0] for r in cur.execute("SELECT key FROM settings ORDER BY key")]
    print(len(keys), 'settings keys:')
    print(', '.join(keys))
except Exception as e:
    print('err', e)

print()
print('===== reseller-related tables row counts =====')
for t in ('reseller_bots', 'reseller_credit_log', 'reseller_product_credit', 'reseller_requests',
          'reseller_tier_requests', 'reseller_inline_commission_log', 'commission_reseller_requests'):
    try:
        print(t, cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
    except Exception as e:
        print(t, 'ERR', str(e)[:60])
con.close()
