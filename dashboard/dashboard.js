let transactions = [];
let investments = [];
let filteredTransactions = [];
let categoryPlans = {};
let categoriesMap = {};
const auth = firebase.auth();

// --- Variáveis globais de data ---
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
// ---------------------------------


// Listener para garantir que a autenticação está concluída
document.addEventListener("DOMContentLoaded", function () {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        await user.reload(); 

        loadUserName(user);
        
        // 1. Carrega todos os dados primeiro
        await Promise.all([
          loadTransactionsFromFirestore(),
          loadInvestmentsFromFirestore(),
          loadCategoryPlansFromFirestore()
        ]);
        
        // 2. Define os filtros de data customizados
        setDefaultFilters(); 
        
        // 3. Roda o filtro inicial
        applyFilters(); 
        
        checkIfUserIsNew();

        // 4. Adiciona os listeners para o seletor de data
        setupDateNavigatorListeners();

        // 5. [NOVO] Aplica as melhorias nos gráficos (padding e clique)
        applyChartModifications();

      } catch (error) {
        console.error("Erro ao inicializar o dashboard:", error);
      }
    } else {
      console.error("Usuário não autenticado.");
      window.location.href = "/index.html"; // Redireciona se não estiver logado
    }
  });
});

/**
 * Gera as iniciais a partir de um nome completo.
 */
function getInitials(name) {
  if (!name) {
    return "?";
  }
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) {
    return "?";
  }
  if (nameParts.length === 1) {
    return nameParts[0].charAt(0).toUpperCase();
  }
  const firstInitial = nameParts[0].charAt(0);
  const lastInitial = nameParts[nameParts.length - 1].charAt(0);
  return `${firstInitial}${lastInitial}`.toUpperCase();
}

/**
 * Gera uma cor de fundo consistente para o avatar de iniciais.
 */
function generateColorForName(name) {
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}


  // Função para exibir badge
  function renderBadge(id, pct) {
    const span = document.getElementById(id);
    if (!span) return;

    if (pct === null || isNaN(pct)) {
      span.classList.add("hidden");
      return;
    }

    const valorFormatado = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% `;
    span.textContent = valorFormatado;
    span.classList.remove("hidden");

    // Reset classes
    span.className = "text-xs font-semibold px-2 py-1 rounded-full";

    if (pct > 0) {
      span.classList.add("bg-green-800/25", "text-green-400", "badge-positive");
    } else if (pct < 0) {
      span.classList.add("bg-red-800/25", "text-red-400", "badge-negative");
    } else {
      span.classList.add("bg-zinc-700", "text-zinc-300");
    }
  }

// Função para carregar transações do Firestore
async function loadTransactionsFromFirestore() {
  const user = auth.currentUser;
  if (!user) {
    console.error("Usuário não autenticado.");
    return;
  }

  showLoading();
  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);

  try {
    const categoriesSnapshot = await userRef.collection("categories").get();
    categoriesSnapshot.forEach((doc) => {
      categoriesMap[doc.id] = doc.data().name;
    });

    const transactionsSnapshot = await userRef.collection("transactions").get();
    hideLoading();
    transactions.length = 0;

    transactionsSnapshot.forEach((doc) => {
      const transaction = doc.data();
      transaction.id = doc.id;
      // Garante que a data seja um objeto Date
      if (transaction.dueDate && typeof transaction.dueDate.seconds === 'number') {
        transaction.dueDate = new Date(transaction.dueDate.seconds * 1000);
      } else if (typeof transaction.dueDate === 'string') {
        transaction.dueDate = new Date(transaction.dueDate);
      }
      
      if (transaction.addedOn && typeof transaction.addedOn.seconds === 'number') {
        transaction.addedOn = new Date(transaction.addedOn.seconds * 1000);
      } else if (typeof transaction.addedOn === 'string') {
        transaction.addedOn = new Date(transaction.addedOn);
      }
      
      transactions.push(transaction);
    });

    filteredTransactions = [...transactions];
  } catch (error) {
    hideLoading();
    console.error("Erro ao carregar transações ou categorias:", error);
  }
}

// Função para calcular os totais de receitas, despesas e transações dos dias 01 e 15
function calculateTotals() {
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalGanhoDia01 = 0;
  let totalGastoDia01 = 0;
  let totalGanhoDia15 = 0;
  let totalGastoDia15 = 0;

  filteredTransactions.forEach((transaction) => {
    if (transaction.type === "Ganho") {
      totalReceitas += transaction.amount;

      if (transaction.datepay === "01") totalGanhoDia01 += transaction.amount;
      else if (transaction.datepay === "15") totalGanhoDia15 += transaction.amount;
    } else if (transaction.type === "Gasto") {
      totalDespesas += transaction.amount;

      if (transaction.datepay === "01") totalGastoDia01 += transaction.amount;
      else if (transaction.datepay === "15") totalGastoDia15 += transaction.amount;
    }
  });

  const totalSobra = totalReceitas - totalDespesas;
  const sobraDia01 = totalGanhoDia01 - totalGastoDia01;
  const sobraDia15 = totalGanhoDia15 - totalGastoDia15;

  function renderDiferencaTexto(id, diffValor) {
    const el = document.getElementById(id);
    if (!el) return;
  
    if (diffValor === null || isNaN(diffValor) || diffValor === 0) {
      el.textContent = ""; 
      return;
    }
  
    const prefixo = diffValor > 0 ? "+" : diffValor < 0 ? "-" : "";
    const texto = `${prefixo}${formatarMoeda(Math.abs(diffValor))} vs mês anterior`;

    el.textContent = texto;
  }
  
  // Calcular variações mensais
  const mesAtual = currentMonth; 
  const anoAtual = currentYear;
  let mesAnterior, anoAnterior;

  if (mesAtual === "all") {
      mesAnterior = null; // Não há "mês anterior" para o ano inteiro
      anoAnterior = null;
  } else {
      mesAnterior = (mesAtual + 11) % 12;
      anoAnterior = (mesAtual === 0) ? anoAtual - 1 : anoAtual;
  }

  function somaPorTipoEMês(tipo, mes, ano) {
    if (mes === "all") {
        return transactions.filter(t => 
            t.type === tipo && t.dueDate instanceof Date && 
            t.dueDate.getFullYear() === ano
        ).reduce((s, t) => s + t.amount, 0);
    }
    return transactions.filter(t => 
      t.type === tipo && t.dueDate instanceof Date && 
      t.dueDate.getMonth() === mes && t.dueDate.getFullYear() === ano
    ).reduce((s, t) => s + t.amount, 0);
  }
  
  const receitasAtual = somaPorTipoEMês("Ganho", mesAtual, anoAtual);
  const receitasAnterior = (mesAnterior !== null) ? somaPorTipoEMês("Ganho", mesAnterior, anoAnterior) : null;
  const despesasAtual = somaPorTipoEMês("Gasto", mesAtual, anoAtual);
  const despesasAnterior = (mesAnterior !== null) ? somaPorTipoEMês("Gasto", mesAnterior, anoAnterior) : null;

  const sobraAtual = receitasAtual - despesasAtual;
  const sobraAnterior = (receitasAnterior !== null && despesasAnterior !== null) ? receitasAnterior - despesasAnterior : null;

  function variacaoPositiva(atual, anterior) {
    if (anterior === null || atual === null) return null;
    if (anterior === 0) return (atual > 0) ? 100 : 0;
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  }

  function variacaoNegativa(atual, anterior) {
    if (anterior === null || atual === null) return null;
    if (anterior === 0) return (atual > 0) ? -100 : 0;
    return ((anterior - atual) / Math.abs(anterior)) * 100;
  }

  const diffReceitas = (receitasAtual !== null && receitasAnterior !== null) ? receitasAtual - receitasAnterior : null;
  const diffDespesas = (despesasAtual !== null && despesasAnterior !== null) ? despesasAtual - despesasAnterior : null;
  const diffSobra = (sobraAtual !== null && sobraAnterior !== null) ? sobraAtual - sobraAnterior : null;
  
  renderBadge("badgeReceitas", variacaoPositiva(receitasAtual, receitasAnterior));
  renderBadge("badgeDespesas", variacaoNegativa(despesasAtual, despesasAnterior));
  renderBadge("badgeSobra", variacaoPositiva(sobraAtual, sobraAnterior));
  
  renderDiferencaTexto("diffReceitas", diffReceitas);
  renderDiferencaTexto("diffDespesas", diffDespesas);
  renderDiferencaTexto("diffSobra", diffSobra);

  animarContador("totalReceitas", totalReceitas);
  animarContador("totalDespesas", totalDespesas);
  animarContador("totalSobra", totalSobra);

  animarContador("totalGanhoDia01", totalGanhoDia01);
  animarContador("totalGastoDia01", totalGastoDia01);
  animarContador("sobraDia01", sobraDia01);
  animarContador("totalGanhoDia15", totalGanhoDia15);
  animarContador("totalGastoDia15", totalGastoDia15);
  animarContador("sobraDia15", sobraDia15);
}

// Função para atualizar os gráficos após o filtro
function updateCharts() {
  // --- Gráfico de Dívidas por Dia ---
  debtsByDayChart.data.datasets[0].data = [
    filteredTransactions
      .filter((t) => t.type === "Gasto" && t.datepay === "01")
      .reduce((sum, t) => sum + t.amount, 0),
    filteredTransactions
      .filter((t) => t.type === "Gasto" && t.datepay === "15")
      .reduce((sum, t) => sum + t.amount, 0),
  ];
  debtsByDayChart.update();

  // --- Gráfico de Categorias ---
  const categoriesData = filteredTransactions
    .filter((t) => t.type === "Gasto")
    .reduce((acc, t) => {
      const categoryName = categoriesMap[t.category] || "Sem Categoria";
      acc[categoryName] = (acc[categoryName] || 0) + t.amount;
      return acc;
    }, {});

  categoriesChart.data.labels = Object.keys(categoriesData);
  categoriesChart.data.datasets[0].data = Object.values(categoriesData);
  categoriesChart.update();

  // --- Gráfico de Pagas vs Pendentes ---
  const paidTransactions = filteredTransactions.filter(
    (t) => t.type === "Gasto" && t.isPaid
  ).length;
  const pendingTransactions = filteredTransactions.filter(
    (t) => t.type === "Gasto" && !t.isPaid
  ).length;
  paidVsPendingChart.data.datasets[0].data = [
    paidTransactions,
    pendingTransactions,
  ];
  paidVsPendingChart.update();

  // --- Gráficos de Receita e Despesa Mensal ---
  const yearForMonthlyCharts = currentYear; 

  const monthlyIncomeData = Array(12).fill(0);
  const monthlyExpensesData = Array(12).fill(0);

  transactions.forEach(t => {
      if (t.dueDate instanceof Date && t.dueDate.getFullYear() === yearForMonthlyCharts) {
          const month = t.dueDate.getMonth();
          if (t.type === "Ganho") {
              monthlyIncomeData[month] += t.amount;
          } else if (t.type === "Gasto") {
              monthlyExpensesData[month] += t.amount;
          }
      }
  });

  // [INÍCIO DA MELHORIA 1: Barras Cinzas]
  const activeGreen = '#10B981';
  const activeRed = '#ef4444';
  const inactiveColor = '#52525b'; // zinc-600

  const incomeColors = Array(12).fill(inactiveColor);
  const expenseColors = Array(12).fill(inactiveColor);

  if (currentMonth === "all") {
      // Ano inteiro: todas as barras ativas
      monthlyIncomeChart.data.datasets[0].backgroundColor = activeGreen;
      monthlyExpensesChart.data.datasets[0].backgroundColor = activeRed;
  } else {
      // Mês específico: só uma barra ativa
      if (currentMonth >= 0 && currentMonth < 12) {
        incomeColors[currentMonth] = activeGreen;
        expenseColors[currentMonth] = activeRed;
      }
      monthlyIncomeChart.data.datasets[0].backgroundColor = incomeColors;
      monthlyExpensesChart.data.datasets[0].backgroundColor = expenseColors;
  }
  // [FIM DA MELHORIA 1]

  monthlyIncomeChart.data.datasets[0].data = monthlyIncomeData;
  monthlyExpensesChart.data.datasets[0].data = monthlyExpensesData;
  monthlyIncomeChart.update();
  monthlyExpensesChart.update();

  // --- Gráfico de Planejamento ---
  if (window.planningChart) { 
    const actualDataById = filteredTransactions
      .filter(t => t.type === "Gasto")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});

    const chartLabels = [];
    const chartPlannedData = [];
    const chartActualData = [];

    for (const catId in categoryPlans) {
      const catName = categoriesMap[catId] || "Categoria (ID: " + catId + ")";
      const planned = categoryPlans[catId] || 0;
      const actual = actualDataById[catId] || 0;

      if (planned > 0 || actual > 0) {
        chartLabels.push(catName);
        chartPlannedData.push(planned);
        chartActualData.push(actual);
      }
    }
    
    window.planningChart.data.labels = chartLabels;
    window.planningChart.data.datasets[0].data = chartPlannedData;
    window.planningChart.data.datasets[1].data = chartActualData;
    window.planningChart.update();
  }
}

// Define o mês/ano atual nas variáveis globais
function setDefaultFilters() {
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth(); // Mês atual (número 0-11)
  updateMonthDisplay(); 
}

// Filtra transações com base nas variáveis globais
function applyFilters() {
  const year = currentYear;
  const month = currentMonth; // 'all' ou um número (0-11)

  // 1. Filtra as Transações
  filteredTransactions = transactions.filter(t => {
    if (!(t.dueDate instanceof Date) || isNaN(t.dueDate.getTime())) return false; // Ignora transações com data inválida
    
    const tDate = t.dueDate;
    const yearMatch = tDate.getFullYear() === year;
    const monthMatch = (month === "all") || (tDate.getMonth() === month);
    return yearMatch && monthMatch;
  });

  // 2. Filtra os Investimentos (sempre pelo ano inteiro)
  const filteredInvestments = investments.filter(inv => {
     const invDate = new Date(inv.date); 
     if (isNaN(invDate.getTime())) return false; 
     const yearMatch = invDate.getFullYear() === year;
     return yearMatch;
  });

  // 3. Recalcula todos os totais e gráficos
  calculateTotals(); 
  calculateInvestmentTotals(filteredInvestments); 
  updateCharts(); 
  updateInvestmentCharts(filteredInvestments); 
}

function logout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "/index.html";
    })
    .catch(() => {
      showAlert('Erro ao deslogar: ' + error.message, 'error');
    });
}

  // Listener para fechar o dropdown do usuário
  const dropdownButton = document.getElementById("dropdownButton");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (dropdownButton) {
    dropdownButton.addEventListener("click", (event) => {
      event.stopPropagation(); 
      dropdownMenu.classList.toggle("hidden");
    });
  }

  document.addEventListener("click", (event) => {
    if (dropdownMenu && !dropdownButton.contains(event.target)) {
      dropdownMenu.classList.add("hidden");
    }
  });

// Função para carregar nome do usuário ao iniciar a página
function loadUserName(user) {
  const nameFromEmail = user.email ? user.email.split('@')[0] : "Usuário";
  const displayName = user.displayName || nameFromEmail;
  
  const email = user.email || "E-mail não disponível";
  const photoURL = user.photoURL;

  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");
  const userGreetingEl = document.getElementById("user-greeting");
  const userModalEl = document.getElementById("user-modal");
  
  const photoEl = document.getElementById("user-photo");
  const initialsEl = document.getElementById("user-initials");

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = email;
  if (userGreetingEl) userGreetingEl.textContent = displayName;
  if (userModalEl) userModalEl.textContent = displayName;

  if (photoURL) {
    if (photoEl) photoEl.src = photoURL;
    if (photoEl) photoEl.classList.remove('hidden');
    if (initialsEl) initialsEl.classList.add('hidden');
  } else {
    const initial = getInitials(displayName);
    const color = generateColorForName(displayName);

    if (initialsEl) initialsEl.textContent = initial;
    if (initialsEl) initialsEl.style.backgroundColor = color;
    
    if (photoEl) photoEl.classList.add('hidden');
    if (initialsEl) initialsEl.classList.remove('hidden');
  }
}

function animarContador(id, valorFinal, duracao = 1000) {
  const elemento = document.getElementById(id);
  if (!elemento || isNaN(valorFinal)) return;

  let inicio = 0;
  try {
    const valorAtual = elemento.textContent.replace(/[^\d,]/g, '').replace(',', '.');
    inicio = parseFloat(valorAtual) || 0;
  } catch (e) {
    inicio = 0;
  }

  const startTime = performance.now();
  elemento.style.opacity = "0.7";
  elemento.style.transform = "scale(1.1)";

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duracao, 1);
    const current = inicio + (valorFinal - inicio) * progress;

    elemento.textContent = formatarMoeda(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      elemento.style.transition = "all 0.3s ease";
      elemento.style.opacity = "1";
      elemento.style.transform = "scale(1)";
      setTimeout(() => {
        elemento.style.transition = "";
      }, 300);
    }
  }
  requestAnimationFrame(update);
}

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2
  });
}

function showNewUserModal() {
  document.getElementById("newUserModal").classList.remove("hidden");
}

function hideNewUserModal() {
  document.getElementById("newUserModal").classList.add("hidden");
}

function checkIfUserIsNew() {
  if (!transactions || transactions.length === 0) {
    showNewUserModal();
  }
}

// Função para carregar investimentos do Firestore
async function loadInvestmentsFromFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  const db = firebase.firestore();
  const investRef = db.collection("users").doc(user.uid).collection("investiments");

  try {
    const snapshot = await investRef.get();
    investments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Erro ao carregar investimentos:", error);
  }
}

function calculateInvestmentTotals(investmentsToCalculate) {
  if (!investmentsToCalculate || investmentsToCalculate.length === 0) {
    document.getElementById("totalPatrimonio").textContent = formatarMoeda(0);
    document.getElementById("rendimentoTotalInvestimentos").textContent = "Rendimento total de " + formatarMoeda(0);
    renderBadge("badgeInvestimentos", 0);
    document.getElementById("totalAportadoCard").textContent = formatarMoeda(0);
    document.getElementById("rendimentoCard").textContent = formatarMoeda(0);
    return;
  }

  let totalInvestido = 0;
  let patrimonioAtual = 0;

  investmentsToCalculate.forEach(inv => {
    const price = parseFloat(inv.price) || 0;
    const quantity = parseFloat(inv.quantity) || 0;
    const currentValue = parseFloat(inv.currentValue) || 0;

    totalInvestido += price * quantity;
    patrimonioAtual += currentValue * quantity;
  });

  const rendimento = patrimonioAtual - totalInvestido;
  const rendimentoPct = totalInvestido > 0 ? (rendimento / totalInvestido) * 100 : 0;
  
  const totalPatrimonioEl = document.getElementById("totalPatrimonio");
  if (totalPatrimonioEl) animarContador("totalPatrimonio", patrimonioAtual);

  const rendimentoTotalEl = document.getElementById("rendimentoTotalInvestimentos");
  if (rendimentoTotalEl) rendimentoTotalEl.textContent = `Rendimento total de ${formatarMoeda(rendimento)}`;
  
  renderBadge("badgeInvestimentos", rendimentoPct); 
  
  const totalAportadoEl = document.getElementById("totalAportadoCard");
  if (totalAportadoEl) animarContador("totalAportadoCard", totalInvestido);
  
  const rendimentoCardEl = document.getElementById("rendimentoCard");
  if (rendimentoCardEl) {
    rendimentoCardEl.textContent = formatarMoeda(rendimento);
    rendimentoCardEl.className = `text-sm font-medium ${rendimento >= 0 ? 'text-green-400' : 'text-red-400'}`;
  }
}

function updateInvestmentCharts(investmentsToUpdate) {
  // Dados para o Gráfico de Alocação
  const allocationData = investmentsToUpdate.reduce((acc, inv) => {
    const valor = (inv.currentValue || 0) * (inv.quantity || 0);
    acc[inv.type] = (acc[inv.type] || 0) + valor;
    return acc;
  }, {});
  
  investmentAllocationChart.data.labels = Object.keys(allocationData).map(k => k.charAt(0).toUpperCase() + k.slice(1));
  investmentAllocationChart.data.datasets[0].data = Object.values(allocationData);
  investmentAllocationChart.update();

  // Dados para o Gráfico de Evolução dos Aportes
  const evolutionData = Array(12).fill(0);
  investmentsToUpdate.forEach(inv => {
    const invDate = new Date(inv.date);
    if (isNaN(invDate.getTime())) return; 

    const month = invDate.getMonth();
    if (month >= 0 && month < 12) {
      evolutionData[month] += (inv.price || 0) * (inv.quantity || 0);
    }
  });

  portfolioEvolutionChart.data.datasets[0].data = evolutionData;
  portfolioEvolutionChart.update();
}

// Carrega os valores planejados para as categorias
async function loadCategoryPlansFromFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  const db = firebase.firestore();
  const plansRef = db.collection("users").doc(user.uid).collection("categoryPlans");
  
  try {
    const snapshot = await plansRef.get();
    snapshot.docs.forEach(doc => {
      categoryPlans[doc.id] = doc.data().plannedValue || 0;
    });
  } catch (error) {
    console.error("Erro ao carregar planejamento:", error);
  }
}

// Configura os listeners do novo seletor de data
function setupDateNavigatorListeners() {
  const monthNavigator = document.querySelector("span.text-lg.font-semibold");

  // Botão de Mês Anterior
  document.querySelector(".fa-chevron-left").addEventListener("click", () => {
    // [BUG 1 CORRIGIDO] Lógica para sair do "Ano Inteiro"
    if (currentMonth === "all") {
        currentMonth = 11; // Vai para Dezembro
        // Não muda o ano, fica no ano atual
    } else {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
    }
    updateMonthDisplay();
    applyFilters(); 
  });

  // Botão de Próximo Mês
  document.querySelector(".fa-chevron-right").addEventListener("click", () => {
    // [BUG 1 CORRIGIDO] Lógica para sair do "Ano Inteiro"
    if (currentMonth === "all") {
        currentMonth = 0; // Vai para Janeiro
        // Não muda o ano, fica no ano atual
    } else {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
    }
    updateMonthDisplay();
    applyFilters();
  });

  // Abre o "Calendário" customizado
  if (monthNavigator) {
    monthNavigator.addEventListener("click", (event) => {
      const existingDropdown = document.getElementById("dropdownContainer");
      if (existingDropdown) {
        existingDropdown.remove();
        return;
      }

      const dropdownContainer = document.createElement("div");
      dropdownContainer.id = "dropdownContainer";
      dropdownContainer.className =
        "absolute bg-zinc-800 text-white rounded-xl shadow-2xl p-4 mt-2 z-10";

      const navigatorRect = monthNavigator.getBoundingClientRect();
      dropdownContainer.style.position = "absolute";
      const dropdownWidth = 240;
      dropdownContainer.style.width = `${dropdownWidth}px`;
      dropdownContainer.style.left = `${navigatorRect.left + navigatorRect.width / 2 - dropdownWidth / 2 + window.scrollX}px`;
      dropdownContainer.style.top = `${navigatorRect.bottom + 6 + window.scrollY}px`;

      let selectedYear = currentYear;

      function updateDropdownContent() {
        dropdownContainer.innerHTML = `
          <div class="flex justify-between items-center mb-4">
            <button id="prevYear" class="bg-green-500 p-2 rounded-lg px-4 py-1"><i class="fas fa-chevron-left"></i></button>
            <span class="text-lg">${selectedYear}</span>
            <button id="nextYear" class="bg-green-500 p-2 rounded-lg px-4 py-1"><i class="fas fa-chevron-right"></i></button>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <button 
              class="bg-zinc-700 p-2 rounded-lg hover:bg-zinc-600 col-span-4 ${
                currentMonth === "all" && selectedYear === currentYear
                  ? "ring-2 ring-green-500"
                  : ""
              }"
              data-month="all">
              Ano Inteiro
            </button>
            ${months
              .map(
                (month, index) => `
              <button 
                class="bg-zinc-700 p-2 rounded-lg hover:bg-zinc-600 ${
                  index === currentMonth && selectedYear === currentYear
                    ? "ring-2 ring-green-500"
                    : ""
                }"
                data-month="${index}">
                ${month.slice(0, 3)}
              </button>
            `
              )
              .join("")}
          </div>
        `;

        // Listeners para os botões DENTRO do dropdown
        dropdownContainer
          .querySelector("#prevYear")
          .addEventListener("click", (e) => {
            e.stopPropagation();
            selectedYear--;
            updateDropdownContent();
          });

        dropdownContainer
          .querySelector("#nextYear")
          .addEventListener("click", (e) => {
            e.stopPropagation();
            selectedYear++;
            updateDropdownContent();
          });

        dropdownContainer.querySelectorAll("[data-month]").forEach((button) => {
          button.addEventListener("click", (e) => {
            currentYear = selectedYear;
            const monthValue = e.target.dataset.month;
            currentMonth = (monthValue === "all") ? "all" : parseInt(monthValue);
            
            updateMonthDisplay();
            applyFilters();
            dropdownContainer.remove();
          });
        });
      }

      updateDropdownContent();
      document.body.appendChild(dropdownContainer);

      // Fecha o dropdown ao clicar fora
      document.addEventListener("click", function closeDropdown(e) {
        if (dropdownContainer && !dropdownContainer.contains(e.target) && e.target !== monthNavigator) {
          dropdownContainer.remove();
          document.removeEventListener("click", closeDropdown);
        }
      });

      dropdownContainer.addEventListener("click", (e) => e.stopPropagation());
    });
  }
}

// Atualiza o texto para lidar com "Ano Inteiro"
function updateMonthDisplay() {
  const monthNavigator = document.querySelector("span.text-lg.font-semibold");
  if (monthNavigator) {
    const monthText = (currentMonth === "all") ? "Ano Inteiro" : months[currentMonth];
    monthNavigator.textContent = `${monthText} ${currentYear}`;
  }
}

// [INÍCIO DAS NOVAS FUNÇÕES]

/**
 * [MELHORIA 2]
 * Esta é a função que será chamada quando você clicar em um gráfico.
 */
function handleChartClick(event, elements) {
    // Só ativa o filtro se estiver na visão "Ano Inteiro" e se o clique foi em uma barra
    if (currentMonth !== "all" || elements.length === 0) {
        return;
    }
    
    // Pega o índice (0-11) do mês clicado
    const monthIndex = elements[0].index; 
    
    // Define o novo mês globalmente
    currentMonth = monthIndex;
    
    // Atualiza o texto do seletor (ex: "Julho 2024")
    updateMonthDisplay();
    // Refaz todo o filtro do dashboard (cards, gráficos, etc.)
    applyFilters();
}

/**
 * [BUG 2 & MELHORIA 2]
 * Esta função aplica as correções de layout e os listeners de clique
 * nos objetos dos gráficos (que são criados pelo charts.js).
 */
function applyChartModifications() {
    // Espera os gráficos (definidos em charts.js) estarem prontos
    const checkChartsReady = setInterval(() => {
        try {
            // Se esta variável (do charts.js) existir, paramos de verificar
            if (window.monthlyIncomeChart && window.monthlyExpensesChart) {
                clearInterval(checkChartsReady);

                // --- Correção do Tooltip (BUG 2) ---
                const topPadding = { top: 30 }; // Aumenta o espaço no topo

                // Aplica o padding em todos os gráficos
                window.monthlyIncomeChart.options.layout.padding = topPadding;
                window.monthlyExpensesChart.options.layout.padding = topPadding;
                window.categoriesChart.options.layout.padding = topPadding;
                window.paidVsPendingChart.options.layout.padding = topPadding;
                window.debtsByDayChart.options.layout.padding = topPadding;
                window.planningChart.options.layout.padding = topPadding;
                window.investmentAllocationChart.options.layout.padding = topPadding;
                window.portfolioEvolutionChart.options.layout.padding = topPadding;
                
                // --- Interatividade dos Gráficos (MELHORIA 2) ---
                window.monthlyIncomeChart.options.onClick = handleChartClick;
                window.monthlyExpensesChart.options.onClick = handleChartClick;

                // Re-renderiza os gráficos com as novas opções
                window.monthlyIncomeChart.update();
                window.monthlyExpensesChart.update();
                // Os outros serão atualizados pelo applyFilters()
            }
        } catch (e) {
            console.warn("Aguardando 'charts.js' carregar...");
        }
    }, 100); // Verifica a cada 100ms
}

// [FIM DAS NOVAS FUNÇÕES]