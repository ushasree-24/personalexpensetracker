const db = require('./db');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ANSI color escape codes for neat console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

const testEmail = `test_runner_${Math.floor(Math.random() * 1000000)}@example.com`;
let testUserId = null;
let createdExpenseId = null;

function logHeader(title) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✔ PASS:${colors.reset} ${message}`);
}

function logFail(message, error) {
  console.log(`${colors.red}✘ FAIL:${colors.reset} ${message}`);
  if (error) console.error(error);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ INFO:${colors.reset} ${message}`);
}

async function runTests() {
  logHeader("STARTING BACKEND TESTS");
  logInfo(`Test User Email: ${testEmail}`);

  let databaseInstance = null;

  // 1. Database Connection Test
  try {
    databaseInstance = await db.connectDb();
    const isFallback = db.isFallback();
    logSuccess("Database connection established.");
    logInfo(`Database type: ${isFallback ? 'Local JSON file fallback' : 'Live MongoDB Atlas'}`);
  } catch (error) {
    logFail("Failed to connect to database.", error);
    process.exit(1);
  }

  // 2. User CRUD Tests
  logHeader("TESTING USER OPERATIONS");
  try {
    // A. Verify user does not exist yet
    const nonExistentUser = await db.findUserByEmail(testEmail);
    if (nonExistentUser === null) {
      logSuccess("Verified email is not already registered.");
    } else {
      throw new Error(`Email ${testEmail} should not be registered already.`);
    }

    // B. Create a new user
    const newUser = await db.createUser({
      username: "Test Runner Bot",
      email: testEmail,
      password: "testpassword123",
      income: 60000
    });
    testUserId = newUser.id;
    if (testUserId) {
      logSuccess(`User created successfully with ID: ${testUserId}`);
    } else {
      throw new Error("User created but no ID was returned.");
    }

    // C. Fetch the created user and verify details
    const fetchedUser = await db.findUserByEmail(testEmail);
    if (fetchedUser && fetchedUser.username === "Test Runner Bot" && parseFloat(fetchedUser.income) === 60000) {
      logSuccess("User fetched by email and verified details successfully.");
    } else {
      throw new Error("Fetched user details did not match expected values.");
    }

    // D. Update User Income
    const updatedUser = await db.updateUserIncome(testUserId, 75000);
    if (updatedUser && parseFloat(updatedUser.income) === 75000) {
      logSuccess("User income updated and verified successfully.");
    } else {
      throw new Error("Failed to update user income or income value incorrect.");
    }
  } catch (error) {
    logFail("User operations test suite failed.", error);
    await cleanup();
    process.exit(1);
  }

  // 3. Budget CRUD Tests
  logHeader("TESTING BUDGET OPERATIONS");
  try {
    // Budgets are auto-seeded upon registration. Let's verify we have budgets.
    const initialBudgets = await db.getBudgets(testUserId);
    if (initialBudgets && initialBudgets.length > 0) {
      logSuccess(`Budgets successfully auto-seeded on registration. Found ${initialBudgets.length} budget limits.`);
    } else {
      throw new Error("No budgets were seeded for the test user.");
    }

    // Update budget for a category
    const targetCategory = "Food";
    const newLimit = 15000;
    const updatedBudget = await db.updateBudget(testUserId, targetCategory, newLimit);
    if (updatedBudget && parseFloat(updatedBudget.limit_amount) === newLimit) {
      logSuccess(`Budget for category '${targetCategory}' updated to ${newLimit} successfully.`);
    } else {
      throw new Error(`Failed to update budget for '${targetCategory}'`);
    }

    // Verify budget update in getBudgets
    const budgets = await db.getBudgets(testUserId);
    const foodBudget = budgets.find(b => b.category === targetCategory);
    if (foodBudget && parseFloat(foodBudget.limit_amount) === newLimit) {
      logSuccess("Verified updated budget is correctly returned from getBudgets.");
    } else {
      throw new Error(`Updated budget limit amount did not match in getBudgets output.`);
    }
  } catch (error) {
    logFail("Budget operations test suite failed.", error);
    await cleanup();
    process.exit(1);
  }

  // 4. Expense CRUD Tests
  logHeader("TESTING EXPENSE OPERATIONS");
  try {
    // A. Check initial expenses list (should be empty for new user)
    const initialExpenses = await db.getExpenses(testUserId);
    if (initialExpenses && initialExpenses.length === 0) {
      logSuccess("Verified initial expenses list is empty.");
    } else {
      throw new Error(`Expected empty expenses list, but found ${initialExpenses.length} entries.`);
    }

    // B. Add a new expense
    const testExpense = {
      amount: 150.50,
      category: "Food",
      title: "Test Grocery Shopping Run",
      date: "2026-06-01",
      paymentMethod: "Credit Card",
      notes: "Testing backend capabilities"
    };

    const newExpense = await db.addExpense(testUserId, testExpense);
    createdExpenseId = newExpense.id;
    if (createdExpenseId) {
      logSuccess(`Expense added successfully with ID: ${createdExpenseId}`);
    } else {
      throw new Error("Expense created but no ID was returned.");
    }

    // C. Get expenses list and verify it contains our expense
    const expenses = await db.getExpenses(testUserId);
    const foundExpense = expenses.find(exp => exp.id === createdExpenseId);
    if (foundExpense && foundExpense.title === testExpense.title && parseFloat(foundExpense.amount) === testExpense.amount) {
      logSuccess("Verified expense details in expenses list.");
    } else {
      throw new Error("Could not find the created expense or the details did not match.");
    }

    // D. Update the expense
    const updatedExpenseDetails = {
      amount: 180.75,
      category: "Food",
      title: "Test Grocery Shopping Run (Updated)",
      date: "2026-06-01",
      paymentMethod: "Cash",
      notes: "Testing updates"
    };

    const updatedExpense = await db.updateExpense(testUserId, createdExpenseId, updatedExpenseDetails);
    if (updatedExpense && parseFloat(updatedExpense.amount) === updatedExpenseDetails.amount && updatedExpense.title === updatedExpenseDetails.title) {
      logSuccess("Expense details updated successfully.");
    } else {
      throw new Error("Failed to update expense details.");
    }

    // E. Delete the expense
    const deleteResult = await db.deleteExpense(testUserId, createdExpenseId);
    if (deleteResult === true) {
      logSuccess("Expense deleted successfully.");
      createdExpenseId = null; // No need to delete in cleanup
    } else {
      throw new Error("Delete operation returned false.");
    }

    // F. Verify list is empty again
    const finalExpenses = await db.getExpenses(testUserId);
    if (finalExpenses.length === 0) {
      logSuccess("Verified expense list is empty after deletion.");
    } else {
      throw new Error(`Expense list not empty after deletion. Found ${finalExpenses.length} entries.`);
    }
  } catch (error) {
    logFail("Expense operations test suite failed.", error);
    await cleanup();
    process.exit(1);
  }

  // 5. Clean up & Complete
  await cleanup();
  logHeader("ALL TESTS COMPLETED SUCCESSFULLY!");
  process.exit(0);
}

async function cleanup() {
  logHeader("CLEANING UP TEST DATA");
  try {
    const isFallback = db.isFallback();
    if (isFallback) {
      // Local JSON DB cleanup
      const fallbackFilePath = path.join(__dirname, 'database.json');
      if (fs.existsSync(fallbackFilePath)) {
        const data = JSON.parse(fs.readFileSync(fallbackFilePath, 'utf-8'));
        
        if (testUserId) {
          data.users = data.users.filter(u => u.id !== testUserId);
          data.budgets = data.budgets.filter(b => b.userId !== testUserId);
          data.expenses = data.expenses.filter(e => e.userId !== testUserId);
          fs.writeFileSync(fallbackFilePath, JSON.stringify(data, null, 2), 'utf-8');
          logSuccess(`Removed test user and budgets from ${fallbackFilePath}`);
        }
      }
    } else {
      // MongoDB Atlas database cleanup
      const uri = process.env.MONGODB_URI;
      if (uri && testUserId) {
        const client = new MongoClient(uri);
        await client.connect();
        const database = client.db();

        const userDeleteRes = await database.collection('users').deleteOne({ _id: new ObjectId(testUserId) });
        if (userDeleteRes.deletedCount > 0) {
          logSuccess(`Deleted test user document from 'users' collection.`);
        }
        
        const budgetDeleteRes = await database.collection('budgets').deleteMany({ userId: testUserId });
        logSuccess(`Deleted ${budgetDeleteRes.deletedCount} budgets from 'budgets' collection.`);

        const expenseDeleteRes = await database.collection('expenses').deleteMany({ userId: testUserId });
        if (expenseDeleteRes.deletedCount > 0) {
          logSuccess(`Deleted ${expenseDeleteRes.deletedCount} leftover expenses from 'expenses' collection.`);
        }
        await client.close();
      }
    }
  } catch (error) {
    logFail("Failed during cleanup of test data.", error);
  }
}

runTests();
