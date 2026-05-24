# IntellMeet Backend

Real-time meeting and collaboration backend built using Node.js, Express.js, MongoDB, Socket.io, Redis, and WebRTC signaling. This backend provides secure authentication, profile management, meeting APIs, and real-time communication features for the IntellMeet platform.

---

# 📁 Project Structure

```bash
backend/
├── config/
│   ├── db.js
│   └── cloudinary.js
│   └── redis.js
│
├── controllers/
│   ├── authController.js
│   └── meetingController.js
│   └── chatController.js
│
├── middleware/
│   └── authMiddleware.js
│
├── models/
│   ├── User.js
│   └── Meeting.js
│   └── Chat.js
│  
├── routes/
│   ├── authRoutes.js
│   └── meetingRoutes.js
│   └── chatRoutes.js
│
├── utils/
│   └──generateToken.js
│
├── server.js
├── package.json
├── .env
└── README.md
```

---

# 🚀 Features

## 🔐 Authentication
- User Signup
- User Login
- JWT Authentication
- Refresh Tokens
- Password Hashing using bcrypt
- Protected Routes Middleware

---

## 👤 Profile Management
- User Profile Creation
- Avatar Upload using Cloudinary
- Update Bio and Phone
- Get User Profile API
- Update Profile API

---

## 🛡️ Security Features
- JWT Token Verification
- Protected APIs
- Rate Limiting using express-rate-limit
- Environment Variable Configuration

---

## 📹 Meeting Features
- Meeting Model
- Meeting CRUD APIs
- Initial WebRTC Peer Connection Logic

---

## ⚡ Real-Time Features
- Socket.io Server Setup
- Real-Time Chat
- Real-Time Notifications
- Redis Setup for Caching and Sessions

---

# 🛠️ Tech Stack

## Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs
- Cloudinary
- Multer
- Socket.io
- Redis
- Express Rate Limit

---

# ⚙️ Environment Variables

Create a `.env` file inside the backend folder.

```env
PORT=5000

MONGO_URI=mongodb://127.0.0.1:27017/intellmeet

JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

# 📦 Installation

## Install Dependencies

```bash
npm install
```

---

# ▶️ Run Backend Server

```bash
npm run dev
```

---

# 🔐 Authentication APIs

## Signup

```http
POST /api/auth/signup
```

## Login

```http
POST /api/auth/login
```

## Get Profile

```http
GET /api/auth/profile
```

## Update Profile

```http
PUT /api/auth/profile
```

---

# 📹 Meeting APIs

## Create Meeting

```http
POST /api/meetings
```

## Get Meetings

```http
GET /api/meetings
```

---

# 🧪 API Testing

Tested using Postman:
- Signup/Login APIs
- JWT Authentication
- Protected Routes
- Profile APIs
- Avatar Upload
- Meeting APIs

---

# ✅ Completed Backend Tasks

- Project setup completed
- MongoDB connection configured
- Authentication system implemented
- JWT & Refresh Tokens added
- Password hashing using bcrypt
- Cloudinary avatar upload completed
- Protected routes middleware completed
- Rate limiting implemented
- Meeting CRUD APIs created
- Socket.io configured
- Basic real-time chat implemented
- Redis setup completed


# 👨‍💻 Developer

Aeni Patel
