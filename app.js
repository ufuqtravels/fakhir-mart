// Global Configuration for Cloud Database
const JSONBIN_API_KEY = "6a347cdfa8b6024c76258e74"; // আপনার বিন কোড / অ্যাক্সেস কী
const JSONBIN_BIN_ID = "6a348041f5f4af5e290be899";  // আপনার আসল বিন আইডি

let products = [];
let cart = [];
let orders = [];

// Initialize Local/Cloud Database (Ultra-Safe Fast Caching)
async function initDatabase() {
  // ১. ট্রাই-ক্যাচ সুরক্ষাসহ কার্ট স্থানীয় ব্রাউজার মেমোরি থেকে লোড হচ্ছে
  try {
    const localCart = localStorage.getItem('fm_cart');
    if (localCart) cart = JSON.parse(localCart);
  } catch (e) {
    console.warn("Cart parsing failed, resetting cart.", e);
    cart = [];
  }

  try {
    const localOrders = localStorage.getItem('fm_orders');
    if (localOrders) orders = JSON.parse(localOrders);
  } catch (e) {
    console.warn("Orders parsing failed, resetting orders.", e);
    orders = [];
  }

  // ২. ট্রাই-ক্যাচ সুরক্ষাসহ ক্যাশ থেকে প্রোডাক্ট ও অর্ডার স্ক্রিনে লোড হচ্ছে
  try {
    const cachedData = localStorage.getItem('fm_cloud_cache');
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      products = parsed.products || [];
      orders = parsed.orders || [];
    }
  } catch (e) {
    console.warn("Cache parsing failed.", e);
  }
  
  // যদি লোকাল ক্যাশ সম্পূর্ণ খালি থাকে, তবে products.js ফাইলের ব্যাকআপ ডাটা লোড হবে
  if ((!products || products.length === 0) && typeof INITIAL_PRODUCTS !== 'undefined') {
    products = [...INITIAL_PRODUCTS];
  }

  // ৩. ক্লাউডের জন্য অপেক্ষা না করে সাইট সাথে সাথে রেন্ডার হবে (0ms delay)
  updateGlobalCartCounters();
  router();

  // ৪. নন-ব্লকিং ব্যাকগ্রাউন্ড সিঙ্ক (await ছাড়া রান হবে, তাই লোডিং আটকে থাকবে না)
  fetchLatestCloudData();
}

// Self-Healing Cloud Data Parser (যেকোনো ফরম্যাটের ডাটা নিজে সংশোধন করে নেবে এবং ডুয়াল হেডার পারমিশন ব্যবহার করবে)
async function fetchLatestCloudData() {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Access-Key': JSONBIN_API_KEY // ডুয়াল হেডার পারমিশন সাপোর্ট
      }
    });
    const data = await response.json();
    if (data.record) {
      // স্বয়ংক্রিয়ভাবে ডাটা ফরম্যাট ডিটেক্ট করা হচ্ছে
      if (Array.isArray(data.record)) {
        products = data.record;
      } else {
        products = data.record.products || [];
        orders = data.record.orders || [];
      }
      
      // লোকাল ক্যাশ ও রেন্ডার আপডেট করা হচ্ছে
      localStorage.setItem('fm_cloud_cache', JSON.stringify({ products, orders }));
      router();
    }
  } catch (error) {
    console.warn("Background Cloud Sync failed. Running on safe mode.", error);
  }
}

// Save Data (Products & Orders) to Cloud Database (ডুয়াল হেডার পারমিশন রাইট ব্লক আনলক করবে)
async function saveCloudData() {
  try {
    const payload = { products, orders };
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Access-Key': JSONBIN_API_KEY // ডুয়াল হেডার পারমিশন সাপোর্ট
      },
      body: JSON.stringify(payload)
    });
    localStorage.setItem('fm_cloud_cache', JSON.stringify(payload));
    console.log("Cloud synced successfully.");
  } catch (error) {
    console.error("Cloud sync failed.", error);
  }
}

function saveCartToLocal() {
  localStorage.setItem('fm_cart', JSON.stringify(cart));
  updateGlobalCartCounters();
}

function updateGlobalCartCounters() {
  const count = cart.reduce((total, item) => total + item.qty, 0);
  const counter = document.getElementById('cart-counter');
  const mobCounter = document.getElementById('mobile-cart-counter');
  if (counter) counter.innerText = count;
  if (mobCounter) mobCounter.innerText = count;
}

// Router Management
window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
  initDatabase();
  document.getElementById('current-year').innerText = new Date().getFullYear();
});

// Search functionality
document.getElementById('global-search-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const query = document.getElementById('search-input').value.trim();
  if (query) {
    window.location.hash = `#/products?search=${encodeURIComponent(query)}`;
  }
});

function router() {
  const hash = window.location.hash || '#/';
  const appViewport = document.getElementById('app-viewport');
  if (!appViewport) return;

  document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === hash) {
      link.classList.add('active');
    }
  });

  const pathParts = hash.split('?');
  const path = pathParts[0];
  const queryString = pathParts[1] || "";
  const params = new URLSearchParams(queryString);

  if (path === '#/') {
    renderHome(appViewport);
  } else if (path === '#/products') {
    renderProducts(appViewport, params);
  } else if (path.startsWith('#/product/')) {
    const prodId = path.split('#/product/')[1];
    renderProductDetail(appViewport, prodId);
  } else if (path === '#/cart') {
    renderCart(appViewport);
  } else if (path === '#/checkout') {
    renderCheckout(appViewport);
  } else if (path === '#/about') {
    renderStaticPage(appViewport, 'About');
  } else if (path === '#/contact') {
    renderStaticPage(appViewport, 'Contact');
  } else if (path === '#/privacy-policy') {
    renderStaticPage(appViewport, 'Privacy');
  } else if (path === '#/terms') {
    renderStaticPage(appViewport, 'Terms');
  } else if (path === '#/refund-policy') {
    renderStaticPage(appViewport, 'Refund');
  } else if (path === '#/admin') {
    renderAdmin(appViewport);
  } else {
    appViewport.innerHTML = `<div class="container section-padding text-center"><h2>পৃষ্ঠাটি পাওয়া যায়নি</h2><a href="#/" class="btn-royal mt-3">হোম পেজে ফিরে যান</a></div>`;
  }
}

/* =======================================
   VIEW RENDERING ENGINE FUNCTIONS
======================================= */

function renderHome(target) {
  const featured = products.filter(p => p.featured).slice(0, 4);

  target.innerHTML = `
    <!-- Royal Brand Banner -->
    <div style="background-image: url('https://i.ibb.co.com/zH4SWz45/1780963400134.png'); background-size: cover; background-position: center; min-height: 450px; display: flex; align-items: center; border-bottom: 4px solid #D4AF37; position: relative;">
      <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0, 75, 35, 0.4); z-index: 1;"></div>
      <div class="container" style="position: relative; z-index: 2; color: #fff;">
        <h1 style="font-family: 'Playfair Display', serif; font-size: 3rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Premium Fruits & Skincare</h1>
        <p style="color: #D4AF37; font-size: 1.3rem; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-style: italic; margin-top: 10px;">"হালাল বাণিজ্য ও বিশ্বস্ততার এক রাজকীয় আঙিনা"</p>
        <a href="#/products" class="btn-royal mt-3" style="box-shadow: 0 4px 15px rgba(0,0,0,0.2);">শপিং শুরু করুন <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </div>

    <!-- Category Section -->
    <section class="section-padding container">
      <div class="section-title-wrap">
        <span class="section-subtitle">আমাদের কালেকশন</span>
        <h2 class="section-title">পণ্য ক্যাটাগরি</h2>
      </div>
      <div class="categories-grid">
        ${['Skin Care', 'Hair Care', 'Serum', 'Cleanser', 'Sunscreen', 'Home Appliances', 'Electronics', 'Imported Fruits', 'Islamic Products']
          .map(cat => `
            <div class="category-card" onclick="window.location.hash='#/products?category=${encodeURIComponent(cat)}'">
              <div class="category-icon">
                <i class="fa-solid ${getCategoryIcon(cat)}"></i>
              </div>
              <p class="category-title">${cat}</p>
            </div>
          `).join('')}
      </div>
    </section>

    <!-- Featured Grid -->
    <section class="section-padding container">
      <div class="section-title-wrap">
        <span class="section-subtitle">অনবদ্য কালেকশন</span>
        <h2 class="section-title">ফিচার্ড প্রোডাক্টস</h2>
      </div>
      <div class="products-grid">
        ${featured.map(p => generateProductCardHtml(p)).join('')}
      </div>
    </section>
  `;
}

function getCategoryIcon(cat) {
  switch (cat) {
    case 'Skin Care': return 'fa-face-smile-beam';
    case 'Hair Care': return 'fa-wand-magic-sparkles';
    case 'Serum': return 'fa-droplet';
    case 'Cleanser': return 'fa-soap';
    case 'Sunscreen': return 'fa-sun';
    case 'Home Appliances': return 'fa-blender';
    case 'Electronics': return 'fa-tv';
    case 'Imported Fruits': return 'fa-apple-whole';
    case 'Islamic Products': return 'fa-mosque';
    default: return 'fa-border-all';
  }
}

function generateProductCardHtml(product) {
  const discount = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  return `
    <div class="product-card">
      ${discount > 0 ? `<div class="discount-badge">${discount}% ছাড়</div>` : ''}
      <div class="product-image-container" onclick="window.location.hash='#/product/${product.id}'" style="cursor: pointer;">
        <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
      </div>
      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <a href="#/product/${product.id}"><h3 class="product-title">${product.name}</h3></a>
        <div class="product-pricing">
          <span class="price-offer">৳${product.price}</span>
          ${product.mrp > product.price ? `<span class="price-mrp">৳${product.mrp}</span>` : ''}
        </div>
        <div class="product-actions-btn">
          <button class="btn-add-cart" onclick="addToCart('${product.id}', 1)" title="কার্টে যোগ করুন"><i class="fa-solid fa-basket-shopping"></i></button>
          <button class="btn-buy-now" onclick="buyNow('${product.id}')">কিনুন</button>
        </div>
      </div>
    </div>
  `;
}

function renderProducts(target, params) {
  const categoryFilter = params.get('category');
  const searchFilter = params.get('search');
  
  let filtered = [...products];
  let pageTitle = "সব প্রোডাক্ট";

  if (categoryFilter) {
    filtered = filtered.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase());
    pageTitle = `${categoryFilter} কালেকশন`;
  } else if (searchFilter) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchFilter.toLowerCase()) || p.brand.toLowerCase().includes(searchFilter.toLowerCase()));
    pageTitle = `অনুসন্ধান ফলাফল: "${searchFilter}"`;
  }

  target.innerHTML = `
    <div class="container section-padding">
      <div class="section-title-wrap">
        <h2 class="section-title">${pageTitle}</h2>
        <p class="mt-3" style="color: var(--light-text);">${filtered.length} টি পণ্য পাওয়া গেছে</p>
      </div>
      
      <div class="products-grid">
        ${filtered.length > 0 ? filtered.map(p => generateProductCardHtml(p)).join('') : '<p class="text-center col-span-all" style="grid-column: 1/-1; padding: 40px 0;">কোন পণ্য খুঁজে পাওয়া যায়নি।</p>'}
      </div>
    </div>
  `;
}

function renderProductDetail(target, id) {
  const item = products.find(p => p.id === id);
  if (!item) {
    target.innerHTML = `<div class="container section-padding text-center"><h2>পণ্যটি পাওয়া যায়নি</h2></div>`;
    return;
  }

  const discount = item.mrp > item.price ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;
  const specRows = Object.entries(item.specs || {}).map(([key, val]) => `
    <tr>
      <td>${key}</td>
      <td>${val}</td>
    </tr>
  `).join('');

  target.innerHTML = `
    <div class="container section-padding">
      <div class="product-details-grid">
        <div class="details-image-gallery">
          <div class="main-preview-container">
            <img src="${item.images[0]}" id="main-product-preview" alt="${item.name}">
          </div>
        </div>
        <div class="details-content-panel">
          <span class="product-category" style="font-size: 0.9rem; font-weight: bold; color: var(--secondary-color);">${item.category}</span>
          <h1 class="mt-3">${item.name}</h1>
          <p style="color: var(--light-text); font-weight: 500;">ব্র্যান্ড: ${item.brand}</p>
          
          <div class="details-price-tag">
            <span class="offer">৳${item.price}</span>
            ${item.mrp > item.price ? `<span class="mrp">৳${item.mrp}</span> <div class="discount-badge" style="position:relative; top:0; left:0;">${discount}% ছাড়</div>` : ''}
          </div>

          <p class="mb-3"><strong>পণ্যের বিবরণী:</strong><br>${item.description}</p>

          <div class="details-qty-wrapper">
            <span>পরিমাণ:</span>
            <div class="qty-control">
              <button onclick="updateDetailsQty(-1)">-</button>
              <input type="number" id="details-qty-input" value="1" min="1">
              <button onclick="updateDetailsQty(1)">+</button>
            </div>
          </div>

          <div class="actions-layout">
            <button class="btn-details-cart" onclick="addCurrentProductToCart('${item.id}')"><i class="fa-solid fa-cart-shopping"></i> কার্টে যোগ করুন</button>
            <button class="btn-details-wa" onclick="checkoutViaWhatsApp('${item.id}')"><i class="fa-brands fa-whatsapp"></i> হোয়াটসঅ্যাপে অর্ডার</button>
          </div>
          
          <div class="details-desc-tab">
            <h3>স্পেসিফিকেশন ও ফিচারসমূহ</h3>
            <table class="spec-table">
              <tbody>
                ${specRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateDetailsQty(diff) {
  const input = document.getElementById('details-qty-input');
  let val = parseInt(input.value) + diff;
  if (val < 1) val = 1;
  input.value = val;
}

function addCurrentProductToCart(id) {
  const qty = parseInt(document.getElementById('details-qty-input').value) || 1;
  addCurrentProductToCartWithQty(id, qty);
}

function addCurrentProductToCartWithQty(id, qty) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      qty: qty
    });
  }
  saveCartToLocal();
  alert("সাফল্যের সাথে কার্টে যুক্ত হয়েছে।");
}

// Shopping Cart Code
function addToCart(id, qty) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      qty: qty
    });
  }
  saveCartToLocal();
  alert("সাফল্যের সাথে কার্টে যুক্ত হয়েছে।");
}

function buyNow(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.find(item => item.id === id);
  if (!existing) {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      qty: 1
    });
  }
  saveCartToLocal();
  window.location.hash = '#/checkout';
}

function updateCartQty(id, qty) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.qty = qty;
    if (item.qty <= 0) {
      cart = cart.filter(i => i.id !== id);
    }
    saveCartToLocal();
    router();
  }
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCartToLocal();
  router();
}

function renderCart(target) {
  if (cart.length === 0) {
    target.innerHTML = `
      <div class="container section-padding text-center">
        <i class="fa-solid fa-basket-shopping" style="font-size: 4rem; color: var(--gray-light); margin-bottom: 20px;"></i>
        <h2>আপনার কার্টটি শূন্য</h2>
        <a href="#/products" class="btn-royal mt-3">কেনাকাটা শুরু করুন</a>
      </div>
    `;
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const shippingCharge = 60;
  const totalAmount = subtotal + shippingCharge;

  target.innerHTML = `
    <div class="container section-padding">
      <div class="section-title-wrap">
        <h2 class="section-title">আপনার শপিং কার্ট</h2>
      </div>
      <div class="cart-layout">
        <div class="cart-table-panel">
          ${cart.map(item => `
            <div class="cart-item-row">
              <img src="${item.image}" alt="${item.name}" class="cart-item-img">
              <div>
                <h4 style="font-size: 0.95rem; line-height:1.4;">${item.name}</h4>
                <p style="color: var(--primary-color); font-weight: bold; margin-top: 5px;">৳${item.price}</p>
              </div>
              <div class="qty-control" style="width: fit-content;">
                <button onclick="updateCartQty('${item.id}', ${item.qty - 1})">-</button>
                <input type="number" readonly value="${item.qty}">
                <button onclick="updateCartQty('${item.id}', ${item.qty + 1})">+</button>
              </div>
              <button onclick="removeFromCart('${item.id}')" style="background:transparent; border:none; color: var(--danger); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          `).join('')}
        </div>
        <div class="cart-summary-panel">
          <h3>অর্ডার বিবরণী</h3>
          <div class="summary-row mt-3">
            <span>সাবটোটাল:</span>
            <span>৳${subtotal}</span>
          </div>
          <div class="summary-row">
            <span>ডেলিভারি চার্জ:</span>
            <span>৳${shippingCharge}</span>
          </div>
          <div class="summary-row summary-total">
            <span>সর্বমোট:</span>
            <span>৳${totalAmount}</span>
          </div>
          <a href="#/checkout" class="btn-royal btn-block mt-3" style="text-align: center;">অর্ডার সম্পন্ন করুন</a>
        </div>
      </div>
    </div>
  `;
}

function renderCheckout(target) {
  if (cart.length === 0) {
    window.location.hash = '#/cart';
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const delivery = 60;
  const total = subtotal + delivery;

  target.innerHTML = `
    <div class="container section-padding">
      <div class="checkout-grid">
        <div class="checkout-card">
          <h3 class="mb-3">ডেলিভারি ঠিকানা ও তথ্য</h3>
          <form id="order-submit-form">
            <div class="form-group">
              <label>আপনার নাম *</label>
              <input type="text" id="cust-name" class="form-control" required placeholder="যেমন: তানভীর হাসান">
            </div>
            <div class="form-group">
              <label>মোবাইল নাম্বার *</label>
              <input type="tel" id="cust-phone" class="form-control" required placeholder="যেমন: 01822788322">
            </div>
            <div class="form-group">
              <label>সম্পূর্ণ ঠিকানা *</label>
              <textarea id="cust-address" class="form-control" required rows="3" placeholder="গ্রাম/মহল্লা, থানা, জেলা"></textarea>
            </div>
            
            <h3 class="mb-3 mt-3">পেমেন্ট মেথড</h3>
            <div class="payment-methods-grid">
              <div class="payment-method-selector active" onclick="selectPaymentMethod('Cash On Delivery', this)">
                <i class="fa-solid fa-hand-holding-dollar"></i>
                <p style="font-size:0.85rem; font-weight:bold;">ক্যাশ অন ডেলিভারি</p>
              </div>
              <div class="payment-method-selector" onclick="selectPaymentMethod('bKash', this)">
                <i class="fa-solid fa-wallet"></i>
                <p style="font-size:0.85rem; font-weight:bold;">বিকাশ (bKash)</p>
              </div>
              <div class="payment-method-selector" onclick="selectPaymentMethod('Nagad', this)">
                <i class="fa-solid fa-mobile-screen"></i>
                <p style="font-size:0.85rem; font-weight:bold;">নগদ (Nagad)</p>
              </div>
            </div>
            <input type="hidden" id="selected-payment" value="Cash On Delivery">

            <button type="submit" class="btn-royal btn-block mt-3" style="padding:15px; font-size:1.1rem;">অর্ডার কনফার্ম করুন (৳${total})</button>
          </form>
        </div>

        <div class="checkout-card" style="height: fit-content; background-color: #FDFBF7;">
          <h3 class="mb-3">আপনার অর্ডার</h3>
          <div style="max-height: 250px; overflow-y: auto; margin-bottom: 20px;">
            ${cart.map(item => `
              <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:0.9rem; border-bottom:1px solid var(--gray-light); padding-bottom:5px;">
                <span>${item.name} <strong>x ${item.qty}</strong></span>
                <span>৳${item.price * item.qty}</span>
              </div>
            `).join('')}
          </div>
          <div class="summary-row">
            <span>সাবটোটাল:</span>
            <span>৳${subtotal}</span>
          </div>
          <div class="summary-row">
            <span>ডেলিভারি চার্জ:</span>
            <span>৳${delivery}</span>
          </div>
          <div class="summary-row summary-total">
            <span>মোট খরচ:</span>
            <span>৳${total}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('order-submit-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const phoneInput = document.getElementById('cust-phone').value.trim();
    const cleanPhone = phoneInput.replace(/[\s\-\+]/g, '');
    
    if (cleanPhone.length < 11 || cleanPhone.length > 13) {
      alert("দুঃখিত, অনুগ্রহ করে একটি সঠিক মোবাইল নাম্বার প্রদান করুন (যেমন: 01822788322)");
      return;
    }
    
    processOrderPlacement(subtotal, delivery, total);
  });
}

function selectPaymentMethod(method, el) {
  document.querySelectorAll('.payment-method-selector').forEach(sel => sel.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('selected-payment').value = method;
}

// Order placement with real-time Cloud sync to dashboard (Do not modify logic)
async function processOrderPlacement(subtotal, delivery, total) {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const payment = document.getElementById('selected-payment').value;

  const orderId = "FM-" + Math.floor(1000 + Math.random() * 9000);

  const newOrder = {
    id: orderId,
    customer: { name, phone, address },
    items: [...cart],
    subtotal,
    delivery,
    total,
    payment,
    status: "pending",
    date: new Date().toLocaleDateString()
  };

  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: {
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Access-Key': JSONBIN_API_KEY
      }
    });
    const data = await response.json();
    if (data.record) {
      if (Array.isArray(data.record)) {
        products = data.record;
      } else {
        products = data.record.products || [];
        orders = data.record.orders || [];
      }
    }
  } catch (e) {
    console.warn("Could not fetch latest orders before posting.", e);
  }

  orders.push(newOrder);
  await saveCloudData();
  
  cart = [];
  saveCartToLocal();

  const appViewport = document.getElementById('app-viewport');
  appViewport.innerHTML = `
    <div class="container section-padding text-center">
      <i class="fa-solid fa-circle-check" style="font-size: 5rem; color: var(--success); margin-bottom: 20px;"></i>
      <h2>আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!</h2>
      <p class="mt-3">অর্ডার আইডি: <strong>${orderId}</strong></p>
      <p style="color: var(--light-text);">খুব শীঘ্রই আমাদের প্রতিনিধি আপনার ঠিকানায় পণ্য পৌঁছে দিতে যোগাযোগ করবেন।</p>
      <a href="#/" class="btn-royal mt-3">হোম পেজে ফিরে যান</a>
    </div>
  `;
}

function checkoutViaWhatsApp(id) {
  const item = products.find(p => p.id === id);
  if (!item) return;
  const message = `হ্যালো Fakhir Mart, আমি এই প্রোডাক্টটি কিনতে চাই:\n\nপ্রোডাক্টের নাম: ${item.name}\nমূল্য: ৳${item.price}\n\nদয়া করে আমার অর্ডারটি বুক করুন।`;
  const url = `https://wa.me/8801822788322?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

function renderStaticPage(target, page) {
  let content = '';
  if (page === 'About') {
    content = `
      <h2>আমাদের সম্পর্কে</h2>
      <p>ফখির মার্ট (Fakhir Mart) হচ্ছে বাংলাদেশে রাজকীয় ও প্রিমিয়াম প্রসাধনী এবং অথেনটিক ইসলামিক সামগ্রীর এক নির্ভরযোগ্য প্রতিষ্ঠান। আমাদের মূল লক্ষ্য হচ্ছে গ্রাহকদের কাছে ১০০% খাঁটি, হালাল ও প্রিমিয়াম প্রোডাক্ট পৌঁছে দেওয়া। আমাদের যাত্রা শুরু হয়েছে ঢাকার নবাবগঞ্জ থেকে।</p>
    `;
  } else if (page === 'Contact') {
    content = `
      <h2>যোগাযোগ করুন</h2>
      <div style="margin-top:20px;">
        <p><strong><i class="fa-solid fa-location-dot"></i> ঠিকানা:</strong> Nababganj, Dhaka, Bangladesh</p>
        <p><strong><i class="fa-solid fa-phone"></i> ফোন ও হোয়াটসঅ্যাপ:</strong> 01822788322</p>
        <p><strong><i class="fa-solid fa-envelope"></i> ইমেইল:</strong> fakhir.mart@gmail.com</p>
      </div>
    `;
  } else if (page === 'Privacy') {
    content = `
      <h2>প্রাইভেসি পলিসি</h2>
      <p>আমরা গ্রাহকদের তথ্যের গোপনীয়তা রক্ষায় সর্বোচ্চ প্রতিশ্রুতিবদ্ধ। আপনার অর্ডার সফলভাবে পরিচালনার জন্য প্রয়োজনীয় তথ্য ছাড়া কোনো ব্যক্তিগত ডাটা আমরা সংরক্ষণ করি না।</p>
    `;
  } else if (page === 'Terms') {
    content = `
      <h2>শর্তাবলী</h2>
      <p>Fakhir Mart ই-কমার্স প্ল্যাটফর্মটি ব্যবহারের মাধ্যমে আপনি আমাদের সকল নিয়মাবলি মেনে নিতে সম্মত হয়েছেন। ক্যাশ অন ডেলিভারির মাধ্যমে পণ্য বুঝে পাওয়ার সময় মূল পরিশোধযোগ্য মূল্য সম্পূর্ণরূপে পরিশোধ করার জন্য অনুরোধ করা হচ্ছে।</p>
    `;
  } else {
    content = `
      <h2>রিটার্ন ও রিফান্ড পলিসি</h2>
      <p>পণ্য ডেলিভারি পাওয়ার পর কোনো প্রকার ত্রুটি পরিলক্ষিত হলে বা প্যাকেজিং নষ্ট থাকলে ২৪ ঘণ্টার মধ্যে আমাদের সাপোর্ট লাইনে যোগাযোগ করুন। যৌথিক কারণে পণ্য ফেরত দেওয়া ও রিফান্ড প্রক্রিয়া সহজতর করতে আমরা বদ্ধপরিকর।</p>
    `;
  }

  target.innerHTML = `
    <div class="container section-padding">
      <div class="checkout-card" style="max-width:800px; margin: 0 auto; line-height:1.8;">
        ${content}
      </div>
    </div>
  `;
}

/* =======================================
   ADMIN CONTROL PANEL ENGINE
======================================= */
function renderAdmin(target) {
  const isAdminLoggedIn = sessionStorage.getItem('fm_admin_logged');
  if (!isAdminLoggedIn) {
    renderAdminLogin(target);
    return;
  }

  target.innerHTML = `
    <div class="container section-padding">
      <div class="admin-grid">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-header">
            <h3>Fakhir Admin</h3>
            <p style="font-size:0.8rem; color:var(--secondary-color);">Management Center</p>
          </div>
          <ul class="admin-sidebar-menu">
            <li class="admin-menu-item active" onclick="switchAdminTab('dashboard', this)"><i class="fa-solid fa-chart-line"></i> ড্যাশবোর্ড</li>
            <li class="admin-menu-item" onclick="switchAdminTab('products', this)"><i class="fa-solid fa-boxes-stacked"></i> প্রোডাক্টস</li>
            <li class="admin-menu-item" onclick="switchAdminTab('orders', this)"><i class="fa-solid fa-truck-ramp-box"></i> অর্ডারসমূহ</li>
            <li class="admin-menu-item" style="color:var(--danger);" onclick="logoutAdmin()"><i class="fa-solid fa-power-off"></i> লগআউট</li>
          </ul>
        </aside>
        <div class="admin-viewport" id="admin-subview">
          <!-- Nested inside routing -->
        </div>
      </div>
    </div>
  `;
  loadAdminDashboardView();
}

function renderAdminLogin(target) {
  target.innerHTML = `
    <div class="container section-padding" style="display:flex; justify-content:center;">
      <div class="checkout-card" style="width:100%; max-width:400px;">
        <h3 class="text-center mb-3">এডমিন লগইন</h3>
        <form id="admin-login-form">
          <div class="form-group">
            <label>এডমিন আইডি (Email)</label>
            <input type="text" id="admin-username" class="form-control" required value="fakhir.mart@gmail.com">
          </div>
          <div class="form-group">
            <label>পাসওয়ার্ড</label>
            <input type="password" id="admin-password" class="form-control" required placeholder="••••••••" value="fakhir123">
          </div>
          <button type="submit" class="btn-royal btn-block mt-3">লগইন করুন</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('admin-login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('admin-username').value;
    const pass = document.getElementById('admin-password').value;

    if (user === 'fakhir.mart@gmail.com' && pass === 'fakhir123') {
      sessionStorage.setItem('fm_admin_logged', 'true');
      router();
    } else {
      alert("ভুল ইউজার আইডি বা পাসওয়ার্ড প্রদান করেছেন!");
    }
  });
}

function logoutAdmin() {
  sessionStorage.removeItem('fm_admin_logged');
  router();
}

function switchAdminTab(tab, el) {
  document.querySelectorAll('.admin-menu-item').forEach(item => item.classList.remove('active'));
  el.classList.add('active');

  if (tab === 'dashboard') {
    loadAdminDashboardView();
  } else if (tab === 'products') {
    loadAdminProductsView();
  } else if (tab === 'orders') {
    loadAdminOrdersView();
  }
}

function loadAdminDashboardView() {
  const container = document.getElementById('admin-subview');
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
  const pending = orders.filter(o => o.status === 'pending').length;

  container.innerHTML = `
    <div class="section-title-wrap" style="text-align:left; margin-bottom:20px;">
      <h2>ওভারভিউ ড্যাশবোর্ড</h2>
    </div>
    <div class="dashboard-stats-grid">
      <div class="stat-box">
        <p class="stat-title">সর্বমোট প্রোডাক্ট</p>
        <p class="stat-value">${products.length}</p>
      </div>
      <div class="stat-box">
        <p class="stat-title">সর্বমোট বিক্রয়</p>
        <p class="stat-value">৳${totalSales}</p>
      </div>
      <div class="stat-box">
        <p class="stat-title">পেন্ডিং অর্ডার</p>
        <p class="stat-value">${pending}</p>
      </div>
    </div>
  `;
}

function loadAdminProductsView() {
  const container = document.getElementById('admin-subview');
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h2>প্রোডাক্ট লিস্ট</h2>
      <button class="btn-royal" onclick="openAddProductModal()" style="padding: 8px 15px; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> নতুন প্রোডাক্ট</button>
    </div>
    <div id="product-edit-form-container"></div>
    <div class="table-responsive-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ছবি</th>
            <th>নাম</th>
            <th>ক্যাটাগরি</th>
            <th>মূল্য (৳)</th>
            <th>অ্যাকশন</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><img src="${p.images[0]}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;"></td>
              <td><strong>${p.name}</strong></td>
              <td>${p.category}</td>
              <td>৳${p.price}</td>
              <td>
                <button class="btn-royal" onclick="openEditProductForm('${p.id}')" style="padding: 4px 10px; font-size: 0.75rem;"><i class="fa-solid fa-pen-to-square"></i> এডিট</button>
                <button class="btn-royal" onclick="deleteProduct('${p.id}')" style="background-color: var(--danger); padding: 4px 10px; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i> ডিলিট</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAddProductModal() {
  const formDiv = document.getElementById('product-edit-form-container');
  formDiv.innerHTML = `
    <div class="checkout-card mb-3" style="background-color: #F8F7F3;">
      <h3 class="mb-3">নতুন প্রোডাক্ট যুক্ত করুন</h3>
      <form id="new-prod-form">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
          <div class="form-group">
            <label>প্রোডাক্টের নাম *</label>
            <input type="text" id="new-p-name" class="form-control" required>
          </div>
          <div class="form-group">
            <label>ব্র্যান্ড *</label>
            <input type="text" id="new-p-brand" class="form-control" required>
          </div>
          <div class="form-group">
            <label>ক্যাটাগরি *</label>
            <input type="text" id="new-p-cat" class="form-control" required placeholder="যেমন: Skin Care">
          </div>
          <div class="form-group">
            <label>ছবি ইউআরএল (Image Link) *</label>
            <input type="text" id="new-p-img" class="form-control" required placeholder="এখানে ImgBB ছবির লিঙ্ক দিন">
          </div>
          <div class="form-group">
            <label>মেইন প্রাইস (MRP) *</label>
            <input type="number" id="new-p-mrp" class="form-control" required>
          </div>
          <div class="form-group">
            <label>বিক্রয় মূল্য *</label>
            <input type="number" id="new-p-price" class="form-control" required>
          </div>
        </div>
        <div class="form-group">
          <label>বিস্তারিত বিবরণ *</label>
          <textarea id="new-p-desc" class="form-control" rows="3" required></textarea>
        </div>
        <button type="submit" class="btn-royal" style="padding: 10px 20px;">সংরক্ষণ করুন</button>
        <button type="button" class="btn-royal" style="background:transparent; color:var(--primary-color); margin-left:10px;" onclick="document.getElementById('product-edit-form-container').innerHTML=''">বাতিল করুন</button>
      </form>
    </div>
  `;

  document.getElementById('new-prod-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('new-p-name').value;
    const brand = document.getElementById('new-p-brand').value;
    const category = document.getElementById('new-p-cat').value;
    const img = document.getElementById('new-p-img').value;
    const mrp = parseInt(document.getElementById('new-p-mrp').value);
    const price = parseInt(document.getElementById('new-p-price').value);
    const description = document.getElementById('new-p-desc').value;

    const newProd = {
      id: "p_" + Date.now(),
      name, brand, category, mrp, price, description,
      specs: { "Volume": "Unknown", "Origin": "Global" },
      images: [img],
      featured: true, latest: true, bestSeller: false
    };

    products.push(newProd);
    await saveCloudData();
    loadAdminProductsView();
  });
}

function openEditProductForm(id) {
  const item = products.find(p => p.id === id);
  if (!item) return;

  const specString = Object.entries(item.specs || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const container = document.getElementById('product-edit-form-container');
  container.innerHTML = `
    <div class="checkout-card mb-3" style="background-color: #F8F7F3; border: 2px solid var(--secondary-color);">
      <h3 class="mb-3">প্রোডাক্ট এডিট করুন: ${item.name}</h3>
      <form id="edit-prod-submit-form">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
          <div class="form-group">
            <label>প্রোডাক্টের নাম *</label>
            <input type="text" id="edit-p-name" class="form-control" value="${item.name}" required>
          </div>
          <div class="form-group">
            <label>ব্র্যান্ড *</label>
            <input type="text" id="edit-p-brand" class="form-control" value="${item.brand}" required>
          </div>
          <div class="form-group">
            <label>ক্যাটাগরি *</label>
            <input type="text" id="edit-p-cat" class="form-control" value="${item.category}" required>
          </div>
          <div class="form-group">
            <label>ছবি লিঙ্ক (ImgBB লিঙ্ক এখানে পেস্ট করুন) *</label>
            <input type="text" id="edit-p-img" class="form-control" value="${item.images[0]}" required>
          </div>
          <div class="form-group">
            <label>মেইন প্রাইস (MRP) *</label>
            <input type="number" id="edit-p-mrp" class="form-control" value="${item.mrp}" required>
          </div>
          <div class="form-group">
            <label>অফার প্রাইস (৳) *</label>
            <input type="number" id="edit-p-price" class="form-control" value="${item.price}" required>
          </div>
        </div>

        <div class="form-group">
          <label>পণ্যের বিবরণী (Product Description) *</label>
          <textarea id="edit-p-desc" class="form-control" rows="4" required>${item.description}</textarea>
        </div>

        <div class="form-group">
          <label>স্পেসিফিকেশন ও ফিচারসমূহ (প্রতি লাইনে একটি করে রাখুন) *</label>
          <textarea id="edit-p-specs" class="form-control" rows="4" required>${specString}</textarea>
        </div>

        <button type="submit" class="btn-royal" style="padding: 10px 20px;">তথ্য আপডেট করুন</button>
        <button type="button" class="btn-royal" style="background:transparent; color:var(--primary-color); margin-left:10px;" onclick="document.getElementById('product-edit-form-container').innerHTML=''">বাতিল করুন</button>
      </form>
    </div>
  `;

  document.getElementById('edit-prod-submit-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const rawSpecs = document.getElementById('edit-p-specs').value.split('\n');
    const parsedSpecs = {};
    rawSpecs.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        parsedSpecs[parts[0].trim()] = parts[1].trim();
      }
    });

    item.name = document.getElementById('edit-p-name').value;
    item.brand = document.getElementById('edit-p-brand').value;
    item.category = document.getElementById('edit-p-cat').value;
    item.images[0] = document.getElementById('edit-p-img').value;
    item.mrp = parseInt(document.getElementById('edit-p-mrp').value);
    item.price = parseInt(document.getElementById('edit-p-price').value);
    item.description = document.getElementById('edit-p-desc').value;
    item.specs = parsedSpecs;

    await saveCloudData();
    alert("সাফল্যের সাথে প্রোডাক্টের তথ্য ও ইমেজ ক্লাউডে আপডেট করা হয়েছে। এটি এখন গ্লোবালি সব ডিভাইসে কার্যকর হবে।");
    document.getElementById('product-edit-form-container').innerHTML = '';
    loadAdminProductsView();
  });
}

async function deleteProduct(id) {
  if (confirm("আপনি কি নিশ্চিতভাবে এই প্রোডাক্টটি ডিলিট করতে চান?")) {
    products = products.filter(p => p.id !== id);
    await saveCloudData();
    loadAdminProductsView();
  }
}

function loadAdminOrdersView() {
  const container = document.getElementById('admin-subview');
  container.innerHTML = `
    <div class="section-title-wrap" style="text-align:left; margin-bottom:20px;">
      <h2>গ্রাহকদের অর্ডার সমূহ</h2>
    </div>
    <div class="table-responsive-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>অর্ডার আইডি</th>
            <th>গ্রাহক তথ্য</th>
            <th>তারিখ</th>
            <th>মোট বিল</th>
            <th>পেমেন্ট</th>
            <th>অবস্থা</th>
            <th>অ্যাকশন</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><strong>${o.id}</strong></td>
              <td>
                <p><strong>${o.customer.name}</strong></p>
                <p style="font-size:0.8rem; color:var(--light-text);">${o.customer.phone}</p>
                <p style="font-size:0.8rem; color:var(--light-text);">${o.customer.address}</p>
              </td>
              <td>${o.date}</td>
              <td>৳${o.total}</td>
              <td>${o.payment}</td>
              <td><span class="badge-status ${o.status}">${o.status}</span></td>
              <td>
                <select onchange="updateOrderStatus('${o.id}', this.value)" style="padding:5px; border-radius:4px; font-family:inherit;">
                  <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                  <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
                  <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function updateOrderStatus(id, newStatus) {
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = newStatus;
    await saveCloudData();
    alert("অর্ডারের স্টেটাস গ্লোবালি আপডেট করা হয়েছে।");
    loadAdminOrdersView();
  }
}
