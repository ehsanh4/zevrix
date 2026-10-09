import sqlite3, sys, os

# DB path can be overridden via argv[2] for testing on a copy.
DEFAULT_DB = '/root/v2ray_bot/bot_database.db'
DB = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_DB
TSV = '/tmp/migrate_users.tsv'

# Telegram IDs that must NEVER be migrated (user explicitly excluded Ehsan & Alireza)
EXCLUDE = {7628162523, 5539687167, 838642202}

# DRY RUN by default. Pass 'APPLY' as argv[1] to actually write.
APPLY = len(sys.argv) > 1 and sys.argv[1] == 'APPLY'

# --- Load users from TSV exported from old server ---
rows = []
with open(TSV, encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\n')
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) < 2:
            print('SKIP malformed line:', repr(line))
            continue
        tg = int(parts[0].strip())
        name = parts[1].strip()
        balance = float(parts[2]) if len(parts) > 2 and parts[2].strip() else 0.0
        rows.append((tg, name, balance))

# --- Safety filters ---
rows = [r for r in rows if r[0] not in EXCLUDE]
print(f'Candidates after EXCLUDE filter: {len(rows)}')

# --- Open DB (read-only first to check existing IDs) ---
con_ro = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur_ro = con_ro.cursor()
cur_ro.execute('SELECT telegram_id FROM users')
existing = {r[0] for r in cur_ro.fetchall()}
con_ro.close()

to_insert = [r for r in rows if r[0] not in existing]
skipped = [r for r in rows if r[0] in existing]

print(f'Already exist on new server (SKIP): {len(skipped)}')
for tg, name, _ in skipped:
    print(f'  SKIP tg={tg} name={name!r}')

print(f'To insert: {len(to_insert)}')
for tg, name, bal in to_insert:
    print(f'  INSERT tg={tg} name={name!r} balance={bal}')

if not APPLY:
    print()
    print('*** DRY RUN - nothing was written. Pass APPLY to write. ***')
    sys.exit(0)

# --- Real write with transaction ---
con = sqlite3.connect(DB, timeout=30)
cur = con.cursor()
try:
    cur.execute('PRAGMA busy_timeout=30000')
    cur.execute('BEGIN')
    for tg, name, bal in to_insert:
        cur.execute(
            '''INSERT INTO users (telegram_id, username, first_name, is_blocked, test_used,
                                 referral_credit, joined_at, language_code, language_selected,
                                 coin_mode, reseller_reminder_sent)
               VALUES (?, ?, ?, 0, 0, ?, CURRENT_TIMESTAMP, 'fa', 0, 'wallet', '')''',
            (tg, None, name, int(bal))
        )
    con.commit()
    print()
    print(f'*** APPLIED: inserted {cur.rowcount if cur.rowcount > 0 else len(to_insert)} rows ***')
except Exception as e:
    con.rollback()
    print('ERROR, rolled back:', e)
    sys.exit(1)
finally:
    con.close()
