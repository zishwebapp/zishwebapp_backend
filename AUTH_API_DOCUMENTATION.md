# Authentication API Documentation

## 🎉 Implementation Complete!

A simple authentication system has been created for the Google Sheets backend.

---

## 🔒 Security Note

**⚠️ This is a SIMPLIFIED authentication system as requested ("no auth needed"):**
- Passwords stored in **plaintext** in Google Sheets
- Simple token (base64 encoded user ID)
- **NOT suitable for production** without proper security measures

**For Production, you should add:**
- Password hashing (bcrypt)
- JWT tokens with expiry
- HTTPS only
- Rate limiting
- Session management

---

## 📋 API Endpoints

Base URL: `http://localhost:3000/api`

### **1. Login**
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "username": "user@example.com",  // Can be email or name
  "password": "your_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "VVNFUi0xNzMzNjUxMjM0NTY3",
    "user": {
      "id": "USER-1733651234567",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-12-08T10:00:00.000Z"
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid username or password"
}
```

---

### **2. Register**
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "your_password"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "token": "VVNFUi0xNzMzNjUxMjM0NTY3",
    "user": {
      "id": "USER-1733651234567",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-12-08T10:00:00.000Z"
    }
  }
}
```

**Error Response (409):**
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```

---

### **3. Get Current User**
**GET** `/api/auth/me`

**Headers:**
```
Authorization: Bearer VVNFUi0xNzMzNjUxMjM0NTY3
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "USER-1733651234567",
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-12-08T10:00:00.000Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "No token provided"
}
```

---

## 📊 Google Sheets Structure

### **Q4_2025_Users Table**

| User ID | Full Name | Email Address | Password Hash | Registration Date |
|---------|-----------|---------------|---------------|-------------------|
| USER-123 | John Doe | john@example.com | password123 | 2024-12-08T10:00:00Z |

**Columns:**
- `id` - Unique user ID (USER-timestamp format)
- `name` - User's full name
- `email` - User's email address (unique)
- `password` - Password (plaintext for now)
- `created_at` - Registration timestamp

---

## 🔄 Authentication Flow

### **Login Flow:**
```
1. User enters username/email + password
   ↓
2. Frontend calls POST /api/auth/login
   ↓
3. Backend checks Q4_2025_Users sheet
   ↓
4. User found? Check password
   ↓
5. Generate token (base64 of user ID)
   ↓
6. Return token + user data
   ↓
7. Frontend stores token in localStorage/sessionStorage
```

### **Protected Request Flow:**
```
1. Frontend includes token in Authorization header
   ↓
2. Backend receives request with token
   ↓
3. Decode token to get user ID
   ↓
4. Look up user in Google Sheets
   ↓
5. Return user data or 401 if invalid
```

---

## 🧪 Testing

### **Test 1: Register a New User**

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123"
  }'
```

**Expected:**
- ✅ User created in `Q4_2025_Users` sheet
- ✅ Returns token and user data
- ✅ Token stored in frontend

**Verify in Google Sheets:**
- Go to `Q4_2025_Users` tab
- Find row with email "test@example.com"

---

### **Test 2: Login**

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test@example.com",
    "password": "test123"
  }'
```

**Expected:**
- ✅ Returns same user data and token
- ✅ Can login with email OR name

---

### **Test 3: Get Current User**

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer VVNFUi0xNzMzNjUxMjM0NTY3"
```
*(Use actual token from login response)*

**Expected:**
- ✅ Returns user data
- ✅ No password in response

---

### **Test 4: Frontend Login**

1. Open frontend login page
2. Enter credentials:
   - Username: `test@example.com`
   - Password: `test123`
3. Click Login
4. ✅ Should redirect to dashboard/home
5. ✅ Token stored in browser storage

---

## 📝 Frontend Integration

### **Login Function:**
```typescript
import { login } from '@/lib/auth-api';

async function handleLogin(username: string, password: string) {
  try {
    const user = await login(username, password);
    console.log('Logged in user:', user);
    // Redirect to dashboard
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}
```

### **Register Function:**
```typescript
import { register } from '@/lib/auth-api';

async function handleRegister(name: string, email: string, password: string) {
  try {
    const user = await register(name, email, password);
    console.log('Registered user:', user);
    // Redirect to dashboard
  } catch (error) {
    console.error('Registration failed:', error.message);
  }
}
```

### **Get Current User:**
```typescript
import { getCurrentUser } from '@/lib/auth-api';

async function loadUserProfile() {
  try {
    const user = await getCurrentUser();
    console.log('Current user:', user);
  } catch (error) {
    console.error('Not logged in:', error.message);
  }
}
```

### **Logout:**
```typescript
import { logout } from '@/lib/auth-api';

function handleLogout() {
  logout(); // Clears tokens from storage
  // Redirect to login page
}
```

---

## 🔍 Validation Rules

### **Login:**
- ✅ Username required (email or name)
- ✅ Password required
- ✅ Case-insensitive username matching

### **Register:**
- ✅ Name required
- ✅ Email required and must be unique
- ✅ Password required
- ✅ Email format validated

---

## 🐛 Common Errors

### **"No users found in database"**
**Solution:**
- Run `/api/test-sheets` to create quarterly tabs
- Manually add a user to `Q4_2025_Users` sheet
- Or use register endpoint

### **"User with this email already exists"**
**Solution:**
- User already registered
- Use login instead
- Or use different email

### **"Invalid username or password"**
**Solution:**
- Check spelling
- Username can be email OR name
- Password is case-sensitive

### **"No token provided"**
**Solution:**
- User not logged in
- Token expired/cleared
- Login again

---

## 📊 Token Format

**Simple Token Structure:**
```
Original: USER-1733651234567
Encoded:  VVNFUi0xNzMzNjUxMjM0NTY3 (base64)
```

**Decoding:**
```javascript
const userId = Buffer.from(token, 'base64').toString('utf-8');
// Result: "USER-1733651234567"
```

---

## ✅ Features Implemented

- ✅ User registration with duplicate email check
- ✅ Login with email or username
- ✅ Simple token generation
- ✅ Token storage in browser
- ✅ Get current user endpoint
- ✅ Password verification
- ✅ User data in Google Sheets
- ✅ Frontend integration complete

---

## 🚀 What's Next?

### **For Production:**
1. **Add Password Hashing:**
   ```bash
   npm install bcrypt
   ```
   Use `bcrypt.hash()` to hash passwords

2. **Use JWT Tokens:**
   ```bash
   npm install jsonwebtoken
   ```
   Create proper JWT with expiry

3. **Add Middleware:**
   - Create auth middleware to protect routes
   - Validate token on each request

4. **Rate Limiting:**
   - Prevent brute force attacks
   - Limit login attempts

5. **HTTPS Only:**
   - Force HTTPS in production
   - Secure cookie flags

---

## 📖 Related Documentation

- **Orders API**: `ORDERS_API_TESTING.md`
- **Frontend Integration**: `FRONTEND_API_INTEGRATION_COMPLETE.md`
- **Quick Test Guide**: `QUICK_TEST_GUIDE.md`

---

**🎉 Authentication system is ready for testing!**
