import sqlite3

DB = '/root/v2ray_bot/bot_database.db'
c = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = c.cursor()

print('=== users schema ===')
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
row = cur.fetchone()
print(row[0] if row else 'TABLE NOT FOUND')

print()
print('=== user count ===')
cur.execute('SELECT COUNT(*) FROM users')
print('users:', cur.fetchone()[0])

print()
print('=== sample users (first 3) ===')
cur.execute('SELECT * FROM users LIMIT 3')
cols = [d[0] for d in cur.description]
print('COLUMNS:', cols)
for r in cur.fetchall():
    print(dict(zip(cols, r)))

c.close()
