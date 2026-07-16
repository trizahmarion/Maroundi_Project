import os
import re
import datetime
import json
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

UPLOAD_FOLDER = 'server_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'heic', 'HEIC', 'webp'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Database connection via SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
jwt = JWTManager(app)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database mapping
db = SQLAlchemy(app)
ALLOWED_ORIGINS = [
    "http://localhost:3000",                 
    "maroundi-project.vercel.app"
]

CORS(app, 
     origins=[
         "https://maroundi-project.vercel.app",
         "http://localhost:3000"
     ], 
     supports_credentials=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

def allowed_file(filename):
    # This checks if there is a '.' in the name, and if the extension is in our allowed list
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- DATABASE SCHEMAS (MODELS) ---
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')
    id_number = db.Column(db.String(50))
    profile_pic = db.Column(db.String(255))
    good_conduct_cert = db.Column(db.String(255))
    is_verified = db.Column(db.Boolean, default=False)
    rating = db.Column(db.Float, default=0.0)
    rating_count = db.Column(db.Integer, default=0)
    is_held = db.Column(db.Boolean, default=False)
    
    # Store dynamic fields as JSON directly in Postgres
    edit_request = db.Column(db.JSON, nullable=True)
    comments = db.Column(db.JSON, default=list) 
    date_joined = db.Column(db.String(50))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'role': self.role,
            'id_number': self.id_number,
            'profile_pic': self.profile_pic,
            'good_conduct_cert': self.good_conduct_cert,
            'is_verified': self.is_verified,
            'rating': self.rating,
            'rating_count': self.rating_count,
            'is_held': self.is_held,
            'edit_request': self.edit_request,
            'comments': self.comments if self.comments is not None else [],
            'date_joined': self.date_joined
        }

class ErrandRequest(db.Model):
    __tablename__ = 'errands'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    location = db.Column(db.String(255))
    timeline = db.Column(db.String(100))
    price = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='pending')
    requester = db.Column(db.String(100), nullable=False)
    runner = db.Column(db.String(100), nullable=True)
    
    # Store arrays of bids and chat messages directly as JSON
    bids = db.Column(db.JSON, default=list)
    messages = db.Column(db.JSON, default=list)
    date = db.Column(db.String(50))
    rated_by_requester = db.Column(db.Boolean, default=False)
    rated_by_runner = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'category': self.category,
            'location': self.location,
            'timeline': self.timeline,
            'price': self.price,
            'status': self.status,
            'requester': self.requester,
            'runner': self.runner,
            'bids': self.bids if self.bids is not None else [],
            'messages': self.messages if self.messages is not None else [],
            'date': self.date,
            'rated_by_requester': self.rated_by_requester,
            'rated_by_runner': self.rated_by_runner
        }


CATEGORIES_BASE_PRICE = {'delivery': 200, 'pickup': 200, 'queue': 300, 'shopping': 250, 'other': 200}

# --- HELPER UTILITIES ---

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_password(password):
    if len(password) < 8: return False
    if not re.search(r"[a-z]", password): return False
    if not re.search(r"[A-Z]", password): return False
    if not re.search(r"\d", password): return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password): return False
    return True

# endpoints
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: 
        return jsonify({"error": "No file detected"}), 400
    file = request.files['file']
    if file.filename == '': 
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
    safe_filename = secure_filename(file.filename)
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], safe_filename))
    return jsonify({
        "message": "File securely uploaded!", "url": f"/uploads/{safe_filename}"
    }), 200

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    
    # Query database directly to see if username already exists
    existing_user = User.query.filter(db.func.lower(User.name) == data['name'].lower()).first()
    if existing_user:
        return jsonify({"error": "Name already registered. Please use another name."}), 400
        
    pwd = data.get('password')
    if not validate_password(pwd):
        return jsonify({"error": "Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character."}), 400

    new_user = User(
        name=data.get('name'),
        phone=data.get('phone'),
        password_hash=generate_password_hash(pwd),
        role=data.get('role'),
        id_number=data.get('id_number'),
        profile_pic=data.get('profile_pic'), 
        good_conduct_cert=data.get('good_conduct_cert'),
        is_verified=False, 
        rating=0.0, 
        rating_count=0,
        is_held=False,
        edit_request=None,
        comments=[],
        date_joined=datetime.datetime.now().strftime("%B %d, %Y")
    )
    
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "Registration successful. Please wait for Admin approval."})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    input_name = data.get('name', '').strip()
    
    # Pull user from Supabase PostgreSQL
    user = User.query.filter(db.func.lower(User.name) == input_name.lower()).first()
    if user and check_password_hash(user.password_hash, data.get('password')):
        access_token = create_access_token(identity={'id': user.id, 'role': user.role})
        user_data = user.to_dict()
        return jsonify({
            'user': user_data,
            'token': access_token
        }), 200
    return jsonify({"error": "Invalid name or password."}), 401

@app.route('/api/users/request_edit', methods=['POST'])
def request_edit():
    data = request.json
    user = User.query.filter_by(name=data.get('name')).first()
    if user:
        user.edit_request = data.get('new_details')
        db.session.commit()
        return jsonify({"message": "Profile edit submitted for Admin approval."})
    return jsonify({"error": "User not found"}), 404

@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user = get_jwt_identity()
    if current_user.get('role') != 'admin':
        return jsonify({"error": "Unauthorized access."}), 403
    users = User.query.filter(User.role != 'admin').all()
    return jsonify([user.to_dict() for user in users]), 200

@app.route('/api/users/verify', methods=['POST'])
def verify_user():
    current_user = get_jwt_identity()
    if current_user.get('role') != 'admin':
        return jsonify({"error": "Unauthorized access."}), 403
    user = User.query.get(request.json.get('id'))
    if user:
        user.is_verified = True
        db.session.commit()
        return jsonify({"message": "Verified"})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/admin/approve_edit', methods=['POST'])
def approve_edit():
    user = User.query.get(request.json.get('id'))
    if user and user.edit_request:
        # Dynamically apply the requested fields
        for k, v in user.edit_request.items():
            if v and hasattr(user, k): 
                setattr(user, k, v)
        user.edit_request = None
        db.session.commit()
        return jsonify({"message": "Profile edit approved."})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/admin/toggle_hold', methods=['POST'])
def toggle_hold():
    user = User.query.get(request.json.get('id'))
    if user:
        user.is_held = not user.is_held
        db.session.commit()
        return jsonify({"message": "Account hold status updated", "is_held": user.is_held})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/requests', methods=['GET', 'POST'])
def handle_requests():
    if request.method == 'GET':
        errands = ErrandRequest.query.all()
        return jsonify([e.to_dict() for e in errands])
    
    data = request.json
    requester = User.query.filter_by(name=data.get('requester')).first()
    if requester and (not requester.is_verified or requester.is_held):
        return jsonify({"error": "Account is unverified or under review. Action blocked."}), 403

    cat = data.get('category', 'other')
    base_price = CATEGORIES_BASE_PRICE.get(cat, 200)
    try: user_price = float(data.get('price', 0))
    except: user_price = 0

    if user_price < base_price:
        return jsonify({"error": f"Minimum price for {cat} is KES {base_price}"}), 400

    new_req = ErrandRequest(
        title=data.get('title'),
        category=cat,
        location=data.get('location'),
        timeline=data.get('timeline'),
        price=user_price,
        status='pending',
        requester=data.get('requester'),
        runner=None,
        bids=[],
        messages=[],
        date=datetime.datetime.now().strftime("%Y-%m-%d"),
        rated_by_requester=False,
        rated_by_runner=False
    )
    db.session.add(new_req)
    db.session.commit()
    return jsonify(new_req.to_dict())

@app.route('/api/requests/bid', methods=['POST'])
def bid_request():
    data = request.json
    runner = User.query.filter_by(name=data.get('runner')).first()
    if runner and (not runner.is_verified or runner.is_held):
        return jsonify({"error": "Account pending verification or under review."}), 403
        
    req = ErrandRequest.query.get(data.get('id'))
    if req and req.status == 'pending':
        # Append bid manually to JSON list
        new_bids = list(req.bids) if req.bids else []
        new_bids.append({
            'runner': runner.name, 
            'amount': float(data.get('amount'))
        })
        req.bids = new_bids
        db.session.commit()
        return jsonify(req.to_dict())
    return jsonify({"error": "Task not available"}), 400

@app.route('/api/requests/accept_bid', methods=['POST'])
def accept_bid():
    data = request.json
    req = ErrandRequest.query.get(data.get('task_id'))
    if req:
        req.status = 'assigned'
        req.runner = data.get('runner_name')
        req.price = data.get('bid_amount')
        db.session.commit()
        return jsonify(req.to_dict())
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/requests/accept', methods=['POST'])
def accept_request():
    data = request.json
    runner = User.query.filter_by(name=data.get('runner')).first()
    if runner and (not runner.is_verified or runner.is_held):
         return jsonify({"error": "Account pending verification or under review."}), 403

    req = ErrandRequest.query.get(data.get('id'))
    if req and req.status == 'pending':
        req.status = 'assigned'
        req.runner = runner.name
        db.session.commit()
        return jsonify(req.to_dict())
    return jsonify({"error": "Task not available"}), 400

@app.route('/api/requests/message', methods=['POST'])
def send_message():
    data = request.json
    req = ErrandRequest.query.get(data.get('task_id'))
    if req:
        new_messages = list(req.messages) if req.messages else []
        new_messages.append({
            'sender': data.get('sender'),
            'text': data.get('text'),
            'timestamp': datetime.datetime.now().strftime("%H:%M")
        })
        req.messages = new_messages
        db.session.commit()
        return jsonify(req.to_dict())
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/requests/complete', methods=['POST'])
def complete_request():
    req = ErrandRequest.query.get(request.json.get('id'))
    if req:
        req.status = 'completed'
        db.session.commit()
        return jsonify(req.to_dict())
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/rate', methods=['POST'])
def rate_user():
    data = request.json
    target_username = data.get('target')
    score = float(data.get('score'))
    task_id = data.get('task_id')
    role = data.get('role')
    comment = data.get('comment', '')

    user = User.query.filter_by(name=target_username).first()
    task = ErrandRequest.query.get(task_id)

    if user and task:
        user.rating_count += 1
        
        if user.rating_count == 1: 
            user.rating = score
        else:
            total_score = (user.rating * (user.rating_count - 1)) + score
            user.rating = round(total_score / user.rating_count, 1)
        
        if comment:
            new_comments = list(user.comments) if user.comments else []
            new_comments.append({'task_id': task_id, 'score': score, 'text': comment})
            user.comments = new_comments
        
        if user.rating_count > 3 and user.rating < 3.5:
            user.is_held = True
            
        if role == 'requester': task.rated_by_requester = True
        if role == 'runner': task.rated_by_runner = True
            
        db.session.commit()
        return jsonify({"message": "Rating saved"})
    return jsonify({"error": "User or task not found"}), 404

if __name__ == '__main__':
    # Creates Postgres tables automatically if they do not exist
    with app.app_context():
        db.create_all()

    #Admin account setup
        admin_exists = User.query.filter_by(role='admin').first()
        
        if not admin_exists:
            admin_hash = os.getenv('ADMIN_PASSWORD')
            if admin_hash:
                admin_user = User(
                    name='Admin',
                    phone='0000000000',
                    password_hash=admin_hash, 
                    role='admin',
                    is_verified=True,
                    rating=5.0,
                    rating_count=1
                )
                db.session.add(admin_user)
                db.session.commit()
                print("Successfully created the default Admin account!")
            else:
                print("Warning: ADMIN_PASSWORD not found")
        else:
            print("Admin account already exists in Supabase. Skipping creation.")
        # -----------------------------

    app.run(debug=True, port=5000)