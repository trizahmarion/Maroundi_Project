import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Truck, Sun, Moon, ArrowLeft, Star, AlertTriangle, LogOut, Camera, FileText, CheckCircle, Smartphone, MapPin, Clock, Edit3, Shield, Send } from 'lucide-react';

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://maroundi-project.onrender.com';

const getImgUrl = (path) => {
    if (!path) return ''; 
    if (path.startsWith('http') || path.startsWith('data:')) { 
        return path;
    }
    return `${API_URL}${path}`; 
}

const BASE_PRICES = { delivery: 200, pickup: 200, queue: 300, shopping: 250, other: 200 };

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');
  const [darkMode, setDarkMode] = useState(false);
  const [unratedTask, setUnratedTask] = useState(null);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const refreshUser = async () => {
    if(user?.role !== 'admin') {
      try {
        const res = await axios.post(`${API_URL}/login`, {name: user.name, password: user.password});
        setUser({...res.data, password: user.password});
        checkUnratedTasks(res.data);
      } catch(e) {}
    }
  }

  const checkUnratedTasks = async (currentUser) => {
    try {
      const res = await axios.get(`${API_URL}/requests`);
      const tasks = res.data;
      const unrated = tasks.find(t => t.status === 'completed' && 
        ((currentUser.role === 'requester' && t.requester === currentUser.name && !t.rated_by_requester) ||
         (currentUser.role === 'runner' && t.runner === currentUser.name && !t.rated_by_runner)));
      setUnratedTask(unrated || null);
    } catch(e) {}
  };

  useEffect(() => { if(user) checkUnratedTasks(user); }, [user]);

  if (view === 'landing') return <LandingPage setView={setView} darkMode={darkMode} setDarkMode={setDarkMode} />;
  if (view === 'login') return <LoginScreen setUser={setUser} setView={setView} />;
  if (view === 'register-req') return <RegisterForm role="requester" setView={setView} />;
  if (view === 'register-run') return <RegisterForm role="runner" setView={setView} />;
  
  if (user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 transition-colors">
        <Navbar user={user} onLogout={() => {setUser(null); setView('landing');}} darkMode={darkMode} setDarkMode={setDarkMode} />
        
        {unratedTask && <RatingModal task={unratedTask} user={user} onClose={() => {setUnratedTask(null); refreshUser();}} />}

        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          {user.is_held && (
            <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-800 dark:text-red-200 p-4 mb-6 rounded-r">
              <p className="font-bold flex items-center gap-2"><AlertTriangle size={20}/> Account Suspended</p>
              <p className="text-sm mt-1">Your rating dropped below 3.5 stars after your initial 3-task grace period, or an admin placed a hold on your account. Action restricted.</p>
            </div>
          )}
          {!user.is_verified && user.role !== 'admin' && (
            <div className="bg-orange-100 dark:bg-orange-900/30 border-l-4 border-orange-500 text-orange-800 dark:text-orange-200 p-4 mb-6 rounded-r">
              <p className="font-bold flex items-center gap-2"><AlertTriangle size={20}/> Verification Pending</p>
              <p className="text-sm mt-1">Your account is restricted until Admin reviews your details.</p>
            </div>
          )}

          {user.role === 'requester' && <RequesterView user={user} refreshUser={refreshUser}/>}
          {user.role === 'runner' && <RunnerView user={user} refreshUser={refreshUser}/>}
          {user.role === 'admin' && <AdminView />}
        </div>
      </div>
    );
  }
  return null;
}

// --- RATING MODAL ---
function RatingModal({ task, user, onClose }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  
  const handleSubmit = async () => {
    if(score === 0) return alert("Please select a star rating.");
    const target = user.role === 'requester' ? task.runner : task.requester;
    await axios.post(`${API_URL}/rate`, { task_id: task.id, role: user.role, target, score, comment });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl text-center">
        <h2 className="text-2xl font-bold mb-2 dark:text-white">Task Completed!</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Please rate {user.role === 'requester' ? 'Runner' : 'Requester'} <b>{user.role === 'requester' ? task.runner : task.requester}</b> for task "{task.title}".</p>
        
        <div className="flex justify-center gap-2 mb-6">
          {[1,2,3,4,5].map(num => (
             <button key={num} onClick={() => setScore(num)} className={`p-3 rounded-xl transition-all ${score >= num ? 'bg-yellow-400 text-white shadow-lg scale-110' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
               <Star size={24} fill={score >= num ? "currentColor" : "none"} />
             </button>
          ))}
        </div>

        <textarea className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white mb-6 focus:ring-2 focus:ring-emerald-500 outline-none resize-none" rows="3" placeholder="Additional comments (optional)..." onChange={e => setComment(e.target.value)}></textarea>
        
        <button onClick={handleSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg">Submit Review</button>
      </div>
    </div>
  );
}

// --- LANDING & AUTH ---
function LandingPage({ setView, darkMode, setDarkMode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="absolute top-4 right-4 z-50 flex gap-4 items-center">
        <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-yellow-400 rounded-full"><Sun size={20}/></button>
        <button onClick={() => setView('login')} className="font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-5 py-2 rounded-xl">Log In</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-5xl md:text-7xl font-black mb-4 dark:text-white">Chapa Errands <span className="text-emerald-500">Na Maroundi</span></h1>
        <p className="text-xl mb-12 text-slate-500 max-w-2xl">Verified runners handling your physical hustle securely.</p>
        <div className="flex flex-col sm:flex-row gap-6 max-w-3xl w-full">
           <div className="flex-1 p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-xl cursor-pointer hover:scale-105 transition-transform" onClick={() => setView('register-req')}>
             <User className="w-12 h-12 text-blue-500 mb-4 mx-auto"/>
             <h3 className="text-2xl font-bold mb-2 dark:text-white">Customer</h3>
             <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl mt-4">Join as Requester</button>
           </div>
           <div className="flex-1 p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-xl cursor-pointer hover:scale-105 transition-transform" onClick={() => setView('register-run')}>
             <Truck className="w-12 h-12 text-emerald-500 mb-4 mx-auto"/>
             <h3 className="text-2xl font-bold mb-2 dark:text-white">Runner</h3>
             <button className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl mt-4">Apply as Runner</button>
           </div>
        </div>
      </div>
    </div>
  );
}

function ImageUpload({ label, onUpload, icon: Icon }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_URL}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      onUpload(res.data.url);
      setPreview(getImgUrl(res.data.url));
      setLoading(false);
    } catch (err) { alert("Upload failed."); setLoading(false); }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{label}</label>
      <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800">
        <input type="file" onChange={handleFile} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*,.pdf" />
        {loading ? <span className="text-emerald-500 font-bold">Uploading...</span> : preview ? 
          <div className="flex flex-col items-center gap-2 text-emerald-600"><CheckCircle size={24}/> <span className="text-sm">Uploaded</span></div> : 
          <div className="flex flex-col items-center text-slate-400"><Icon size={24}/><span className="text-xs text-blue-500">Tap to upload</span></div>}
      </div>
    </div>
  );
}

function RegisterForm({ role, setView }) {
  const [form, setForm] = useState({ name: '', phone: '', password: '', id_number: '', profile_pic: '', good_conduct_cert: '' });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (role === 'runner' && !form.good_conduct_cert) return alert("Runners must upload Good Conduct.");
    try {
      await axios.post(`${API_URL}/register`, { ...form, role });
      alert("Registration successful! Please log in.");
      setView('login');
    } catch (err) { alert(err.response?.data?.error || "Registration failed"); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 py-12">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 dark:border-slate-700">
        <button onClick={() => setView('landing')} className="mb-6 flex items-center text-slate-400"><ArrowLeft size={16} className="mr-2"/> Back</button>
        <h2 className="text-3xl font-bold mb-6 dark:text-white capitalize">Register as {role}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
             <div className="flex-1"><ImageUpload label="Profile Photo" icon={Camera} onUpload={(url) => setForm({...form, profile_pic: url})} /></div>
             {role === 'runner' && <div className="flex-1"><ImageUpload label="Good Conduct" icon={FileText} onUpload={(url) => setForm({...form, good_conduct_cert: url})} /></div>}
          </div>
          <input required className="w-full p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Name" onChange={e => setForm({...form, name: e.target.value})} />
          <input required className="w-full p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white" type="tel" placeholder="Phone" onChange={e => setForm({...form, phone: e.target.value})} />
          <input required className="w-full p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white" type="text" placeholder="National ID" onChange={e => setForm({...form, id_number: e.target.value})} />
          <input required className="w-full p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white" type="password" placeholder="Password (Min 8 chars, 1 Upper, 1 Special)" onChange={e => setForm({...form, password: e.target.value})} />
          <button className="w-full bg-emerald-600 text-white p-4 rounded-xl font-bold">Create Account</button>
        </form>
      </div>
    </div>
  );
}

function LoginScreen({ setUser, setView }) {
  const [form, setForm] = useState({ name: '', password: '' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login`, form);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setView('dashboard');
    } catch (err) { alert("Invalid Name or Password."); }
  };
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl w-full max-w-sm">
        <button onClick={() => setView('landing')} className="mb-6 flex items-center text-slate-400"><ArrowLeft size={16} className="mr-2"/> Back</button>
        <h2 className="text-3xl font-bold mb-6 dark:text-white">Log In</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Your Name" onChange={e => setForm({...form, name: e.target.value})} />
          <input className="w-full p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white" type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} />
          <button className="w-full bg-emerald-600 text-white p-4 rounded-xl font-bold">Log In</button>
        </form>
      </div>
    </div>
  );
}

// --- PROFILE SETTINGS ---
function UserProfile({ user, refreshUser }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ phone: user.phone, profile_pic: '' });

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/users/request_edit`, { name: user.name, new_details: editForm });
            alert("Profile edit request sent to Admin for approval.");
            setIsEditing(false);
            refreshUser();
        } catch(err) { alert("Error requesting edit"); }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
                <div className="flex items-center gap-6">
                    {user.profile_pic ? (
                      <img src={getImgUrl(user.profile_pic)} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-slate-100 dark:border-slate-700" />
                    ) : (
                      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center text-2xl font-bold text-emerald-700 dark:text-emerald-300">{user.name.charAt(0)}</div>
                    )}
                    <div>
                        <h2 className="text-3xl font-bold dark:text-white flex items-center gap-3">
                          {user.name} 
                          {user.rating_count === 0 ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase font-black tracking-widest">New</span>
                          ) : (
                            <span className="text-sm bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 px-3 py-1 rounded-lg flex items-center"><Star size={14} className="mr-1"/> {user.rating} ({user.rating_count})</span>
                          )}
                        </h2>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-slate-500 uppercase font-bold text-sm">{user.role}</span>
                          <span className="text-sm text-slate-500 flex items-center gap-1"><Smartphone size={14}/> {user.phone}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-2 font-medium tracking-wide uppercase">Active since: {user.date_joined}</div>
                    </div>
                </div>
                {user.role !== 'admin' && (
                  <button onClick={() => setIsEditing(!isEditing)} className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-xl font-bold hover:bg-blue-100">
                      <Edit3 size={16}/> Settings
                  </button>
                )}
            </div>
            
            {user.edit_request && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-bold flex items-center gap-2">
                    <CheckCircle size={16}/> Profile changes pending Admin approval.
                </div>
            )}

            {isEditing && !user.edit_request && (
                <form onSubmit={handleEditSubmit} className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-2">New Phone Number</label>
                        <input className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-slate-800 dark:text-white" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-2">New Profile Picture</label>
                        <div className="scale-90 origin-top-left">
                            <ImageUpload label="" icon={Camera} onUpload={(url) => setEditForm({...editForm, profile_pic: url})} />
                        </div>
                    </div>
                    <button className="sm:col-span-2 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">Submit Request to Admin</button>
                </form>
            )}
        </div>
    )
}

// --- REQUESTER VIEW ---
function RequesterView({ user, refreshUser }) {
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('post'); // post, history
  
  // Post Form State
  const [form, setForm] = useState({ title: '', category: 'delivery', location: '', timeline: '', price: BASE_PRICES['delivery'] });

  const fetchRequests = async () => {
    const res = await axios.get(`${API_URL}/requests`);
    setRequests(res.data.filter(r => r.requester === user.name));
    refreshUser();
  };
  useEffect(() => { fetchRequests(); }, []);

  const handleCategoryChange = (e) => {
      const cat = e.target.value;
      setForm({...form, category: cat, price: BASE_PRICES[cat]});
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if(user.is_held || !user.is_verified) return alert("Action restricted. Awaiting admin verification or account is held.");
    if(form.price < BASE_PRICES[form.category]) return alert(`Minimum price for ${form.category} is KES ${BASE_PRICES[form.category]}`);
    
    try {
        await axios.post(`${API_URL}/requests`, { ...form, requester: user.name });
        setForm({ title: '', category: 'delivery', location: '', timeline: '', price: BASE_PRICES['delivery'] });
        alert("Errand Posted!");
        fetchRequests();
        setTab('history');
    } catch(err) { alert(err.response?.data?.error); }
  };

  const acceptBid = async (taskId, runnerName, bidAmount) => {
      if(user.is_held || !user.is_verified) return alert("Action restricted.");
      await axios.post(`${API_URL}/requests/accept_bid`, { task_id: taskId, runner_name: runnerName, bid_amount: bidAmount });
      fetchRequests();
  };

  return (
     <div>
       <UserProfile user={user} refreshUser={refreshUser}/>
       
       <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-6">
          <button onClick={()=>setTab('post')} className={`font-bold pb-2 border-b-2 ${tab==='post'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>Post Errand</button>
          <button onClick={()=>setTab('history')} className={`font-bold pb-2 border-b-2 ${tab==='history'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>My Requests</button>
       </div>

       {tab === 'post' && (
           <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-2xl">
             <h2 className="font-bold text-2xl mb-6 dark:text-white">Request an Errand</h2>
             <form onSubmit={handlePost} className="space-y-4">
                <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Task Category</label>
                   <select value={form.category} onChange={handleCategoryChange} className="w-full p-4 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white capitalize font-bold text-blue-600">
                      {Object.keys(BASE_PRICES).map(c => <option key={c} value={c}>{c} (Min KES {BASE_PRICES[c]})</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Task Title / Details</label>
                   <input required disabled={user.is_held || !user.is_verified} className="w-full p-4 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white disabled:opacity-50" placeholder="E.g., Buy groceries from Naivas" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-bold text-slate-500 mb-1">Location</label>
                       <input required className="w-full p-4 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white disabled:opacity-50" disabled={user.is_held || !user.is_verified} placeholder="E.g., Westlands" value={form.location} onChange={e=>setForm({...form, location: e.target.value})} />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-slate-500 mb-1">Timeline</label>
                       <input required type="datetime-local" className="w-full p-4 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white disabled:opacity-50" disabled={user.is_held || !user.is_verified} value={form.timeline} onChange={e=>setForm({...form, timeline: e.target.value})} />
                    </div>
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Your Price Offer (KES)</label>
                   <input required type="number" min={BASE_PRICES[form.category]} className="w-full p-4 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white font-bold text-emerald-600 disabled:opacity-50" disabled={user.is_held || !user.is_verified} value={form.price} onChange={e=>setForm({...form, price: e.target.value})} />
                   <p className="text-xs text-slate-400 mt-1">Runners can accept this price or bid higher.</p>
                </div>
                <button disabled={user.is_held || !user.is_verified} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">Post Errand</button>
             </form>
           </div>
       )}

       {tab === 'history' && (
           <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
               {requests.length === 0 && <p className="text-slate-500 col-span-full">No errands posted yet.</p>}
               {requests.map(req => (
                   <TaskCard key={req.id} task={req} user={user} refresh={fetchRequests}>
                       {/* Inject Bids UI for Requester */}
                       {req.status === 'pending' && req.bids?.length > 0 && (
                           <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                               <h4 className="font-bold text-sm mb-2 text-slate-500">Runner Bids:</h4>
                               <div className="space-y-2">
                                   {req.bids.map((b, i) => (
                                       <div key={i} className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                                           <span className="text-sm font-bold">{b.runner} <span className="text-emerald-600">KES {b.amount}</span></span>
                                           <button onClick={() => acceptBid(req.id, b.runner, b.amount)} className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-emerald-700">Accept</button>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       )}
                   </TaskCard>
               ))}
           </div>
       )}
     </div>
  );
}

// --- RUNNER VIEW ---
function RunnerView({ user, refreshUser }) {
  const [available, setAvailable] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [tab, setTab] = useState('market'); // market, active

  const refresh = async () => {
    const res = await axios.get(`${API_URL}/requests`);
    setAvailable(res.data.filter(r => r.status === 'pending'));
    setMyTasks(res.data.filter(r => r.runner === user.name && r.status !== 'pending'));
    refreshUser();
  };
  useEffect(() => { refresh(); }, []);

  const acceptJob = async (id) => {
    if(user.is_held || !user.is_verified) return alert("Action restricted.");
    try { await axios.post(`${API_URL}/requests/accept`, { id, runner: user.name }); refresh(); setTab('active'); }
    catch(e) { alert(e.response?.data?.error); }
  };

  const placeBid = async (id, currentPrice) => {
      if(user.is_held || !user.is_verified) return alert("Action restricted.");
      const amt = prompt(`Current price is KES ${currentPrice}. Enter your bid amount:`);
      if(!amt || isNaN(amt) || Number(amt) <= Number(currentPrice)) return alert("Bid must be higher than current price.");
      
      try { 
          await axios.post(`${API_URL}/requests/bid`, { id, runner: user.name, amount: amt }); 
          alert("Bid placed! Waiting for requester to accept.");
          refresh(); 
      }
      catch(e) { alert(e.response?.data?.error); }
  };

  const completeJob = async (id) => { await axios.post(`${API_URL}/requests/complete`, { id }); refresh(); };

  return (
    <div>
        <UserProfile user={user} refreshUser={refreshUser}/>
        
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-6">
          <button onClick={()=>setTab('market')} className={`font-bold pb-2 border-b-2 ${tab==='market'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>Marketplace</button>
          <button onClick={()=>setTab('active')} className={`font-bold pb-2 border-b-2 ${tab==='active'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>My Tasks ({myTasks.filter(t=>t.status==='assigned').length})</button>
        </div>

        {tab === 'active' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {myTasks.length === 0 && <div className="col-span-full p-8 text-center text-slate-500">No active tasks.</div>}
              {myTasks.map(req => <TaskCard key={req.id} task={req} user={user} refresh={refresh} onAction={req.status === 'assigned' ? completeJob : null} actionLabel="Mark as Completed"/>)}
            </div>
        )}

        {tab === 'market' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {available.length === 0 && <p className="text-slate-500 col-span-full">No new jobs available right now.</p>}
              {available.map(req => (
                  <TaskCard key={req.id} task={req} user={user} refresh={refresh}>
                      <div className="mt-4 flex gap-2">
                          <button disabled={user.is_held || !user.is_verified} onClick={() => acceptJob(req.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold disabled:opacity-50">Accept KES {req.price}</button>
                          <button disabled={user.is_held || !user.is_verified} onClick={() => placeBid(req.id, req.price)} className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-white py-3 rounded-xl font-bold disabled:opacity-50">Bid Higher</button>
                      </div>
                  </TaskCard>
              ))}
            </div>
        )}
    </div>
  );
}

// --- ADMIN VIEW ---
function AdminView() {
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('database');

  // 1. Grab the token from browser storage
  const token = localStorage.getItem('token');
  
  // 2. Create a reusable header configuration
  const authConfig = {
      headers: { Authorization: `Bearer ${token}` }
  };

  const refresh = async () => {
      try {
          // Add authConfig as the second argument for GET requests
          const res = await axios.get(`${API_URL}/admin/users`, authConfig);
          setUsers(res.data);
      } catch (err) {
          console.error("Failed to authenticate or fetch users:", err);
          // If this fails, the token is likely missing or expired
      }
  };
  
  useEffect(() => { refresh(); }, []);

  // Add authConfig as the THIRD argument for POST requests
  const verifyUser = async (id) => { 
      await axios.post(`${API_URL}/users/verify`, { id }, authConfig); 
      refresh(); 
  };
  
  const toggleHold = async (id) => { 
      await axios.post(`${API_URL}/admin/toggle_hold`, { id }, authConfig); 
      refresh(); 
  };
  
  const approveEdit = async (id) => { 
      await axios.post(`${API_URL}/admin/approve_edit`, { id }, authConfig); 
      refresh(); 
  };

  const pending = users.filter(u => !u.is_verified && u.role !== 'admin');
  const suspended = users.filter(u => u.is_held);
  const pendingEdits = users.filter(u => u.edit_request);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-8 rounded-3xl shadow-xl">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-2"><Shield/> Admin System Center</h2>
        <p className="text-slate-300">Manage platform integrity, verification, and profiles.</p>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
        <button onClick={()=>setTab('database')} className={`font-bold pb-2 border-b-2 ${tab==='database'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>Database</button>
        <button onClick={()=>setTab('approvals')} className={`font-bold pb-2 border-b-2 flex items-center gap-2 ${tab==='approvals'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>
          Verifications {pending.length > 0 && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pending.length}</span>}
        </button>
        <button onClick={()=>setTab('suspensions')} className={`font-bold pb-2 border-b-2 flex items-center gap-2 ${tab==='suspensions'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>
          Suspensions {suspended.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{suspended.length}</span>}
        </button>
        <button onClick={()=>setTab('edits')} className={`font-bold pb-2 border-b-2 flex items-center gap-2 ${tab==='edits'?'border-blue-600 text-blue-600':'border-transparent text-slate-500'}`}>
          Profile Edits {pendingEdits.length > 0 && <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingEdits.length}</span>}
        </button>
      </div>

      {/* RENDER TABS */}
      {tab === 'approvals' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
           {pending.length === 0 ? <p className="text-slate-500">No pending verifications.</p> : pending.map(u => (
              <div key={u.id} className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                 <div>
                    <div className="font-bold text-lg dark:text-white flex items-center gap-2">
                        {u.name} <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded uppercase">{u.role}</span>
                    </div>
                    <div className="text-sm text-slate-500">ID: {u.id_number} | Phone: {u.phone}</div>
                    {u.good_conduct_cert && <a href={getImgUrl(u.good_conduct_cert)} target="_blank" rel="noreferrer" className="text-blue-500 text-xs mt-1 inline-block">View Good Conduct</a>}
                 </div>
                 <button onClick={() => verifyUser(u.id)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold">Approve</button>
              </div>
           ))}
        </div>
      )}

      {tab === 'edits' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
           {pendingEdits.length === 0 ? <p className="text-slate-500">No profile edits pending.</p> : pendingEdits.map(u => (
              <div key={u.id} className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                 <div>
                    <div className="font-bold text-lg dark:text-white">{u.name} requested edit:</div>
                    <div className="text-sm text-slate-500 mt-2 bg-slate-50 dark:bg-slate-900 p-3 rounded">
                        {u.edit_request.phone && <div><b>New Phone:</b> {u.edit_request.phone}</div>}
                        {u.edit_request.profile_pic && <div><b>New Pic:</b> <a href={getImgUrl(u.edit_request.profile_pic)} target="_blank" rel="noreferrer" className="text-blue-500">View Image</a></div>}
                    </div>
                 </div>
                 <button onClick={() => approveEdit(u.id)} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Approve Edit</button>
              </div>
           ))}
        </div>
      )}

      {tab === 'suspensions' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
           {suspended.length === 0 ? <p className="text-slate-500">No suspended accounts.</p> : suspended.map(u => (
              <div key={u.id} className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                 <div>
                    <div className="font-bold text-lg dark:text-white text-red-500">{u.name} ({u.role})</div>
                    <div className="text-sm text-slate-500">Rating: <Star size={12} className="inline"/> {u.rating}</div>
                 </div>
                 <button onClick={() => toggleHold(u.id)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold">Lift Suspension</button>
              </div>
           ))}
        </div>
      )}

      {tab === 'database' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-x-auto">
           <table className="w-full text-left">
              <thead><tr className="bg-slate-50 dark:bg-slate-900 text-slate-500"><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Rating</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead>
              <tbody className="dark:text-slate-200">
                {users.map(u => (
                  <tr key={u.id} className="border-b dark:border-slate-700">
                     <td className="p-4 font-bold">
                        {u.name}
                        {u.rating_count === 0 && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-full">NEW</span>}
                     </td>
                     <td className="p-4 uppercase text-xs">{u.role}</td>
                     <td className="p-4 font-bold text-yellow-600">{u.rating}</td>
                     <td className="p-4">{u.is_held ? <span className="text-red-500 font-bold text-sm">ON HOLD</span> : <span className="text-emerald-500 font-bold text-sm">ACTIVE</span>}</td>
                     <td className="p-4">
                       <button onClick={() => toggleHold(u.id)} className={`px-4 py-2 text-xs rounded font-bold text-white ${u.is_held ? 'bg-emerald-500' : 'bg-red-500'}`}>
                         {u.is_held ? 'Lift Hold' : 'Place Hold'}
                       </button>
                     </td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
}

// --- SHARED COMPONENTS (CHAT INCLUDED) ---
function TaskCard({ task, onAction, actionLabel, children, user, refresh }) {
  const [chatMsg, setChatMsg] = useState('');

  const getStatusColor = (status) => {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    if (status === 'assigned') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
  }

  const sendMessage = async (e) => {
      e.preventDefault();
      if(!chatMsg.trim()) return;
      await axios.post(`${API_URL}/requests/message`, { task_id: task.id, sender: user.name, text: chatMsg });
      setChatMsg('');
      refresh();
  };

  const isAssigned = task.status === 'assigned' || task.status === 'completed';
  const showRequesterName = user.role === 'requester' || isAssigned;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between hover:shadow-lg transition-shadow">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${getStatusColor(task.status)}`}>{task.status}</div>
          <div className="text-emerald-600 dark:text-emerald-400 font-black text-lg">KES {task.price}</div>
        </div>
        <h3 className="font-bold text-xl mb-2 dark:text-white leading-tight capitalize">{task.title}</h3>
        <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs px-2 py-1 rounded uppercase font-bold mb-4">{task.category}</span>
        
        <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400 mb-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2"><MapPin size={16}/> <span className="font-semibold">{task.location}</span></div>
          <div className="flex items-center gap-2"><Clock size={16}/> <span>{new Date(task.timeline).toLocaleString()}</span></div>
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
             <div className="flex items-center gap-2"><User size={16}/> <span>Req: {showRequesterName ? task.requester : 'Hidden until accepted'}</span></div>
             <div className="flex items-center gap-2 mt-1"><Truck size={16}/> <span>Run: {task.runner || 'None'}</span></div>
          </div>
        </div>
      </div>

      {/* CHAT INTERFACE FOR ASSIGNED TASKS */}
      {isAssigned && (
          <div className="mb-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-500">Messages</div>
              <div className="p-4 h-32 overflow-y-auto bg-slate-50 dark:bg-slate-800 space-y-2">
                  {task.messages.length === 0 && <div className="text-xs text-slate-400 text-center">No messages yet.</div>}
                  {task.messages.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.sender === user.name ? 'items-end' : 'items-start'}`}>
                          <div className={`text-xs px-3 py-2 rounded-xl max-w-[80%] ${m.sender === user.name ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 dark:text-white'}`}>
                              {m.text}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1">{m.sender} • {m.timestamp}</span>
                      </div>
                  ))}
              </div>
              {task.status !== 'completed' && (
                  <form onSubmit={sendMessage} className="flex border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                      <input className="flex-1 text-sm px-3 outline-none dark:bg-slate-800 dark:text-white" placeholder="Message..." value={chatMsg} onChange={e=>setChatMsg(e.target.value)} />
                      <button type="submit" className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-full"><Send size={18}/></button>
                  </form>
              )}
          </div>
      )}
      
      {children}

      {onAction && <button onClick={() => onAction(task.id)} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors">{actionLabel}</button>}
    </div>
  );
}

function Navbar({ user, onLogout, darkMode, setDarkMode }) {
  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
       <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
           <div className="font-black text-2xl text-emerald-600 dark:text-emerald-400 tracking-tight">Maroundi</div>
           <div className="flex items-center gap-4">
             <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-yellow-400 rounded-full">
               {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
             </button>
             <button onClick={onLogout} className="flex items-center gap-2 text-slate-500 font-bold hover:text-red-500 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl">
               <LogOut size={16}/> <span className="hidden sm:inline">Logout</span>
             </button>
           </div>
       </div>
    </div>
  );
}