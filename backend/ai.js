const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const DEFAULT_INCOME = 50000;

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Local regex parser when offline or without Gemini API keys
function parseLocalExpense(text) {
  const cleanedText = text.toLowerCase().trim();
  
  // Extract amount using regex
  let amount = null;
  const amountRegex = /(?:[\$\u20B9\u20AC\u00A3]|\b(?:rs|usd|eur|gbp)\b)?\s*(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks|rupees|euros|pounds|rs|usd|eur|gbp)?\b/;
  const amountMatch = cleanedText.match(amountRegex);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
  }

  // Extract payment method by checking keywords
  let paymentMethod = "Cash";
  const paymentKeywords = {
    "UPI": ["upi", "gpay", "phonepe", "paytm", "scan", "qr", "bhim"],
    "Credit Card": ["credit card", "credit", "card", "visa", "mastercard", "amex"],
    "Debit Card": ["debit card", "debit"],
    "Net Banking": ["net banking", "bank transfer", "transfer", "wire", "bank", "neft", "imps"],
    "Cash": ["cash", "paid cash", "by cash"]
  };

  for (const [method, keywords] of Object.entries(paymentKeywords)) {
    for (const word of keywords) {
      if (cleanedText.includes(word)) {
        paymentMethod = method;
        break;
      }
    }
    if (paymentMethod !== "Cash") break;
  }

  // Extract category by checking keywords
  let category = "Others";
  const categoryKeywords = {
    "Food": ["grocery", "groceries", "supermarket", "walmart", "target", "milk", "bread", "eggs", "food", "market", "cooking", "restaurant", "dinner", "lunch", "breakfast", "eat", "cafe", "starbucks", "coffee", "pizza", "burger", "mcdonalds", "subway", "kfc", "sushi", "pub", "bar", "dining", "cafe"],
    "Travel": ["uber", "lyft", "taxi", "cab", "bus", "metro", "train", "flight", "gas", "petrol", "fuel", "parking", "toll", "commute", "subway ride", "travel", "tour", "hotel", "trip"],
    "Shopping": ["amazon", "clothes", "shoes", "shopping", "shirt", "jacket", "mall", "electronics", "device", "phone purchase", "shoes", "pants", "dress"],
    "Education": ["school", "college", "tuition", "course", "book", "books", "pen", "fee", "fees", "academy", "bootcamp", "education", "study"],
    "Medical": ["doctor", "hospital", "clinic", "medicine", "pharmacy", "health", "pill", "dentist", "surgery", "medical", "insurance"],
    "Bills": ["rent", "electricity", "water", "internet", "wifi", "phone", "bill", "trash", "heating", "gas bill", "power", "sewer", "recharge"],
    "Entertainment": ["movie", "cinema", "show", "netflix", "spotify", "game", "xbox", "playstation", "steam", "concert", "ticket", "club", "cinema", "netflix subscription", "disney", "prime video"]
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    for (const word of keywords) {
      if (cleanedText.includes(word)) {
        category = cat;
        break;
      }
    }
    if (category !== "Others") break;
  }

  // Extract date
  let date = formatDate(new Date());
  if (cleanedText.includes("yesterday")) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = formatDate(yesterday);
  } else if (cleanedText.includes("day before yesterday")) {
    const dbYesterday = new Date();
    dbYesterday.setDate(dbYesterday.getDate() - 2);
    date = formatDate(dbYesterday);
  } else if (cleanedText.includes("last week")) {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    date = formatDate(lastWeek);
  }

  // Extract title (original text minus amount and keywords)
  let title = text;
  if (amountMatch) {
    title = title.replace(amountMatch[0], '');
  }
  title = title.replace(/yesterday|day before yesterday|last week|today/gi, '');
  title = title
    .replace(/via upi|by cash|with card|using card|with upi|via card|on gpay/gi, '')
    .replace(/[,\.\-\$₹]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    title = `${category} Expense`;
  }

  return {
    amount,
    category,
    title: title.substring(0, 40),
    date,
    paymentMethod,
    notes: "Auto-parsed statement"
  };
}

// Local rule-engine analyzer for budget warnings when Gemini is unavailable
function generateLocalCoachResponse(message, databaseState) {
  const query = message.toLowerCase();
  const expenses = databaseState.expenses || [];
  const budgets = databaseState.budgets || [];
  const income = parseFloat(databaseState.income) || DEFAULT_INCOME;
  
  const totalSpend = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const savings = income - totalSpend;
  const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(1) : 0;
  
  const categorySpend = {};
  expenses.forEach(e => {
    categorySpend[e.category] = (categorySpend[e.category] || 0) + parseFloat(e.amount);
  });

  let topCategory = "N/A";
  let topAmount = 0;
  for (const [cat, amt] of Object.entries(categorySpend)) {
    if (amt > topAmount) {
      topAmount = amt;
      topCategory = cat;
    }
  }

  if (query.includes("hello") || query.includes("hi") || query.includes("hey") || query.includes("who are you")) {
    return `### Hello! I am **Aura**, your AI Financial Coach. 👋\n\nI'm currently running in **Local Offline Mode** (no API key needed). I can perform mathematical audits and analyses on your actual expenses.\n\nTry asking me:\n- **"How is my budget doing?"** - Performs an audit of your category spending against limits.\n- **"Give me a spending summary"** - Calculates your balance, total expenditures, and savings rate.\n- **"Give me savings tips"** - Recommends targeted financial cuts based on your top spending.\n\n*Tip: You can add your Google Gemini API Key in **Settings** to unlock full, open-ended conversational intelligence!*`;
  }

  if (query.includes("budget") || query.includes("limit") || query.includes("overspend") || query.includes("check")) {
    let response = `### 📊 Budget Audit Report\n\n`;
    let alerts = [];
    let healthy = [];

    budgets.forEach(b => {
      const spend = categorySpend[b.category] || 0;
      const percent = b.limit_amount > 0 ? ((spend / b.limit_amount) * 100) : 0;
      const line = `* **${b.category}**: spent **₹${spend.toFixed(2)}** of ₹${b.limit_amount.toFixed(2)} (${percent.toFixed(0)}%)`;
      
      if (spend > b.limit_amount) {
        alerts.push(line + ` 🛑 **[OVER BUDGET]**`);
      } else if (percent >= 80) {
        alerts.push(line + ` ⚠️ **[WARNING: Close to Limit]**`);
      } else {
        healthy.push(line + ` ✅`);
      }
    });

    if (alerts.length > 0) {
      response += `#### 🚨 Overspending & Warning Categories:\n` + alerts.join('\n') + `\n\n`;
    }
    if (healthy.length > 0) {
      response += `#### 👍 Categories within Budget:\n` + healthy.join('\n') + `\n\n`;
    }
    if (alerts.length === 0) {
      response += `Fantastic! All your categories are currently within budget. Keep up the excellent control! 🎉`;
    } else {
      response += `**Coach Recommendation:** I recommend cutting back on **${topCategory}** (your top expense category) to free up buffer space.`;
    }
    return response;
  }

  if (query.includes("summary") || query.includes("report") || query.includes("spend") || query.includes("expense") || query.includes("how much")) {
    let response = `### 📈 Spending Summary\n\nHere is your current financial snapshot:\n\n* 💵 **Monthly Income:** ₹${income.toFixed(2)}\n* 💸 **Total Spent:** ₹${totalSpend.toFixed(2)}\n* 🐷 **Total Savings:** ₹${savings.toFixed(2)} (Savings Rate: **${savingsRate}%**)\n* 🏷️ **Top Spending Area:** **${topCategory}** (₹${topAmount.toFixed(2)})\n\n`;

    if (savings < 0) {
      response += `⚠️ **Critical Alert:** Your expenses exceed your income by **₹${Math.abs(savings).toFixed(2)}** this month. You are running a deficit. Consider pausing shopping and non-essential dining immediately.`;
    } else if (savingsRate < 20) {
      response += `💡 **Coach Tip:** Your savings rate is **${savingsRate}%**. Try targeting a **20%** savings rate (₹${(income * 0.2).toFixed(2)}) by capping your dining out and shopping budgets.`;
    } else {
      response += `🎉 **Excellent Work:** Saving **${savingsRate}%** of your income is outstanding! You are on a great path toward your financial goals.`;
    }
    return response;
  }

  if (query.includes("save") || query.includes("savings") || query.includes("tips") || query.includes("help") || query.includes("cut")) {
    let response = `### 💡 Savings & Budget Optimization Tips\n\nBased on your expense behavior, here are three tailored action items to boost your savings:\n\n`;

    if (topCategory !== "N/A" && topCategory !== "Bills") {
      response += `1. **Trim your ${topCategory} expenses:** You've spent **₹${topAmount.toFixed(2)}** on this category. Trimming just 15% here will save you **₹${(topAmount * 0.15).toFixed(2)}** this month.\n`;
    } else {
      response += `1. **The 50/30/20 Rule:** Allocate 50% of income to Needs (rent, utilities), 30% to Wants (dining, fun), and 20% to Savings. With your income of ₹${income}, your target savings is **₹${(income * 0.2).toFixed(2)}**.\n`;
    }

    response += `2. **Audit Subscriptions (Entertainment):** Double check if you have recurring subscriptions (Netflix, Spotify, gym memberships) that you haven't used in the last 30 days. Cancel them immediately.\n`;
    response += `3. **Plan Meals (Dining Out):** Dining out and coffee runs are major sources of hidden leaks. Meal prepping just 3 days a week can easily save you ₹2000-₹5000 monthly.\n\n`;
    response += `*Tip: Run a **"budget check"** to see which categories have remaining limits.*`;
    return response;
  }

  return `### Hello! I am **Aura**, your AI Financial Coach. 🤖\n\nI'm currently running in **Local Mode**. I noticed you mentioned: *"${message}"*.\n\nI can perform data analyses on your current expenses. Ask me:\n- **"How is my budget doing?"** to check category limits.\n- **"Give me a spending summary"** to see your income/expense balances.\n- **"Give me savings tips"** to see custom optimization advice.\n\n*To activate full conversational AI (like asking general financial questions or explaining terms), please configure your Gemini API Key in the **Settings** menu.*`;
}

// Parses raw message text using Google Gemini
async function parseExpenseText(text, apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    console.log("No Gemini API key configured. Utilizing local parser.");
    return parseLocalExpense(text);
  }

  try {
    const ai = new GoogleGenerativeAI(key);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const todayStr = formatDate(new Date());
    
    const systemPrompt = `You are a helper that parses raw transaction text into structured JSON.
Parse the user's text and return ONLY a JSON object. Do not include markdown headers, triple backticks, or any explanations.
The JSON object must have exactly these keys:
- "amount": a floating-point number (or null if not found)
- "category": a string that MUST be exactly one of: "Food", "Travel", "Shopping", "Education", "Medical", "Bills", "Entertainment", "Others"
- "title": a brief, clean title of the transaction (max 40 chars, capitalized)
- "date": string in "YYYY-MM-DD" format. (Relative to today's date, which is ${todayStr}).
- "paymentMethod": a string that MUST be exactly one of: "Cash", "Credit Card", "Debit Card", "UPI", "Net Banking"
- "notes": brief notes detailing this expense (or "Auto-parsed" if no details exist, max 100 chars).

Input text: "${text}"`;

    const result = await model.generateContent(systemPrompt);
    const resultText = result.response.text().trim();
    const jsonStr = resultText.replace(/```json/i, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      amount: parsed.amount ? parseFloat(parsed.amount) : null,
      category: [
        "Food", "Travel", "Shopping", "Education", "Medical", "Bills", "Entertainment", "Others"
      ].includes(parsed.category) ? parsed.category : "Others",
      title: parsed.title || "Expense",
      date: parsed.date || todayStr,
      paymentMethod: [
        "Cash", "Credit Card", "Debit Card", "UPI", "Net Banking"
      ].includes(parsed.paymentMethod) ? parsed.paymentMethod : "Cash",
      notes: parsed.notes || "Auto-parsed"
    };
  } catch (err) {
    console.error("Gemini parser failed, falling back to local:", err.message);
    return parseLocalExpense(text);
  }
}

// Conversation with Aura personal financial assistant using Google Gemini
async function chatWithCoach(chatHistory, newMessage, databaseState, apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    console.log("No Gemini API key configured. Utilizing local coach advice.");
    return generateLocalCoachResponse(newMessage, databaseState);
  }

  try {
    const ai = new GoogleGenerativeAI(key);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const expenses = databaseState.expenses || [];
    const budgets = databaseState.budgets || [];
    const income = parseFloat(databaseState.income) || DEFAULT_INCOME;
    
    const totalSpend = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const savings = income - totalSpend;
    
    const categorySpend = {};
    expenses.forEach(e => {
      categorySpend[e.category] = (categorySpend[e.category] || 0) + parseFloat(e.amount);
    });

    const budgetStatusStr = budgets.map(b => {
      const spend = categorySpend[b.category] || 0;
      const pct = b.limit_amount > 0 ? ((spend / b.limit_amount) * 100).toFixed(0) : 0;
      return `- ${b.category}: Spent ₹${spend.toFixed(2)} of ₹${b.limit_amount.toFixed(2)} (${pct}%)`;
    }).join('\n');

    const recentTxnsStr = expenses.slice(0, 10).map(e => {
      return `- ${e.date}: ₹${e.amount.toFixed(2)} on ${e.category} (${e.title})`;
    }).join('\n');

    const contextPrompt = `You are "Aura", a highly intelligent, premium, and friendly AI Financial Coach helping a user manage their personal expense tracker.
Analyze their data, answer their financial queries, provide encouraging suggestions, and guide them to good savings habits.

Here is their current live financial profile:
- Monthly Income: ₹${income.toFixed(2)}
- Total Expenses: ₹${totalSpend.toFixed(2)}
- Current Net Savings: ₹${savings.toFixed(2)}
- Budget Limits and Progress:
${budgetStatusStr}

- 10 Most Recent Transactions:
${recentTxnsStr}

Format rules:
- Format response in clean, professional markdown.
- Use bold numbers and bullet points for lists.
- Keep response friendly, motivational, and brief (maximum 3 paragraphs).
- Respond in the language the user speaks.
- Do not make up information; base calculations on the provided facts.

Chat History:
${chatHistory.map(h => `${h.role === 'user' ? 'User' : 'Aura'}: ${h.text}`).join('\n')}
User: ${newMessage}
Aura:`;

    const result = await model.generateContent(contextPrompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("Gemini chat failed, falling back to local coach advice:", err.message);
    return generateLocalCoachResponse(newMessage, databaseState) + "\n\n*(Note: Encountered Gemini API error, answered in offline mode)*";
  }
}

module.exports = {
  parseExpenseText,
  chatWithCoach
};
