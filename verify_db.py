import sqlite3, sys

DB = sys.argv[1] if len(sys.argv) > 1 else '/root/v2ray_bot/bot_database.db'
c = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = c.cursor()

cur.execute('SELECT COUNT(*) FROM users')
print('total users:', cur.fetchone()[0])

print()
print('=== migrated users (acquisition_source check not used; listing all by telegram_id) ===')
cur.execute('SELECT id, telegram_id, first_name, is_blocked, joined_at FROM users ORDER BY id')
for r in cur.fetchall():
    print(r)

print()
print('=== integrity check ===')
cur.execute('PRAGMA integrity_check')
print('integrity:', cur.fetchone()[0])

cur.execute('SELECT COUNT(*) FROM users WHERE telegram_id IS NULL')
print('users with NULL telegram_id:', cur.fetchone()[0])

cur.execute('SELECT telegram_id, COUNT(*) c FROM users GROUP BY telegram_id HAVING c > 1')
dups = cur.fetchall()
print('duplicate telegram_ids:', dups if dups else 'none')

c.close()
