import sqlite3, sys

DB = sys.argv[1] if len(sys.argv) > 1 else '/root/v2ray_bot/bot_database.db'
c = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = c.cursor()

print('=== foreign_keys pragma ===')
cur.execute('PRAGMA foreign_keys')
print('foreign_keys:', cur.fetchone()[0])

print()
print('=== tables referencing users (via FK) ===')
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
found = False
for name, sql in cur.fetchall():
    if not sql:
        continue
    low = sql.lower()
    if 'references users' in low or 'references `users`' in low:
        print('TABLE', name, 'references users')
        found = True
if not found:
    print('none')

print()
print('=== triggers on users ===')
cur.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='trigger' AND tbl_name='users'")
trigs = cur.fetchall()
print(trigs if trigs else 'none')

print()
print('=== all tables ===')
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
print(', '.join(r[0] for r in cur.fetchall()))

c.close()
