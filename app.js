const STORE_KEY = 'loja-base-config-v1';
const PRODUCTS_KEY = 'loja-base-produtos-v1';
const ORDERS_KEY = 'loja-base-pedidos-v1';
const defaultStore = { name: 'Minha Loja', city: '', whatsapp: '', tagline: 'Escolha seus favoritos.', description: 'Produtos selecionados para você, com entrega na sua região.', deliveryFee: 0, pickup: true };
let store = load(STORE_KEY, defaultStore), products = load(PRODUCTS_KEY, []), cart = {}, editingProductId = null;
const $ = selector => document.querySelector(selector);
const db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let isAdmin = false;
function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)); }
function money(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0); }
function safe(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c])); }
function orderText(order) { const items = order.items.map(item => `- ${item.quantity}x ${item.name}: ${money(item.price * item.quantity)}`).join('\n'); return `NOVO PEDIDO ${order.id}\n\nCliente: ${order.customer}\nWhatsApp: ${order.phone}\nRecebimento: ${order.fulfillment}${order.address ? `\nEndereço: ${order.address}` : ''}\nPagamento: ${order.payment}\n\nItens:\n${items}\n\nTotal: ${money(order.total)}${order.note ? `\nObservação: ${order.note}` : ''}`; }
function whatsappUrl(order) { const phone = String(store.whatsapp || '').replace(/\D/g, ''); return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(orderText(order))}` : ''; }
function openModal(id) { $(`#${id}`).hidden = false; }
function closeModal(id) { $(`#${id}`).hidden = true; }
function toast(message) { const el = $('#toast'); el.textContent = message; el.hidden = false; setTimeout(() => { el.hidden = true; }, 2600); }
function cartItems() { return Object.entries(cart).map(([id, quantity]) => ({ product: products.find(item => item.id === id), quantity })).filter(item => item.product && item.quantity > 0); }
function cartSubtotal() { return cartItems().reduce((sum, item) => sum + item.product.price * item.quantity, 0); }
function updateStoreView() { $('#storeName').textContent = store.name; $('#storeCity').textContent = store.city ? `Entrega em ${store.city}` : 'Entrega local'; $('#storeTagline').textContent = store.tagline; $('#storeDescription').textContent = store.description; document.title = store.name; }
function renderCategories() {
  const select = $('#categoryFilter'), chosen = select.value;
  const categories = [...new Set(products.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="all">Todas as categorias</option>' + categories.map(category => `<option value="${safe(category)}">${safe(category)}</option>`).join('');
  select.value = categories.includes(chosen) ? chosen : 'all';
}
function visibleProducts() { const search = $('#searchInput').value.trim().toLowerCase(), category = $('#categoryFilter').value; return products.filter(item => (!search || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(search)) && (category === 'all' || item.category === category)); }
function renderProducts() {
  const visible = visibleProducts();
  $('#productGrid').innerHTML = visible.map(item => `<article class="product-card"><div class="product-visual">${safe(item.emoji || '📦')}</div><p class="product-category">${safe(item.category)}</p><h3>${safe(item.name)}</h3><p class="product-description">${safe(item.description || '')}</p><div class="product-bottom"><strong class="product-price">${money(item.price)}</strong><button class="add-btn" data-add="${item.id}">Adicionar</button></div></article>`).join('');
  $('#emptyProducts').hidden = visible.length > 0;
}
function renderCart() {
  const items = cartItems(), count = items.reduce((sum, item) => sum + item.quantity, 0);
  $('#cartCount').textContent = count; $('#cartTotal').textContent = money(cartSubtotal()); $('#checkoutBtn').disabled = !items.length; $('#cartEmpty').hidden = items.length > 0;
  $('#cartItems').innerHTML = items.map(({ product, quantity }) => `<div class="cart-row"><div class="cart-emoji">${safe(product.emoji || '📦')}</div><div><div class="cart-name">${safe(product.name)}</div><div class="cart-price">${money(product.price)} cada</div><div class="quantity-controls"><button data-minus="${product.id}">−</button><span>${quantity}</span><button data-plus="${product.id}">+</button></div></div><strong class="cart-row-total">${money(product.price * quantity)}</strong></div>`).join('');
}
function resetCart() { cart = {}; renderCart(); }
function renderAdminProducts() { $('#adminProducts').innerHTML = products.map(item => `<div class="admin-row"><div class="admin-row-info"><span>${safe(item.emoji || '📦')}</span><div><strong>${safe(item.name)}</strong><small>${safe(item.category)} · ${money(item.price)}</small></div></div><div class="admin-actions"><button data-edit="${item.id}">Editar</button><button data-remove="${item.id}">Excluir</button></div></div>`).join(''); }
function fillStoreForm() { $('#storeNameInput').value = store.name; $('#cityInput').value = store.city; $('#whatsappInput').value = store.whatsapp || ''; $('#taglineInput').value = store.tagline; $('#descriptionInput').value = store.description; $('#deliveryFeeInput').value = store.deliveryFee; $('#pickupInput').checked = store.pickup; }
function clearProductForm() { editingProductId = null; $('#productForm').reset(); $('#saveProductBtn').textContent = 'Adicionar produto'; }
function fillProductForm(item) { editingProductId = item.id; $('#productIdInput').value = item.id; $('#productNameInput').value = item.name; $('#productPriceInput').value = item.price; $('#productCategoryInput').value = item.category; $('#productEmojiInput').value = item.emoji; $('#saveProductBtn').textContent = 'Salvar produto'; }
function prepareCheckout() { $('#checkoutTotal').textContent = money(cartSubtotal() + (store.deliveryFee || 0)); $('#addressField').hidden = $('#fulfillmentInput').value !== 'delivery'; $('#fulfillmentInput').value = 'delivery'; $('#addressField').hidden = false; $('#pixPaymentBox').hidden = true; openModal('checkoutModal'); }
async function createDominipayPayment(order) { const { data, error } = await db.functions.invoke('hyper-api', { body: { amount: order.total, observation: `Pedido ${order.id}` } }); if (error) throw error; if (!data || !data.id) throw new Error(data?.error || 'A Dominipay não retornou o pagamento.'); return data; }
function pixResultHtml(payment) { if (!payment) return ''; const qr = payment.qrCodeBase64 ? `<img class="pix-result-qr" src="data:image/png;base64,${payment.qrCodeBase64}" alt="QR Code Pix">` : ''; const code = payment.qrCopyPaste ? `<textarea id="successPixCode" readonly>${safe(payment.qrCopyPaste)}</textarea><button class="secondary-btn" id="copySuccessPixBtn" type="button">Copiar Pix copia e cola</button>` : ''; return `<div class="pix-result"><strong>Pagamento Pix pendente</strong><p>Escaneie o QR Code ou copie o código abaixo para pagar.</p>${qr}${code}</div>`; }
function renderAll() { updateStoreView(); renderCategories(); renderProducts(); renderCart(); renderAdminProducts(); }

$('#searchInput').addEventListener('input', renderProducts); $('#categoryFilter').addEventListener('change', renderProducts);
$('#productGrid').addEventListener('click', event => { const button = event.target.closest('[data-add]'); if (!button) return; cart[button.dataset.add] = (cart[button.dataset.add] || 0) + 1; renderCart(); toast('Produto adicionado ao carrinho.'); });
$('#cartItems').addEventListener('click', event => { const plus = event.target.closest('[data-plus]'), minus = event.target.closest('[data-minus]'); if (plus) cart[plus.dataset.plus] = (cart[plus.dataset.plus] || 0) + 1; if (minus) { cart[minus.dataset.minus] -= 1; if (cart[minus.dataset.minus] <= 0) delete cart[minus.dataset.minus]; } renderCart(); });
$('#clearCartBtn').addEventListener('click', resetCart); $('#checkoutBtn').addEventListener('click', prepareCheckout);
$('#settingsBtn').addEventListener('click', async () => { await refreshAdmin(); fillStoreForm(); clearProductForm(); renderAdminProducts(); openModal('settingsModal'); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
document.querySelectorAll('.backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
$('#storeForm').addEventListener('submit', async event => {
  event.preventDefault();
  const next = { name: $('#storeNameInput').value.trim() || 'Minha Loja', city: $('#cityInput').value.trim(), whatsapp: $('#whatsappInput').value.trim(), tagline: $('#taglineInput').value.trim() || 'Escolha seus favoritos.', description: $('#descriptionInput').value.trim() || 'Produtos selecionados para você.', deliveryFee: Number($('#deliveryFeeInput').value || 0), pickup: $('#pickupInput').checked };
  const { data, error } = await db.from('store_settings').upsert({ id: 1, name: next.name, city: next.city, whatsapp: next.whatsapp, tagline: next.tagline, description: next.description, delivery_fee: next.deliveryFee, pickup: next.pickup, updated_at: new Date().toISOString() }).select();
  if (error || !data || !data.length) { toast('Não foi possível salvar. Entre novamente como dono da loja.'); return; }
  store = next; persist(); renderAll(); closeModal('settingsModal'); toast('Configurações salvas.');
});
$('#productForm').addEventListener('submit', async event => {
  event.preventDefault();
  const data = { name: $('#productNameInput').value.trim(), price: Number($('#productPriceInput').value), category: $('#productCategoryInput').value.trim() || 'Outros', emoji: $('#productEmojiInput').value.trim() || '📦' };
  const result = editingProductId
    ? await db.from('products').update(data).eq('id', editingProductId).select()
    : await db.from('products').insert({ ...data, description: 'Produto disponível para pedido.' }).select();
  if (result.error || !result.data || !result.data.length) { toast('Não foi possível salvar o produto. Entre novamente como dono da loja.'); return; }
  await reloadProducts(); clearProductForm(); toast('Produto salvo.');
});
$('#cancelProductBtn').addEventListener('click', clearProductForm);
$('#adminProducts').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-remove]');
  if (edit) { const item = products.find(product => product.id === edit.dataset.edit); if (item) fillProductForm(item); }
  if (remove) {
    const { data, error } = await db.from('products').delete().eq('id', remove.dataset.remove).select('id');
    if (error || !data || !data.length) { toast('Não foi possível excluir. Entre novamente como dono da loja.'); return; }
    delete cart[remove.dataset.remove]; await reloadProducts(); renderCart(); toast('Produto excluído.');
  }
});
$('#fulfillmentInput').addEventListener('change', () => { $('#addressField').hidden = $('#fulfillmentInput').value !== 'delivery'; $('#checkoutTotal').textContent = money(cartSubtotal() + ($('#fulfillmentInput').value === 'delivery' ? Number(store.deliveryFee || 0) : 0)); });
$('#checkoutForm').addEventListener('submit', async event => {
  event.preventDefault();
  const delivery = $('#fulfillmentInput').value === 'delivery';
  if (delivery && !$('#addressInput').value.trim()) { $('#addressInput').focus(); toast('Informe o endereço de entrega.'); return; }
  const order = { id: `PED-${Date.now().toString().slice(-6)}`, createdAt: new Date().toISOString(), customer: $('#customerNameInput').value.trim(), phone: $('#customerPhoneInput').value.trim(), fulfillment: delivery ? 'Entrega' : 'Retirada', address: $('#addressInput').value.trim(), payment: $('#paymentInput').value, note: $('#noteInput').value.trim(), items: cartItems().map(({ product, quantity }) => ({ name: product.name, quantity, price: product.price })), total: cartSubtotal() + (delivery ? Number(store.deliveryFee || 0) : 0) };
  const submitBtn = event.target.querySelector('button[type="submit"]'); submitBtn.disabled = true;
  let dominipayPayment = null;
  try {
    if (order.payment === 'Pix') dominipayPayment = await createDominipayPayment(order);
    const { error } = await db.from('orders').insert({ code: order.id, customer: order.customer, phone: order.phone, fulfillment: order.fulfillment, address: order.address, payment: order.payment, note: order.note, items: order.items, total: order.total, payment_status: dominipayPayment ? dominipayPayment.status : 'pending', dominipay_payment_id: dominipayPayment ? dominipayPayment.id : null });
    if (error) throw error;
  } catch (error) { console.error(error); toast(error.message || (order.payment === 'Pix' ? 'Não foi possível gerar o Pix. Tente novamente.' : 'Não foi possível enviar o pedido.')); submitBtn.disabled = false; return; }
  submitBtn.disabled = false;
  const orders = load(ORDERS_KEY, []); orders.push({ ...order, dominipayPaymentId: dominipayPayment?.id || null, paymentStatus: dominipayPayment?.status || 'pending' }); localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  const whatsapp = whatsappUrl(order), sendButton = whatsapp ? `<a class="whatsapp-order-btn" href="${whatsapp}" target="_blank" rel="noopener">Enviar pedido pelo WhatsApp</a>` : '<p class="muted">Configure o WhatsApp da loja em ⚙️ para enviar este pedido.</p>';
  resetCart(); $('#checkoutForm').hidden = true; $('#orderSuccess').hidden = false;
  $('#orderSuccess').innerHTML = `<strong>Pedido ${order.id}</strong><br>Pedido registrado com sucesso.${dominipayPayment ? pixResultHtml(dominipayPayment) : ''}<br>${sendButton}<br><button class="secondary-btn" id="newOrderBtn" type="button">Fazer novo pedido</button>`;
  if (dominipayPayment?.qrCopyPaste) $('#copySuccessPixBtn').addEventListener('click', async () => { await navigator.clipboard.writeText(dominipayPayment.qrCopyPaste); toast('Pix copia e cola copiado.'); });
  $('#newOrderBtn').addEventListener('click', () => { resetCart(); $('#checkoutForm').reset(); $('#checkoutForm').hidden = false; $('#orderSuccess').hidden = true; closeModal('checkoutModal'); });
});


async function loadRemote() {
  const [s, p] = await Promise.all([
    db.from('store_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('products').select('*').order('created_at', { ascending: true })
  ]);
  if (s.error) throw s.error;
  if (p.error) throw p.error;
  if (s.data) store = { name: s.data.name, city: s.data.city || '', whatsapp: s.data.whatsapp || '', tagline: s.data.tagline, description: s.data.description, deliveryFee: Number(s.data.delivery_fee || 0), pickup: !!s.data.pickup };
  products = p.data.map(row => ({ ...row, price: Number(row.price) }));
  persist();
}
async function reloadProducts() { await loadRemote(); renderAll(); }
async function refreshAdmin() {
  let session = null, admin = false, hasOwner = true;
  try {
    ({ data: { session } } = await db.auth.getSession());
    if (session) {
      const { data, error } = await db.rpc('is_admin'); admin = !error && data === true;
      if (!admin) { const owner = await db.rpc('store_has_owner'); hasOwner = owner.error ? true : owner.data === true; }
    }
  } catch { admin = false; }
  isAdmin = admin;
  $('#adminArea').hidden = !admin;
  $('#adminLogin').hidden = admin;
  $('#loginForm').hidden = !!session;
  $('#loginHint').hidden = !!session;
  $('#claimBox').hidden = !session || admin;
  $('#claimBtn').hidden = hasOwner;
  $('#claimText').textContent = hasOwner ? 'Esta conta não tem permissão de dono da loja.' : 'Conta pronta. Como a loja ainda não tem dono, você pode assumir essa função agora.';
}
$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const { error } = await db.auth.signInWithPassword({ email: $('#loginEmailInput').value.trim(), password: $('#loginPasswordInput').value });
  if (error) { toast('E-mail ou senha incorretos.'); return; }
  $('#loginForm').reset(); await refreshAdmin();
  if (isAdmin) { fillStoreForm(); renderAdminProducts(); }
});
$('#signupBtn').addEventListener('click', async () => {
  const email = $('#loginEmailInput').value.trim(), password = $('#loginPasswordInput').value;
  if (!email || password.length < 6) { toast('Informe o e-mail e uma senha com pelo menos 6 caracteres.'); return; }
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) { toast('Não foi possível criar a conta: ' + error.message); return; }
  if (!data.session) { toast('Conta criada. Confirme pelo e-mail que enviamos e depois toque em Entrar.'); return; }
  $('#loginForm').reset(); await refreshAdmin();
});
$('#claimBtn').addEventListener('click', async () => {
  const { data, error } = await db.rpc('claim_store_owner');
  await refreshAdmin();
  if (error || data !== true) { toast('Não foi possível assumir a loja. Ela já pode ter um dono.'); return; }
  fillStoreForm(); renderAdminProducts(); toast('Pronto! Você é a dona da loja.');
});
['#logoutBtn', '#logoutBtn2'].forEach(selector => $(selector).addEventListener('click', async () => { await db.auth.signOut(); await refreshAdmin(); }));

renderAll();
loadRemote().then(renderAll).catch(error => { console.error(error); toast('Sem conexão com o servidor. Mostrando os últimos dados salvos.'); });
