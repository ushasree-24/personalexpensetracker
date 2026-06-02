const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');
const ai = require('./ai');
const auth = require('./auth');

const app = express();

// Configure CORS and JSON Body Parser
app.use(cors());
app.use(express.json());

// Initialize database connection asynchronously on startup
db.connectDb().catch(err => {
  console.error("Database connection failed on application startup:", err.message);
});

// ==================== SYSTEM STATUS ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    name: "Aura Finance API",
    version: "1.0.0",
    status: "active"
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: "ok",
    database: db.isFallback() ? "JSON File Fallback" : "MongoDB Live",
    time: new Date()
  });
});

// ==================== AUTHENTICATION ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, income } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required fields." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "This email is already registered." });
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await db.createUser({
      username,
      email,
      password: passwordHash,
      income: income ? parseFloat(income) : 50000 // default budget context
    });

    res.status(201).json({
      success: true,
      message: "User account created successfully! Please sign in."
    });
  } catch (err) {
    console.error("Registration route error:", err.message);
    res.status(500).json({ error: "Registration failed", message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required fields." });
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Invalid login credentials. Email not found." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid login credentials. Incorrect password." });
    }

    // Generate JWT token
    const token = auth.generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        email: user.email,
        income: user.income
      }
    });
  } catch (err) {
    console.error("Login route error:", err.message);
    res.status(500).json({ error: "Authentication failed", message: err.message });
  }
});

// ==================== PROTECTED ROUTES ====================

// Profile income configuration
app.put('/api/profile/income', auth.authMiddleware, async (req, res) => {
  try {
    const { income } = req.body;
    if (income === undefined || isNaN(income) || parseFloat(income) < 0) {
      return res.status(400).json({ error: "Income must be a positive number." });
    }
    const updated = await db.updateUserIncome(req.user.userId, income);
    if (!updated) {
      return res.status(404).json({ error: "User profile not found." });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update income profile", message: err.message });
  }
});

// Fetch all expenses
app.get('/api/expenses', auth.authMiddleware, async (req, res) => {
  try {
    const list = await db.getExpenses(req.user.userId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve expenses", message: err.message });
  }
});

// Add new expense
app.post('/api/expenses', auth.authMiddleware, async (req, res) => {
  try {
    const { amount, category, title, description, date, paymentMethod, notes } = req.body;
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }

    const transactionTitle = title || description || "Expense";

    const newExp = await db.addExpense(req.user.userId, {
      amount,
      category,
      title: transactionTitle,
      date,
      paymentMethod,
      notes
    });
    res.status(201).json(newExp);
  } catch (err) {
    res.status(500).json({ error: "Failed to save expense", message: err.message });
  }
});

// Update single expense
app.put('/api/expenses/:id', auth.authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, title, description, date, paymentMethod, notes } = req.body;
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }

    const transactionTitle = title || description || "Expense";

    const updated = await db.updateExpense(req.user.userId, id, {
      amount,
      category,
      title: transactionTitle,
      date,
      paymentMethod,
      notes
    });

    if (!updated) {
      return res.status(404).json({ error: "Expense not found or unauthorized access" });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update expense", message: err.message });
  }
});

// Delete expense
app.delete('/api/expenses/:id', auth.authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await db.deleteExpense(req.user.userId, id);
    if (!success) {
      return res.status(404).json({ error: "Expense not found or unauthorized access" });
    }
    res.json({ success: true, message: "Expense deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete expense", message: err.message });
  }
});

// Fetch all budgets
app.get('/api/budgets', auth.authMiddleware, async (req, res) => {
  try {
    const budgets = await db.getBudgets(req.user.userId);
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve budgets", message: err.message });
  }
});

// Update category budget limit
app.put('/api/budgets', auth.authMiddleware, async (req, res) => {
  try {
    const { category, limit_amount } = req.body;
    if (!category) {
      return res.status(400).json({ error: "Category name is required" });
    }
    if (limit_amount === undefined || isNaN(limit_amount) || parseFloat(limit_amount) < 0) {
      return res.status(400).json({ error: "Limit amount must be a positive number" });
    }
    const updated = await db.updateBudget(req.user.userId, category, limit_amount);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update budget", message: err.message });
  }
});

// Quick-add parse route
app.post('/api/ai/parse', auth.authMiddleware, async (req, res) => {
  try {
    const { text, apiKey } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Text prompt is required" });
    }
    const parsedData = await ai.parseExpenseText(text, apiKey);
    res.json(parsedData);
  } catch (err) {
    res.status(500).json({ error: "AI Parsing failed", message: err.message });
  }
});

// Aura coach chat route
app.post('/api/ai/chat', auth.authMiddleware, async (req, res) => {
  try {
    const { message, history, income, apiKey } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const userId = req.user.userId;
    const expenses = await db.getExpenses(userId);
    const budgets = await db.getBudgets(userId);
    const dbState = {
      expenses,
      budgets,
      income: income || 50000
    };

    const reply = await ai.chatWithCoach(history || [], message, dbState, apiKey);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: "AI Chat failed", message: err.message });
  }
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Aura Finance API running on port ${PORT}`);
});

module.exports = app;
