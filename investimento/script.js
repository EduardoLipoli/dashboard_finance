const db = firebase.firestore();
const auth = firebase.auth();

let allAvailableStocks = [];


// Listener para garantir que a autenticação está concluída
document.addEventListener("DOMContentLoaded", function () {
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
      } catch (error) {
        console.error("Erro ao atualizar dados do usuário:", error);
      }
    } else {
      console.error("Usuário não autenticado.");
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

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    // O usuário está logado; podemos inicializar
    init();
  } else {
    // Usuário não logado — por exemplo, redirecione pra tela de login
    window.location.href = '/login.html';
  }
});

// Sample data - in a real app, this would come from a database
let investments = JSON.parse(localStorage.getItem('investments')) || [];
let chart = null;
let chartPeriod = 'year'; // <<< NOVO: Guarda o período atual do gráfico

// DOM Elements
const addInvestmentBtn = document.getElementById('add-investment-btn');
const addFirstInvestmentBtn = document.getElementById('add-first-investment');
const addInvestmentModal = document.getElementById('add-investment-modal');
const closeModalBtn = document.getElementById('close-modal');
const cancelAddInvestmentBtn = document.getElementById('cancel-add-investment');
const investmentForm = document.getElementById('investment-form');
const investmentsTableBody = document.getElementById('investments-table-body');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

const syncPricesBtn = document.getElementById('sync-prices-btn'); 


// <<< NOVO: Seletores dos botões de período do gráfico
const btnMonth = document.getElementById('btn-month');
const btnYear = document.getElementById('btn-year');
const btn5Years = document.getElementById('btn-5years');

// Stats elements
const totalValueEl = document.getElementById('total-value');
const totalProfitEl = document.getElementById('total-profit');
const totalPorcProfit = document.getElementById('porc-profit')
const totalInvestedEl = document.getElementById('total-invested');
const totalAssetsEl = document.getElementById('total-assets');

function init() {
  showLoading();

  ApiService.fetchAllAvailable().then(stocks => {
        allAvailableStocks = stocks;
    });

  const uid = auth.currentUser.uid;

  db.collection('users')
    .doc(uid)
    .collection('investiments')
    .onSnapshot(snapshot => {
      investments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      updateInvestmentsList();
      updateStats();
      updateDistribution();
      initChart();

      emptyState.style.display = investments.length === 0 ? 'block' : 'none';

      hideLoading();
    }, error => {
      console.error('Erro ao buscar investimentos:', error);
      hideLoading(); // Garante que o loader some mesmo em erro
    });
}

// Update the investments list
function updateInvestmentsList(filter = '') {
  investmentsTableBody.innerHTML = '';

  const filteredInvestments = investments.filter(investment =>
    investment.name.toLowerCase().includes(filter.toLowerCase()) ||
    investment.type.toLowerCase().includes(filter.toLowerCase())
  );

  if (filteredInvestments.length === 0 && filter !== '') {
    investmentsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="p-4 text-center text-gray-400">Nenhum investimento encontrado</td>
            </tr>
        `;
    return;
  }

  filteredInvestments.forEach(investment => {
    const investedValue = investment.quantity * investment.price;
    const currentValue = investment.quantity * investment.currentValue;
    const profit = currentValue - investedValue;
    const profitPercentage = (profit / investedValue) * 100;

    let typeBadge = '';
    let badgeColor = '';

    switch (investment.type) {
      case 'acao':
        typeBadge = 'Ação';
        badgeColor = 'bg-yellow-500 bg-opacity-20 text-yellow-400';
        break;
      case 'fii':
        typeBadge = 'FII';
        badgeColor = 'bg-blue-500 bg-opacity-20 text-blue-400';
        break;
      case 'renda-fixa':
        typeBadge = 'Renda Fixa';
        badgeColor = 'bg-green-500 bg-opacity-20 text-green-400';
        break;
      case 'cripto':
        typeBadge = 'Cripto';
        badgeColor = 'bg-purple-500 bg-opacity-20 text-purple-400';
        break;
      case 'etf':
        typeBadge = 'ETF';
        badgeColor = 'bg-indigo-500 bg-opacity-20 text-indigo-400';
        break;
    }

    const row = document.createElement('tr');
    row.className = 'investment-row';
    row.innerHTML = `
            <td class="p-3">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3 ${investment.type === 'acao' ? 'bg-yellow-500' : investment.type === 'fii' ? 'bg-blue-500' : investment.type === 'renda-fixa' ? 'bg-green-500' : investment.type === 'cripto' ? 'bg-purple-500' : 'bg-indigo-500'}">
                        <i class="fas ${investment.type === 'acao' ? 'fa-chart-line' : investment.type === 'fii' ? 'fa-building' : investment.type === 'renda-fixa' ? 'fa-landmark' : investment.type === 'cripto' ? 'fa-coins' : 'fa-chart-pie'} text-white text-xs"></i>
                    </div>
                    <div>
                        <p class="font-medium">${investment.name}</p>
                    </div>
                </div>
            </td>
            <td class="p-3">
                <span class="px-2 py-1 ${badgeColor} rounded-full text-xs">${typeBadge}</span>
            </td>
            <td class="p-3">
              ${(() => new Date(investment.date).toLocaleDateString('pt-BR'))()}
            </td>
            <td class="p-3">${investment.quantity}</td>
            <td class="p-3">R$ ${investment.price.toFixed(2)}</td>
            <td class="p-3">R$ ${investedValue.toFixed(2)}</td>
            <td class="p-3 font-medium">R$ ${currentValue.toFixed(2)}</td>
            <td class="p-3">
                <span class="${profit >= 0 ? 'text-green-500' : 'text-red-500'} font-medium">${profit >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%</span>
            </td>
            <td class="p-3">
                <div class="flex space-x-2">
                    <button class="edit-btn text-gray-400 hover:text-green-500" data-id="${investment.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn text-gray-400 hover:text-red-500" data-id="${investment.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

    investmentsTableBody.appendChild(row);
  });

  // Add event listeners to edit and delete buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      editInvestment(id);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      showDeleteModal(id);
    });
  });
}

// Update stats
function updateStats() {
  let totalInvested = 0;
  let totalCurrent = 0;

  investments.forEach(investment => {
    totalInvested += investment.quantity * investment.price;
    totalCurrent += investment.quantity * investment.currentValue;
  });

  // [NOVA FUNÇÃO CHAMADA AQUI]
  // Salva o total do portfólio para a página de aposentadoria
  savePortfolioSummary(totalCurrent);
  // [FIM DA ADIÇÃO]

  const totalProfit = totalCurrent - totalInvested;
  const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const totalPorcProfit = document.getElementById('porc-profit');
  const isPositive = profitPercentage >= 0;

  // 1️⃣ Escolhe ícone e cor
  const arrowIcon = isPositive ?
    '<i class="fas fa-arrow-up"></i>' :
    '<i class="fas fa-arrow-down"></i>';
  const colorClass = isPositive ? 'text-green-500' : 'text-red-500';

  // 2️⃣ Remove ambas as classes (caso já existam)
  totalPorcProfit.classList.remove('text-green-500', 'text-red-500');

  // 3️⃣ Adiciona a classe correta
  totalPorcProfit.classList.add(colorClass);

  // 4️⃣ Preenche o conteúdo (usa innerHTML para incluir o <i>)
  totalPorcProfit.innerHTML = `
      ${arrowIcon}
      (${Math.abs(profitPercentage).toFixed(2)}%)
    `;


  totalValueEl.textContent = `R$ ${totalCurrent.toFixed(2)}`;
  totalInvestedEl.textContent = `R$ ${totalInvested.toFixed(2)}`;
  totalProfitEl.textContent = `R$ ${totalProfit.toFixed(2)}`;
  // totalPorcProfit.innerHTML = `${arrowIcon} (${Math.abs(profitPercentage).toFixed(2)}%)`; // Removido pois já foi setado acima
  totalAssetsEl.textContent = `${investments.length} ativo${investments.length !== 1 ? 's' : ''}`;

  updateChart();
}

async function savePortfolioSummary(totalValue) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const summaryRef = db.collection('users').doc(user.uid)
                             .collection('portfolioSummary').doc('summary');
        await summaryRef.set({
            totalPortfolioValue: totalValue,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error("Erro ao salvar sumário do portfólio:", error);
    }
}


// Initialize chart
function initChart() {
  const ctx = document
    .getElementById('performanceChart')
    .getContext('2d');

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [], // vamos popular em updateChart()
      datasets: [] // idem
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#f4f4f5'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#18181b',
          titleColor: '#f4f4f5',
          bodyColor: '#e4e4e7',
          borderColor: '#3f3f46',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label(ctx) {
              return ctx.dataset.label + ': R$ ' +
                ctx.parsed.y.toLocaleString('pt-BR');
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#f4f4f5'
          }
        },
        y: {
          stacked: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#f4f4f5',
            callback(v) {
              return 'R$ ' + v.toLocaleString('pt-BR');
            }
          }
        }
      }
    }
  });

  updateChart();
}

// cores tailwind → hex
const COLOR_MAP = {
  acao: '#eab308', // yellow-500
  fii: '#3b82f6', // blue-500
  'renda-fixa': '#22c55e', // green-500
  cripto: '#a855f7', // purple-500
  etf: '#6366f1' // indigo-500
};

// <<< FUNÇÃO MODIFICADA para lidar com os períodos
function updateChart() {
  if (!chart) return;

  const now = new Date();
  let labels = [];
  let periodData = {}; // Estrutura para acumular valores por tipo e período

  // Define os rótulos e a lógica de agrupamento com base no período selecionado
  if (chartPeriod === 'year') {
    const allMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    labels = allMonths.slice(0, now.getMonth() + 1);

    investments.forEach(inv => {
      const invDate = new Date(inv.date);
      if (invDate.getFullYear() === now.getFullYear()) {
        const month = invDate.getMonth();
        const type = inv.type;
        if (!periodData[type]) periodData[type] = new Array(labels.length).fill(0);
        periodData[type][month] += inv.quantity * inv.price;
      }
    });

  } else if (chartPeriod === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    labels = Array.from({ length: daysInMonth }, (_, i) => i + 1); // Dias 1, 2, 3...

    investments.forEach(inv => {
      const invDate = new Date(inv.date);
      if (invDate.getFullYear() === now.getFullYear() && invDate.getMonth() === now.getMonth()) {
        const day = invDate.getDate() - 1; // 0-indexed
        const type = inv.type;
        if (!periodData[type]) periodData[type] = new Array(labels.length).fill(0);
        periodData[type][day] += inv.quantity * inv.price;
      }
    });

  } else if (chartPeriod === '5years') {
    const currentYear = now.getFullYear();
    labels = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i); // Últimos 5 anos

    investments.forEach(inv => {
      const invDate = new Date(inv.date);
      const year = invDate.getFullYear();
      const yearIndex = labels.indexOf(year);

      if (yearIndex > -1) {
        const type = inv.type;
        if (!periodData[type]) periodData[type] = new Array(labels.length).fill(0);
        periodData[type][yearIndex] += inv.quantity * inv.price;
      }
    });
  }


  // Monta os datasets a partir dos dados agrupados
  const datasets = Object.entries(periodData).map(([type, data]) => ({
    label: {
      acao: 'Ações',
      fii: 'FIIs',
      'renda-fixa': 'Renda Fixa',
      cripto: 'Cripto',
      etf: 'ETF'
    } [type] || type,
    data,
    backgroundColor: COLOR_MAP[type] || '#888',
    borderRadius: 6
  }));

  // Atualiza o gráfico
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update();
}

// Show add investment modal
function showAddInvestmentModal() {
  document.getElementById('edit-id').value = '';
  document.getElementById('investment-form').reset();
  addInvestmentModal.classList.remove('hidden');
}

// Edit investment
function editInvestment(id) {
  showLoading();
  const investment = investments.find(i => i.id === id);
  if (!investment) {
    hideLoading();
    return;
  }
  
  // Preenche o formulário com os dados do investimento
  document.getElementById('edit-id').value = investment.id;
  document.getElementById('investment-type').value = investment.type;
  document.getElementById('asset-name').value = investment.name;
  document.getElementById('date').value = investment.date;
  document.getElementById('quantity').value = investment.quantity;
  document.getElementById('price').value = investment.price;
  
  // A linha que tentava preencher 'current-value' foi REMOVIDA daqui.
  
  // Mostra o modal e esconde o loader
  addInvestmentModal.classList.remove('hidden');
  hideLoading();
}

// Show delete confirmation modal
function showDeleteModal(id) {
  document.getElementById('delete-id').value = id;
  deleteModal.classList.remove('hidden');
}

// Save investment
async function saveInvestment(e) {
  e.preventDefault();
  showLoading();

  // Coletamos os dados que AINDA existem no formulário
  const id = document.getElementById('edit-id').value;
  const type = document.getElementById('investment-type').value;
  const name = document.getElementById('asset-name').value;
  const date = document.getElementById('date').value;
  const quantity = parseFloat(document.getElementById('quantity').value);
  const price = parseFloat(document.getElementById('price').value);

  // Note que a linha 'const currentValue = ...' foi removida daqui.

  try {
    // 1. Busca o preço atual na API. Se falhar, usa o preço de compra como valor reserva.
    const fetchedCurrentValue = await ApiService.fetchCurrentPrice(name, type, price);
    
    // 2. Prepara os dados para salvar no Firestore
    const uid = auth.currentUser.uid;
    const data = {
      type,
      name,
      date,
      quantity,
      price,
      currentValue: fetchedCurrentValue, // Usa o valor obtido da API
      userId: uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const userCol = db.collection('users').doc(uid).collection('investiments');
    
    if (id) {
      await userCol.doc(id).update(data);
      showAlert('Investimento atualizado com sucesso!', 'success');
    } else {
      await userCol.add(data);
      showAlert('Investimento adicionado com sucesso!', 'success');
    }

    addInvestmentModal.classList.add('hidden');
    investmentForm.reset();

  } catch (error) {
    // Este bloco 'catch' é onde o seu erro foi exibido
    console.error('Erro ao salvar investimento:', error);
    showAlert('Erro ao salvar investimento: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}
// Delete investment
async function deleteInvestment() {
  showLoading();

  try {
    const uid = auth.currentUser.uid;
    const id = document.getElementById('delete-id').value;
    const userCol = db.collection('users').doc(uid).collection('investiments');

    await userCol.doc(id).delete();

    // A atualização já é feita pelo onSnapshot
    // updateInvestmentsList();
    // updateStats();
    deleteModal.classList.add('hidden');
  } catch (error) {
    console.error('Erro ao deletar investimento:', error);
  } finally {
    hideLoading();
  }
}

// <<< NOVO: Função para atualizar o estilo (cores) dos botões de período
function updateChartButtons(activePeriod) {
  const buttons = {
    month: btnMonth,
    year: btnYear,
    '5years': btn5Years
  };

  // Reseta todos os botões para o estilo inativo
  Object.values(buttons).forEach(button => {
    button.classList.remove('bg-green-600', 'hover:bg-green-500');
    button.classList.add('bg-zinc-700', 'hover:bg-zinc-600');
  });

  // Aplica o estilo ativo ao botão selecionado
  const activeButton = buttons[activePeriod];
  if (activeButton) {
    activeButton.classList.remove('bg-zinc-700', 'hover:bg-zinc-600');
    activeButton.classList.add('bg-green-600', 'hover:bg-green-500');
  }
}

// Event Listeners
addInvestmentBtn.addEventListener('click', showAddInvestmentModal);
addFirstInvestmentBtn.addEventListener('click', showAddInvestmentModal);
closeModalBtn.addEventListener('click', () => addInvestmentModal.classList.add('hidden'));
cancelAddInvestmentBtn.addEventListener('click', () => addInvestmentModal.classList.add('hidden'));
investmentForm.addEventListener('submit', saveInvestment);
cancelDeleteBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));
confirmDeleteBtn.addEventListener('click', deleteInvestment);

syncPricesBtn.addEventListener('click', refreshAllPrices);

// <<< NOVO: Listeners para os botões de período do gráfico
btnMonth.addEventListener('click', () => {
  chartPeriod = 'month';
  updateChartButtons('month');
  updateChart();
});

btnYear.addEventListener('click', () => {
  chartPeriod = 'year';
  updateChartButtons('year');
  updateChart();
});

btn5Years.addEventListener('click', () => {
  chartPeriod = '5years';
  updateChartButtons('5years');
  updateChart();
});


// Close modals when clicking outside
addInvestmentModal.addEventListener('click', (e) => {
  if (e.target === addInvestmentModal) {
    addInvestmentModal.classList.add('hidden');
  }
});

deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.classList.add('hidden');
  }
});

// Search functionality
searchInput.addEventListener('input', (e) => {
  updateInvestmentsList(e.target.value);
});

function updateDistribution() {
  // 1) Mapeamento de cores (hex)
  const COLORS = {
    acao: '#f59e0b', // yellow-500
    fii: '#3b82f6', // blue-500
    'renda-fixa': '#16a34a', // green-600
    cripto: '#a855f7', // purple-500
    outros: '#94a3b8' // gray-400
  };

  // 2) Acumula valor investido por tipo
  const totals = investments.reduce((acc, inv) => {
    const invested = inv.quantity * inv.price;
    acc[inv.type] = (acc[inv.type] || 0) + invested;
    return acc;
  }, {});

  // 3) Total geral e cálculo das porcentagens arredondadas
  const grandTotal = Object.values(totals).reduce((sum, v) => sum + v, 0);
  if (grandTotal <= 0) return;

  const entries = Object.entries(totals).map(([type, val]) => ({
    type,
    value: val,
    rawPct: (val / grandTotal) * 100
  }));
  let floorSum = 0;
  entries.forEach(e => {
    e.intPct = Math.floor(e.rawPct);
    floorSum += e.intPct;
    e.remainder = e.rawPct - e.intPct;
  });
  let leftover = 100 - floorSum;
  entries
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(e => {
      if (leftover > 0) {
        e.intPct++;
        leftover--;
      }
    });

  // 4) Atualiza cada linha: apenas o % e a cor da bolinha
  // Esconde todos os itens da lista inicialmente
  document.querySelectorAll('.distribution [data-type]').forEach(el => {
    el.style.display = 'none';
  });

  // Mostra e atualiza apenas os que têm valor
  entries.forEach(({
    type,
    intPct
  }) => {
    const row = document.querySelector(`.distribution [data-type="${type}"]`);
    if (!row) return;

    row.style.display = 'flex'; // mostra o item

    row.querySelector('.percentage').textContent = `${intPct}%`;

    const dot = row.querySelector('.w-3.h-3.rounded-full');
    if (dot) {
      dot.style.backgroundColor = COLORS[type] || COLORS.outros;
    }
  });

  if (entries.length === 0) {
    document.querySelector('.distribution svg').style.display = 'none';
    document.querySelector('.distribution p').style.display = 'none';
    return;
  }

  // 5) Atualiza o anel como antes (mantendo a cor para o tipo principal)
  const main = entries.reduce((m, e) => e.value > m.value ? e : m, entries[0]);
  const mainPct = main.intPct;
  const circle = document.querySelector('.progress-ring__circle');
  const textEl = document.querySelector('.distribution svg text');
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  circle.style.transition = 'stroke-dashoffset 0.6s ease';
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = `${circumference * (1 - mainPct/100)}`;
  circle.style.stroke = COLORS[main.type] || COLORS.outros;
  textEl.textContent = `${mainPct}%`;
}

async function refreshAllPrices() {
    // Seleciona os elementos do botão que vamos manipular
    const syncButton = document.getElementById('sync-prices-btn');
    const syncIcon = syncButton.querySelector('i');
    const syncText = syncButton.querySelector('span');

    // 1. Inicia o estado de "carregando"
    syncButton.disabled = true;
    syncButton.classList.add('opacity-75', 'cursor-not-allowed');
    syncIcon.classList.add('fa-spin'); // Adiciona a animação de giro da Font Awesome
    syncText.textContent = 'Sincronizando...';

    // O alerta de "info" é opcional, mas ajuda a dar um feedback maior
    showAlert('Iniciando sincronização de preços...', 'info');

    const uid = auth.currentUser.uid;
    const collectionRef = db.collection('users').doc(uid).collection('investiments');
    
    // O bloco try...catch...finally é perfeito para isso
    try {
        const updatePromises = investments.map(async (inv) => {
            if (inv.type === 'renda-fixa') {
                return Promise.resolve();
            }

            const newPrice = await ApiService.fetchCurrentPrice(inv.name, inv.type, inv.currentValue);
            
            if (newPrice !== inv.currentValue) {
                return collectionRef.doc(inv.id).update({
                    currentValue: newPrice,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            return Promise.resolve();
        });

        // Espera todas as atualizações terminarem
        await Promise.all(updatePromises);

        showAlert('Preços sincronizados com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao sincronizar preços:', error);
        showAlert('Ocorreu um erro durante a sincronização.', 'error');
    } finally {
        // 3. Ao final (independente de sucesso ou erro), reverte o botão ao estado original
        syncButton.disabled = false;
        syncButton.classList.remove('opacity-75', 'cursor-not-allowed');
        syncIcon.classList.remove('fa-spin'); // Remove a animação de giro
        syncText.textContent = 'Sincronizar';
    }
}


const assetNameInput = document.getElementById('asset-name');
const investmentTypeInput = document.getElementById('investment-type');
const searchResultsContainer = document.getElementById('search-results');

let debounceTimer;

// Função Debounce: Evita que a API seja chamada a cada tecla pressionada.
// Ela espera o usuário parar de digitar por um tempo (delay) antes de executar a busca.
const debounce = (func, delay) => {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

// Função que busca os ativos na API
const handleSearch = (query) => {
    if (query.length < 2) {
        searchResultsContainer.innerHTML = '';
        searchResultsContainer.classList.add('hidden');
        return;
    }

    const assetType = investmentTypeInput.value;
    let results = [];

    if (assetType === 'acao' || assetType === 'fii' || assetType === 'etf') {
        const lowerCaseQuery = query.toLowerCase();
        // Filtra a lista local em vez de chamar a API
        results = allAvailableStocks.filter(item => 
            item.toLowerCase().includes(lowerCaseQuery)
        );
    } 
    // A busca de cripto não muda, pois a API da CoinGecko está funcionando
    else if (assetType === 'cripto') {
        // Esta parte exigiria uma chamada à API da coingecko como antes,
        // mas vamos focar na solução da Brapi por enquanto.
    }
    
    // A função displayResults para a Brapi precisa de um pequeno ajuste
    displayLocalResults(results);
};

// Nova função de display para a lista local (um pouco mais simples)
const displayLocalResults = (results) => {
    searchResultsContainer.innerHTML = '';
    if (!results || results.length === 0) {
        searchResultsContainer.classList.add('hidden');
        return;
    }

    results.slice(0, 7).forEach(stockSymbol => {
        const resultItem = document.createElement('div');
        resultItem.className = 'py-2 px-4 hover:bg-zinc-500 cursor-pointer text-sm font-bold';
        resultItem.textContent = stockSymbol;
        
        resultItem.addEventListener('click', () => {
            assetNameInput.value = stockSymbol;
            searchResultsContainer.innerHTML = '';
            searchResultsContainer.classList.add('hidden');
        });
        
        searchResultsContainer.appendChild(resultItem);
    });

    searchResultsContainer.classList.remove('hidden');
};

// Adiciona o Event Listener ao campo de input com o debounce
assetNameInput.addEventListener('input', debounce((e) => {
    handleSearch(e.target.value);
}, 300)); // Delay de 300ms

// Fecha a lista de resultados se o usuário clicar fora
document.addEventListener('click', (e) => {
    if (!assetNameInput.contains(e.target) && !searchResultsContainer.contains(e.target)) {
        searchResultsContainer.classList.add('hidden');
    }
});
