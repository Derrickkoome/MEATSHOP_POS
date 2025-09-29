const API_URL = "/api";

// --------- DOM REFS ----------
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".section");

const inventoryValueEl = document.getElementById("inventoryValue");
const todaysSalesEl = document.getElementById("todaysSales");
const lowStockCountEl = document.getElementById("lowStockCount");
const recentSalesBody = document.getElementById("recentSalesBody");

// Sales UI
const productsListEl = document.getElementById("products-list");
const productSearchEl = document.getElementById("productSearch");
const categoryFilterEl = document.getElementById("categoryFilter");
const cartItemsEl = document.getElementById("cart-items");
const cartSubtotalEl = document.getElementById("cart-subtotal");
const cartTaxEl = document.getElementById("cart-tax");
const cartTotalEl = document.getElementById("cart-total");
const clearCartBtn = document.getElementById("clear-cart");
const checkoutBtn = document.getElementById("checkout-btn");
const salesBalanceEl = document.getElementById("sales-balance");

// Inventory UI
const inventoryBodyEl = document.getElementById("inventory-body");
const addProductBtn = document.getElementById("add-product-btn");
const inventorySearchEl = document.getElementById("inventorySearch");

// Modal UI
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
const closeProductModalBtn = document.getElementById("closeProductModal");
const productModalTitle = document.getElementById("productModalTitle");
const productIdInput = document.getElementById("product-id");
const productNameInput = document.getElementById("product-name");
const productCategoryInput = document.getElementById("product-category");
const productPriceInput = document.getElementById("product-price");
const productStockInput = document.getElementById("product-stock");
const productImageInput = document.getElementById("product-image");

// Reports
const salesHistoryEl = document.getElementById("sales-history");
const dailySummaryEl = document.getElementById("daily-summary");

// ---------- STATE ----------
let cart = []; // { id, name, price, qty }

// ---------- NAV ----------
navLinks.forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove("active"));
    link.classList.add("active");

    const target = link.getAttribute("href").substring(1);
    sections.forEach(s => s.classList.remove("active"));
    document.getElementById(target).classList.add("active");

    // load data for that view
    if (target === "dashboard") loadDashboard();
    if (target === "sales") { renderProducts(); updateBalance(); }
    if (target === "inventory") renderInventory();
    if (target === "reports") { renderSalesHistory(); }
  });
});

// ---------- HELPERS ----------
function formatKES(n) {
  if (isNaN(n)) n = 0;
  return "KSh " + Number(n).toLocaleString();
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text().catch(()=>"");
    throw new Error(`Request failed ${res.status} ${txt}`);
  }
  return res.json();
}

// ---------- PRODUCTS & BALANCE ----------
async function fetchProducts() {
  return fetchJSON(`${API_URL}/products`);
}

async function updateBalance() {
  const products = await fetchProducts();
  const totalValue = products.reduce((acc, p) => acc + (Number(p.price) * Number(p.stock)), 0);
  salesBalanceEl.textContent = `💰 Inventory Balance: ${formatKES(totalValue)}`;
  inventoryValueEl.textContent = formatKES(totalValue);
}

// ---------- DASHBOARD ----------
async function loadDashboard() {
  const products = await fetchProducts();
  const sales = await fetchJSON(`${API_URL}/sales`);

  // Inventory Value
  const inventoryValue = products.reduce((acc, p) => acc + (Number(p.price) * Number(p.stock)), 0);
  inventoryValueEl.textContent = formatKES(inventoryValue);

  // Today's Sales
  const todayStr = new Date().toLocaleDateString();
  const todaysSales = sales
    .filter(s => new Date(s.date).toLocaleDateString() === todayStr)
    .reduce((acc, s) => acc + Number(s.total), 0);
  todaysSalesEl.textContent = formatKES(todaysSales);

  // Low stock (threshold 5)
  const lowCount = products.filter(p => Number(p.stock) <= 5).length;
  lowStockCountEl.textContent = String(lowCount);

  // Recent sales (latest 5)
  recentSalesBody.innerHTML = "";
  const sorted = sales.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5);
  sorted.forEach(sale => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${new Date(sale.date).toLocaleString()}</td>
                    <td>${sale.items.map(i => `${i.name} x${i.qty}`).join(", ")}</td>
                    <td>${formatKES(sale.total)}</td>`;
    recentSalesBody.appendChild(tr);
  });
}

// ---------- RENDER PRODUCTS ----------
async function renderProducts() {
  const q = (productSearchEl.value || "").trim().toLowerCase();
  const cat = (categoryFilterEl.value || "All");
  const products = await fetchProducts();
  productsListEl.innerHTML = "";

  const filtered = products.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q);
    const matchC = cat === "All" || p.category === cat;
    return matchQ && matchC;
  });

  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${p.image || 'https://via.placeholder.com/300x200?text=Meat'}" alt="${p.name}">
      <h4>${p.name}</h4>
      <p>${p.category}</p>
      <p>${formatKES(p.price)}</p>
      <p>Stock: ${p.stock}</p>
      <div style="display:flex;gap:8px;margin-top:8px;width:100%;justify-content:center">
        <input type="number" min="1" max="${p.stock}" value="1" style="width:70px;padding:6px;border-radius:6px;border:1px solid #ddd" />
        <button class="btn add-btn" ${p.stock <= 0 ? "disabled" : ""}>Add</button>
      </div>
    `;
    const qtyInput = card.querySelector("input[type='number']");
    const addBtn = card.querySelector(".add-btn");

    addBtn.addEventListener("click", async () => {
      const qty = Math.max(1, Math.floor(Number(qtyInput.value) || 1));
      await addToCart(p.id, qty);
    });

    productsListEl.appendChild(card);
  });
}

// ---------- CART ----------
async function addToCart(productId, qty = 1) {
  // check current stock from server
  const product = await fetchJSON(`${API_URL}/products/${productId}`);
  const existing = cart.find(i => i.id === productId);
  const currentQtyInCart = existing ? existing.qty : 0;
  if ((currentQtyInCart + qty) > product.stock) {
    alert(`Not enough stock for "${product.name}". Available: ${product.stock - currentQtyInCart}`);
    return;
  }

  if (existing) existing.qty += qty;
  else cart.push({ id: product.id, name: product.name, price: Number(product.price), qty });

  renderCart();
}

function renderCart() {
  cartItemsEl.innerHTML = "";
  if (cart.length === 0) {
    cartItemsEl.innerHTML = "<p style='color:#666'>Cart is empty</p>";
    updateCartSummary();
    return;
  }

  cart.forEach(item => {
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div>
        <strong>${item.name}</strong><br/>
        <small>${formatKES(item.price)} each</small>
      </div>
      <div class="controls">
        <button class="btn small dec">-</button>
        <span style="min-width:28px;text-align:center">${item.qty}</span>
        <button class="btn small inc">+</button>
        <button class="btn small remove" style="margin-left:8px">✕</button>
      </div>
      <div style="min-width:80px;text-align:right">${formatKES(item.price * item.qty)}</div>
    `;

    // buttons
    div.querySelector(".dec").addEventListener("click", async () => {
      if (item.qty > 1) {
        item.qty--;
      } else {
        cart = cart.filter(c => c.id !== item.id);
      }
      renderCart();
    });
    div.querySelector(".inc").addEventListener("click", async () => {
      // validate stock
      const prod = await fetchJSON(`${API_URL}/products/${item.id}`);
      if (item.qty + 1 > prod.stock) {
        alert(`Not enough stock for "${prod.name}". Available: ${prod.stock}`);
        return;
      }
      item.qty++;
      renderCart();
    });
    div.querySelector(".remove").addEventListener("click", () => {
      cart = cart.filter(c => c.id !== item.id);
      renderCart();
    });

    cartItemsEl.appendChild(div);
  });

  updateCartSummary();
}

function updateCartSummary() {
  const subtotal = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const tax = subtotal * 0.16; // 16% VAT
  const total = subtotal + tax;
  cartSubtotalEl.textContent = formatKES(subtotal);
  cartTaxEl.textContent = formatKES(tax);
  cartTotalEl.textContent = formatKES(total);
}

// clear cart
clearCartBtn.addEventListener("click", () => {
  cart = [];
  renderCart();
});

// ---------- CHECKOUT ----------
checkoutBtn.addEventListener("click", async () => {
  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }

  // validate availability
  for (let item of cart) {
    const prod = await fetchJSON(`${API_URL}/products/${item.id}`);
    if (item.qty > prod.stock) {
      alert(`Not enough stock for ${prod.name}. Available ${prod.stock}`);
      return;
    }
  }

  // compute inventoryBefore
  const allProducts = await fetchProducts();
  const inventoryBefore = allProducts.reduce((acc, p) => acc + (Number(p.price) * Number(p.stock)), 0);

  const saleTotal = cart.reduce((acc, it) => acc + (it.price * it.qty), 0);

  const inventoryAfter = inventoryBefore - saleTotal;

  // build sale record
  const sale = {
    items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    total: saleTotal,
    date: new Date().toISOString(),
    inventoryBefore,
    inventoryAfter
  };

  // save sale
  await fetchJSON(`${API_URL}/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sale)
  });

  // deduct stock on backend
  const updates = cart.map(async item => {
    // re-fetch current to avoid overwrite
    const prod = await fetchJSON(`${API_URL}/products/${item.id}`);
    const newStock = Math.max(0, Number(prod.stock) - Number(item.qty));
    return fetchJSON(`${API_URL}/products/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: newStock })
    });
  });

  await Promise.all(updates);

  // reset
  cart = [];
  renderCart();
  renderProducts();
  renderInventory();
  renderSalesHistory();
  updateBalance();
  loadDashboard();

  alert("Sale completed!");
});

// ---------- INVENTORY CRUD ----------
addProductBtn.addEventListener("click", () => openProductModal());

closeProductModalBtn.addEventListener("click", () => {
  productModal.classList.add("hidden");
});

async function renderInventory() {
  const q = (inventorySearchEl.value || "").trim().toLowerCase();
  const products = await fetchProducts();
  inventoryBodyEl.innerHTML = "";
  products
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>${formatKES(p.price)}</td>
        <td>${p.stock}</td>
        <td>
          <button class="btn edit">Edit</button>
          <button class="btn delete">Delete</button>
        </td>
      `;
      tr.querySelector(".edit").addEventListener("click", () => openProductModal(p));
      tr.querySelector(".delete").addEventListener("click", () => deleteProduct(p.id));
      inventoryBodyEl.appendChild(tr);
    });
}

function openProductModal(product = null) {
  productModal.classList.remove("hidden");
  if (product) {
    productModalTitle.textContent = "Edit Product";
    productIdInput.value = product.id;
    productNameInput.value = product.name;
    productCategoryInput.value = product.category;
    productPriceInput.value = product.price;
    productStockInput.value = product.stock;
    productImageInput.value = product.image || "";
  } else {
    productModalTitle.textContent = "Add Product";
    productIdInput.value = "";
    productForm.reset();
  }
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    name: productNameInput.value.trim(),
    category: productCategoryInput.value,
    price: Number(productPriceInput.value),
    stock: Number(productStockInput.value),
    image: productImageInput.value.trim() || ""
  };

  const id = productIdInput.value;
  if (id) {
    // replace using PUT for simplicity (json-server supports PUT)
    await fetchJSON(`${API_URL}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, id: Number(id) })
    });
  } else {
    await fetchJSON(`${API_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  productModal.classList.add("hidden");
  renderInventory();
  renderProducts();
  updateBalance();
});

async function deleteProduct(id) {
  const ok = confirm("Delete this product?");
  if (!ok) return;
  await fetchJSON(`${API_URL}/products/${id}`, { method: "DELETE" });
  renderInventory();
  renderProducts();
  updateBalance();
}

// ---------- SALES HISTORY & DAILY SUMMARY ----------
async function renderSalesHistory() {
  const sales = await fetchJSON(`${API_URL}/sales`);
  // newest first
  sales.sort((a,b) => new Date(b.date) - new Date(a.date));

  // Sales History
  salesHistoryEl.innerHTML = "";
  if (sales.length === 0) {
    salesHistoryEl.innerHTML = "<p style='color:#666'>No sales yet</p>";
  } else {
    sales.forEach(sale => {
      const div = document.createElement("div");
      div.className = "sale-record";
      div.innerHTML = `
        <p><strong>Date:</strong> ${new Date(sale.date).toLocaleString()}</p>
        <p><strong>Total:</strong> ${formatKES(sale.total)}</p>
        <p><strong>Items:</strong></p>
        <ul>${sale.items.map(i=>`<li>${i.name} x${i.qty} (${formatKES(i.price)} each)</li>`).join("")}</ul>
        <p><strong>Inventory Before Sale:</strong> ${formatKES(sale.inventoryBefore)}</p>
        <p><strong>Inventory After Sale:</strong> ${formatKES(sale.inventoryAfter)}</p>
      `;
      salesHistoryEl.appendChild(div);
    });
  }

  // Daily Summary (group by local date)
  const summary = {};
  sales.forEach(s => {
    const day = new Date(s.date).toLocaleDateString();
    if (!summary[day]) summary[day] = { total: 0, items: 0 };
    summary[day].total += Number(s.total);
    summary[day].items += s.items.reduce((acc,i)=>acc + Number(i.qty), 0);
  });

  dailySummaryEl.innerHTML = "<h3>📊 Daily Sales Summary</h3>";
  const table = document.createElement("table");
  table.className = "daily-summary";
  table.innerHTML = `<thead><tr><th>Date</th><th>Total Sales (KSh)</th><th>Items Sold</th></tr></thead><tbody></tbody>`;
  const tbody = table.querySelector("tbody");
  Object.keys(summary).forEach(date => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${date}</td><td>${Number(summary[date].total).toLocaleString()}</td><td>${summary[date].items}</td>`;
    tbody.appendChild(tr);
  });
  dailySummaryEl.appendChild(table);
}

// ---------- SEARCH & FILTER LISTENERS ----------
productSearchEl.addEventListener("input", () => renderProducts());
categoryFilterEl.addEventListener("change", () => renderProducts());
inventorySearchEl.addEventListener("input", () => renderInventory());

// ---------- INIT ----------
async function init() {
  await renderProducts();
  await renderInventory();
  await renderSalesHistory();
  await updateBalance();
  await loadDashboard();
  renderCart();
}
init().catch(err => console.error("Init error:", err));
