const db   = firebase.firestore();
const auth = firebase.auth();

// Listener para garantir que a autenticação está concluída
document.addEventListener("DOMContentLoaded", function () {
    showLoading();

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        await user.reload();

        const userPhoto = document.getElementById("user-photo");
        const photoURL = user.photoURL;
        const userEmail = document.getElementById("user-email");

        const email = user.email || "E-mail não disponível";
        userEmail.textContent = email;

        if (photoURL && userPhoto) {
          userPhoto.src = photoURL;
          userPhoto.classList.remove("hidden");
        } else if (userPhoto) {
          userPhoto.classList.add("hidden");
        }

        loadUserName(user);
        hideLoading();
      } catch (error) {
        console.error("Erro ao atualizar dados do usuário:", error);
        hideLoading();
      }
    } else {
      console.error("Usuário não autenticado.");
      hideLoading();
      window.location.href = "/index.html";
    }
  });
});

// Função para deslogar o usuário
function logout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "/index.html";
    })
    .catch((error) => {
      showAlert("Erro ao deslogar: " + error.message, "error");
    });
}

// Função para exibir o nome do usuário logado
function loadUserName(user) {
  const displayName = user.displayName || user.email || "Carregando...";
  document.getElementById("user-name").textContent = displayName;
}

const dropdownButton = document.getElementById("dropdownButton");
const dropdownMenu = document.getElementById("dropdownMenu");

dropdownButton.addEventListener("click", () => {
  dropdownMenu.classList.toggle("hidden");
});

// Fechar dropdown ao clicar fora
document.addEventListener("click", (event) => {
  if (!dropdownButton.contains(event.target)) {
    dropdownMenu.classList.add("hidden");
  }
});

function showAlert(message, type = "success") {
  const alertContainer = document.getElementById("alert-container");
  const alert = document.createElement("div");

  // Classes base
  let baseClasses =
    "flex items-center px-4 py-3 rounded shadow-md transition-opacity duration-300";

  // Classes por tipo
  let typeClasses = "";
  if (type === "success") {
    typeClasses = "bg-green-500 text-white hover:bg-green-600 transition-colors cursor-default select-none";
  } else if (type === "error") {
    typeClasses = "bg-red-500 text-white hover:bg-red-600 transition-colors cursor-default select-none";
  } else if (type === "info") {
    typeClasses = "bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-default select-none";
  } else if (type === "warning") {
    typeClasses = "bg-yellow-500 text-white hover:bg-yellow-600 transition-colors cursor-default select-none";
  }

  alert.className = `${baseClasses} ${typeClasses}`;
  alert.innerHTML = `
      <span class="flex-grow">${message}</span>
      <button class="ml-4 text-lg font-bold focus:outline-none">&times;</button>
    `;

  // Remover alerta ao clicar no botão ou após 5 segundos
  alert.querySelector("button").addEventListener("click", () => {
    alert.remove();
  });

  setTimeout(() => {
    alert.remove();
  }, 3000);

  alertContainer.appendChild(alert);
}

// DOM Elements
const goalsContainer       = document.getElementById('goalsContainer');
const addGoalBtn           = document.getElementById('addGoalBtn');
const closeModalBtn        = document.getElementById('closeModalBtn');
const closeDetailsModalBtn = document.getElementById('closeDetailsModalBtn');
const addGoalModal         = document.getElementById('addGoalModal');
const goalDetailsModal     = document.getElementById('goalDetailsModal');
const goalForm             = document.getElementById('goalForm');
const filterButtons        = document.querySelectorAll('.filter-btn');
const totalGoalsElement    = document.getElementById('totalGoals');
const completedGoalsElement= document.getElementById('completedGoals');
const totalAmountElement   = document.getElementById('totalAmount');
// Containers de lista / detalhes
const detailPage    = document.getElementById('goalDetailsPage');
const backToListBtn = document.getElementById('backToList');
const detailNameEl  = document.getElementById('detailGoalName');
const detailRemEl   = document.getElementById('detailRemaining');
const tableWrapper  = document.getElementById('tableWrapper');


let goals = [];
let currentFilter = 'all';
let currentSelectedGoal = null;

// Referência à coleção de metas do usuário
function goalsRef() {
  return db.collection('users')
           .doc(auth.currentUser.uid)
           .collection('goals');
}

// Quando o auth estiver pronto, inicia
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = '/index.html';
    return;
  }
  init();
});

// Inicialização: carrega metas e listeners
async function init() {
  await loadGoals();
  setupEventListeners();
}

// Busca todas as metas no Firestore e carrega UI
async function loadGoals() {
    showLoading();
  const snap = await goalsRef().orderBy('createdAt', 'desc').get();
  goals = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      amount: Number(d.amount) || 0,
      currentAmount: Number(d.currentAmount) || 0,
      deadline: d.deadline,
      priority: d.priority,
      createdAt: d.createdAt
    };
  });
  renderGoals(currentFilter);
  updateSummary();
  hideLoading();
}

// Grava nova meta no Firestore
async function addNewGoal() {
  const name    = goalForm.goalName.value.trim();
  const amount  = parseFloat(goalForm.goalAmount.value);
  const current = parseFloat(goalForm.goalCurrentAmount.value) || 0;
  const deadline= goalForm.goalDeadline.value;
  const priority= goalForm.goalPriority.value;
  
  if (!name || isNaN(amount) || amount <= 0 || !deadline) {
    alert('Preencha todos os campos obrigatórios corretamente.');
    return;
  }
  if (current > amount) {
    alert('Valor atual não pode ser maior que o valor da meta.');
    return;
  }

  showLoading();

  await goalsRef().add({
    name,
    amount,
    currentAmount: current,
    deadline,
    priority,
    createdAt: firebase.firestore.Timestamp.now()
  });
  goalForm.reset();
  addGoalModal.classList.add('hidden');
  await loadGoals();
  hideLoading();
}

// Atualiza meta existente no Firestore
async function updateGoalData(goal) {
  const data = {
    name: goal.name,
    amount: goal.amount,
    currentAmount: goal.currentAmount,
    deadline: goal.deadline,
    priority: goal.priority
  };
  await goalsRef().doc(goal.id).update(data);
  await loadGoals();
}

// Remove meta do Firestore
async function deleteGoalData(id) {
  await goalsRef().doc(id).delete();
  await loadGoals();
}

// Configura todos os event listeners de UI
function setupEventListeners() {
  // abrir/fechar modais
  addGoalBtn.addEventListener('click', () => addGoalModal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => addGoalModal.classList.add('hidden'));
  closeDetailsModalBtn.addEventListener('click', () => goalDetailsModal.classList.add('hidden'));

  // formulário de nova meta
  goalForm.addEventListener('submit', e => {
    e.preventDefault();
    addNewGoal();
  });

  // filtros
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active', 'bg-green-600', 'text-white'));
      btn.classList.add('active', 'bg-green-600', 'text-white');
      currentFilter = btn.dataset.filter;
      renderGoals(currentFilter);
      updateSummary();
    });
  });

  // fechar modais clicando fora
  window.addEventListener('click', e => {
    if (e.target === addGoalModal) addGoalModal.classList.add('hidden');
    if (e.target === goalDetailsModal) goalDetailsModal.classList.add('hidden');
  });
}

backToListBtn.addEventListener('click', () => {
  detailPage.classList.add('hidden');
  document.querySelector('main').classList.remove('hidden');
});


// Renderiza todos os cards mantendo seu design original
function renderGoals(filter = 'all') {
  goalsContainer.innerHTML = '';
  let filtered = [...goals];
  if (filter === 'active')    filtered = filtered.filter(g => g.currentAmount < g.amount);
  if (filter === 'completed') filtered = filtered.filter(g => g.currentAmount >= g.amount);

  if (filtered.length === 0) {
    goalsContainer.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-inbox text-4xl text-zinc-300 mb-4"></i>
        <p class="text-zinc-500">Nenhuma meta encontrada</p>
      </div>`;
    return;
  }

  filtered
    .sort((a,b) => {
      if (a.currentAmount >= a.amount && b.currentAmount < b.amount) return 1;
      if (a.currentAmount < a.amount && b.currentAmount >= b.amount) return -1;
      const pr = { high:3, medium:2, low:1 };
      if (pr[a.priority] > pr[b.priority]) return -1;
      if (pr[a.priority] < pr[b.priority]) return 1;
      return new Date(a.deadline) - new Date(b.deadline);
    })
    .forEach(goal => {
      const progress    = Math.min(Math.round((goal.currentAmount/goal.amount)*100),100);
      const isCompleted = goal.currentAmount >= goal.amount;
      const daysLeft    = Math.ceil((new Date(goal.deadline)-new Date())/(1000*60*60*24));
      
      const card = document.createElement('div');
      card.className = `
        goal-card bg-zinc-800 text-zinc-50 rounded-xl shadow-sm p-6
        border border-zinc-700 transition-all duration-300 cursor-pointer
        ${isCompleted?'opacity-80':''}
      `;
      card.dataset.id = goal.id;

      // Monta innerHTML
      card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
          <h3 class="font-bold text-zinc-50 truncate">${goal.name}</h3>
          <span class="px-2 py-1 rounded text-xs ${
            goal.priority==='high'   ? 'bg-red-900 bg-opacity-25 text-red-500' :
            goal.priority==='medium' ? 'bg-yellow-900 bg-opacity-25 text-yellow-500' :
                                       'bg-blue-900 bg-opacity-25 text-blue-500'
          }">${
            goal.priority==='high'   ? 'Alta' :
            goal.priority==='medium' ? 'Média' :
                                       'Baixa'
          }</span>
        </div>
        <div class="mb-4">
          <div class="flex justify-between text-sm text-zinc-300 mb-1">
            <span>Progresso</span><span>${progress}%</span>
          </div>
          <div class="w-full bg-zinc-700 rounded-full h-2">
            <div class="bg-green-500 h-2 rounded-full" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-zinc-300">Valor</p>
            <p class="font-medium text-zinc-50">R$ ${goal.amount.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
          </div>
          <div>
            <p class="text-zinc-300">Atual</p>
            <p class="font-medium ${
              isCompleted?'text-green-500':'text-zinc-50'
            }">R$ ${goal.currentAmount.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
          </div>
          <div>
            <p class="text-zinc-300">Data Limite</p>
            <p class="font-medium text-zinc-50">${formatDate(goal.deadline)}</p>
          </div>
          <div>
            <p class="text-zinc-300">Tempo Restante</p>
            <p class="font-medium ${
              daysLeft<0   ? 'text-red-500' :
              daysLeft<=30 ? 'text-yellow-500' :
                             'text-zinc-50'
            }">${
              daysLeft<0   ? 'Expirado' :
              daysLeft===0 ? 'Hoje'     :
                             `${daysLeft} dias`
            }</p>
          </div>
        </div>
      `;
      
      // Se concluído, adiciona badge
      if (isCompleted) {
        const done = document.createElement('div');
        done.className = 'mt-4 py-2 text-center bg-green-500 text-zinc-50 rounded-lg text-sm';
        done.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Meta concluída';
        card.appendChild(done);
      }

      card.addEventListener('click', () => showGoalDetails(goal.id));
      goalsContainer.appendChild(card);
    });
}


// Abre modal de detalhes e conecta botões a Firestore
function showGoalDetails(goalId) {
  const g = goals.find(x => x.id === goalId);
  if (!g) return;
  currentSelectedGoal = g;
  
  // Popula campos
  const progress = Math.min(Math.round((g.currentAmount/g.amount)*100),100);
  const daysLeft = Math.ceil((new Date(g.deadline)-new Date())/(1000*60*60*24));

  document.getElementById('detailTitle').textContent         = g.name;
  document.getElementById('detailProgressPercent').textContent = `${progress}%`;
  document.getElementById('detailGoalAmount').textContent     = `R$ ${g.amount.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  document.getElementById('detailCurrentAmount').textContent  = `R$ ${g.currentAmount.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  document.getElementById('detailDeadline').textContent       = formatDate(g.deadline);
  document.getElementById('detailPriority').innerHTML         = `
    <span class="px-2 py-1 rounded text-xs ${
      g.priority==='high'   ? 'bg-red-900 bg-opacity-25 text-red-500' :
      g.priority==='medium' ? 'bg-yellow-900 bg-opacity-25 text-yellow-500' :
                               'bg-blue-900 bg-opacity-25 text-blue-500'
    }">${
      g.priority==='high'   ? 'Alta' :
      g.priority==='medium' ? 'Média' :
                               'Baixa'
    }</span>
  `;
  // Círculo de progresso
  const circle = document.getElementById('detailProgressCircle');
  const r = circle.r.baseVal.value;
  const c = 2 * Math.PI * r;
  circle.style.strokeDasharray  = `${c} ${c}`;
  circle.style.strokeDashoffset = c - (progress/100)*c;

  // Botões
  document.getElementById('addAmountBtn').onclick = async () => {
    const v = parseFloat(document.getElementById('addToGoal').value);
    if (isNaN(v)||v<=0) { alert('Valor inválido'); return; }
    g.currentAmount = Math.min(g.amount, g.currentAmount+v);
    await updateGoalData(g);
    document.getElementById('addToGoal').value = '';
  };
  document.getElementById('editGoalBtn').onclick = () => {
    goalDetailsModal.classList.add('hidden');
    setTimeout(() => editGoal(g), 300);
  };
  document.getElementById('deleteGoalBtn').onclick = async () => {
    if (confirm('Excluir esta meta?')) {
      goalDetailsModal.classList.add('hidden');
      await deleteGoalData(g.id);
    }
  };
document.getElementById('viewDetailsBtn').onclick = () => {
  goalDetailsModal.classList.add('hidden');
  showGoalDetail(currentSelectedGoal);
};


  goalDetailsModal.classList.remove('hidden');
}

async function showGoalDetail(goal) {
    showLoading();
  // esconde botão Nova Meta (se existir)
  addGoalBtn.classList.add('hidden');

  // esconde lista e mostra detalhes
  document.querySelector('main').classList.add('hidden');
  detailPage.classList.remove('hidden');
  detailNameEl.textContent = goal.name;

  // buscar contribuições
  const contribSnap = await goalsRef()
    .doc(goal.id)
    .collection('contributions')
    .orderBy('date','asc')
    .get();
  const contribs = contribSnap.docs.map(d => d.data());

  // montar meses
  const start = goal.createdAt.toDate();
  const end   = new Date(goal.deadline);
  const months = [];
  let cur = new Date(start);
  while (cur <= end) {
    months.push({
      label: cur.toLocaleString('pt-BR',{month:'short',year:'numeric'}),
      pago: 0,
      planejado: Math.ceil(goal.amount / ((end.getFullYear()-start.getFullYear())*12 + (end.getMonth()-start.getMonth()+1)))
    });
    cur.setMonth(cur.getMonth()+1);
  }

  // distribuir pagamentos
  let restantePago = contribs.reduce((s,c)=>s+c.value,0);
  for (let c of contribs) {
    for (let m of months) {
      if (restantePago <= 0) break;
      const falta = m.planejado - m.pago;
      const take = Math.min(falta, restantePago);
      m.pago += take;
      restantePago -= take;
    }
  }

  // valor restante
  const totalContrib = contribs.reduce((s,c)=>s+c.value,0);
  const restante     = Math.max(0, goal.amount - totalContrib);
  detailRemEl.textContent = `Valor restante: R$ ${restante.toFixed(2)}`;

  // montar tabela
  let html = `
<table class="w-full min-w-[800px] whitespace-nowrap text-sm table-auto border-collapse">
  <thead class="bg-zinc-800 text-zinc-50 sticky top-0 z-10">
    <tr>
      <th class="px-4 py-2">Plano</th>
      <th class="px-4 py-2">Restante</th>`;
  months.forEach(m => html += `<th class="px-4 py-2">${m.label}</th>`);
  html += `
    </tr>
  </thead>
  <tbody class="bg-zinc-900 text-zinc-50">
    <tr>
      <td class="px-4 py-2">${goal.name}</td>
      <td class="px-4 py-2">R$ ${restante.toFixed(2)}</td>`;
  months.forEach((m, idx) => {
    html += `
      <td class="px-4 py-2 group relative" data-idx="${idx}">
        <span class="month-value">R$ ${m.pago.toFixed(2)}</span>
        <button
          data-idx="${idx}"
          class="py-4 backdrop-blur-sm rounded-lg border border-zinc-700 edit-plan-btn absolute inset-0
                 flex items-center justify-center bg-zinc-900/80 text-sm font-bold text-green-400
                 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >Editar</button>
      </td>`;
  });
  html += `
    </tr>
  </tbody>
</table>`;
  tableWrapper.innerHTML = html;

  // handlers editar
  tableWrapper.querySelectorAll('.edit-plan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (tableWrapper.querySelector('.edit-input')) return;
      const cell = btn.closest('td');
      const idx  = +btn.dataset.idx;
      const span = cell.querySelector('.month-value');
      const current = parseFloat(span.textContent.replace(/[^\d,\.]/g,'').replace(',', '.'))||0;

      const editContainer = document.createElement('div');
      editContainer.className = 'flex items-center space-x-2';
      const input = document.createElement('input');
      input.type = 'number';
      input.value = current.toFixed(2);
      input.className = 'edit-input bg-zinc-800 p-1 rounded w-24 text-zinc-50';
      const saveBtn = document.createElement('button');
      saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                             viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                   d="M5 13l4 4L19 7" /></svg>`;
      saveBtn.className = 'p-1 rounded bg-green-600 text-white';

      cell.innerHTML = '';
      editContainer.append(input, saveBtn);
      cell.append(editContainer);
      input.focus();

      saveBtn.addEventListener('click', async () => {
        const novo = parseFloat(input.value)||0;
        const diferenca = novo - m.pago;
        if (diferenca !== 0) {
          await goalsRef().doc(goal.id).collection('contributions').add({
            value: diferenca,
            date: firebase.firestore.Timestamp.now()
          });
        }
        showGoalDetail(goal);
      });
    });
  });
   hideLoading();
}

// Abre modal de edição (reusa o mesmo form de inclusão)
function editGoal(goal) {
  goalForm.goalName.value           = goal.name;
  goalForm.goalAmount.value         = goal.amount;
  goalForm.goalCurrentAmount.value  = goal.currentAmount;
  goalForm.goalDeadline.value       = goal.deadline;
  goalForm.goalPriority.value       = goal.priority;

  const originalHandler = goalForm.onsubmit;
  goalForm.onsubmit = async e => {
    e.preventDefault();
    goal.name           = goalForm.goalName.value.trim();
    goal.amount         = parseFloat(goalForm.goalAmount.value);
    goal.currentAmount  = parseFloat(goalForm.goalCurrentAmount.value)||0;
    goal.deadline       = goalForm.goalDeadline.value;
    goal.priority       = goalForm.goalPriority.value;
    await updateGoalData(goal);
    goalForm.reset();
    goalForm.onsubmit = originalHandler;
    addGoalModal.classList.add('hidden');
  };
  addGoalModal.classList.remove('hidden');
}

// Atualiza indicadores de resumo
function updateSummary() {
  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.currentAmount >= g.amount).length;
  const totalAmount = goals.reduce((acc, g) => acc + g.amount, 0);

  animateCount(totalGoalsElement, totalGoals);
  animateCount(completedGoalsElement, completedGoals);
  animateCount(totalAmountElement, totalAmount, 'R$ ', true);
}


// Formata data em PT-BR
function formatDate(d) {
  return new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}

function animateCount(element, endValue, prefix = '', isCurrency = false, duration = 500) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = start + (endValue - start) * progress;

    if (isCurrency) {
      element.textContent = prefix + current.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      element.textContent = prefix + Math.floor(current);
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
