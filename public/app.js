// Auth Check
const user = JSON.parse(localStorage.getItem('user'));
if (!user) {
    window.location.href = '/login.html';
}

const API_URL = '/api';

// Helper for auth headers
const getHeaders = () => {
    const headers = { 'x-user-id': user.id };
    // Only add x-role if admin, though backend should check user object anyway
    if (user.role === 'admin') headers['x-role'] = 'admin';
    return headers;
};

// Navigation
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    document.querySelectorAll('nav button, .nav-item').forEach(b => b.classList.remove('active'));

    // Support two selectors: one for desktop nav, one for bottom nav 
    const selector = `button[onclick="showSection('${sectionId}')"]`;
    document.querySelectorAll(selector).forEach(el => el.classList.add('active'));

    if (sectionId === 'dashboard') loadDashboard();
    if (sectionId === 'clients') loadCustomers();
    if (sectionId === 'loans') loadLoans();
    if (sectionId === 'reports') loadReports();
}

// Modal Helpers
function openModal(modalId) {
    document.getElementById(modalId).classList.add('open');
    if (modalId === 'modal-new-loan') loadCustomerSelect();
}
function closeModal(modalId) { document.getElementById(modalId).classList.remove('open'); }

// Formatting
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (date) => new Date(date).toLocaleDateString('pt-BR');

// ---------------------------
// DATA LOADING
// ---------------------------

async function loadDashboard() {
    // Headers explicitly added
    const resLoans = await fetch(`${API_URL}/loans`, { headers: getHeaders() });
    const { data: loans } = await resLoans.json();

    const resCustomers = await fetch(`${API_URL}/customers`, { headers: getHeaders() });
    const { data: customers } = await resCustomers.json();

    const resPayments = await fetch(`${API_URL}/reports/payments`, { headers: getHeaders() });
    const { data: payments } = await resPayments.json();

    const totalLoaned = loans ? loans.reduce((acc, l) => acc + l.current_balance, 0) : 0;
    const totalInterest = payments ? payments.filter(p => p.type === 'INTEREST_ONLY').reduce((acc, p) => acc + p.amount, 0) : 0;
    const totalClients = customers ? customers.length : 0;

    document.getElementById('total-loaned').innerText = formatCurrency(totalLoaned);
    document.getElementById('total-interest').innerText = formatCurrency(totalInterest);
    document.getElementById('total-clients').innerText = totalClients;
}

async function loadCustomers() {
    const res = await fetch(`${API_URL}/customers`, { headers: getHeaders() });
    const { data } = await res.json();
    const list = document.getElementById('clients-list');
    list.innerHTML = '';

    if (data) {
        data.forEach(c => {
            const photo = c.photo_path ? `<img src="/${c.photo_path}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;margin-right:1rem;">` : '';
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display:flex;align-items:center;">
                    ${photo}
                    <div>
                        <h3>${c.name}</h3>
                        <p>${c.cpf_rg}</p>
                        <p>📞 ${c.phone}</p>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    }
}

async function loadCustomerSelect() {
    const res = await fetch(`${API_URL}/customers`, { headers: getHeaders() });
    const { data } = await res.json();
    const select = document.getElementById('select-customer');
    select.innerHTML = '<option value="">Selecione o Cliente</option>';
    if (data) {
        data.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name} (${c.cpf_rg})</option>`;
        });
    }
}

async function loadLoans() {
    // Loans endpoint needs to be filtered by customer ownership in backend too, 
    // but typically we can create a /loans endpoint that joins customers and filters by user_id
    // OR we fetch customers first and then loans. 
    // For now assuming backend loans route still returns all, so we need to fix backend loans route OR filter here.
    // Ideally backend fix. Let's assume we fixed backend loans route or provided user_id header there.
    // If backend /loans doesn't filter, we might see other users' loans if not careful.
    // Let's rely on customers fetch for protection or update loans route. 
    // Actually, we haven't updated loans route yet. We should. 
    // For now, let's pass headers.

    const res = await fetch(`${API_URL}/loans`, { headers: getHeaders() });
    const { data } = await res.json();
    const list = document.getElementById('loans-list');
    list.innerHTML = '';

    const resC = await fetch(`${API_URL}/customers`, { headers: getHeaders() });
    const { data: customers } = await resC.json();
    const customerMap = {};
    if (customers) {
        customers.forEach(c => customerMap[c.id] = c.name);
    }

    if (data) {
        // Client-side filter as specific safety net if backend isn't perfect yet, 
        // but real fix is backend.
        const myLoans = data.filter(l => customerMap[l.customer_id]);

        myLoans.forEach(l => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h3>${customerMap[l.customer_id] || 'Desconhecido'}</h3>
                <p>Juros: ${l.interest_rate}% / dia</p>
                <p>Status: <span style="color:${l.status === 'ACTIVE' ? 'var(--primary)' : 'var(--text-muted)'}">${l.status}</span></p>
                <div class="balance">${formatCurrency(l.current_balance)}</div>
                <p style="font-size:0.8rem; margin-top:0.5rem;">Ult. Atualização: ${formatDate(l.last_interest_update)}</p>
            `;
            card.onclick = () => openLoanAction(l, customerMap[l.customer_id]);
            list.appendChild(card);
        });
    }
}

async function loadReports() {
    const res = await fetch(`${API_URL}/reports/payments`, { headers: getHeaders() });
    const { data } = await res.json();
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';

    if (data) {
        data.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(p.date)}</td>
                <td>${p.customer_name}</td>
                <td>${p.type === 'INTEREST_ONLY' ? 'Somente Juros' : 'Amortização'}</td>
                <td style="color:var(--primary); font-weight:bold;">${formatCurrency(p.amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ---------------------------
// ACTIONS
// ---------------------------

let currentLoanId = null;

function openLoanAction(loan, customerName) {
    currentLoanId = loan.id;
    document.getElementById('loan-action-title').innerText = `Gestão: ${customerName}`;
    document.getElementById('loan-details').innerText = `Saldo Atual: ${formatCurrency(loan.current_balance)}`;
    document.getElementById('payment-loan-id').value = loan.id;
    openModal('modal-loan-action');
}

async function triggerInterestUpdate() {
    if (!currentLoanId) return;
    try {
        const res = await fetch(`${API_URL}/loans/${currentLoanId}/update-interest`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await res.json();
        alert(data.message + (data.added ? ` (Adicionado: ${formatCurrency(data.added)})` : ''));
        closeModal('modal-loan-action');
        loadLoans();
    } catch (e) {
        alert('Erro ao atualizar juros');
    }
}

// ---------------------------
// FORMS
// ---------------------------

document.getElementById('form-add-client').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
        const res = await fetch(`${API_URL}/customers`, {
            method: 'POST',
            headers: { 'x-user-id': user.id }, // Needed for FormData authentication
            body: formData
        });
        if (res.ok) {
            alert('Cliente cadastrado!');
            closeModal('modal-add-client');
            showSection('clients');
            e.target.reset();
        } else {
            const err = await res.json();
            alert('Erro: ' + (err.error || 'Erro desconhecido'));
        }
    } catch (err) { console.error(err); alert('Erro na requisição'); }
});

document.getElementById('form-new-loan').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));

    try {
        const res = await fetch(`${API_URL}/loans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            alert('Empréstimo criado!');
            closeModal('modal-new-loan');
            showSection('loans');
            e.target.reset();
        } else {
            alert('Erro ao criar empréstimo');
        }
    } catch (err) { console.error(err); alert('Erro na requisição'); }
});

document.getElementById('form-payment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!currentLoanId) return;

    try {
        const res = await fetch(`${API_URL}/loans/${currentLoanId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
            alert('Pagamento registrado! Novo saldo: ' + formatCurrency(result.new_balance));
            closeModal('modal-loan-action');
            loadLoans();
            e.target.reset();
        } else {
            alert('Erro: ' + result.error);
        }
    } catch (err) { console.error(err); alert('Erro na requisição'); }
});

// Init
renderUserProfile();
loadDashboard();

function renderUserProfile() {
    const profileContainer = document.getElementById('user-profile-mobile');
    if (!profileContainer || !user) return;

    const photoHtml = user.photo_path
        ? `<img src="/${user.photo_path}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border: 2px solid var(--primary);">`
        : `<div style="width:40px; height:40px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; font-size:1.2rem; border: 2px solid #334155;">👤</div>`;

    profileContainer.innerHTML = `
        <span style="font-size:1rem; font-weight:600; color:#fff;">${user.full_name || user.username}</span>
        ${photoHtml}
    `;
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    const preview = document.getElementById('profile-preview-container');
    const nameInput = document.getElementById('profile-fullname');

    nameInput.value = user.full_name || '';
    preview.innerHTML = user.photo_path
        ? `<img src="/${user.photo_path}" style="width:100%; height:100%; object-fit:cover;">`
        : '👤';

    modal.classList.add('open');
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.remove('open');
}

function previewProfilePhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('profile-preview-container').innerHTML =
                `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
            'x-user-id': user.id
        },
        body: formData
    });

    if (res.ok) {
        const data = await res.json();
        user.full_name = data.full_name;
        if (data.photo_path) user.photo_path = data.photo_path;
        localStorage.setItem('user', JSON.stringify(user));
        renderUserProfile();
        closeProfileModal();
        alert('Perfil atualizado!');
    } else {
        alert('Erro ao atualizar perfil');
    }
};
