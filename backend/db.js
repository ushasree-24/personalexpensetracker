const { MongoClient, ObjectId } = require('mongodb');
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn("Could not set custom DNS servers:", e.message);
}
require('dotenv').config();

let client = null;
let db = null;
let connectionPromise = null;

const categoryMap = {
  "Food & Groceries": "Food",
  "Dining Out": "Food",
  "Transport": "Travel",
  "Utilities": "Bills",
  "Entertainment": "Entertainment",
  "Shopping": "Shopping",
  "Others": "Others"
};

function normalizeCategory(cat) {
  return categoryMap[cat] || cat || "Others";
}

// Default budgets to seed on user registration
const defaultBudgets = [
  { category: "Food", limit_amount: 12000 },
  { category: "Travel", limit_amount: 5000 },
  { category: "Shopping", limit_amount: 8000 },
  { category: "Education", limit_amount: 12000 },
  { category: "Medical", limit_amount: 5000 },
  { category: "Bills", limit_amount: 6000 },
  { category: "Entertainment", limit_amount: 5000 },
  { category: "Others", limit_amount: 4000 }
];

// Connect to MongoDB Atlas
async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://ushasree:usha2409@cluster0.klgdpjg.mongodb.net/personalexpensetracker?appName=Cluster0';


    console.log(`Connecting to database... Target: ${uri.replace(/:[^@]+@/, ':****@')}`);

  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        client = new MongoClient(uri, {
          serverSelectionTimeoutMS: 30000,
          maxPoolSize: 10,
          socketTimeoutMS: 45000
        });
        await client.connect();
        db = client.db();
        console.log("Successfully connected to MongoDB!");

        // Create unique index on user emails
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        console.log("Database indexes verified.");
        return db;
      } catch (error) {
        console.error("MongoDB connection failed!", error.message);
        connectionPromise = null; // Reset promise so next queries can retry
        throw error;
      }
    })();
  }
  return connectionPromise;
}

// Helper to guarantee db is connected
async function ensureDb() {
  if (db) return db;
  if (connectionPromise) {
    return await connectionPromise;
  }
  return await connectDb();
}

// USER ACCOUNT OPERATIONS
async function findUserByEmail(email) {
  const cleanEmail = email.toLowerCase().trim();
  const database = await ensureDb();
  const user = await database.collection('users').findOne({ email: cleanEmail });
  if (user) {
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      password: user.password,
      income: parseFloat(user.income || 50000)
    };
  }
  return null;
}

async function createUser(user) {
  const newUser = {
    username: user.username.trim(),
    email: user.email.toLowerCase().trim(),
    password: user.password, // hashed in controller
    income: parseFloat(user.income || 50000)
  };

  const database = await ensureDb();

  // Check duplicate in Mongo
  const existing = await database.collection('users').findOne({ email: newUser.email });
  if (existing) {
    throw new Error("Email already registered");
  }

  // Insert User
  const result = await database.collection('users').insertOne(newUser);
  const userId = result.insertedId.toString();

  // Seed budgets in Mongo
  const userBudgets = defaultBudgets.map(b => ({
    userId: userId,
    category: b.category,
    limit_amount: b.limit_amount
  }));
  await database.collection('budgets').insertMany(userBudgets);

  return {
    id: userId,
    ...newUser
  };
}

async function updateUserIncome(userId, incomeAmount) {
  const income = parseFloat(incomeAmount);
  const database = await ensureDb();
  const result = await database.collection('users').findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { income } },
    { returnDocument: 'after' }
  );
  if (result) {
    return {
      id: result._id.toString(),
      username: result.username,
      email: result.email,
      income: parseFloat(result.income)
    };
  }
  return null;
}

// EXPENSE OPERATIONS (SCOPED BY USERID)
async function getExpenses(userId) {
  const database = await ensureDb();
  const expenses = await database.collection('expenses').find({ userId: userId }).toArray();
  return expenses
    .map(exp => ({
      id: exp._id.toString(),
      amount: parseFloat(exp.amount),
      category: normalizeCategory(exp.category),
      title: exp.title || exp.description || "",
      date: exp.date,
      paymentMethod: exp.paymentMethod || "Cash",
      notes: exp.notes || ""
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function addExpense(userId, expense) {
  const newExpense = {
    userId: userId,
    amount: parseFloat(expense.amount),
    category: expense.category || "Others",
    title: expense.title || expense.description || "Expense",
    date: expense.date || new Date().toISOString().split('T')[0],
    paymentMethod: expense.paymentMethod || "Cash",
    notes: expense.notes || ""
  };

  const database = await ensureDb();
  const result = await database.collection('expenses').insertOne(newExpense);
  return {
    id: result.insertedId.toString(),
    ...newExpense
  };
}

async function updateExpense(userId, id, updatedExpense) {
  const updateDoc = {
    amount: parseFloat(updatedExpense.amount),
    category: updatedExpense.category || "Others",
    title: updatedExpense.title || updatedExpense.description || "Expense",
    date: updatedExpense.date,
    paymentMethod: updatedExpense.paymentMethod || "Cash",
    notes: updatedExpense.notes || ""
  };

  const database = await ensureDb();
  const filter = { _id: new ObjectId(id), userId: userId };
  const result = await database.collection('expenses').findOneAndUpdate(
    filter,
    { $set: updateDoc },
    { returnDocument: 'after' }
  );
  if (result) {
    return {
      id: result._id.toString(),
      amount: parseFloat(result.amount),
      category: result.category,
      title: result.title || result.description || "",
      date: result.date,
      paymentMethod: result.paymentMethod || "Cash",
      notes: result.notes || ""
    };
  }
  return null;
}

async function deleteExpense(userId, id) {
  const database = await ensureDb();
  const result = await database.collection('expenses').deleteOne({ _id: new ObjectId(id), userId: userId });
  return result.deletedCount > 0;
}

// BUDGET OPERATIONS (SCOPED BY USERID)
async function getBudgets(userId) {
  const database = await ensureDb();
  const budgets = await database.collection('budgets').find({ userId: userId }).toArray();
  const uniqueBudgets = {};
  budgets.forEach(b => {
    const normCat = normalizeCategory(b.category);
    uniqueBudgets[normCat] = (uniqueBudgets[normCat] || 0) + parseFloat(b.limit_amount);
  });
  return Object.entries(uniqueBudgets).map(([category, limit_amount]) => ({
    category,
    limit_amount
  }));
}

async function updateBudget(userId, category, limitAmount) {
  const limit = parseFloat(limitAmount);
  const database = await ensureDb();
  await database.collection('budgets').updateOne(
    { userId: userId, category: category },
    { $set: { limit_amount: limit } },
    { upsert: true }
  );
  return { category, limit_amount: limit };
}

module.exports = {
  connectDb,
  findUserByEmail,
  createUser,
  updateUserIncome,
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getBudgets,
  updateBudget,
  isFallback: () => false
};
