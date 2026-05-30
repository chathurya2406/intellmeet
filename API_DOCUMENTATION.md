# IntelliMeet Backend API Documentation

Complete reference for all IntelliMeet backend endpoints. All timestamps are ISO 8601 format (UTC).

---

## **BASE URL**

```
Development:  http://localhost:5000
Production:   https://api.intellmeet.example.com
```

---

## **AUTHENTICATION**

All endpoints except `/health`, `/`, and unauthenticated auth endpoints require a Bearer token:

```
Authorization: Bearer <ACCESS_TOKEN>
```

The access token is obtained from login/signup endpoints and lasts 15 minutes. Use the refresh endpoint to get a new token.

### **Authentication & User Management**

#### **POST** `/api/auth/signup`
Register a new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response:** `201 Created`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Validation:**
- `name`: 2-100 characters, required
- `email`: Valid email format, unique, required
- `password`: Minimum 8 characters, required

**Errors:**
- `400` - Invalid input or missing required fields
- `409` - Email already registered

---

#### **POST** `/api/auth/login`
Authenticate with email and password.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Cookies:** Sets `intellmeet_refresh` (httpOnly, secure, sameSite=strict)

**Errors:**
- `400` - Missing credentials
- `401` - Invalid credentials

---

#### **POST** `/api/auth/refresh`
Get a new access token using the refresh token cookie.

**Request:** No body required (uses httpOnly cookie)

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Cookies:** Updates `intellmeet_refresh` with new rotated token

**Errors:**
- `401` - Refresh token missing, invalid, or expired

---

#### **POST** `/api/auth/logout`
Logout current session (single session only).

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully."
}
```

**Effects:**
- Clears refresh token cookie
- Invalidates current refresh token
- Access token remains valid until expiry (frontend should discard)

---

#### **POST** `/api/auth/logout-all`
Logout all active sessions for this user.

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "message": "All sessions invalidated."
}
```

**Effects:**
- Clears refresh token cookie
- Increments token version, invalidating all outstanding refresh tokens
- All existing access tokens become invalid after they expire

---

#### **GET** `/api/auth/profile`
Retrieve authenticated user's profile.

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "avatar": "https://example.com/avatar.jpg",
    "lastLogin": "2026-05-30T14:22:10.000Z",
    "emailVerified": true,
    "createdAt": "2026-05-28T10:15:00.000Z",
    "updatedAt": "2026-05-30T14:22:10.000Z"
  }
}
```

**Errors:**
- `401` - Unauthorized (invalid/missing token)
- `404` - User not found

---

#### **PUT** `/api/auth/profile`
Update user profile (name, avatar).

**Authentication:** Required ✅

**Request:**
```json
{
  "name": "John Smith",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Smith",
    "email": "john@example.com",
    "role": "user",
    "avatar": "https://example.com/new-avatar.jpg",
    "updatedAt": "2026-05-30T14:30:00.000Z"
  }
}
```

**Validation:**
- `name`: 2-100 characters (optional)
- `avatar`: Valid URL string, max 2048 characters (optional)

**Errors:**
- `400` - Invalid input or no valid fields provided
- `401` - Unauthorized

---

#### **PUT** `/api/auth/change-password`
Change user password (requires current password verification).

**Authentication:** Required ✅

**Request:**
```json
{
  "currentPassword": "SecurePassword123",
  "newPassword": "NewPassword456"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password updated successfully. Please log in again."
}
```

**Effects:**
- Hashes password with 12 bcrypt rounds
- Invalidates all user sessions (forces re-login)
- Clears refresh token cookie

**Validation:**
- `newPassword`: Minimum 8 characters

**Errors:**
- `400` - Missing fields or invalid password length
- `401` - Current password incorrect
- `404` - User not found

---

#### **POST** `/api/auth/forgot-password`
Request a password reset token (sent via email in production).

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Email Subject:** (In production)
```
Password Reset Request - IntelliMeet
```

**Email Link:** 
```
https://intellmeet.example.com/reset-password?token=<TOKEN>&email=<EMAIL>
```

**Token Validity:** 1 hour from request

**Security Note:** Response is generic (doesn't reveal if email exists)

---

#### **POST** `/api/auth/reset-password`
Reset password using reset token from email link.

**Request:**
```json
{
  "email": "john@example.com",
  "token": "abc123def456...",
  "newPassword": "NewPassword789"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password reset successfully. Please log in with your new password."
}
```

**Effects:**
- Updates password with bcrypt hash
- Invalidates all user sessions
- Clears reset token from database
- Clears refresh token cookie

**Validation:**
- Token must be valid and not expired (1 hour)
- `newPassword`: Minimum 8 characters

**Errors:**
- `400` - Invalid/expired token or invalid password
- `400` - Email not found or no reset token

---

#### **POST** `/api/auth/send-verification-email`
Send email verification link to authenticated user.

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "message": "Verification email sent."
}
```

**Email Subject:** (In production)
```
Verify Your Email Address - IntelliMeet
```

**Email Link:**
```
https://intellmeet.example.com/verify-email?token=<TOKEN>&email=<EMAIL>
```

**Token Validity:** 24 hours from request

**Effects:**
- Generates secure random token
- Stores bcrypt hash + expiration in database

---

#### **POST** `/api/auth/verify-email`
Verify email address using token from verification email.

**Request:**
```json
{
  "email": "john@example.com",
  "token": "xyz789uvw012..."
}
```

**Response:** `200 OK`
```json
{
  "message": "Email verified successfully.",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true
  }
}
```

**Effects:**
- Sets `emailVerified: true` on user
- Clears verification token from database
- Available for automated workflows

**Validation:**
- Token must be valid and not expired (24 hours)

**Errors:**
- `400` - Invalid/expired token

---

#### **DELETE** `/api/auth/profile`
Permanently delete user account.

**Authentication:** Required ✅

**Request:**
```json
{
  "password": "SecurePassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Account deleted successfully."
}
```

**Effects:**
- Deletes user record from database
- Clears all refresh tokens
- Invalidates all sessions
- All user data is permanently removed

**Validation:**
- `password`: Must match current password

**Security:**
- Requires password confirmation
- Logged to audit trail

**Errors:**
- `400` - Password not provided
- `401` - Invalid password
- `404` - User not found

---

## **MEETINGS**

All meeting endpoints require authentication.

### **Meeting Management**

#### **POST** `/api/meetings/:meetingId/start`
Create or join a meeting.

**Authentication:** Required ✅

**URL Parameters:**
- `:meetingId` - Unique meeting identifier (string, 6+ characters)

**Request Body:** (optional)
```json
{}
```

**Response:** `200 OK` / `201 Created`
```json
{
  "meeting": {
    "meetingId": "abc123",
    "status": "active",
    "startTime": "2026-05-30T14:25:00.000Z",
    "endTime": null,
    "durationSeconds": null,
    "participants": ["John Doe", "Jane Smith"],
    "participantIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
    "peakParticipantCount": 2,
    "createdBy": "507f1f77bcf86cd799439011",
    "actionItems": [],
    "aiSummary": null,
    "recordingMetadata": null,
    "createdAt": "2026-05-30T14:25:00.000Z",
    "updatedAt": "2026-05-30T14:25:10.000Z"
  }
}
```

**Behavior:**
- Creates new meeting if doesn't exist
- Adds user to participants if not already present
- Updates `peakParticipantCount` if this brings count higher
- Returns existing meeting if already active
- Can restart an ended meeting

---

#### **GET** `/api/meetings/:meetingId`
Retrieve meeting details with chat history.

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "meeting": {
    "meetingId": "abc123",
    "status": "active",
    "startTime": "2026-05-30T14:25:00.000Z",
    "endTime": null,
    "durationSeconds": null,
    "participants": ["John Doe", "Jane Smith"],
    "participantIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
    "peakParticipantCount": 2,
    "createdBy": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2026-05-30T14:25:00.000Z",
    "updatedAt": "2026-05-30T14:30:00.000Z"
  },
  "messages": [
    {
      "_id": "607f1f77bcf86cd799439021",
      "meetingId": "abc123",
      "sender": "John Doe",
      "userId": "507f1f77bcf86cd799439011",
      "text": "Hello everyone!",
      "createdAt": "2026-05-30T14:26:00.000Z",
      "updatedAt": "2026-05-30T14:26:00.000Z"
    }
  ]
}
```

**Query Parameters:**
- None

**Features:**
- Returns up to 200 most recent messages
- Messages in chronological order
- Includes full meeting details and creator info

**Errors:**
- `401` - Unauthorized
- `404` - Meeting not found

---

#### **GET** `/api/meetings`
List user's meetings (paginated).

**Authentication:** Required ✅

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page, max 50 (default: 10)
- `status` - Filter by status: "active" or "ended" (optional)

**Response:** `200 OK`
```json
{
  "meetings": [
    {
      "meetingId": "abc123",
      "status": "ended",
      "startTime": "2026-05-30T12:00:00.000Z",
      "endTime": "2026-05-30T12:45:00.000Z",
      "durationSeconds": 2700,
      "participants": ["John Doe", "Jane Smith"],
      "participantIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
      "peakParticipantCount": 2,
      "createdAt": "2026-05-30T12:00:00.000Z",
      "updatedAt": "2026-05-30T12:45:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

**Features:**
- Returns meetings created by authenticated user
- Sorted by creation date (newest first)
- Excludes sensitive fields (actionItems, aiSummary, recordingMetadata)

---

#### **POST** `/api/meetings/:meetingId/end`
End an active meeting.

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "meeting": {
    "meetingId": "abc123",
    "status": "ended",
    "startTime": "2026-05-30T14:25:00.000Z",
    "endTime": "2026-05-30T14:45:00.000Z",
    "durationSeconds": 1200,
    "participants": ["John Doe", "Jane Smith"],
    "peakParticipantCount": 2,
    "createdAt": "2026-05-30T14:25:00.000Z",
    "updatedAt": "2026-05-30T14:45:00.000Z"
  },
  "message": "Meeting ended successfully."
}
```

**Effects:**
- Sets status to "ended"
- Records end time
- Calculates duration in seconds
- Updates last modified timestamp

**Behavior:**
- Returns existing end time if meeting already ended (idempotent)
- Auto-triggered when last participant leaves (Socket.io)

**Errors:**
- `401` - Unauthorized
- `404` - Meeting not found

---

#### **GET** `/api/meetings/:meetingId/analytics`
Retrieve meeting statistics and analytics.

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "analytics": {
    "meetingId": "abc123",
    "status": "ended",
    "startTime": "2026-05-30T14:25:00.000Z",
    "endTime": "2026-05-30T14:45:00.000Z",
    "durationSeconds": 1200,
    "durationFormatted": "20m",
    "participantCount": 2,
    "peakParticipantCount": 2,
    "participants": ["John Doe", "Jane Smith"],
    "messageCount": 45,
    "hasAiSummary": true,
    "actionItemCount": 3,
    "completedActionItems": 1,
    "hasRecording": true
  }
}
```

**Features:**
- Human-readable duration format
- Message count in meeting
- Action item tracking
- Recording availability indicator

---

### **AI & Meeting Features**

#### **POST** `/api/meetings/:meetingId/ai-summary`
Save AI-generated meeting summary and extract action items.

**Authentication:** Required ✅

**Request:**
```json
{
  "summary": "Discussed Q2 roadmap. Team agreed on new feature priorities and timeline.",
  "actionItems": [
    {
      "text": "Design mockups for feature X",
      "assignedTo": "Jane Smith",
      "dueDate": "2026-06-06"
    },
    {
      "text": "Research API integration",
      "assignedTo": "John Doe",
      "dueDate": "2026-06-13"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "message": "AI summary saved.",
  "aiSummary": "Discussed Q2 roadmap. Team agreed on new feature priorities and timeline.",
  "actionItems": [
    {
      "_id": "707f1f77bcf86cd799439031",
      "text": "Design mockups for feature X",
      "assignedTo": "Jane Smith",
      "completed": false,
      "dueDate": "2026-06-06T00:00:00.000Z"
    },
    {
      "_id": "707f1f77bcf86cd799439032",
      "text": "Research API integration",
      "assignedTo": "John Doe",
      "completed": false,
      "dueDate": "2026-06-13T00:00:00.000Z"
    }
  ]
}
```

**Validation:**
- `summary`: Non-empty string, required
- `actionItems`: Array of objects (optional)
  - `text`: Non-empty string, 1-500 characters
  - `assignedTo`: String (optional)
  - `dueDate`: ISO 8601 date (optional)

**Errors:**
- `400` - Invalid summary or action items
- `404` - Meeting not found

---

#### **PATCH** `/api/meetings/:meetingId/action-items/:itemId`
Update action item status, assignee, or due date.

**Authentication:** Required ✅

**URL Parameters:**
- `:meetingId` - Meeting identifier
- `:itemId` - Action item ID from AI summary

**Request:**
```json
{
  "completed": true,
  "assignedTo": "John Smith",
  "dueDate": "2026-06-20"
}
```

**Response:** `200 OK`
```json
{
  "actionItem": {
    "_id": "707f1f77bcf86cd799439031",
    "text": "Design mockups for feature X",
    "assignedTo": "John Smith",
    "completed": true,
    "dueDate": "2026-06-20T00:00:00.000Z"
  }
}
```

**Partial Updates:** Any field is optional

**Errors:**
- `404` - Meeting or action item not found

---

#### **DELETE** `/api/meetings/:meetingId/action-items/:itemId`
Delete an action item.

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "message": "Action item deleted successfully."
}
```

**Errors:**
- `404` - Meeting or action item not found

---

#### **POST** `/api/meetings/:meetingId/recording`
Save meeting recording metadata (URL, duration, size, format).

**Authentication:** Required ✅

**Request:**
```json
{
  "url": "https://storage.example.com/recordings/abc123.mp4",
  "durationSeconds": 1200,
  "sizeBytes": 524288000,
  "format": "mp4"
}
```

**Response:** `200 OK`
```json
{
  "message": "Recording metadata saved.",
  "recordingMetadata": {
    "url": "https://storage.example.com/recordings/abc123.mp4",
    "durationSeconds": 1200,
    "sizeBytes": 524288000,
    "format": "mp4",
    "recordedAt": "2026-05-30T14:45:00.000Z"
  }
}
```

**Validation:**
- `url`: Valid URL string, required

**Fields Optional:**
- `durationSeconds`, `sizeBytes`, `format`

**Errors:**
- `400` - Missing or invalid URL
- `404` - Meeting not found

---

## **CHAT MESSAGES**

### **Direct Message Endpoints**

All message endpoints require authentication.

#### **POST** `/api/messages/:meetingId`
Create a chat message in a meeting.

**Authentication:** Required ✅

**Request:**
```json
{
  "text": "This is a great discussion point!"
}
```

**Response:** `201 Created`
```json
{
  "message": "Message sent successfully.",
  "data": {
    "_id": "807f1f77bcf86cd799439041",
    "meetingId": "abc123",
    "sender": "John Doe",
    "userId": "507f1f77bcf86cd799439011",
    "text": "This is a great discussion point!",
    "createdAt": "2026-05-30T14:35:00.000Z",
    "updatedAt": "2026-05-30T14:35:00.000Z"
  }
}
```

**Validation:**
- `text`: Non-empty string, 1-2000 characters
- `meetingId`: Must be valid existing meeting

**Errors:**
- `400` - Invalid text or missing fields
- `404` - Meeting not found

---

#### **GET** `/api/messages/:meetingId`
Retrieve chat messages with pagination.

**Authentication:** Required ✅

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page, max 100 (default: 50)

**Response:** `200 OK`
```json
{
  "meetingId": "abc123",
  "messages": [
    {
      "_id": "807f1f77bcf86cd799439041",
      "meetingId": "abc123",
      "sender": "John Doe",
      "userId": "507f1f77bcf86cd799439011",
      "text": "This is a great discussion point!",
      "createdAt": "2026-05-30T14:35:00.000Z",
      "updatedAt": "2026-05-30T14:35:00.000Z"
    },
    {
      "_id": "807f1f77bcf86cd799439042",
      "meetingId": "abc123",
      "sender": "Jane Smith",
      "userId": "507f1f77bcf86cd799439012",
      "text": "I completely agree!",
      "createdAt": "2026-05-30T14:36:00.000Z",
      "updatedAt": "2026-05-30T14:36:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 127,
    "pages": 3
  }
}
```

**Features:**
- Messages in chronological order (oldest first)
- Full pagination support
- Returns in reverse order from DB, then reversed for display

**Errors:**
- `404` - Meeting not found

---

#### **DELETE** `/api/messages/:messageId`
Delete a chat message (only sender can delete).

**Authentication:** Required ✅

**Response:** `200 OK`
```json
{
  "message": "Message deleted successfully."
}
```

**Authorization:**
- User must be the message sender
- Admin role cannot delete others' messages

**Errors:**
- `403` - Not the message sender
- `404` - Message not found

---

## **REAL-TIME COMMUNICATION (Socket.io)**

All Socket.io connections require JWT authentication via `token` query parameter or `Authorization` header.

### **Connection Events**

#### **Connection Authentication**
```javascript
// Client connects with token
const socket = io(BACKEND_URL, {
  transports: ["websocket"],
  auth: {
    token: "Bearer " + accessToken
  }
});
```

**Server validates token before allowing connection**

---

### **Room Events**

#### **join-room**
Join a meeting room (emits participant list + chat history to joining user).

**Emitted by Client:**
```javascript
socket.emit("join-room", meetingId);
// OR
socket.emit("join-room", { meetingId: "abc123" });
```

**Server Responses:**

1. **chat-history** - Broadcast to joining user
```javascript
socket.on("chat-history", (messages) => {
  // Array of last 200 messages
  console.log(messages);
});
```

2. **meeting-info** - Send participant list
```javascript
socket.on("meeting-info", (data) => {
  console.log(data.participants); // ["John Doe", "Jane Smith"]
  console.log(data.startTime);    // "2026-05-30T14:25:00.000Z"
});
```

3. **user-joined** - Broadcast to other users in room
```javascript
socket.on("user-joined", (data) => {
  console.log(data.name);     // "John Doe"
  console.log(data.userId);   // "507f1f77bcf86cd799439011"
});
```

---

#### **chat-message**
Send a real-time chat message.

**Emitted by Client:**
```javascript
socket.emit("chat-message", {
  meetingId: "abc123",
  text: "Hello everyone!"
});
```

**Server Response:** Broadcast to all users in meeting
```javascript
socket.on("chat-message", (message) => {
  console.log(message.sender);   // "John Doe"
  console.log(message.text);     // "Hello everyone!"
  console.log(message.userId);   // "507f1f77bcf86cd799439011"
  console.log(message.createdAt); // "2026-05-30T14:26:00.000Z"
});
```

**Message Persistence:** Automatically saved to MongoDB

---

### **WebRTC Signaling**

Server acts as signaling relay only. Clients handle peer-to-peer connections.

#### **webrtc-offer**
Send WebRTC offer to specific peer.

**Emitted by Client:**
```javascript
socket.emit("webrtc-offer", {
  targetSocketId: "socket-id-of-peer",
  offer: rtcSessionDescription
});
```

**Server Relays to Target:**
```javascript
socket.on("webrtc-offer", (data) => {
  console.log(data.offer);          // RTCSessionDescription
  console.log(data.fromSocketId);   // Socket ID of sender
  console.log(data.fromUser.name);  // "John Doe"
});
```

---

#### **webrtc-answer**
Send WebRTC answer to peer.

**Emitted by Client:**
```javascript
socket.emit("webrtc-answer", {
  targetSocketId: "socket-id-of-peer",
  answer: rtcSessionDescription
});
```

**Server Relays to Target:**
```javascript
socket.on("webrtc-answer", (data) => {
  console.log(data.answer);        // RTCSessionDescription
  console.log(data.fromSocketId);  // Socket ID of sender
});
```

---

#### **webrtc-ice-candidate**
Send ICE candidate for connection establishment.

**Emitted by Client:**
```javascript
socket.emit("webrtc-ice-candidate", {
  targetSocketId: "socket-id-of-peer",
  candidate: iceCandidate
});
```

**Server Relays to Target:**
```javascript
socket.on("webrtc-ice-candidate", (data) => {
  console.log(data.candidate);    // RTCIceCandidate
  console.log(data.fromSocketId); // Socket ID of sender
});
```

---

### **Room Management**

#### **leave-room**
Leave a meeting room.

**Emitted by Client:**
```javascript
socket.emit("leave-room", { meetingId: "abc123" });
```

**Server Broadcasts to Other Users:**
```javascript
socket.on("user-left", (data) => {
  console.log(data.name);   // "John Doe"
  console.log(data.userId); // "507f1f77bcf86cd799439011"
});
```

**Auto-End Meeting:** If last user leaves, meeting auto-ends

---

#### **disconnect** / **disconnecting**
User disconnects from Socket.io.

**Server Behavior:**
```javascript
// On user disconnect
socket.on("disconnect", () => {
  // User has left all rooms
  // May trigger auto-end if last participant
});
```

**Client Reconnection:**
- Socket.io auto-reconnects with exponential backoff
- Re-join room and get chat history again

---

### **Error Events**

#### **error**
Receive error messages.

**Server Emits:**
```javascript
socket.on("error", (data) => {
  console.log(data.message); // Error message
});
```

**Common Errors:**
- `"Meeting ID is required to join."`
- `"Message text is required."`
- `"Unable to join room."`
- `"Unable to save chat message."`

---

## **UTILITY ENDPOINTS**

#### **GET** `/health`
Health check for Kubernetes probes (no authentication required).

**Response:** `200 OK` / `503 Service Unavailable`
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-05-30T14:40:00.000Z",
  "uptime": 3600
}
```

**Used By:**
- Kubernetes readiness probes
- Load balancers
- Monitoring systems

---

#### **GET** `/`
Server information and version (no authentication required).

**Response:** `200 OK`
```json
{
  "message": "IntellMeet Backend Running 🚀",
  "version": "1.0.0"
}
```

---

#### **GET** `/metrics`
Prometheus metrics (rate-limited to 30 req/min).

**Response:** `200 OK` (Prometheus text format)
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",path="/api/auth/login",status="200"} 1234

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005",method="GET",path="/health"} 450
```

**Features:**
- Request counters by method/path/status
- Response time histograms
- Active meetings gauge
- Active users gauge

**Scrape Interval:** Configured in Prometheus (default 15s)

---

## **ERROR RESPONSES**

All error responses follow this format:

```json
{
  "message": "Error description",
  "status": 400,
  "details": {} // Optional additional information
}
```

### **HTTP Status Codes**

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Success | GET request returned data |
| `201` | Created | User created, message sent |
| `400` | Bad Request | Invalid input or validation error |
| `401` | Unauthorized | Missing or invalid token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Email already registered |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Server Error | Unexpected server error |
| `503` | Service Unavailable | Database disconnected |

---

## **RATE LIMITS**

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login`, `/api/auth/signup` | 10 requests | 15 minutes |
| All `/api/*` endpoints | 100 requests | 15 minutes |
| `/metrics` | 30 requests | 1 minute |

**Headers Returned:**
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1685107200
```

---

## **CORS CONFIGURATION**

**Allowed Origins:** Configured via `FRONTEND_URL` environment variable

**Allowed Methods:** GET, POST, PUT, PATCH, DELETE, OPTIONS

**Allowed Headers:** Content-Type, Authorization

**Credentials:** Enabled (for httpOnly cookies)

---

## **SECURITY HEADERS**

All responses include:
```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

---

## **EXAMPLE WORKFLOWS**

### **Complete Authentication Flow**

```javascript
// 1. Sign up
const signupRes = await fetch("/api/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    name: "John Doe",
    email: "john@example.com",
    password: "SecurePassword123"
  })
});
const { token } = await signupRes.json();
localStorage.setItem("accessToken", token);

// 2. Use token for authenticated requests
const profileRes = await fetch("/api/auth/profile", {
  headers: { "Authorization": `Bearer ${token}` }
});

// 3. Token expires after 15 minutes
// Frontend automatically calls refresh endpoint

// 4. Refresh token (automatic via cookie)
const refreshRes = await fetch("/api/auth/refresh", {
  method: "POST",
  credentials: "include" // Includes refresh token cookie
});
const { token: newToken } = await refreshRes.json();
localStorage.setItem("accessToken", newToken);

// 5. Logout
await fetch("/api/auth/logout", {
  method: "POST",
  headers: { "Authorization": `Bearer ${token}` }
});
```

---

## **ENVIRONMENT VARIABLES**

Backend configuration:

```bash
# Server
NODE_ENV=production
PORT=5000

# Database
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/intellmeet

# Authentication
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-secret-key-min-32-chars
REFRESH_TOKEN_EXPIRES_IN=7d

# Frontend
FRONTEND_URL=https://intellmeet.example.com

# Optional: Error Tracking
SENTRY_DSN=https://key@sentry.io/123456

# Optional: Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@intellmeet.com
SMTP_PASS=app-password
```

---

## **VERSIONING**

**Current API Version:** 1.0.0

No API versioning prefix currently (e.g., `/v1/api/*`).

Future versions will use: `/api/v2/...`

---

## **CHANGELOG**

### **Phase 2 (May 30, 2026)**
- ✅ Added password reset flow (`/api/auth/forgot-password`, `/api/auth/reset-password`)
- ✅ Added email verification (`/api/auth/send-verification-email`, `/api/auth/verify-email`)
- ✅ Added profile deletion (`DELETE /api/auth/profile`)
- ✅ Added action item deletion (`DELETE /api/meetings/:meetingId/action-items/:itemId`)
- ✅ Added direct message endpoints (`/api/messages/:meetingId`, `DELETE /api/messages/:messageId`)
- ✅ Added comprehensive API documentation

---

**Last Updated:** May 30, 2026  
**Document Version:** 1.0  
**Status:** Complete and Production-Ready
