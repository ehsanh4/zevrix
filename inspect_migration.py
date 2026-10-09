import sqlite3, os, subprocess, glob

DB = '/root/v2ray_bot/bot_database.db'
BASE = '/root/v2ray_bot'

def mask(k, v):
    if v is None:
        return None
    if isinstance(v, str) and len(v) > 8 and any(s in k.lower() for s in ('token', 'key', 'secret', 'password', 'pass')):
        return v[:4] + '...(' + str(len(v)) + ' chars)'
    return v

print('===== RAM / SWAP =====')
print(subprocess.run(['free', '-h'], capture_output=True, text=True).stdout)

print('===== top-level files in /root/v2ray_bot =====')
for f in sorted(os.listdir(BASE)):
    p = os.path.join(BASE, f)
    try:
        sz = os.path.getsize(p) if os.path.isfile(p) else ''
        print(('DIR ' if os.path.isdir(p) else 'FILE'), f, sz)
    except Exception as e:
        print(f, 'ERR', e)

print()
print('===== config-ish files =====')
for name in ('.env', 'config.json', 'config.py', 'data.py', 'bot.cfg', 'settings.json', '.env.example'):
    p = os.path.join(BASE, name)
    print(name, 'EXISTS' if os.path.exists(p) else 'absent')

print()
print('===== python files mentioning token =====')
try:
    out = subprocess.run(['grep', '-rIl', '-i', 'bot_token', BASE], capture_output=True, text=True, timeout=60)
    print(out.stdout or 'none')
except Exception as e:
    print('grep err', e)

print()
print('===== systemd unit =====')
try:
    print(open('/etc/systemd/system/v2raybot.service').read())
except Exception as e:
    print('err', e)

print('===== cron =====')
try:
    print(subprocess.run(['crontab', '-l'], capture_output=True, text=True).stdout or 'no root crontab')
except Exception as e:
    print('err', e)
for f in sorted(os.listdir('/etc/cron.d')) if os.path.isdir('/etc/cron.d') else []:
    print('/etc/cron.d/' + f)

print()
print('===== panels on this box? =====')
for svc in ('marzban', 'hiddify', 'x-ui', '3x-ui', 'xray', 'sing-box'):
    r = subprocess.run(['systemctl', 'is-enabled', svc], capture_output=True, text=True)
    if r.returncode == 0:
        print(svc, '->', r.stdout.strip())
if os.path.exists('/usr/bin/docker') or os.path.exists('/usr/local/bin/docker'):
    print(subprocess.run(['docker', 'ps', '--format', '{{.Names}} {{.Image}}'], capture_output=True, text=True).stdout or 'docker: no containers')
else:
    print('docker: not installed')

print()
print('===== reseller dbs =====')
for p in sorted(glob.glob(BASE + '/reseller_dbs/*')):
    print(os.path.basename(p), os.path.getsize(p), 'bytes')

print()
print('===== main db size =====')
print(os.path.getsize(DB), 'bytes')

con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = con.cursor()

print()
print('===== settings table (values masked) =====')
cols = [c[1] for c in cur.execute("PRAGMA table_info(settings)")]
print('columns:', cols)
rows = cur.execute("SELECT * FROM settings").fetchall()
for row in rows:
    d = dict(zip(cols, row))
    print({k: mask(k, v) for k, v in d.items()})

print()
print('===== panel_servers (masked) =====')
try:
    cols = [c[1] for c in cur.execute("PRAGMA table_info(panel_servers)")]
    print('columns:', cols)
    for row in cur.execute("SELECT * FROM panel_servers").fetchall():
        d = dict(zip(cols, row))
        print({k: mask(k, v) for k, v in d.items()})
except Exception as e:
    print('err', e)

print()
print('===== reseller_bots (masked) =====')
try:
    cols = [c[1] for c in cur.execute("PRAGMA table_info(reseller_bots)")]
    print('columns:', cols)
    for row in cur.execute("SELECT * FROM reseller_bots").fetchall():
        d = dict(zip(cols, row))
        print({k: mask(k, v) for k, v in d.items()})
except Exception as e:
    print('err', e)

print()
print('===== row counts =====')
for t in ('users', 'orders', 'configs', 'wallet_transactions', 'reseller_bots', 'panel_servers', 'products'):
    try:
        print(t, cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
    except Exception as e:
        print(t, 'ERR', e)

print()
print('===== git version =====')
r = subprocess.run(['git', '-C', BASE, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True)
print('commit:', r.stdout.strip() or r.stderr.strip())
r = subprocess.run(['git', '-C', BASE, 'describe', '--tags', '--always'], capture_output=True, text=True)
print('describe:', r.stdout.strip() or r.stderr.strip())
r = subprocess.run(['git', '-C', BASE, 'status', '--porcelain'], capture_output=True, text=True)
print('dirty files:', len(r.stdout.splitlines()))

con.close()
