import os, subprocess

BASE = '/root/v2ray_bot'

print('========== install.sh (FULL) ==========')
print(open(os.path.join(BASE, 'install.sh'), encoding='utf-8', errors='replace').read())

print()
print('========== systemd units ==========')
for u in ('v2raybot', 'v2raybot-adminpanel', 'v2raybot-miniapp'):
    p = f'/etc/systemd/system/{u}.service'
    try:
        print(f'--- {u}.service ---')
        print(open(p, encoding='utf-8', errors='replace').read())
    except Exception as e:
        print('err', u, e)

print('========== nginx sites-enabled ==========')
print(subprocess.run(['ls', '-la', '/etc/nginx/sites-enabled/'], capture_output=True, text=True).stdout)
for f in sorted(os.listdir('/etc/nginx/sites-enabled')):
    p = os.path.join('/etc/nginx/sites-enabled', f)
    try:
        print(f'--- {f} ---')
        print(open(p, encoding='utf-8', errors='replace').read())
    except Exception as e:
        print('err', f, e)

print('========== nginx sites-available ==========')
print(subprocess.run(['ls', '-la', '/etc/nginx/sites-available/'], capture_output=True, text=True).stdout)
