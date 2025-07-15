let transactions = [];
let investments = [];
let filteredTransactions = [];
const auth = firebase.auth();

// Listener para garantir que a autenticação está concluída
document.addEventListener("DOMContentLoaded", function () {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        await user.reload(); // Garante que os dados do usuário (como displayName) estão atualizados

        // AGORA, APENAS CHAMAMOS AS FUNÇÕES PRINCIPAIS
        loadUserName(user); // Única função responsável pelo nome e avatar
        
        await Promise.all([
          loadTransactionsFromFirestore(),
          loadInvestmentsFromFirestore()
        ]);

        calculateTotals();
        calculateInvestmentTotals();
        updateCharts();
        updateInvestmentCharts();
        
        setDefaultMonth();
        checkIfUserIsNew();

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
 * Pega a primeira letra do primeiro e do último nome.
 * @param {string} name - O nome do usuário.
 * @returns {string} - As iniciais (ex: "AM" para "Admin Master").
 */
function getInitials(name) {
  if (!name) {
    return "?";
  }

  // Remove espaços extras e divide o nome em partes
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);

  // Se não houver partes válidas, retorna "?"
  if (nameParts.length === 0) {
    return "?";
  }

  // Se for um nome único (ex: "Admin"), retorna só a primeira letra
  if (nameParts.length === 1) {
    return nameParts[0].charAt(0).toUpperCase();
  }

  // Pega a primeira letra do primeiro nome
  const firstInitial = nameParts[0].charAt(0);
  // Pega a primeira letra do último nome
  const lastInitial = nameParts[nameParts.length - 1].charAt(0);

  return `${firstInitial}${lastInitial}`.toUpperCase();
}

/**
 * Gera uma cor de fundo consistente a partir de uma lista pré-definida,
 * baseando-se no nome do usuário para que a cor seja sempre a mesma para ele.
 * @param {string} name - O nome para gerar a cor.
 * @returns {string} Um código de cor hexadecimal.
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
      // Alterado para zinc-700 e zinc-300
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
    const categoriesMap = {};
    categoriesSnapshot.forEach((doc) => {
      categoriesMap[doc.id] = doc.data().name;
    });

    const transactionsSnapshot = await userRef.collection("transactions").get();
    hideLoading();
    transactions.length = 0;

    transactionsSnapshot.forEach((doc) => {
      const transaction = doc.data();
      transaction.id = doc.id;
      transaction.dueDate = new Date(transaction.dueDate.seconds * 1000);
      transaction.addedOn = new Date(transaction.addedOn.seconds * 1000);

      if (transaction.category in categoriesMap) {
        transaction.category = categoriesMap[transaction.category];
      }

      transactions.push(transaction);
    });

    filteredTransactions = [...transactions];
    calculateTotals();
    updateCharts();
    setDefaultMonth();
    checkIfUserIsNew();
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

    renderBadge("badgeReceitas");
  });

  const totalSobra = totalReceitas - totalDespesas;
  const sobraDia01 = totalGanhoDia01 - totalGastoDia01;
  const sobraDia15 = totalGanhoDia15 - totalGastoDia15;




  function renderDiferencaTexto(id, diffValor) {
    const el = document.getElementById(id);
    if (!el) return;
  
    if (diffValor === null || isNaN(diffValor)) {
      el.textContent = "";
      return;
    }
  
    const prefixo = diffValor > 0 ? "+" : diffValor < 0 ? "-" : "";
    const texto = `${prefixo}${formatarMoeda(Math.abs(diffValor))} vs mês anterior`;

    el.textContent = texto;

  }
  

  // Calcular variações mensais
  const selectedMonth = document.getElementById("monthFilter").value;
  const mesAtual = selectedMonth === "all" ? null : parseInt(selectedMonth);
  const mesAnterior = mesAtual !== null ? (mesAtual + 11) % 12 : null;

  function somaPorTipoEMês(tipo, mes) {
    return transactions.filter(t => 
      t.type === tipo && t.dueDate instanceof Date && t.dueDate.getMonth() === mes
    ).reduce((s, t) => s + t.amount, 0);
  }

  const receitasAtual = mesAtual !== null ? somaPorTipoEMês("Ganho", mesAtual) : null;
  const receitasAnterior = mesAnterior !== null ? somaPorTipoEMês("Ganho", mesAnterior) : null;
  const despesasAtual = mesAtual !== null ? somaPorTipoEMês("Gasto", mesAtual) : null;
  const despesasAnterior = mesAnterior !== null ? somaPorTipoEMês("Gasto", mesAnterior) : null;

  const sobraAtual = receitasAtual !== null && despesasAtual !== null ? receitasAtual - despesasAtual : null;
  const sobraAnterior = receitasAnterior !== null && despesasAnterior !== null ? receitasAnterior - despesasAnterior : null;

// Para receitas e sobra: quanto mais, melhor
function variacaoPositiva(atual, anterior) {
  return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
}

// Para despesas: quanto menos, melhor (inverter o sinal)
function variacaoNegativa(atual, anterior) {
  return anterior > 0 ? ((anterior - atual) / anterior) * 100 : null;
}

  const diffReceitas = receitasAtual - receitasAnterior;
  const diffDespesas = despesasAtual - despesasAnterior;
  const diffSobra = sobraAtual - sobraAnterior;
  
    renderBadge("badgeReceitas", variacaoPositiva(receitasAtual, receitasAnterior));
  renderBadge("badgeDespesas", variacaoNegativa(despesasAtual, despesasAnterior));
  renderBadge("badgeSobra", variacaoPositiva(sobraAtual, sobraAnterior));
  
  
  renderDiferencaTexto("diffReceitas", diffReceitas);
  renderDiferencaTexto("diffDespesas", diffDespesas);
  renderDiferencaTexto("diffSobra", diffSobra);

 // Animação de valores
  animarContador("totalReceitas", totalReceitas);
  animarContador("totalDespesas", totalDespesas);
  animarContador("totalSobra", totalSobra);

  animarContador("totalGanhoDia01", totalGanhoDia01);
  animarContador("totalGastoDia01", totalGastoDia01);
  animarContador("sobraDia01", sobraDia01);
  animarContador("totalGanhoDia15", totalGanhoDia15);
  animarContador("totalGastoDia15", totalGastoDia15);
  animarContador("sobraDia15", sobraDia15);// Animação de valores
  animarContador("totalReceitas", totalReceitas);
  animarContador("totalDespesas", totalDespesas);
  animarContador("totalSobra", totalSobra);

  animarContador("totalGanhoDia01", totalGanhoDia01);
  animarContador("totalGastoDia01", totalGastoDia01);
  animarContador("sobraDia01", sobraDia01);
  animarContador("totalGanhoDia15", totalGanhoDia15);
  animarContador("totalGastoDia15", totalGastoDia15);
  animarContador("sobraDia15", sobraDia15);

  // Texto final nos elementos
  document.getElementById("totalReceitas").textContent = formatarMoeda(totalReceitas);
  document.getElementById("totalDespesas").textContent = formatarMoeda(totalDespesas);
  document.getElementById("totalSobra").textContent = formatarMoeda(totalSobra);

  document.getElementById("totalGanhoDia01").textContent = formatarMoeda(totalGanhoDia01);
  document.getElementById("totalGastoDia01").textContent = formatarMoeda(totalGastoDia01);
  document.getElementById("sobraDia01").textContent = formatarMoeda(sobraDia01);

  document.getElementById("totalGanhoDia15").textContent = formatarMoeda(totalGanhoDia15);
  document.getElementById("totalGastoDia15").textContent = formatarMoeda(totalGastoDia15);
  document.getElementById("sobraDia15").textContent = formatarMoeda(sobraDia15);

  gerarResumoAnual();
  gerarPlanoFinanceiroPessoal();
}

// Função para atualizar os gráficos após o filtro
function updateCharts() {
  debtsByDayChart.data.datasets[0].data = [
    filteredTransactions
      .filter((t) => t.type === "Gasto" && t.datepay === "01")
      .reduce((sum, t) => sum + t.amount, 0),
    filteredTransactions
      .filter((t) => t.type === "Gasto" && t.datepay === "15")
      .reduce((sum, t) => sum + t.amount, 0),
  ];
  debtsByDayChart.update();

  const categoriesData = filteredTransactions
    .filter((t) => t.type === "Gasto")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  // Atualiza o gráfico de categorias com as transações de "Gasto"
  categoriesChart.data.labels = Object.keys(categoriesData);
  categoriesChart.data.datasets[0].data = Object.values(categoriesData);
  categoriesChart.update();

  // Atualizar gráfico de Pagas vs Pendentes para transações do tipo "Gasto"
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

  // Atualizar gráfico de Receitas por Mês
  const monthlyIncomeData = Array.from({ length: 12 }, (_, i) => {
    return filteredTransactions
      .filter((t) => t.type === "Ganho" && t.dueDate.getMonth() === i)
      .reduce((sum, t) => sum + t.amount, 0);
  });

  const monthlyExpensesData = Array.from({ length: 12 }, (_, i) => {
    return filteredTransactions
      .filter((t) => t.type === "Gasto" && t.dueDate.getMonth() === i)
      .reduce((sum, t) => sum + t.amount, 0);
  });

  monthlyIncomeChart.data.datasets[0].data = monthlyIncomeData;
  monthlyExpensesChart.data.datasets[0].data = monthlyExpensesData;
  monthlyIncomeChart.update();
  monthlyExpensesChart.update();
}

// Função para definir o mês atual no filtro
function setDefaultMonth() {
  const currentMonth = new Date().getMonth();
  document.getElementById("monthFilter").value = currentMonth;
  filterByMonth();
}

window.onload = setDefaultMonth;

// Função para filtrar as transações por mês
function filterByMonth() {
  const selectedMonth = document.getElementById("monthFilter").value;

  if (selectedMonth === "all") {
    filteredTransactions = [...transactions];
  } else {
    filteredTransactions = transactions.filter((transaction) => {
      return transaction.dueDate.getMonth() === parseInt(selectedMonth);
    });
  }

  calculateTotals();
  updateCharts();
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

  // Listener para fechar o dropdown ao clicar fora
  const dropdownButton = document.getElementById("dropdownButton");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (dropdownButton) {
    dropdownButton.addEventListener("click", (event) => {
      event.stopPropagation(); // Evita que o clique no botão feche o menu imediatamente
      dropdownMenu.classList.toggle("hidden");
    });
  }

  document.addEventListener("click", (event) => {
    if (dropdownMenu && !dropdownButton.contains(event.target)) {
      dropdownMenu.classList.add("hidden");
    }
  });

  // Listener para o botão de hambúrguer e botão de fechar a sidebar móvel
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  const mobileSidebar = document.getElementById("sidebar"); // A própria sidebar
  const mobileOverlay = document.getElementById("mobile-sidebar-overlay");

  if (hamburgerBtn) {
      hamburgerBtn.addEventListener("click", toggleMobileSidebar);
  }
  if (closeSidebarBtn) {
      closeSidebarBtn.addEventListener("click", toggleMobileSidebar);
  }
  if (mobileOverlay) {
      mobileOverlay.addEventListener("click", toggleMobileSidebar);
  }

// Função para abrir/fechar a sidebar móvel (GLOBALMENTE ACESSÍVEL)
function toggleMobileSidebar() {
    const mobileSidebar = document.getElementById("sidebar");
    const mobileOverlay = document.getElementById("mobile-sidebar-overlay");
    const closeSidebarBtn = document.getElementById("closeSidebarBtn");

    if (mobileSidebar && mobileOverlay && closeSidebarBtn) {
        mobileSidebar.classList.toggle("is-open");
        mobileOverlay.classList.toggle("hidden");
        closeSidebarBtn.classList.toggle("hidden"); // Mostra/esconde o botão de fechar
    }
}

function closeModal() {
  const modal = document.getElementById("no-transactions-popup");
  const overlay = document.getElementById("overlay");

  modal.classList.add("hidden");
  overlay.classList.add("hidden");
}

function showAlert(message, type = 'success') {
  const alertContainer = document.getElementById('alert-container');
  const alert = document.createElement('div');

  let baseClasses =
    'flex items-center px-4 py-3 rounded shadow-md transition-opacity duration-300';
    
  let typeClasses = "";
  if (type === "success") {
    typeClasses = "bg-green-500 text-white hover:bg-green-600 transition-colors cursor-default select-none";
  } else if (type === "error") {
    typeClasses = "bg-red-500 text-white hover:bg-red-600 transition-colors cursor-default select-none";
  } else if (type === "info") {
    typeClasses = "bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-default select-none";
  } else if (type === "warning") {
    typeClasses = "bg-yellow-500 text-black hover:bg-yellow-600 transition-colors cursor-default select-none";
  }

  alert.className = `${baseClasses} ${typeClasses}`;
  alert.innerHTML = `
    <span class="flex-grow">${message}</span>
    <button class="ml-4 text-lg font-bold focus:outline-none">&times;</button>
  `;

  // Remover alerta ao clicar no botão ou após 5 segundos
  alert.querySelector('button').addEventListener('click', () => {
    alert.remove();
  });

  setTimeout(() => {
    alert.remove();
  }, 3000);

  alertContainer.appendChild(alert);
}

// Carregar nome do usuário ao iniciar a página
function loadUserName(user) {
  // Define o nome de exibição, com fallback para o início do e-mail
  const nameFromEmail = user.email ? user.email.split('@')[0] : "Usuário";
  const displayName = user.displayName || nameFromEmail;
  
  const email = user.email || "E-mail não disponível";
  const photoURL = user.photoURL;

  // Pega todos os elementos da interface que precisam ser atualizados
  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");
  const userGreetingEl = document.getElementById("user-greeting");
  const userModalEl = document.getElementById("user-modal");
  
  const photoEl = document.getElementById("user-photo");
  const initialsEl = document.getElementById("user-initials");

  // Atualiza todos os textos com o nome do usuário
  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = email;
  if (userGreetingEl) userGreetingEl.textContent = displayName;
  if (userModalEl) userModalEl.textContent = displayName;

  // LÓGICA CORRETA PARA MOSTRAR FOTO OU INICIAIS
  if (photoURL) {
    // Se TEM foto, mostra o elemento da imagem e esconde as iniciais
    photoEl.src = photoURL;
    photoEl.classList.remove('hidden');
    initialsEl.classList.add('hidden');
  } else {
    // Se NÃO TEM foto, calcula e exibe as iniciais
    const initial = getInitials(displayName);
    const color = generateColorForName(displayName);

    initialsEl.textContent = initial;
    initialsEl.style.backgroundColor = color;
    
    photoEl.classList.add('hidden');
    initialsEl.classList.remove('hidden');
  }
}

function animarContador(id, valorFinal, duracao = 1000) {
  const elemento = document.getElementById(id);
  if (!elemento || isNaN(valorFinal)) return;

  // Tentar obter o valor atual do elemento
  let inicio = 0;
  try {
    const valorAtual = elemento.textContent.replace(/[^\d,]/g, '').replace(',', '.');
    inicio = parseFloat(valorAtual) || 0;
  } catch (e) {
    inicio = 0;
  }

  const startTime = performance.now();

  // Efeito visual inicial
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
      // Efeito final
      elemento.style.transition = "all 0.3s ease";
      elemento.style.opacity = "1";
      elemento.style.transform = "scale(1)";

      // Remove a transição após a animação
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

function gerarResumoAnual() {
  const container = document.getElementById("resumoAnual");
  if (!container) return;

  if (!transactions.length) {
    // Alterado para zinc-800 e zinc-400
    container.innerHTML = `
      <div class="bg-zinc-800 text-white p-4 rounded-lg text-center">
        <p class="text-sm">Nenhum dado encontrado para gerar o resumo anual.</p>
        <p class="text-sm mt-1 text-zinc-400">Adicione transações para começar a visualizar seu desempenho financeiro.</p>
      </div>
    `;
    return;
  }

  const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const dadosAnuais = Array.from({ length: 12 }, () => ({ receitas: 0, despesas: 0, sobra: 0 }));
  const anoAtual = new Date().getFullYear();

  transactions.forEach((t) => {
    if (!t.dueDate || !(t.dueDate instanceof Date)) t.dueDate = new Date(t.dueDate);

    const data = t.dueDate;
    const mes = data.getMonth();
    const ano = data.getFullYear();

    if (ano === anoAtual) {
      if (t.type === "Ganho") dadosAnuais[mes].receitas += t.amount;
      else if (t.type === "Gasto") dadosAnuais[mes].despesas += t.amount;
    }
  });

  let maiorGasto = { mes: null, valor: 0 };
  let maiorSobra = { mes: null, valor: -Infinity };
  let acumulado = 0;

  let resumoHTML = `<h2 class="text-lg font-bold text-white">📆 Resumo Anual (2024)</h2>`;
  resumoHTML += `<div class="grid grid-cols-2 md:grid-cols-4 gap-4">`;

  dadosAnuais.forEach((dado, i) => {
    dado.sobra = dado.receitas - dado.despesas;
    if (dado.despesas > maiorGasto.valor) maiorGasto = { mes: mesesNomes[i], valor: dado.despesas };
    if (dado.sobra > maiorSobra.valor) maiorSobra = { mes: mesesNomes[i], valor: dado.sobra };
    if (dado.sobra > 0) acumulado += dado.sobra;

    resumoHTML += `
      <div class="bg-zinc-900 p-4 rounded-lg shadow flex flex-col gap-1">
        <h3 class="text-sm font-semibold text-zinc-400">${mesesNomes[i]}</h3>
        <p>Receitas: <span class="text-green-400">${formatarMoeda(dado.receitas)}</span></p>
        <p>Despesas: <span class="text-red-400">${formatarMoeda(dado.despesas)}</span></p>
        <p>Sobra: <span class="${dado.sobra >= 0 ? 'text-green-500' : 'text-red-500'}">${formatarMoeda(dado.sobra)}</span></p>
      </div>
    `;
  });

  resumoHTML += `</div><div class="mt-4">`;

  // Insights
  resumoHTML += `<h3 class="text-md font-semibold text-white mt-4">📌 Insights do Ano:</h3><ul class="list-disc ml-5 mt-2 space-y-1">`;
  resumoHTML += `<li>📉 Mês com mais despesas: <strong>${maiorGasto.mes}</strong> (${formatarMoeda(maiorGasto.valor)})</li>`;
  resumoHTML += `<li>💹 Mês com maior economia: <strong>${maiorSobra.mes}</strong> (${formatarMoeda(maiorSobra.valor)})</li>`;
  resumoHTML += `<li>🏦 Economia acumulada no ano: <strong class="text-green-400">${formatarMoeda(acumulado)}</strong></li>`;

  const jan = dadosAnuais[0].despesas;
  const dez = dadosAnuais[11].despesas;
  if (jan > 0) {
    const variacao = ((dez - jan) / jan) * 100;
    resumoHTML += `<li>📈 Despesas ${variacao >= 0 ? "aumentaram" : "diminuíram"} ${Math.abs(variacao).toFixed(1)}% de Jan para Dezembro.</li>`;
  }

  resumoHTML += `</ul></div>`;
  container.innerHTML = resumoHTML;
}

function gerarPlanoFinanceiroPessoal() {
  const container = document.getElementById("planoFinanceiro");
  if (!container) return;

  if (!transactions.length) {
    container.innerHTML = `
      <div class="bg-zinc-800 text-white p-4 rounded-lg text-center">
        <p class="text-sm">Nenhum dado encontrado para gerar o plano financeiro.</p>
        <p class="text-sm mt-1 text-zinc-400">Adicione transações para começar a visualizar seu desempenho financeiro.</p>
      </div>
    `;
    return;
  }

  const anoAtual = new Date().getFullYear();
  const transacoesAno = transactions.filter(t => {
    if (!t.dueDate || !(t.dueDate instanceof Date)) t.dueDate = new Date(t.dueDate);
    return t.dueDate.getFullYear() === anoAtual;
  });

  const receitas = transacoesAno.filter(t => t.type === "Ganho");
  const despesas = transacoesAno.filter(t => t.type === "Gasto");

  // Ajuste correto com base no seu sistema
  const fixas = despesas.filter(t => t.isFixed);
  const parceladas = despesas.filter(t => !t.isFixed && t.installments > 1);
  const variaveis = despesas.filter(t => !t.isFixed && (!t.installments || t.installments <= 1));
  const pendentes = despesas.filter(t => !t.isPaid);

  const totalReceitas = receitas.reduce((sum, t) => sum + t.amount, 0);
  const totalDespesas = despesas.reduce((sum, t) => sum + t.amount, 0);
  const totalFixas = fixas.reduce((sum, t) => sum + t.amount, 0);
  const totalVariaveis = variaveis.reduce((sum, t) => sum + t.amount, 0);
  const totalParcelado = parceladas.reduce((sum, t) => sum + t.amount, 0);
  const totalPendentes = pendentes.reduce((sum, t) => sum + t.amount, 0);
  const sobra = totalReceitas - totalDespesas;

  const receitasPorMes = [...Array(12).keys()].map(mes =>
    receitas.filter(t => t.dueDate.getMonth() === mes).reduce((s, t) => s + t.amount, 0)
  );
  const despesasPorMes = [...Array(12).keys()].map(mes =>
    despesas.filter(t => t.dueDate.getMonth() === mes).reduce((s, t) => s + t.amount, 0)
  );
  const mediaReceita = receitasPorMes.reduce((a, b) => a + b, 0) / 12;
  const mediaDespesa = despesasPorMes.reduce((a, b) => a + b, 0) / 12;
  const mediaSobra = mediaReceita - mediaDespesa;

  const metaEconomia = mediaSobra > 0 ? mediaSobra * 0.5 : 0;
  const perfil = totalReceitas === 0
    ? "Indefinido"
    : (totalDespesas / totalReceitas > 0.9
      ? "Gastador"
      : totalDespesas / totalReceitas > 0.7
      ? "Equilibrado"
      : "Poupador");

  const categorias = {};
  despesas.forEach(t => categorias[t.category] = (categorias[t.category] || 0) + t.amount);
  const topCategorias = Object.entries(categorias).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const frequencia = {};
  despesas.forEach(t => frequencia[t.category] = (frequencia[t.category] || 0) + 1);
  const maisFrequente = Object.entries(frequencia).sort((a, b) => b[1] - a[1])[0];
  const percFixos = totalDespesas > 0 ? (totalFixas / totalDespesas) * 100 : 0;
  const economiaCategoria = topCategorias[0] ? topCategorias[0][1] * 0.2 : 0;

  container.innerHTML = `
    <h2 class="text-xl font-bold text-white">📘 Plano Financeiro Pessoal - ${anoAtual}</h2>
    <div class="space-y-6 mt-4">

      <!-- Receita e Despesas -->
      <div class="bg-zinc-900 p-4 rounded-xl shadow space-y-2">
        <h3 class="text-md font-semibold text-white mb-2">💰 Receitas e Despesas</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <p>Receita anual: <strong class="text-green-400">${formatarMoeda(totalReceitas)}</strong></p>
          <p>Despesas anuais: <strong class="text-red-400">${formatarMoeda(totalDespesas)}</strong></p>
          <p>Despesas fixas: <strong>${formatarMoeda(totalFixas)}</strong></p>
          <p>Despesas variáveis: <strong>${formatarMoeda(totalVariaveis)}</strong></p>
          <p>Parcelamentos: <strong>${parceladas.length}</strong> (${formatarMoeda(totalParcelado)})</p>
          <p>Contas pendentes: <strong>${pendentes.length}</strong> (${formatarMoeda(totalPendentes)})</p>
        </div>
        <div class="mt-2 border-t border-zinc-700 pt-2 text-sm">
          <p>Sobra anual: <strong class="${sobra >= 0 ? 'text-green-400' : 'text-red-400'}">${formatarMoeda(sobra)}</strong></p>
          <p>Proporção despesas/receita: <strong>${(totalDespesas / totalReceitas * 100).toFixed(1)}%</strong></p>
        </div>
      </div>

      <!-- Diagnóstico -->
      <div class="bg-zinc-900 p-4 rounded-xl shadow space-y-2">
        <h3 class="text-md font-semibold text-white mb-2">🧠 Diagnóstico</h3>
        <p>Perfil financeiro: <strong class="text-yellow-300">${perfil}</strong></p>
        <p>${percFixos.toFixed(1)}% das despesas são fixas${percFixos > 80 ? " — ⚠️ alto comprometimento!" : ""}</p>
        ${maisFrequente ? `<p>🔁 Categoria mais frequente: <strong>${maisFrequente[0]}</strong> (${maisFrequente[1]} vezes)</p>` : ""}
        ${topCategorias.length ? `
          <div>
            🔻 <strong>Top 3 categorias de gasto:</strong>
            <ul class="list-disc ml-6 text-sm mt-1">
              ${topCategorias.map(([cat, val], i) => `<li>${i + 1}. ${cat} — ${formatarMoeda(val)}</li>`).join("")}
            </ul>
          </div>` : ""}
        ${economiaCategoria ? `<p>💡 Reduzindo 20% em <strong>${topCategorias[0][0]}</strong>, você economizaria ${formatarMoeda(economiaCategoria)}.</p>` : ""}
      </div>

      <!-- Projeção -->
      <div class="bg-zinc-900 p-4 rounded-xl shadow space-y-2">
        <h3 class="text-md font-semibold text-white mb-2">📈 Projeção Mensal (base média)</h3>
        <ul class="list-disc ml-6 text-sm">
          <li>Receita média: <strong class="text-green-400">${formatarMoeda(mediaReceita)}</strong></li>
          <li>Despesa média: <strong class="text-red-400">${formatarMoeda(mediaDespesa)}</strong></li>
          <li>Sobra média: <strong class="${mediaSobra >= 0 ? 'text-green-400' : 'text-red-400'}">${formatarMoeda(mediaSobra)}</strong></li>
        </ul>
        <p class="mt-2">🎯 Meta sugerida de economia mensal: <strong>${formatarMoeda(metaEconomia)}</strong></p>
      </div>
    </div>
  `;
}

function mostrarRelatorio(tipo) {
  const seções = {
    anual: document.getElementById("resumoAnual"),
    plano: document.getElementById("planoFinanceiro")
  };

  const seçõesDOM = Object.values(seções);
  const botaoClicado = event.target;
  const todosBotoes = document.querySelectorAll(".btn-tab");

  // Se o botão já está ativo, clique novamente para fechar (toggle)
  if (botaoClicado.classList.contains("bg-zinc-600")) {
    seçõesDOM.forEach(el => el.classList.add("hidden"));
    todosBotoes.forEach(btn => btn.classList.remove("bg-zinc-600", "text-white", "border-zinc-500", "shadow-md"));
    return;
  }

  // Ativa o botão e exibe a aba
  for (let chave in seções) {
    seções[chave].classList.toggle("hidden", chave !== tipo);
  }

  todosBotoes.forEach(btn => btn.classList.remove("bg-zinc-600", "text-white", "border-zinc-500", "shadow-md"));
  botaoClicado.classList.add("bg-zinc-600", "text-white", "border-zinc-500", "shadow-md");
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

function calculateInvestmentTotals() {
  if (!investments || investments.length === 0) return;

  let totalInvestido = 0;
  let patrimonioAtual = 0;

  investments.forEach(inv => {
    const price = parseFloat(inv.price) || 0;
    const quantity = parseFloat(inv.quantity) || 0;
    const currentValue = parseFloat(inv.currentValue) || 0;

    totalInvestido += price * quantity;
    patrimonioAtual += currentValue * quantity;

    renderBadge("badgeInvestimentos");
  });

  const rendimento = patrimonioAtual - totalInvestido;
  const rendimentoPct = totalInvestido > 0 ? (rendimento / totalInvestido) * 100 : 0;

  // --- Preenchendo os elementos do Card de forma segura ---
  
  const totalPatrimonioEl = document.getElementById("totalPatrimonio");
  if (totalPatrimonioEl) animarContador("totalPatrimonio", patrimonioAtual);

  const rendimentoTotalEl = document.getElementById("rendimentoTotalInvestimentos");
  if (rendimentoTotalEl) rendimentoTotalEl.textContent = `Rendimento total de ${formatarMoeda(rendimento)}`;
  
  // A função renderBadge já deve verificar se o elemento existe
  renderBadge("badgeInvestimentos", rendimentoPct); 
  
  const totalAportadoEl = document.getElementById("totalAportadoCard");
  if (totalAportadoEl) animarContador("totalAportadoCard", totalInvestido);
  
  const rendimentoCardEl = document.getElementById("rendimentoCard");
  if (rendimentoCardEl) {
    rendimentoCardEl.textContent = formatarMoeda(rendimento);
    rendimentoCardEl.className = `text-sm font-medium ${rendimento >= 0 ? 'text-green-400' : 'text-red-400'}`;
  }
}

function updateInvestmentCharts() {
  // Dados para o Gráfico de Alocação
  const allocationData = investments.reduce((acc, inv) => {
    const valor = inv.currentValue * inv.quantity;
    acc[inv.type] = (acc[inv.type] || 0) + valor;
    return acc;
  }, {});
  
  investmentAllocationChart.data.labels = Object.keys(allocationData).map(k => k.charAt(0).toUpperCase() + k.slice(1));
  investmentAllocationChart.data.datasets[0].data = Object.values(allocationData);
  investmentAllocationChart.update();

  // Dados para o Gráfico de Evolução dos Aportes
  const evolutionData = Array(12).fill(0);
  investments.forEach(inv => {
    const month = new Date(inv.date).getMonth();
    if (month >= 0 && month < 12) {
      evolutionData[month] += inv.price * inv.quantity;
    }
  });

  portfolioEvolutionChart.data.datasets[0].data = evolutionData;
  portfolioEvolutionChart.update();
}