// App State Management
const state = {
  token: null,
  expenses: [],
  budgets: [],
  income: 50000,
  username: "User",
  useGemini: false,
  geminiKey: "",
  currency: "INR",
  apiUrl: "",
  activeView: "dashboard",
  chatHistory: [],
  chartTrendInstance: null,
  chartBreakdownInstance: null,
  chartIncomeVsExpenseInstance: null
};

// Currency Symbols Mapping
const currencySymbols = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥"
};

// Helper to format currency values dynamically
function formatCurrency(amount) {
  const symbol = currencySymbols[state.currency] || "₹";
  const locale = state.currency === "INR" ? "en-IN" : "en-US";
  return `${symbol}${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyNoDecimals(amount) {
  const symbol = currencySymbols[state.currency] || "₹";
  const locale = state.currency === "INR" ? "en-IN" : "en-US";
  return `${symbol}${amount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Category Icon Mapping
const categoryIcons = {
  "Food": "shopping-cart",
  "Travel": "car",
  "Shopping": "shopping-bag",
  "Education": "book",
  "Medical": "heart",
  "Bills": "file-text",
  "Entertainment": "film",
  "Others": "help-circle"
};

// Category CSS Class Mapping
const categoryClasses = {
  "Food": "cat-food",
  "Travel": "cat-travel",
  "Shopping": "cat-shopping",
  "Education": "cat-education",
  "Medical": "cat-medical",
  "Bills": "cat-bills",
  "Entertainment": "cat-ent",
  "Others": "cat-others"
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  setupAuthFormToggles();
  setupAuthEventListeners();
  
  if (checkAuth()) {
    loadLocalStorageSettings();
    setupNavigation();
    setupEventListeners();
    fetchInitialData();
  }
  
  // Set default date in modal input to today
  document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
  
  // Set default month in statements filter to current month
  document.getElementById('txn-filter-date').value = new Date().toISOString().substring(0, 7);
});

// Helper to resolve absolute backend API URL
function getApiBaseUrl() {
  const customUrl = localStorage.getItem("aura_api_url");
  if (customUrl && customUrl.trim() !== "") {
    return customUrl.trim();
  }
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : window.location.origin; // default to same host in production
}

// Authentication Controller Verification
function checkAuth() {
  state.token = localStorage.getItem("aura_jwt_token") || null;
  const authContainer = document.getElementById("view-auth");
  const appContainer = document.querySelector(".app-container");
  
  if (state.token) {
    appContainer.style.display = "flex";
    authContainer.style.display = "none";
    
    // Sync state details
    state.username = localStorage.getItem("aura_username") || "User";
    state.income = parseFloat(localStorage.getItem("aura_income")) || 50000;
    state.currency = localStorage.getItem("aura_currency") || "INR";
    
    document.getElementById("display-username").textContent = state.username;
    document.getElementById("user-avatar").textContent = state.username.charAt(0).toUpperCase();
    return true;
  } else {
    appContainer.style.display = "none";
    authContainer.style.display = "flex";
    return false;
  }
}

// Setup Auth forms toggle link (Login <=> Register)
function setupAuthFormToggles() {
  const toggleBtn = document.getElementById("auth-toggle-btn");
  const loginForm = document.getElementById("auth-login-form");
  const registerForm = document.getElementById("auth-register-form");
  const title = document.getElementById("auth-title");
  const subtitle = document.getElementById("auth-subtitle");
  const toggleText = document.getElementById("auth-toggle-text");
  
  toggleBtn.addEventListener("click", () => {
    if (loginForm.style.display !== "none") {
      // Toggle to Register View
      loginForm.style.display = "none";
      registerForm.style.display = "flex";
      title.textContent = "Create Account";
      subtitle.textContent = "Register to start optimizing your money";
      toggleText.textContent = "Already have an account? ";
      toggleBtn.textContent = "Sign In here";
    } else {
      // Toggle to Login View
      loginForm.style.display = "flex";
      registerForm.style.display = "none";
      title.textContent = "Welcome to Aura";
      subtitle.textContent = "Sign in to track your personal expenses";
      toggleText.textContent = "Don't have an account? ";
      toggleBtn.textContent = "Register here";
    }
  });
}

// Setup Auth Submit Event Listeners
function setupAuthEventListeners() {
  const loginForm = document.getElementById("auth-login-form");
  const registerForm = document.getElementById("auth-register-form");
  
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    
    showAppLoading();
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      
      // Save session token in local storage
      localStorage.setItem("aura_jwt_token", data.token);
      localStorage.setItem("aura_username", data.user.username);
      localStorage.setItem("aura_income", data.user.income.toString());
      
      loginForm.reset();
      showToast("Welcome back! Signed in successfully.", "success");
      
      // Start SPA shell
      if (checkAuth()) {
        loadLocalStorageSettings();
        setupNavigation();
        setupEventListeners();
        await fetchInitialData();
        switchView("dashboard");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, "danger");
    } finally {
      hideAppLoading();
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const income = parseFloat(document.getElementById("register-income").value) || 50000;
    
    showAppLoading();
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, income })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      
      showToast(data.message || "Account registered successfully!", "success");
      
      registerForm.reset();
      document.getElementById("auth-toggle-btn").click(); // Redirect to login form
    } catch (err) {
      console.error(err);
      showToast(err.message, "danger");
    } finally {
      hideAppLoading();
    }
  });
}

// API FETCH WRAPPER: Automatically injects JWT and handles session expiration redirects
async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (state.token) {
    options.headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  if (options.body && typeof options.body === 'string') {
    options.headers['Content-Type'] = 'application/json';
  }
  
  const apiBase = getApiBaseUrl();
  const absoluteUrl = url.startsWith('/') ? `${apiBase}${url}` : url;
  
  const res = await fetch(absoluteUrl, options);
  if (res.status === 401) {
    handleLogout();
    throw new Error("Session expired. Please sign in again.");
  }
  return res;
}

// Clear Token and logout user
function handleLogout() {
  localStorage.removeItem("aura_jwt_token");
  localStorage.removeItem("aura_username");
  localStorage.removeItem("aura_income");
  state.token = null;
  state.username = "User";
  state.income = 50000;
  state.chatHistory = [];
  
  showToast("Logged out successfully!", "success");
  checkAuth();
}

// Load user configurations from LocalStorage
function loadLocalStorageSettings() {
  state.income = parseFloat(localStorage.getItem("aura_income")) || 50000;
  state.username = localStorage.getItem("aura_username") || "User";
  state.useGemini = localStorage.getItem("aura_use_gemini") === "true";
  state.geminiKey = localStorage.getItem("aura_gemini_key") || "";
  state.currency = localStorage.getItem("aura_currency") || "INR";
  
  // Sync profile values to input fields
  document.getElementById("settings-username").value = state.username;
  document.getElementById("settings-income").value = state.income;
  document.getElementById("settings-currency").value = state.currency;
  document.getElementById("settings-gemini-toggle").checked = state.useGemini;
  document.getElementById("settings-gemini-key").value = state.geminiKey;
  
  const symbol = currencySymbols[state.currency] || "₹";
  document.getElementById("label-settings-income").textContent = `Monthly Regular Income (${symbol})`;
  document.getElementById("label-budget-limit-input").textContent = `Budget Limit Amount (${symbol})`;
  document.getElementById("label-expense-amount").textContent = `Amount (${symbol}) *`;

  if (state.useGemini) {
    document.getElementById("gemini-key-container").style.display = "block";
    document.getElementById("ai-engine-status-tag").textContent = "Gemini Engine";
  } else {
    document.getElementById("gemini-key-container").style.display = "none";
    document.getElementById("ai-engine-status-tag").textContent = "Local Engine";
  }
  
  // Update UI widgets
  document.getElementById("display-username").textContent = state.username;
  document.getElementById("user-avatar").textContent = state.username.charAt(0).toUpperCase();
}

// Fetch live expenses and budgets from server database
async function fetchInitialData() {
  showAppLoading();
  try {
    const expensesRes = await apiFetch('/api/expenses');
    state.expenses = await expensesRes.json();
    
    const budgetsRes = await apiFetch('/api/budgets');
    state.budgets = await budgetsRes.json();
    
    const statusRes = await apiFetch('/api/status');
    const statusData = await statusRes.json();
    document.getElementById("db-status-text").textContent = statusData.database === "MongoDB Live" ? "Safe Sync" : "Local Backup";

    renderUI();
  } catch (err) {
    console.error("Failed to load initial sync data", err);
    showToast("Server Connection Failed. Running offline mode.", "danger");
  } finally {
    hideAppLoading();
  }
}

// Setup SPA navigation click bindings
function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-link, .mobile-nav-link, [data-view]");
  
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetView = link.getAttribute("data-view");
      if (!targetView) return;
      
      switchView(targetView);
    });
  });
}

function switchView(viewName) {
  state.activeView = viewName;
  
  // Remove active state from all views and links
  document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link, .mobile-nav-link").forEach(l => l.classList.remove("active"));
  
  // Activate target view
  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) targetPanel.classList.add("active");
  
  // Activate links
  document.querySelectorAll(`[data-view="${viewName}"]`).forEach(l => l.classList.add("active"));
  
  // Update header text dynamically
  const titles = {
    dashboard: { title: "Financial Dashboard", subtitle: `Welcome back, ${state.username}. See your financial pulse.` },
    transactions: { title: "Statements & Logs", subtitle: "Review, filter, and inspect your transaction history." },
    budgets: { title: "Category Budgets", subtitle: "Audit and distribute monthly budget allowances." },
    coach: { title: "WalletWise Financial Coach", subtitle: "Your interactive assistant for budget optimization." },
    settings: { title: "System Configurations", subtitle: "Setup your user profile, income, and Gemini API keys." }
  };
  
  if (titles[viewName]) {
    document.getElementById("page-title").textContent = titles[viewName].title;
    document.getElementById("page-subtitle").textContent = titles[viewName].subtitle;
  }
  
  // Re-render views if they need active charts
  if (viewName === "dashboard") {
    renderTrendChart();
    renderBreakdownChart();
    renderIncomeVsExpenseChart();
  }
  
  // Scroll to top
  window.scrollTo(0, 0);
}

// Setup core user interaction events
function setupEventListeners() {
  // Modal toggle actions
  const modal = document.getElementById("modal-expense");
  const addBtn = document.getElementById("global-add-expense-btn");
  const addTxnBtn = document.getElementById("txn-add-btn");
  const cancelBtn = document.getElementById("expense-cancel-btn");
  const closeBtn = document.getElementById("modal-expense-close");
  const form = document.getElementById("modal-expense-form");
  
  // Logout actions
  const sidebarLogout = document.getElementById("sidebar-logout-btn");
  const settingsLogout = document.getElementById("settings-logout-btn");
  if (sidebarLogout) sidebarLogout.addEventListener("click", handleLogout);
  if (settingsLogout) settingsLogout.addEventListener("click", handleLogout);

  const openModal = (expenseToEdit = null) => {
    modal.classList.add("active");
    if (expenseToEdit) {
      document.getElementById("modal-expense-title").textContent = "Modify Transaction";
      document.getElementById("expense-id").value = expenseToEdit.id;
      document.getElementById("expense-amount").value = expenseToEdit.amount;
      document.getElementById("expense-category").value = expenseToEdit.category;
      document.getElementById("expense-title").value = expenseToEdit.title || expenseToEdit.description || "";
      document.getElementById("expense-payment").value = expenseToEdit.paymentMethod || "Cash";
      document.getElementById("expense-date").value = expenseToEdit.date;
      document.getElementById("expense-notes").value = expenseToEdit.notes || "";
    } else {
      document.getElementById("modal-expense-title").textContent = "Add New Transaction";
      document.getElementById("expense-id").value = "";
      document.getElementById("expense-amount").value = "";
      document.getElementById("expense-category").value = "Food";
      document.getElementById("expense-title").value = "";
      document.getElementById("expense-payment").value = "Cash";
      document.getElementById("expense-date").value = new Date().toISOString().split('T')[0];
      document.getElementById("expense-notes").value = "";
    }
  };
  
  const closeModal = () => {
    modal.classList.remove("active");
    form.reset();
  };
  
  addBtn.addEventListener("click", () => openModal());
  if (addTxnBtn) addTxnBtn.addEventListener("click", () => openModal());
  cancelBtn.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);
  
  // Form submission: Save transaction
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("expense-id").value;
    const expenseData = {
      amount: parseFloat(document.getElementById("expense-amount").value),
      category: document.getElementById("expense-category").value,
      title: document.getElementById("expense-title").value.trim(),
      paymentMethod: document.getElementById("expense-payment").value,
      date: document.getElementById("expense-date").value,
      notes: document.getElementById("expense-notes").value.trim()
    };
    
    try {
      if (id) {
        // Update request
        const res = await apiFetch(`/api/expenses/${id}`, {
          method: "PUT",
          body: JSON.stringify(expenseData)
        });
        if (!res.ok) throw new Error("Update failed");
        showToast("Transaction updated successfully!", "success");
      } else {
        // Create request
        const res = await apiFetch("/api/expenses", {
          method: "POST",
          body: JSON.stringify(expenseData)
        });
        if (!res.ok) throw new Error("Insert failed");
        showToast("Transaction logged successfully!", "success");
      }
      closeModal();
      await fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast("Failed to save transaction.", "danger");
    }
  });

  // Budget Edit Submission
  document.getElementById("budget-update-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const category = document.getElementById("budget-category-select").value;
    const limit_amount = parseFloat(document.getElementById("budget-limit-input").value);
    
    try {
      const res = await apiFetch("/api/budgets", {
        method: "PUT",
        body: JSON.stringify({ category, limit_amount })
      });
      if (!res.ok) throw new Error("Budget update failed");
      const symbol = currencySymbols[state.currency] || "₹";
      showToast(`Budget for ${category} updated to ${symbol}${limit_amount}`, "success");
      document.getElementById("budget-limit-input").value = "";
      await fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast("Failed to update budget.", "danger");
    }
  });
  
  // Filters for statements
  document.getElementById("txn-search").addEventListener("input", renderTransactionsTable);
  document.getElementById("txn-filter-date").addEventListener("change", renderTransactionsTable);
  document.getElementById("txn-filter-category").addEventListener("change", renderTransactionsTable);
  document.getElementById("txn-filter-sort").addEventListener("change", renderTransactionsTable);
  document.getElementById("dashboard-view-all-txns").addEventListener("click", () => switchView("transactions"));

  // AI Quick Parse bar
  const quickInput = document.getElementById("ai-quick-input");
  const quickBtn = document.getElementById("ai-quick-btn");
  
  const handleQuickParse = async () => {
    const text = quickInput.value.trim();
    if (!text) return;
    
    quickBtn.disabled = true;
    quickInput.disabled = true;
    showToast("Parsing statement...", "success");
    
    try {
      const res = await apiFetch("/api/ai/parse", {
        method: "POST",
        body: JSON.stringify({ text, apiKey: state.useGemini ? state.geminiKey : null })
      });
      const data = await res.json();
      
      if (data.amount) {
        openModal({
          id: "",
          amount: data.amount,
          category: data.category,
          title: data.title,
          paymentMethod: data.paymentMethod || "Cash",
          date: data.date,
          notes: data.notes || "Auto-parsed statement"
        });
        quickInput.value = "";
      } else {
        showToast("Could not extract amount. Please enter manually.", "warning");
        openModal({
          id: "",
          amount: "",
          category: data.category,
          title: data.title || text,
          paymentMethod: data.paymentMethod || "Cash",
          date: data.date,
          notes: data.notes || "Auto-parsed statement"
        });
      }
    } catch (err) {
      console.error(err);
      showToast("AI parser connection error.", "danger");
    } finally {
      quickBtn.disabled = false;
      quickInput.disabled = false;
    }
  };
  
  quickBtn.addEventListener("click", handleQuickParse);
  quickInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleQuickParse();
  });

  // AI Chat Events
  const chatInput = document.getElementById("chat-input-field");
  const chatSendBtn = document.getElementById("chat-send-btn");
  
  const handleChatSend = async () => {
    const message = chatInput.value.trim();
    if (!message) return;
    
    appendChatBubble("user", message);
    chatInput.value = "";
    
    const thinkingId = appendChatThinkingBubble();
    
    try {
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          history: state.chatHistory,
          income: state.income,
          apiKey: state.useGemini ? state.geminiKey : null
        })
      });
      const data = await res.json();
      
      document.getElementById(thinkingId).remove();
      appendChatBubble("model", data.reply);
      
      state.chatHistory.push({ role: "user", text: message });
      state.chatHistory.push({ role: "model", text: data.reply });
      
    } catch (err) {
      console.error(err);
      document.getElementById(thinkingId).remove();
      appendChatBubble("model", "I'm having trouble connecting to my cognitive center. Please verify network status.");
    }
  };
  
  chatSendBtn.addEventListener("click", handleChatSend);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleChatSend();
  });

  // Settings: Profile Save
  document.getElementById("save-profile-btn").addEventListener("click", async () => {
    const name = document.getElementById("settings-username").value.trim() || "User";
    const income = parseFloat(document.getElementById("settings-income").value) || 50000;
    const currency = document.getElementById("settings-currency").value;
    
    state.username = name;
    state.income = income;
    state.currency = currency;
    
    localStorage.setItem("aura_username", name);
    localStorage.setItem("aura_income", income.toString());
    localStorage.setItem("aura_currency", currency);
    
    document.getElementById("display-username").textContent = name;
    document.getElementById("user-avatar").textContent = name.charAt(0).toUpperCase();
    
    const symbol = currencySymbols[state.currency] || "₹";
    document.getElementById("label-settings-income").textContent = `Monthly Regular Income (${symbol})`;
    document.getElementById("label-budget-limit-input").textContent = `Budget Limit Amount (${symbol})`;
    document.getElementById("label-expense-amount").textContent = `Amount (${symbol}) *`;

    try {
      // Sync income to backend database profile
      const res = await apiFetch("/api/profile/income", {
        method: "PUT",
        body: JSON.stringify({ income })
      });
      if (!res.ok) throw new Error("Sync failed");
      showToast("Profile savings rate and currency configuration updated!", "success");
    } catch (err) {
      console.error(err);
      showToast("Local configuration updated. Server sync failed.", "warning");
    }
    
    renderUI();
  });

  // Settings: Gemini config save
  const geminiToggle = document.getElementById("settings-gemini-toggle");
  geminiToggle.addEventListener("change", () => {
    const isChecked = geminiToggle.checked;
    document.getElementById("gemini-key-container").style.display = isChecked ? "block" : "none";
  });
  
  document.getElementById("save-ai-btn").addEventListener("click", () => {
    const isChecked = geminiToggle.checked;
    const key = document.getElementById("settings-gemini-key").value.trim();
    
    if (isChecked && !key) {
      showToast("Gemini key required if online AI is enabled.", "warning");
      return;
    }
    
    state.useGemini = isChecked;
    state.geminiKey = key;
    
    localStorage.setItem("aura_use_gemini", isChecked.toString());
    localStorage.setItem("aura_gemini_key", key);
    
    document.getElementById("ai-engine-status-tag").textContent = isChecked ? "Gemini Engine" : "Local Engine";
    showToast("AI engine updated configuration successfully!", "success");
  });

  // Settings: Maintenance Buttons
  document.getElementById("export-json-btn").addEventListener("click", exportJSONData);
  document.getElementById("export-csv-btn").addEventListener("click", exportCSVData);
  document.getElementById("reset-db-btn").addEventListener("click", handleDatabaseReset);
}

// Global UI Rendering Router
function renderUI() {
  renderKPIs();
  renderTrendChart();
  renderBreakdownChart();
  renderIncomeVsExpenseChart();
  renderDashboardBudgetPreview();
  renderRecentTransactionsList();
  renderTransactionsTable();
  renderBudgetPageList();
  
  lucide.createIcons();
}

// Render Header KPI Stats
function renderKPIs() {
  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = state.expenses.filter(e => e.date.substring(0, 7) === currentYearMonth);
  const totalSpent = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netBalance = state.income - totalSpent;
  
  const savingsRate = state.income > 0 ? ((netBalance / state.income) * 100) : 0;
  
  document.getElementById("kpi-monthly-income").textContent = formatCurrency(state.income);
  document.getElementById("kpi-total-expenses").textContent = formatCurrency(totalSpent);
  
  const balanceEl = document.getElementById("kpi-net-balance");
  balanceEl.textContent = `${netBalance < 0 ? '-' : ''}${formatCurrency(Math.abs(netBalance))}`;
  
  if (netBalance < 0) {
    balanceEl.style.color = "var(--danger)";
  } else {
    balanceEl.style.color = "var(--text-primary)";
  }
  
  const rateEl = document.getElementById("kpi-savings-rate");
  rateEl.textContent = `${savingsRate.toFixed(0)}%`;
  
  if (savingsRate >= 20) {
    rateEl.style.color = "var(--success)";
  } else if (savingsRate > 0) {
    rateEl.style.color = "var(--warning)";
  } else {
    rateEl.style.color = "var(--danger)";
  }
}

// Render Dashboard category budgets
function renderDashboardBudgetPreview() {
  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = state.expenses.filter(e => e.date.substring(0, 7) === currentYearMonth);
  const container = document.getElementById("dashboard-budget-preview");
  container.innerHTML = "";
  
  const spendingMap = {};
  monthlyExpenses.forEach(e => {
    spendingMap[e.category] = (spendingMap[e.category] || 0) + e.amount;
  });
  
  const auditList = state.budgets.map(b => {
    const spend = spendingMap[b.category] || 0;
    const ratio = b.limit_amount > 0 ? (spend / b.limit_amount) : 0;
    return { ...b, spend, ratio };
  }).sort((a, b) => b.ratio - a.ratio).slice(0, 4);
  
  if (auditList.length === 0) {
    container.innerHTML = `<p class="kpi-subtext" style="text-align: center; margin: 2rem 0;">No active budget limits configured.</p>`;
    return;
  }
  
  auditList.forEach(b => {
    const percent = Math.min(b.ratio * 100, 100);
    let progressColor = "var(--success)";
    if (b.ratio >= 1.0) {
      progressColor = "var(--danger)";
    } else if (b.ratio >= 0.8) {
      progressColor = "var(--warning)";
    }
    
    const budgetItem = document.createElement("div");
    budgetItem.className = "budget-item";
    budgetItem.innerHTML = `
      <div class="budget-info">
        <span class="budget-category">${b.category}</span>
        <span class="budget-values">${formatCurrencyNoDecimals(b.spend)} / ${formatCurrencyNoDecimals(b.limit_amount)}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${progressColor};"></div>
      </div>
    `;
    container.appendChild(budgetItem);
  });
}

// Render Dashboard recent log list
function renderRecentTransactionsList() {
  const container = document.getElementById("dashboard-recent-list");
  container.innerHTML = "";
  
  const recent = state.expenses.slice(0, 5);
  
  if (recent.length === 0) {
    container.innerHTML = `<p class="kpi-subtext" style="text-align: center; margin: 2rem 0;">No logged transactions yet. Type above to add.</p>`;
    return;
  }
  
  recent.forEach(exp => {
    const iconName = categoryIcons[exp.category] || "help-circle";
    const cssClass = categoryClasses[exp.category] || "cat-others";
    const formattedDate = new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const item = document.createElement("div");
    item.className = "expense-item";
    item.innerHTML = `
      <div class="expense-left">
        <div class="category-icon ${cssClass}">
          <i data-lucide="${iconName}"></i>
        </div>
        <div class="expense-details">
          <span class="expense-desc">${exp.title || exp.category}</span>
          ${exp.notes ? `<span class="expense-notes-preview">${exp.notes.substring(0, 45)}${exp.notes.length > 45 ? '...' : ''}</span>` : ''}
          <div class="expense-meta">
            <span>${exp.category}</span>
            <span>&bull;</span>
            <span>${exp.paymentMethod || 'Cash'}</span>
            <span>&bull;</span>
            <span>${formattedDate}</span>
          </div>
        </div>
      </div>
      <div class="expense-right">
        <span class="expense-amt">${formatCurrency(exp.amount)}</span>
        <div class="expense-actions">
          <button class="action-btn edit-btn" onclick="editExpenseViaId('${exp.id}')">
            <i data-lucide="edit-3"></i>
          </button>
          <button class="action-btn delete-btn" onclick="deleteExpenseViaId('${exp.id}')">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Render Statements View Table
function renderTransactionsTable() {
  const tableBody = document.getElementById("txn-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = "";
  
  const searchVal = document.getElementById("txn-search").value.toLowerCase();
  const dateFilter = document.getElementById("txn-filter-date").value; // Format: YYYY-MM or empty
  const categoryFilter = document.getElementById("txn-filter-category").value;
  const sortFilter = document.getElementById("txn-filter-sort").value;
  
  let filtered = state.expenses.filter(exp => {
    const matchedTitle = exp.title && exp.title.toLowerCase().includes(searchVal);
    const matchedNotes = exp.notes && exp.notes.toLowerCase().includes(searchVal);
    const matchedCategoryName = exp.category.toLowerCase().includes(searchVal);
    
    const matchesSearch = matchedTitle || matchedNotes || matchedCategoryName;
    const matchesCategory = categoryFilter === "ALL" || exp.category === categoryFilter;
    const matchesMonth = !dateFilter || exp.date.substring(0, 7) === dateFilter;
    
    return matchesSearch && matchesCategory && matchesMonth;
  });
  
  filtered.sort((a, b) => {
    if (sortFilter === "date-desc") {
      return new Date(b.date) - new Date(a.date);
    } else if (sortFilter === "date-asc") {
      return new Date(a.date) - new Date(b.date);
    } else if (sortFilter === "amount-desc") {
      return b.amount - a.amount;
    } else if (sortFilter === "amount-asc") {
      return a.amount - b.amount;
    }
    return 0;
  });
  
  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          No matching transactions found.
        </td>
      </tr>
    `;
    return;
  }
  
  filtered.forEach(exp => {
    const formattedDate = new Date(exp.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>
        <div style="font-weight: 500; color: var(--text-primary);">${exp.title || exp.category}</div>
        ${exp.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${exp.notes}</div>` : ''}
      </td>
      <td>
        <span class="kpi-subtext" style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 12px; border: 1px solid var(--card-border);">
          ${exp.category}
        </span>
      </td>
      <td>
        <span style="font-size: 0.85rem; color: var(--text-secondary);">${exp.paymentMethod || 'Cash'}</span>
      </td>
      <td style="font-weight: 600; color: var(--text-primary);">${formatCurrency(exp.amount)}</td>
      <td style="text-align: right;">
        <button class="action-btn edit-btn" onclick="editExpenseViaId('${exp.id}')">
          <i data-lucide="edit-3"></i>
        </button>
        <button class="action-btn delete-btn" onclick="deleteExpenseViaId('${exp.id}')">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
  
  lucide.createIcons();
}

// Render Budgets View progress cards
function renderBudgetPageList() {
  const container = document.getElementById("budget-page-list");
  if (!container) return;
  container.innerHTML = "";
  
  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = state.expenses.filter(e => e.date.substring(0, 7) === currentYearMonth);
  
  const spendingMap = {};
  monthlyExpenses.forEach(e => {
    spendingMap[e.category] = (spendingMap[e.category] || 0) + e.amount;
  });
  
  state.budgets.forEach(b => {
    const spend = spendingMap[b.category] || 0;
    const ratio = b.limit_amount > 0 ? (spend / b.limit_amount) : 0;
    const percent = Math.min(ratio * 100, 100);
    const remaining = b.limit_amount - spend;
    
    let progressColor = "var(--success)";
    let statusText = "On Track";
    
    if (ratio >= 1.0) {
      progressColor = "var(--danger)";
      statusText = "Over Limit";
    } else if (ratio >= 0.8) {
      progressColor = "var(--warning)";
      statusText = "Warning";
    }
    
    const item = document.createElement("div");
    item.className = "budget-item";
    item.style.padding = "1rem";
    item.style.background = "rgba(255,255,255,0.01)";
    item.style.borderRadius = "var(--border-radius-sm)";
    item.style.border = "1px solid var(--card-border)";
    
    item.innerHTML = `
      <div class="budget-info" style="margin-bottom: 0.5rem;">
        <div style="display: flex; flex-direction: column;">
          <span class="budget-category" style="font-size: 1.05rem;">${b.category}</span>
          <span class="kpi-subtext">Remaining: <span style="font-weight: 600; color: ${remaining < 0 ? 'var(--danger)' : 'var(--success)'};">${remaining < 0 ? '-' : ''}${formatCurrency(Math.abs(remaining))}</span></span>
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
          <span style="font-weight: 600;">${formatCurrency(spend)} / ${formatCurrency(b.limit_amount)}</span>
          <span class="kpi-subtext" style="background: rgba(255,255,255,0.04); padding: 1px 6px; border-radius: 8px; border: 1px solid var(--card-border); color: ${progressColor}; font-size: 0.7rem; text-transform: uppercase;">${statusText}</span>
        </div>
      </div>
      <div class="progress-bar-bg" style="height: 10px;">
        <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${progressColor};"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Render Chart.js Trend Chart
function renderTrendChart() {
  const canvas = document.getElementById("expensesTrendChart");
  if (!canvas) return;
  
  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = state.expenses.filter(e => e.date.substring(0, 7) === currentYearMonth);
  
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const maxDay = today.getMonth() === new Date().getMonth() ? today.getDate() : daysInMonth;
  
  const labels = [];
  const spendData = [];
  let runningTotal = 0;
  
  for (let d = 1; d <= maxDay; d++) {
    const dayStr = `${currentYearMonth}-${d.toString().padStart(2, '0')}`;
    const dayExpenses = monthlyExpenses.filter(e => e.date === dayStr);
    const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    runningTotal += dayTotal;
    const dateLabel = new Date(dayStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    labels.push(dateLabel);
    spendData.push(runningTotal);
  }
  
  if (state.chartTrendInstance) {
    state.chartTrendInstance.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  const gridBorderColor = 'rgba(255, 255, 255, 0.05)';
  
  state.chartTrendInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cumulative Expenditure (₹)',
        data: spendData,
        borderColor: '#857563',
        borderWidth: 3,
        backgroundColor: (context) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(133, 117, 99, 0.2)');
          gradient.addColorStop(1, 'rgba(133, 117, 99, 0)');
          return gradient;
        },
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#B59C7B',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'Outfit', size: 14, weight: 'bold' },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              const symbol = currencySymbols[state.currency] || "₹";
              return `Spent: ${symbol}${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridBorderColor },
          ticks: {
            color: '#64748b',
            font: { family: 'Outfit', size: 11 }
          }
        },
        y: {
          grid: { color: gridBorderColor },
          ticks: {
            color: '#64748b',
            font: { family: 'Outfit', size: 11 },
            callback: function(value) {
              const symbol = currencySymbols[state.currency] || "₹";
              return symbol + value;
            }
          }
        }
      }
    }
  });
}

// Category wise Spending doughnut chart implementation
// Maps to the new categories list
function renderBreakdownChart() {
  const canvas = document.getElementById("categoryBreakdownChart");
  if (!canvas) return;

  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = state.expenses.filter(e => e.date.substring(0, 7) === currentYearMonth);

  const categories = ["Food", "Travel", "Shopping", "Education", "Medical", "Bills", "Entertainment", "Others"];
  const colors = ["#3c7d5a", "#857563", "#B59C7B", "#3E3831", "#a34759", "#a1773f", "#D0C5B4", "#9C8F80"];
  
  const categorySpend = categories.map(cat => {
    return monthlyExpenses
      .filter(e => e.category === cat)
      .reduce((sum, e) => sum + e.amount, 0);
  });

  const nonZeroData = [];
  const nonZeroLabels = [];
  const nonZeroColors = [];

  categories.forEach((cat, index) => {
    if (categorySpend[index] > 0) {
      nonZeroLabels.push(cat);
      nonZeroData.push(categorySpend[index]);
      nonZeroColors.push(colors[index]);
    }
  });

  if (nonZeroData.length === 0) {
    nonZeroLabels.push("No Expenses");
    nonZeroData.push(1);
    nonZeroColors.push("rgba(255, 255, 255, 0.05)");
  }

  if (state.chartBreakdownInstance) {
    state.chartBreakdownInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  state.chartBreakdownInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: nonZeroLabels,
      datasets: [{
        data: nonZeroData,
        backgroundColor: nonZeroColors,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 11 },
            boxWidth: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit', size: 12 },
          bodyFont: { family: 'Outfit', size: 13, weight: 'bold' },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          padding: 8,
          callbacks: {
            label: function(context) {
              if (context.label === "No Expenses") return "No Spending Recorded";
              const symbol = currencySymbols[state.currency] || "₹";
              return ` ${context.label}: ${symbol}${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

// Income vs Expense vertical bar comparison chart
function renderIncomeVsExpenseChart() {
  const canvas = document.getElementById("incomeVsExpenseChart");
  if (!canvas) return;

  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = state.expenses.filter(e => e.date.substring(0, 7) === currentYearMonth);
  const totalSpent = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

  if (state.chartIncomeVsExpenseInstance) {
    state.chartIncomeVsExpenseInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  state.chartIncomeVsExpenseInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [state.income, totalSpent],
        backgroundColor: [
          'rgba(60, 125, 90, 0.75)',
          'rgba(163, 71, 89, 0.75)'
        ],
        borderColor: [
          '#3c7d5a',
          '#a34759'
        ],
        borderWidth: 1.5,
        borderRadius: 6,
        barThickness: 45
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit', size: 12 },
          bodyFont: { family: 'Outfit', size: 13, weight: 'bold' },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          padding: 8,
          callbacks: {
            label: function(context) {
              const symbol = currencySymbols[state.currency] || "₹";
              return ` ${context.label}: ${symbol}${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 12 }
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 11 },
            callback: function(value) {
              const symbol = currencySymbols[state.currency] || "₹";
              return symbol + value;
            }
          }
        }
      }
    }
  });
}

// AI Chat Helpers
function appendChatBubble(role, text) {
  const container = document.getElementById("chat-messages-container");
  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${role === 'user' ? 'message-user' : 'message-ai'}`;
  
  if (role === 'user') {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = parseMarkdownHeuristics(text);
  }
  
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function appendChatThinkingBubble() {
  const container = document.getElementById("chat-messages-container");
  const bubble = document.createElement("div");
  const uniqueId = `thinking-${Date.now()}`;
  bubble.id = uniqueId;
  bubble.className = "message-bubble message-ai";
  bubble.innerHTML = `
    <div class="typing-indicator">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return uniqueId;
}

// Simple local markdown parser helper
function parseMarkdownHeuristics(text) {
  let html = text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\s*[\-\*]\s+(.*)$/gim, '<li>$1</li>')
    .replace(/\n/g, '<br>');
    
  html = html.replace(/(<li>.*?<\/li>)/gs, (match) => {
    return `<ul>${match}</ul>`;
  });
  html = html.replace(/<\/ul>(\s|<br>)*<ul>/g, '');
  return html;
}

// Edit Expense via ID (Called from global click handler)
window.editExpenseViaId = function(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (exp) {
    const modal = document.getElementById("modal-expense");
    document.getElementById("modal-expense-title").textContent = "Modify Transaction";
    document.getElementById("expense-id").value = exp.id;
    document.getElementById("expense-amount").value = exp.amount;
    document.getElementById("expense-category").value = exp.category;
    document.getElementById("expense-title").value = exp.title || exp.description || "";
    document.getElementById("expense-payment").value = exp.paymentMethod || "Cash";
    document.getElementById("expense-date").value = exp.date;
    document.getElementById("expense-notes").value = exp.notes || "";
    modal.classList.add("active");
  }
};

// Delete Expense via ID (Called from global click handler)
window.deleteExpenseViaId = async function(id) {
  if (confirm("Are you sure you want to permanently delete this transaction?")) {
    try {
      const res = await apiFetch(`/api/expenses/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Delete failed");
      showToast("Transaction deleted successfully", "success");
      await fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete transaction.", "danger");
    }
  }
};

// Reset Database Operations (Wipes expenses and resets budgets to Rupee defaults)
async function handleDatabaseReset() {
  if (confirm("⚠️ CRITICAL WARNING: This will permanently delete ALL logged expenses and reset budgets back to defaults. Do you want to proceed?")) {
    showAppLoading();
    try {
      for (const exp of state.expenses) {
        await apiFetch(`/api/expenses/${exp.id}`, { method: "DELETE" });
      }
      
      const standardBudgets = [
        { category: "Food", limit_amount: 12000 },
        { category: "Travel", limit_amount: 5000 },
        { category: "Shopping", limit_amount: 8000 },
        { category: "Education", limit_amount: 12000 },
        { category: "Medical", limit_amount: 5000 },
        { category: "Bills", limit_amount: 6000 },
        { category: "Entertainment", limit_amount: 5000 },
        { category: "Others", limit_amount: 4000 }
      ];
      
      for (const b of standardBudgets) {
        await apiFetch("/api/budgets", {
          method: "PUT",
          body: JSON.stringify(b)
        });
      }
      
      showToast("Database successfully reset!", "success");
      await fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast("Error encountered resetting database", "danger");
    } finally {
      hideAppLoading();
    }
  }
}

// Data Export logic
function exportJSONData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.expenses, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `aura_financial_export_${new Date().toISOString().split('T')[0]}.json`);
  dlAnchorElem.click();
}

function exportCSVData() {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Date,Title,Category,PaymentMethod,Amount,Notes\n";
  
  state.expenses.forEach(e => {
    const titleClean = e.title ? e.title.replace(/"/g, '""') : (e.description ? e.description.replace(/"/g, '""') : "");
    const notesClean = e.notes ? e.notes.replace(/"/g, '""') : "";
    csvContent += `"${e.date}","${titleClean}","${e.category}","${e.paymentMethod || 'Cash'}",${e.amount},"${notesClean}"\n`;
  });
  
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", encodeURI(csvContent));
  dlAnchorElem.setAttribute("download", `aura_statement_${new Date().toISOString().split('T')[0]}.csv`);
  dlAnchorElem.click();
}

// Loading indicators
function showAppLoading() {
  hideAppLoading();
  
  const loader = document.createElement("div");
  loader.id = "app-global-loader";
  loader.style.position = "fixed";
  loader.style.top = "0";
  loader.style.left = "0";
  loader.style.width = "100vw";
  loader.style.height = "100vh";
  loader.style.background = "rgba(4,6,12,0.6)";
  loader.style.backdropFilter = "blur(4px)";
  loader.style.zIndex = "6000";
  loader.style.display = "flex";
  loader.style.alignItems = "center";
  loader.style.justifyContent = "center";
  loader.style.fontSize = "1.5rem";
  loader.style.color = "var(--text-primary)";
  loader.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; gap: 1rem;">
      <div class="typing-indicator" style="transform: scale(2);">
        <span class="typing-dot" style="background-color: var(--accent-primary);"></span>
        <span class="typing-dot" style="background-color: var(--accent-secondary);"></span>
        <span class="typing-dot" style="background-color: var(--accent-cyan);"></span>
      </div>
      <span style="font-family: var(--font-family); font-size: 0.9rem; font-weight: 500; letter-spacing: 0.5px; color: var(--text-secondary);">SYNCING DATA STATE...</span>
    </div>
  `;
  document.body.appendChild(loader);
}

function hideAppLoading() {
  const loader = document.getElementById("app-global-loader");
  if (loader) loader.remove();
}

// Custom Toast Notifications
function showToast(message, type = "success") {
  const old = document.querySelectorAll(".toast-popup");
  old.forEach(t => t.remove());
  
  const toast = document.createElement("div");
  toast.className = "toast-popup glass-panel";
  toast.style.position = "fixed";
  toast.style.bottom = "85px";
  toast.style.right = "2rem";
  toast.style.padding = "0.75rem 1.25rem";
  toast.style.borderRadius = "var(--border-radius-sm)";
  toast.style.zIndex = "7500";
  toast.style.fontSize = "0.9rem";
  toast.style.fontWeight = "600";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.gap = "0.5rem";
  toast.style.animation = "fadeIn var(--transition-fast)";
  
  if (window.innerWidth <= 1024) {
    toast.style.bottom = "85px";
    toast.style.right = "50%";
    toast.style.transform = "translateX(50%)";
    toast.style.width = "calc(100% - 2rem)";
    toast.style.maxWidth = "400px";
  }
  
  let icon = "check-circle";
  let color = "var(--success)";
  if (type === "warning") {
    icon = "alert-triangle";
    color = "var(--warning)";
  } else if (type === "danger") {
    icon = "alert-circle";
    color = "var(--danger)";
  }
  
  toast.innerHTML = `
    <i data-lucide="${icon}" style="color: ${color}; width: 18px; height: 18px;"></i>
    <span style="font-family: var(--font-family);">${message}</span>
  `;
  
  document.body.appendChild(toast);
  lucide.createIcons();
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.5s ease";
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}
