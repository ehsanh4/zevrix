import sqlite3

DB = '/root/v2ray_bot/bot_database.db'
c = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = c.cursor()

print('=== ALL users on NEW server ===')
cur.execute('SELECT id, telegram_id, username, first_name, is_blocked, is_reseller, joined_at FROM users ORDER BY id')
for r in cur.fetchall():
    print(r)

print()
print('=== telegram_ids present ===')
cur.execute('SELECT telegram_id FROM users')
ids = [str(r[0]) for r in cur.fetchall()]
print(','.join(ids))

c.close()
