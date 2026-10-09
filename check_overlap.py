import sqlite3

DB = '/root/v2ray_bot/bot_database.db'
c = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = c.cursor()

# Telegram IDs that must NOT be migrated (user explicitly excluded Ehsan & Alireza)
EXCLUDE = {7628162523, 5539687167, 838642202}

# Telegram IDs already present on the new server
EXISTING = {111121303, 123901499, 838642202, 5539687167, 6684101121, 7514992604, 7628162523, 7845714345}

print('=== users on NEW server that are in EXCLUDE list ===')
cur.execute('SELECT id, telegram_id, username, first_name FROM users WHERE telegram_id IN (%s)' % ','.join(str(x) for x in EXCLUDE))
for r in cur.fetchall():
    print(r)

print()
print('=== EXCLUDE ids NOT on new server (no action needed) ===')
for t in sorted(EXCLUDE):
    print(t, 'PRESENT' if t in EXISTING else 'absent')

c.close()
