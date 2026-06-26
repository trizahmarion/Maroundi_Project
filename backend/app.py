import csv
import json
import os
import re
import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = 'server_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
USERS_FILE = 'database_users.csv'
REQS_FILE = 'database_requests.csv'

USER_FIELDS = ['id', 'name', 'phone', 'password_hash', 'role', 'id_number', 'profile_pic', 'good_conduct_cert', 'is_verified', 'rating', 'rating_count', 'is_held', 'edit_request', 'comments', 'date_joined']
REQ_FIELDS = ['id', 'title', 'category', 'location', 'timeline', 'price', 'status', 'requester', 'runner', 'bids', 'messages', 'date', 'rated_by_requester', 'rated_by_runner']

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def init_csv():
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w', newline='', encoding='utf-8') as f:
            csv.DictWriter(f, fieldnames=USER_FIELDS).writeheader()
    if not os.path.exists(REQS_FILE):
        with open(REQS_FILE, 'w', newline='', encoding='utf-8') as f:
            csv.DictWriter(f, fieldnames=REQ_FIELDS).writeheader()

def read_users():
    users = []
    with open(USERS_FILE, 'r', newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            row['id'] = int(row['id'])
            row['is_verified'] = row['is_verified'] == 'True'
            row['rating'] = float(row['rating'])
            row['rating_count'] = int(row['rating_count'])
            row['is_held'] = row['is_held'] == 'True'
            row['edit_request'] = json.loads(row['edit_request']) if row['edit_request'] else None
            row['comments'] = json.loads(row['comments']) if row['comments'] else []
            users.append(row)
    return users

def write_users(users):
    with open(USERS_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=USER_FIELDS)
        writer.writeheader()
        for u in users:
            row = dict(u)
            row['edit_request'] = json.dumps(row['edit_request']) if row['edit_request'] else ''
            row['comments'] = json.dumps(row['comments']) if row['comments'] else ''
            writer.writerow(row)

def read_requests():
    reqs = []
    with open(REQS_FILE, 'r', newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            row['id'] = int(row['id'])
            row['price'] = float(row['price'])
            row['bids'] = json.loads(row['bids']) if row['bids'] else []
            row['messages'] = json.loads(row['messages']) if row['messages'] else []
            row['rated_by_requester'] = row['rated_by_requester'] == 'True'
            row['rated_by_runner'] = row['rated_by_runner'] == 'True'
            reqs.append(row)
    return reqs

def write_requests(reqs):
    with open(REQS_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=REQ_FIELDS)
        writer.writeheader()
        for r in reqs:
            row = dict(r)
            row['bids'] = json.dumps(row['bids'])
            row['messages'] = json.dumps(row['messages'])
            writer.writerow(row)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app)
init_csv()

CATEGORIES_BASE_PRICE = {'delivery': 200, 'pickup': 200, 'queue': 300, 'shopping': 250, 'other': 200}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_password(password):
    if len(password) < 8: return False
    if not re.search(r"[a-z]", password): return False
    if not re.search(r"[A-Z]", password): return False
    if not re.search(r"\d", password): return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password): return False
    return True

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filename = f"{int(datetime.datetime.now().timestamp())}_{filename}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return jsonify({"url": f"/uploads/{filename}"})
    return jsonify({"error": "Invalid file type."}), 400

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    users_db = read_users()
    
    if any(u['name'].lower() == data['name'].lower() for u in users_db):
        return jsonify({"error": "Name already registered. Please use another name."}), 400
        
    pwd = data.get('password')
    if not validate_password(pwd):
        return jsonify({"error": "Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character."}), 400

    new_user = {
        'id': len(users_db) + 1,
        'name': data.get('name'),
        'phone': data.get('phone'),
        'password_hash': generate_password_hash(pwd),
        'role': data.get('role'),
        'id_number': data.get('id_number'),
        'profile_pic': data.get('profile_pic'), 
        'good_conduct_cert': data.get('good_conduct_cert'),
        'is_verified': False, 
        'rating': 0.0, 
        'rating_count': 0,
        'is_held': False,
        'edit_request': None,
        'comments': [],
        'date_joined': datetime.datetime.now().strftime("%B %d, %Y")
    }
    users_db.append(new_user)
    write_users(users_db)
    return jsonify({"message": "Registration successful. Please wait for Admin approval."})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if data.get('name') == 'Admin' and data.get('password') == '@Dm1n!6':
        return jsonify({'id': 0, 'name': 'Admin', 'role': 'admin', 'is_verified': True, 'profile_pic': ''})

    users_db = read_users()
    user = next((u for u in users_db if u['name'].lower() == data.get('name', '').lower()), None)
    if user and check_password_hash(user['password_hash'], data.get('password')):
        return jsonify({k:v for k,v in user.items() if k != 'password_hash'})
    return jsonify({"error": "Invalid name or password."}), 401

@app.route('/api/users/request_edit', methods=['POST'])
def request_edit():
    data = request.json
    users_db = read_users()
    user = next((u for u in users_db if u['name'] == data.get('name')), None)
    if user:
        user['edit_request'] = data.get('new_details')
        write_users(users_db)
        return jsonify({"message": "Profile edit submitted for Admin approval."})
    return jsonify({"error": "User not found"}), 404

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    return jsonify([{k:v for k,v in u.items() if k != 'password_hash'} for u in read_users()])

@app.route('/api/users/verify', methods=['POST'])
def verify_user():
    users_db = read_users()
    user = next((u for u in users_db if u['id'] == request.json.get('id')), None)
    if user:
        user['is_verified'] = True
        write_users(users_db)
        return jsonify({"message": "Verified"})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/admin/approve_edit', methods=['POST'])
def approve_edit():
    users_db = read_users()
    user = next((u for u in users_db if u['id'] == request.json.get('id')), None)
    if user and user.get('edit_request'):
        for k, v in user['edit_request'].items():
            if v: user[k] = v
        user['edit_request'] = None
        write_users(users_db)
        return jsonify({"message": "Profile edit approved."})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/admin/toggle_hold', methods=['POST'])
def toggle_hold():
    users_db = read_users()
    user = next((u for u in users_db if u['id'] == request.json.get('id')), None)
    if user:
        user['is_held'] = not user['is_held']
        write_users(users_db)
        return jsonify({"message": "Account hold status updated", "is_held": user['is_held']})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/requests', methods=['GET', 'POST'])
def handle_requests():
    if request.method == 'GET':
        return jsonify(read_requests())
    
    data = request.json
    users_db = read_users()
    requester = next((u for u in users_db if u['name'] == data.get('requester')), None)
    if requester and (not requester['is_verified'] or requester['is_held']):
        return jsonify({"error": "Account is unverified or under review. Action blocked."}), 403

    cat = data.get('category', 'other')
    base_price = CATEGORIES_BASE_PRICE.get(cat, 200)
    try: user_price = float(data.get('price', 0))
    except: user_price = 0

    if user_price < base_price:
        return jsonify({"error": f"Minimum price for {cat} is KES {base_price}"}), 400

    requests_db = read_requests()
    new_req = {
        'id': len(requests_db) + 1,
        'title': data.get('title'),
        'category': cat,
        'location': data.get('location'),
        'timeline': data.get('timeline'),
        'price': user_price,
        'status': 'pending',
        'requester': data.get('requester'),
        'runner': None,
        'bids': [],
        'messages': [],
        'date': datetime.datetime.now().strftime("%Y-%m-%d"),
        'rated_by_requester': False,
        'rated_by_runner': False
    }
    requests_db.append(new_req)
    write_requests(requests_db)
    return jsonify(new_req)

@app.route('/api/requests/bid', methods=['POST'])
def bid_request():
    data = request.json
    users_db = read_users()
    runner = next((u for u in users_db if u['name'] == data.get('runner')), None)
    if runner and (not runner['is_verified'] or runner['is_held']):
        return jsonify({"error": "Account pending verification or under review."}), 403
        
    requests_db = read_requests()
    for req in requests_db:
        if req['id'] == data.get('id') and req['status'] == 'pending':
            req['bids'].append({
                'runner': runner['name'], 
                'amount': float(data.get('amount'))
            })
            write_requests(requests_db)
            return jsonify(req)
    return jsonify({"error": "Task not available"}), 400

@app.route('/api/requests/accept_bid', methods=['POST'])
def accept_bid():
    data = request.json
    requests_db = read_requests()
    for req in requests_db:
        if req['id'] == data.get('task_id'):
            req['status'] = 'assigned'
            req['runner'] = data.get('runner_name')
            req['price'] = data.get('bid_amount')
            write_requests(requests_db)
            return jsonify(req)
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/requests/accept', methods=['POST'])
def accept_request():
    data = request.json
    users_db = read_users()
    runner = next((u for u in users_db if u['name'] == data.get('runner')), None)
    if runner and (not runner['is_verified'] or runner['is_held']):
         return jsonify({"error": "Account pending verification or under review."}), 403

    requests_db = read_requests()
    for req in requests_db:
        if req['id'] == data.get('id') and req['status'] == 'pending':
            req['status'] = 'assigned'
            req['runner'] = runner['name']
            write_requests(requests_db)
            return jsonify(req)
    return jsonify({"error": "Task not available"}), 400

@app.route('/api/requests/message', methods=['POST'])
def send_message():
    data = request.json
    requests_db = read_requests()
    for req in requests_db:
        if req['id'] == data.get('task_id'):
            req['messages'].append({
                'sender': data.get('sender'),
                'text': data.get('text'),
                'timestamp': datetime.datetime.now().strftime("%H:%M")
            })
            write_requests(requests_db)
            return jsonify(req)
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/requests/complete', methods=['POST'])
def complete_request():
    requests_db = read_requests()
    for req in requests_db:
        if req['id'] == request.json.get('id'):
            req['status'] = 'completed'
            write_requests(requests_db)
            return jsonify(req)
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/rate', methods=['POST'])
def rate_user():
    data = request.json
    target_username = data.get('target')
    score = float(data.get('score'))
    task_id = data.get('task_id')
    role = data.get('role')
    comment = data.get('comment', '')

    users_db = read_users()
    requests_db = read_requests()
    user = next((u for u in users_db if u['name'] == target_username), None)
    task = next((t for t in requests_db if t['id'] == task_id), None)

    if user and task:
        user['rating_count'] += 1
        
        if user['rating_count'] == 1: user['rating'] = score
        else:
            total_score = (user['rating'] * (user['rating_count'] - 1)) + score
            user['rating'] = round(total_score / user['rating_count'], 1)
        
        if comment:
            user['comments'].append({'task_id': task_id, 'score': score, 'text': comment})
        
        if user['rating_count'] > 3 and user['rating'] < 3.5:
            user['is_held'] = True
            
        if role == 'requester': task['rated_by_requester'] = True
        if role == 'runner': task['rated_by_runner'] = True
            
        write_users(users_db)
        write_requests(requests_db)
        return jsonify({"message": "Rating saved"})
    return jsonify({"error": "User or task not found"}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)