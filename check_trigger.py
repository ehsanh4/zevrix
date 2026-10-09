import sqlite3, sys

DB = sys.argv[1] if len(sys.argv) > 1 else '/root/v2ray_bot/bot_database.db'
c = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = c.cursor()

print('=== trigger trg_wallet_transactions definition ===')
cur.execute("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='trg_wallet_transactions'")
row = cur.fetchone()
print(row[0] if row else 'not found')

print()
print('=== journal mode ===')
cur.execute('PRAGMA journal_mode')
print('journal_mode:', cur.fetchone()[0])

print()
print('=== indexes on users ===')
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='users'")
for name, sql in cur.fetchall():
    print(name, '|', sql)

c.close()
