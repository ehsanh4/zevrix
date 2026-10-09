import sqlite3, sys

DB = sys.argv[1] if len(sys.argv) > 1 else '/root/v2ray_bot/bot_database.db'
c = sqlite3.connect(DB, timeout=30)
c.execute('PRAGMA busy_timeout=30000')
res = c.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()
print('wal_checkpoint result (busy, log, checkpointed):', res)
c.close()
