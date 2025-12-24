// --- Download PDF and Reset Sales ---
let lastReportData = { range: 'today', sales: [], total: 0, count: 0 };

if (typeof window.jspdf === 'undefined' && window.jspdf == null && window.jspdf == undefined) {
    window.jspdf = window.jspdf || window.jspdf;
}

const downloadBtn = document.getElementById('downloadPdfBtn');
const resetBtn = document.getElementById('resetSalesBtn');

if (downloadBtn) {
    downloadBtn.onclick = function() {
        if (!lastReportData.sales.length) {
            alert('No sales to download.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Sales Report', 10, 15);
        doc.setFontSize(12);
        doc.text(`Range: ${lastReportData.range.charAt(0).toUpperCase() + lastReportData.range.slice(1)}`, 10, 25);
        doc.text(`Total Sales: ${lastReportData.count}`, 10, 32);
        doc.text(`Total Amount: ₹${lastReportData.total.toFixed(2)}`, 10, 39);
        let y = 48;
        doc.setFontSize(11);
        doc.text('Date', 10, y);
        doc.text('Items', 60, y);
        doc.text('Total', 170, y, { align: 'right' });
        y += 6;
        lastReportData.sales.forEach(sale => {
            let date = new Date(sale.timestamp).toLocaleString();
            let items = sale.order.map(i => `${i.name} x${i.qty}`).join(', ');
            doc.text(date, 10, y);
            doc.text(items, 60, y);
            doc.text(`₹${(sale.total || 0).toFixed(2)}`, 170, y, { align: 'right' });
            y += 7;
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
        });
        doc.save(`sales_report_${lastReportData.range}_${new Date().toISOString().slice(0,10)}.pdf`);
    };
}

if (resetBtn) {
    resetBtn.onclick = function() {
        if (confirm('Are you sure you want to reset all sales data? This cannot be undone.')) {
            localStorage.setItem('restaurant_sales', '[]');
            showReport(lastReportData.range);
        }
    };
}
// --- Menu Data Management (localStorage CRUD) ---
const MENU_KEY = 'restaurant_menu';
const CART_KEY = 'restaurant_cart';

function getMenu() {
    return JSON.parse(localStorage.getItem(MENU_KEY)) || [];
}
function setMenu(menu) {
    localStorage.setItem(MENU_KEY, JSON.stringify(menu));
}
function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
}
function setCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// --- UI Rendering ---
function renderMenu() {
    const menu = getMenu();
    const menuDiv = document.getElementById('menuItems');
    menuDiv.innerHTML = '';
    menu.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}" data-idx="${idx}">
            <h3>${item.name}</h3>
            <p>₹${item.price.toFixed(2)}</p>
        `;
        div.querySelector('img').onclick = () => addToCart(idx);
        menuDiv.appendChild(div);
    });
}

// Cart is now an array of {idx, qty}
function renderCart() {
    const cart = getCart();
    const menu = getMenu();
    const cartDiv = document.getElementById('cartItems');
    cartDiv.innerHTML = '';
    let total = 0;
    cart.forEach((entry, i) => {
        const item = menu[entry.idx];
        if (!item) return;
        total += item.price * entry.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <span>${item.name} - ₹${item.price.toFixed(2)}</span>
            <div style="display:inline-flex;align-items:center;gap:0.5em;margin-left:1em;">
                <button onclick="updateCartQty(${i},-1)">-</button>
                <span>${entry.qty}</span>
                <button onclick="updateCartQty(${i},1)">+</button>
            </div>
            <button onclick="removeFromCart(${i})" style="margin-left:1em;">Remove</button>
        `;
        cartDiv.appendChild(div);
    });
    document.getElementById('cartTotal').textContent = `Total: ₹${total.toFixed(2)}`;
}

// --- Cart Operations ---
function addToCart(idx) {
    let cart = getCart();
    let found = cart.find(entry => entry.idx === idx);
    if (found) {
        found.qty += 1;
    } else {
        cart.push({ idx, qty: 1 });
    }
    setCart(cart);
    renderCart();
}
function removeFromCart(cartIdx) {
    const cart = getCart();
    cart.splice(cartIdx, 1);
    setCart(cart);
    renderCart();
}

function updateCartQty(cartIdx, delta) {
    let cart = getCart();
    if (!cart[cartIdx]) return;
    cart[cartIdx].qty += delta;
    if (cart[cartIdx].qty < 1) cart[cartIdx].qty = 1;
    setCart(cart);
    renderCart();
}

// --- Pay Now (QR Code) ---
document.getElementById('payNowBtn').onclick = function() {
    const cart = getCart();
    const menu = getMenu();
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }
    let order = cart.map(entry => `${menu[entry.idx]?.name} x${entry.qty}`).join(', ');
    let total = cart.reduce((sum, entry) => sum + (menu[entry.idx]?.price || 0) * entry.qty, 0);
    let upiId = 'abc123@okicici';
    let upiPayUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Account Holder Name')}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(order)}`;
    let qrDiv = document.getElementById('qrCodeContainer');
    qrDiv.innerHTML = `<div style='text-align:center'>
        <canvas id='upiQrCanvas'></canvas>
        <div style='margin-top:0.7em;font-size:1.1em;color:#3730a3;'>Scan to pay<br><b>UPI: ${upiId}</b></div>
        <div style='margin-top:0.5em;color:#6366f1;font-weight:600;'>Order: ${order}<br>Total: ₹${total.toFixed(2)}</div>
        <div style='margin-top:0.7em;color:#333;font-size:0.95em;'>When you scan, the amount and order will show in your payment app automatically.</div>
        <button id='paymentDoneBtn' style='margin-top:1.2em;background:#27ae60;color:#fff;border:none;border-radius:8px;padding:0.7em 2em;font-size:1em;cursor:pointer;'>Payment Completed</button>
    </div>`;
    QRCode.toCanvas(document.getElementById('upiQrCanvas'), upiPayUrl, function (err) {
        if (err) alert('QR code error');
    });
    setTimeout(() => {
        const btn = document.getElementById('paymentDoneBtn');
        if (btn) {
            btn.onclick = function() {
                // Save sale to localStorage
                const cart = getCart();
                const menu = getMenu();
                if (cart.length > 0) {
                    let order = cart.map(entry => ({
                        name: menu[entry.idx]?.name,
                        qty: entry.qty,
                        price: menu[entry.idx]?.price
                    }));
                    let total = cart.reduce((sum, entry) => sum + (menu[entry.idx]?.price || 0) * entry.qty, 0);
                    let sales = JSON.parse(localStorage.getItem('restaurant_sales') || '[]');
                    sales.push({
                        order,
                        total,
                        timestamp: Date.now()
                    });
                    localStorage.setItem('restaurant_sales', JSON.stringify(sales));
                }
                setCart([]);
                renderCart();
                document.getElementById('qrCodeContainer').innerHTML = '';
            };
        }
    }, 100);

// --- Report Modal Logic ---
const reportBtn = document.getElementById('reportBtn');
const reportModal = document.getElementById('reportModal');
const closeReport = document.getElementById('closeReport');
const reportContent = document.getElementById('reportContent');

if (reportBtn && reportModal && closeReport && reportContent) {
    reportBtn.onclick = () => {
        showReport('today');
        reportModal.style.display = 'block';
    };
    closeReport.onclick = () => { reportModal.style.display = 'none'; };
    window.addEventListener('click', function(event) {
        if (event.target == reportModal) {
            reportModal.style.display = 'none';
        }
    });
    document.querySelectorAll('.report-range').forEach(btn => {
        btn.onclick = function() {
            showReport(this.getAttribute('data-range'));
        };
    });
}

function showReport(range) {
    let sales = JSON.parse(localStorage.getItem('restaurant_sales') || '[]');
    const now = new Date();
    let start;
    if (range === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (range === 'week') {
        const day = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
    } else if (range === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    } else if (range === 'year') {
        start = new Date(now.getFullYear(), 0, 1).getTime();
    } else {
        start = 0;
    }
    let filtered = sales.filter(sale => sale.timestamp >= start);
    let total = filtered.reduce((sum, sale) => sum + (sale.total || 0), 0);
    let count = filtered.length;
    lastReportData = { range, sales: filtered.slice().reverse(), total, count };
    let html = `<div style='margin-bottom:1em;'><b>${count}</b> sale(s), <b>₹${total.toFixed(2)}</b> total</div>`;
    if (filtered.length === 0) {
        html += '<div>No sales found for this period.</div>';
    } else {
        html += '<table style="width:100%;border-collapse:collapse;font-size:0.98em;">';
        html += '<tr style="background:#f1f5f9;"><th style="padding:4px 8px;">Date</th><th>Items</th><th>Total</th></tr>';
        lastReportData.sales.forEach(sale => {
            let date = new Date(sale.timestamp);
            let items = sale.order.map(i => `${i.name} x${i.qty}`).join(', ');
            html += `<tr><td style="padding:4px 8px;">${date.toLocaleString()}</td><td>${items}</td><td>₹${(sale.total || 0).toFixed(2)}</td></tr>`;
        });
        html += '</table>';
    }
    if (reportContent) reportContent.innerHTML = html;
}
};

// --- Admin Modal (Menu Management CRUD) ---
const adminBtn = document.getElementById('adminBtn');
const adminModal = document.getElementById('adminModal');
const closeAdmin = document.getElementById('closeAdmin');
adminBtn.onclick = () => { renderAdminMenu(); adminModal.style.display = 'block'; };
closeAdmin.onclick = () => { adminModal.style.display = 'none'; clearAdminForm(); };
window.onclick = function(event) {
    if (event.target == adminModal) {
        adminModal.style.display = 'none';
        clearAdminForm();
    }
};

function renderAdminMenu() {
    const menu = getMenu();
    const list = document.getElementById('adminMenuList');
    list.innerHTML = '';
    menu.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'admin-menu-item';
        div.innerHTML = `
            <span>${item.name} - $${item.price.toFixed(2)}</span>
            <div>
                <button onclick="editMenuItem(${idx})">Edit</button>
                <button class="delete-btn" onclick="deleteMenuItem(${idx})">Delete</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function clearAdminForm() {
    document.getElementById('editIndex').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemImage').value = '';
    document.getElementById('saveBtn').textContent = 'Add Item';
}

document.getElementById('menuForm').onsubmit = function(e) {
    e.preventDefault();
    const idx = document.getElementById('editIndex').value;
    const name = document.getElementById('itemName').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    const imageInput = document.getElementById('itemImage');
    const file = imageInput.files[0];
    let menu = getMenu();
    function saveMenuItem(imageData) {
        if (idx === '') {
            menu.push({ name, price, image: imageData });
        } else {
            menu[idx] = { name, price, image: imageData };
        }
        setMenu(menu);
        renderMenu();
        renderAdminMenu();
        clearAdminForm();
    }
    if (file) {
        const reader = new FileReader();
        reader.onload = function(ev) {
            saveMenuItem(ev.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        // If editing and no new file selected, keep previous image
        let imageData = (idx !== '' && menu[idx]) ? menu[idx].image : '';
        saveMenuItem(imageData);
    }
};

function editMenuItem(idx) {
    const menu = getMenu();
    const item = menu[idx];
    document.getElementById('editIndex').value = idx;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemImage').value = item.image;
    document.getElementById('saveBtn').textContent = 'Update Item';
}
function deleteMenuItem(idx) {
    let menu = getMenu();
    menu.splice(idx, 1);
    setMenu(menu);
    renderMenu();
    renderAdminMenu();
}

// --- Initial Render ---
window.onload = function() {
    // Always load menu from menu.json and override localStorage
    fetch('menu.json')
        .then(res => res.json())
        .then(data => {
            setMenu(data);
            renderMenu();
            renderCart();
        })
        .catch(() => {
            setMenu([
                { name: 'Pizza', price: 10, image: 'https://images.pexels.com/photos/315755/pexels-photo-315755.jpeg?auto=compress&w=400' },
                { name: 'Burger', price: 7, image: 'https://images.pexels.com/photos/1639567/pexels-photo-1639567.jpeg?auto=compress&w=400' },
                { name: 'Pasta', price: 8, image: 'https://images.pexels.com/photos/461382/pexels-photo-461382.jpeg?auto=compress&w=400' }
            ]);
            renderMenu();
            renderCart();
        });
};

// Expose removeFromCart for inline onclick
window.removeFromCart = removeFromCart;
window.editMenuItem = editMenuItem;
window.deleteMenuItem = deleteMenuItem;
window.updateCartQty = updateCartQty;

