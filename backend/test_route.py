import sys
sys.path.append('d:/Projects/WebMsh/backend')
from fastapi.testclient import TestClient
from app.main import app
from app.auth import _hash_password, _now_ts
import sqlite3
import traceback

conn = sqlite3.connect('d:/Projects/WebMsh/backend/app/webmsh_auth.sqlite3')
try:
    conn.execute('INSERT OR IGNORE INTO users (email, display_name, password_hash, is_email_verified, totp_enabled, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)', ('test@webmsh.local', 'Test', _hash_password('test'), _now_ts(), _now_ts()))
    conn.commit()
    row = conn.execute('SELECT id FROM users WHERE email="test@webmsh.local"').fetchone()
    user_id = row[0]
    conn.execute('INSERT OR IGNORE INTO projects (id, user_id, name, created_at, updated_at) VALUES (100, ?, "test", ?, ?)', (user_id, _now_ts(), _now_ts()))
    conn.commit()
except Exception as e:
    print("DB error", e)

try:
    client = TestClient(app)
    resp1 = client.post('/auth/signin', json={'email':'test@webmsh.local', 'password':'test'})
    cookie = resp1.cookies.get('webmsh_session')
    resp2 = client.post('/projects/100/geometry/box', json={'width':1,'height':1,'depth':1,'origin_x':0,'origin_y':0,'origin_z':0}, cookies={'webmsh_session': cookie})
    print('STATUS:', resp2.status_code)
    print('BODY:', resp2.text)
except Exception:
    traceback.print_exc()
