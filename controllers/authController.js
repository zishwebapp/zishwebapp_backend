import { getAll } from "../services/sheetService.js";

/**
 * POST /api/auth/login - Simple login (no password hashing)
 * Checks if user exists in Google Sheets Users table
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required"
      });
    }

    console.log(`Login attempt for username: ${username}`);

    // Get all users from Google Sheets
    const users = await getAll("users");
    
    if (!users || users.length === 0) {
      return res.status(500).json({
        success: false,
        message: "No users found in database. Please create users first."
      });
    }

    // Find user by email or name (case-insensitive)
    const user = users.find(u => 
      u.email?.toLowerCase() === username.toLowerCase() || 
      u.name?.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    // Simple password check (no hashing - as requested "no auth needed")
    // In production, you should use bcrypt or similar
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    console.log(`✅ Login successful for user: ${user.name}`);

    // Generate simple token (just base64 encoded user ID for session tracking)
    const token = Buffer.from(user.id).toString('base64');

    // Return user data (exclude password)
    return res.json({
      success: true,
      message: "Login successful",
      data: {
        token: token,
        user: {
          id: user.id,
          name: user.name,
          username: user.name, // Add username field for frontend compatibility
          email: user.email,
          role: user.role || 'admin', // Default to admin if not set
          created_at: user.created_at
        }
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
}

/**
 * POST /api/auth/register - Simple user registration
 * Creates a new user in Google Sheets Users table
 */
export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }

    console.log(`Registration attempt for email: ${email}`);

    // Check if user already exists
    const users = await getAll("users");
    const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    // Create new user
    const { create } = await import("../services/sheetService.js");
    
    const newUser = {
      id: `USER-${Date.now()}`,
      name: name,
      email: email,
      password: password, // Storing plaintext as requested (no auth needed)
      role: role || 'admin', // Default to admin if not provided
      created_at: new Date().toISOString()
    };

    await create("users", newUser);

    console.log(`✅ User registered successfully: ${newUser.name} (${newUser.role})`);

    // Generate token
    const token = Buffer.from(newUser.id).toString('base64');

    // Return user data (exclude password)
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        token: token,
        user: {
          id: newUser.id,
          name: newUser.name,
          username: newUser.name,
          email: newUser.email,
          role: newUser.role,
          created_at: newUser.created_at
        }
      }
    });

  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  }
}

/**
 * GET /api/auth/me - Get current user info (if token provided)
 */
export async function getCurrentUser(req, res) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Decode simple token to get user ID
    const userId = Buffer.from(token, 'base64').toString('utf-8');

    // Get user from Google Sheets
    const { getById } = await import("../services/sheetService.js");
    const userResult = await getById("users", userId);

    if (!userResult) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Return user data (exclude password)
    return res.json({
      success: true,
      data: {
        id: userResult.data.id,
        name: userResult.data.name,
        username: userResult.data.name,
        email: userResult.data.email,
        role: userResult.data.role || 'admin',
        created_at: userResult.data.created_at
      }
    });

  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user info",
      error: error.message
    });
  }
}
