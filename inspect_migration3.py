import os, re

BASE = '/root/v2ray_bot'

print('===== install.sh: token / existing-install handling =====')
src = open(os.path.join(BASE, 'install.sh'), encoding='utf-8', errors='replace').read()
for i, line in enumerate(src.splitlines(), 1):
    if re.search(r'BOT_TOKEN|\.env|read |already|exist|پیشتر|نصب شده|توکن', line):
        print(f'{i:4d}: {line[:170]}')

print()
print('===== manage.sh: available subcommands =====')
src = open(os.path.join(BASE, 'manage.sh'), encoding='utf-8', errors='replace').read()
# print case patterns
for m in re.finditer(r'^\s*([a-zA-Z0-9_\-]+)\)\s*$', src, re.M):
    print('cmd:', m.group(1))

print()
print('===== manage.sh: backup / restore / migrate mentions =====')
for i, line in enumerate(src.splitlines(), 1):
    if re.search(r'backup|restore|migrate|rsync|scp|انتقال|بکاپ|برگردان', line, re.I):
        print(f'{i:4d}: {line[:170]}')

print()
print('===== update.sh =====')
print(open(os.path.join(BASE, 'update.sh'), encoding='utf-8', errors='replace').read())

print('===== nginx sites =====')
import subprocess
print(subprocess.run(['ls', '-la', '/etc/nginx/sites-enabled/'], capture_output=True, text=True).stdout)
for f in os.listdir('/etc/nginx/sites-enabled'):
    p = os.path.join('/etc/nginx/sites-enabled', f)
    if os.path.isfile(p) or os.path.islink(p):
        try:
            print('--- ' + f + ' ---')
            print(open(p, encoding='utf-8', errors='replace').read()[:1500])
        except Exception as e:
            print('err', f, e)
