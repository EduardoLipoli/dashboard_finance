    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // Funções de apoio
    function formatCurrency(value) {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatMonthLabel(iso) {
      const [y, m] = iso.split('-').map(Number);
      return new Date(y, m - 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
    }

    function getMonthsBetween(start, end) {
      const meses = [];
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        meses.push(`${cur.getFullYear()}-${mm}`);
        cur.setMonth(cur.getMonth() + 1);
      }
      return meses;
    }

    function calculatePercentage(value, total) {
      return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
    }

    function showAlert(message, type = "success") {
      const alertContainer = document.getElementById("alert-container");
      const alert = document.createElement("div");
      
      const typeClasses = {
        success: "bg-green-500 text-white",
        error: "bg-red-500 text-white",
        warning: "bg-yellow-500 text-white",
        info: "bg-blue-500 text-white"
      };
      
      alert.className = `flex items-center justify-between px-4 py-3 rounded-lg shadow-lg mb-2 ${typeClasses[type] || typeClasses.success}`;
      alert.innerHTML = `
        <div class="flex items-center">
          <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'} mr-2"></i>
          <span>${message}</span>
        </div>
        <button class="ml-4 text-lg font-bold focus:outline-none">&times;</button>
      `;
      
      alert.querySelector("button").addEventListener("click", () => {
        alert.remove();
      });
      
      setTimeout(() => {
        if (alert.parentNode) {
          alert.remove();
        }
      }, 5000);
      
      alertContainer.appendChild(alert);
    }

    // Função para buscar dados
    async function fetchData(start, end) {
      const uid = auth.currentUser.uid;
      
      // Buscar categorias
      const catSnap = await db.collection('users').doc(uid).collection('categories').get();
      const categories = catSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        type: d.data().tipo
      }));

      // Buscar transações
      const txSnap = await db.collection('users').doc(uid)
        .collection('transactions')
        .where('dueDate', '>=', firebase.firestore.Timestamp.fromDate(start))
        .where('dueDate', '<=', firebase.firestore.Timestamp.fromDate(end))
        .get();
      const transactions = txSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          category: data.category,
          amount: data.amount,
          dueDate: data.dueDate.toDate(),
          type: data.type
        };
      });

      // Buscar planos
      const planSnap = await db.collection('users').doc(uid).collection('categoryPlans').get();
      const plans = {};
      planSnap.docs.forEach(d => plans[d.id] = d.data().plannedValue || 0);

      return { categories, transactions, plans };
    }

    // Função para agregar dados
    function aggregate(categories, transactions, plans, meses) {
  const report = {};
  let totalPlanned = 0;
  let totalActual = 0;

  // Inicializar estrutura de relatório
  categories.forEach(cat => {
    report[cat.id] = {
      name: cat.name,
      type: cat.type,
      plan: plans[cat.id] || 0,
      monthly: Object.fromEntries(meses.map(m => [m, { real: 0 }])),
      total: 0,
      transactions: [] // NOVO: Array para guardar as transações da categoria
    };

    if (cat.type === 'Gasto') {
      totalPlanned += plans[cat.id] || 0;
    }
  });

  // Processar transações
  transactions.forEach(tx => {
    const monthKey = `${tx.dueDate.getFullYear()}-${String(tx.dueDate.getMonth() + 1).padStart(2, '0')}`;
    if (report[tx.category]) {
      report[tx.category].monthly[monthKey].real += tx.amount;
      report[tx.category].total += tx.amount;
      report[tx.category].transactions.push(tx); // NOVO: Adiciona a transação à lista da categoria

      if (report[tx.category].type === 'Gasto') {
        totalActual += tx.amount;
      }
    }
  });

  return { report, totalPlanned, totalActual };
}

    // Função para renderizar cards de resumo
    function renderSummaryCards(totalPlanned, totalActual) {
      document.getElementById('total-planned').textContent = formatCurrency(totalPlanned);
      document.getElementById('total-actual').textContent = formatCurrency(totalActual);
      document.getElementById('total-variance').textContent = formatCurrency(totalActual - totalPlanned);
    }

// Função para renderizar meses (VERSÃO COM PORCENTAGEM NA BARRA)
function renderMonths(report, meses) {
  const container = document.getElementById('monthsContainer');
  container.innerHTML = '';
  container.className = 'flex overflow-x-auto pb-4 gap-6';

  meses.forEach(month => {
    // Calcular valores totais para o mês
    let planned = 0;
    let actual = 0;
    
    Object.values(report).forEach(cat => {
      if (cat.type === 'Gasto') {
        planned += cat.plan;
        actual += cat.monthly[month].real;
      }
    });
    
    const variance = actual - planned;
    const varianceClass = variance <= 0 ? 'text-green-400' : 'text-red-400';
    const varianceIcon = variance <= 0 ? 'fa-arrow-down' : 'fa-arrow-up';
    const percentage = calculatePercentage(actual, planned);
    const progressColor = percentage < 90 ? 'bg-green-500' : percentage < 100 ? 'bg-yellow-500' : 'bg-red-500';
    
    const monthCard = document.createElement('div');
    monthCard.className = 'dashboard-card month-card w-80 p-6 rounded-xl flex-shrink-0 flex flex-col shadow-lg';
    
    monthCard.innerHTML = `
      <div class="flex justify-between items-start mb-4">
        <h3 class="text-lg font-bold text-zinc-100">${formatMonthLabel(month)}</h3>
        <div class="text-base font-semibold ${varianceClass} flex items-center gap-2">
          <i class="fas ${varianceIcon}"></i>
          <span>${formatCurrency(Math.abs(variance))}</span>
        </div>
      </div>

      <div class="flex-grow">
        <div class="flex justify-between items-center text-base mb-2">
          <span class="text-zinc-400">Planejado</span>
          <span class="font-medium text-zinc-200">${formatCurrency(planned)}</span>
        </div>
        <div class="flex justify-between items-center text-base">
          <span class="text-zinc-400">Realizado</span>
          <span class="font-medium text-zinc-100">${formatCurrency(actual)}</span>
        </div>
      </div>

      <div class="mt-5">
        <div class="flex justify-between items-center mb-1 text-sm">
          <span class="text-zinc-400">Progresso</span>
          <span class="font-bold text-zinc-100">${percentage}%</span>
        </div>
        <div class="w-full bg-zinc-700 h-3 rounded-full overflow-hidden">
          <div class="h-full ${progressColor}" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
    
    container.appendChild(monthCard);
  });
}

    // Função para renderizar categorias
    function renderCategories(report) {
      const container = document.getElementById('categoriesContainer');
      container.innerHTML = '';
      
      Object.values(report)
        .filter(cat => cat.type === 'Gasto')
        .forEach(cat => {
          const percentage = calculatePercentage(cat.total, cat.plan);
          const progressColor = percentage > 100 ? 'bg-red-500' : percentage > 90 ? 'bg-yellow-500' : 'bg-green-500';
          const statusText = percentage > 100 ? 'Acima' : percentage > 90 ? 'Atenção' : 'Dentro';
          const statusColor = percentage > 100 ? 'text-red-400' : percentage > 90 ? 'text-yellow-400' : 'text-green-400';
          
          const categoryItem = document.createElement('div');
          categoryItem.className = 'dashboard-card p-4 rounded-xl fade-in';
          categoryItem.innerHTML = `
            <div class="flex justify-between items-center mb-3">
              <h3 class="font-semibold">${cat.name}</h3>
              <div class="flex items-center gap-2">
                <span class="${statusColor} font-medium">${formatCurrency(cat.total)}</span>
                <span class="text-xs px-2 py-1 rounded-full ${statusColor} bg-opacity-10">${statusText}</span>
              </div>
            </div>
            <div class="mb-1 flex justify-between text-sm text-zinc-400">
              <span>Planejado: ${formatCurrency(cat.plan)}</span>
              <span>${percentage}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-value ${progressColor}" style="width: ${Math.min(100, percentage)}%"></div>
            </div>
          `;
          
          container.appendChild(categoryItem);
        });
    }

    // Função para renderizar a tabela
function renderReportTable(report) {
  const thead = document.getElementById('reportHead');
  const tbody = document.getElementById('reportBody');

  // Cabeçalho da tabela
  thead.innerHTML = `
    <tr class="bg-zinc-800 text-zinc-100 text-sm">
      <th class="px-4 py-3 text-left w-2/5">Categoria</th>
      <th class="px-4 py-3 text-center">Planejado</th>
      <th class="px-4 py-3 text-center">Realizado</th>
      <th class="px-4 py-3 text-center">Diferença</th>
      <th class="px-4 py-3 text-center">Status</th>
    </tr>
  `;

  // Corpo da tabela
  tbody.innerHTML = '';

  Object.entries(report).forEach(([catId, cat]) => {
    if (cat.type !== 'Gasto' || cat.total === 0) return; // ALTERADO: Não mostra categorias de gasto sem transações

    const variance = cat.total - cat.plan;
    const varianceClass = variance < 0 ? 'text-green-400' : variance > 0 ? 'text-red-400' : 'text-zinc-400';
    const varianceIcon = variance < 0 ? 'fa-arrow-down' : variance > 0 ? 'fa-arrow-up' : 'fa-equals';
    const status = variance < 0 ? 'Economia' : variance > 0 ? 'Acima' : 'Dentro';
    const statusClass = variance < 0 ? 'bg-green-900/30 text-green-400' : variance > 0 ? 'bg-red-900/30 text-red-400' : 'bg-zinc-800 text-zinc-400';

    const row = document.createElement('tr');
    // ALTERADO: Adicionado classes 'category-row' e 'cursor-pointer', e o atributo data-cat-id
    row.className = 'category-row hover:bg-zinc-800/50 cursor-pointer';
    row.dataset.catId = catId; // Guarda o ID da categoria na linha
    row.dataset.expanded = 'false'; // Estado inicial

    row.innerHTML = `
      <td class="px-4 py-3 text-zinc-100">
        <i class="fas fa-chevron-right mr-3 text-xs text-zinc-500 transition-transform"></i>
        ${cat.name}
      </td>
      <td class="px-4 py-3 text-center">
        <div class="plan-display relative group" data-cat="${catId}">
          <span class="plan-value">${formatCurrency(cat.plan)}</span>
          <button class="py-4 -translate-y-2 backdrop-blur-sm rounded-lg border border-zinc-700 edit-plan-btn absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-sm font-bold text-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Editar
          </button>
        </div>
      </td>
      <td class="px-4 py-3 text-center">${formatCurrency(cat.total)}</td>
      <td class="px-4 py-3 text-center ${varianceClass}">
        <i class="fas ${varianceIcon} mr-1"></i>${formatCurrency(Math.abs(variance))}
      </td>
      <td class="px-4 py-3 text-center">
        <span class="text-xs px-2 py-1 rounded-full ${statusClass}">${status}</span>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function setupExpansionListeners(report) {
    const tbody = document.getElementById('reportBody');
    const toggleBtn = document.getElementById('toggleDetails');

    // Função para alternar uma única categoria
    const toggleCategory = (categoryRow) => {
        const catId = categoryRow.dataset.catId;
        const isExpanded = categoryRow.dataset.expanded === 'true';
        const icon = categoryRow.querySelector('.fa-chevron-right, .fa-chevron-down');

        // Remove detalhes antigos se existirem
        document.querySelectorAll(`.transaction-detail-${catId}`).forEach(row => row.remove());

        if (!isExpanded) {
            // Expandir
            categoryRow.dataset.expanded = 'true';
            icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
            
            const transactions = report[catId].transactions.sort((a,b) => a.dueDate - b.dueDate);
            let detailRowsHtml = '';

            transactions.forEach(tx => {
                detailRowsHtml += `
                    <tr class="transaction-detail-row transaction-detail-${catId} bg-zinc-800/30">
                        <td class="pl-12 pr-4 py-2 text-zinc-400 text-sm">${tx.name}</td>
                        <td class="px-4 py-2 text-center text-zinc-400 text-sm">${tx.dueDate.toLocaleDateString('pt-BR')}</td>
                        <td class="px-4 py-2 text-center text-zinc-300 font-mono">${formatCurrency(tx.amount)}</td>
                        <td></td>
                        <td></td>
                    </tr>
                `;
            });
            categoryRow.insertAdjacentHTML('afterend', detailRowsHtml);

        } else {
            // Recolher
            categoryRow.dataset.expanded = 'false';
            icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
        }
    };

    // Listener para cliques nas linhas da categoria
    tbody.addEventListener('click', (e) => {
        const categoryRow = e.target.closest('.category-row');
        // Impede que o clique no botão "Editar" expanda a linha
        if (categoryRow && !e.target.closest('.edit-plan-btn')) {
            toggleCategory(categoryRow);
        }
    });

    // Listener para o botão "Expandir/Recolher Tudo"
    toggleBtn.addEventListener('click', () => {
        const isExpandAll = toggleBtn.textContent.includes('Expandir');
        const allCategoryRows = tbody.querySelectorAll('.category-row');
        
        allCategoryRows.forEach(row => {
            const isExpanded = row.dataset.expanded === 'true';
            if ((isExpandAll && !isExpanded) || (!isExpandAll && isExpanded)) {
                toggleCategory(row);
            }
        });

        toggleBtn.innerHTML = isExpandAll ? 
            '<i class="fas fa-compress"></i> Recolher Tudo' : 
            '<i class="fas fa-expand"></i> Expandir Tudo';
    });
}

    // Função para editar valores planejados
    function setupPlanEditors() {
      document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-plan-btn')) {
          const parent = e.target.closest('.plan-display');
          const catId = parent.dataset.cat;
          const valueText = parent.querySelector('.plan-value').textContent.replace(/[^\d,.-]+/g, '').replace(',', '.');
          const value = parseFloat(valueText) || 0;
          
          // Substituir pelo campo de edição
          parent.innerHTML = `
            <input type="number" value="${value}" min="0" step="0.01" 
                   data-cat="${catId}"
                   class="plan-input" />
          `;
          
          const input = parent.querySelector('input');
          input.focus();
          
          input.addEventListener('blur', async () => {
            const val = parseFloat(input.value) || 0;
            const uid = auth.currentUser.uid;
            
            try {
              await db.collection('users').doc(uid)
                .collection('categoryPlans').doc(catId)
                .set({ plannedValue: val });
              
              // Atualizar visualmente
              parent.innerHTML = `
                <div class="plan-display relative group" data-cat="${catId}">
                  <span class="plan-value">${formatCurrency(val)}</span>
                  <button class="py-4 -translate-y-2 backdrop-blur-sm rounded-lg border border-zinc-700 edit-plan-btn absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-sm font-bold text-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Editar
                  </button>
                </div>
              `;
              
              showAlert('Valor planejado atualizado com sucesso!', 'success');
              
              // Recarregar dados
              buildReport();
            } catch (error) {
              console.error('Erro ao atualizar valor planejado:', error);
              showAlert('Erro ao atualizar valor planejado', 'error');
            }
          });
          
          input.addEventListener('keydown', ev => {
            if (ev.key === 'Enter') input.blur();
          });
        }
      });
    }

    // Função principal para construir o relatório
    async function buildReport() {
      showLoading();
      try {
        document.getElementById('refreshBtn').innerHTML = '<i class="fas fa-spinner animate-spin"></i>';
        document.getElementById('refreshBtn').disabled = true;
        
        const startInput = document.getElementById('startDate').value;
        const endInput = document.getElementById('endDate').value;
        
        if (!startInput || !endInput) {
          showAlert('Selecione as duas datas.', 'error');
          return;
        }
        
        const [startYear, startMonth] = startInput.split('-').map(Number);
        const [endYear, endMonth] = endInput.split('-').map(Number);
        
        const start = new Date(startYear, startMonth - 1, 1);
        const end = new Date(endYear, endMonth - 1, 1);
        
        const diffMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
        if (diffMonths > 3) {
          showAlert('Selecione no máximo 4 meses de diferença.', 'warning');
          return;
        }
        
        const meses = getMonthsBetween(start, end);
        const { categories, transactions, plans } = await fetchData(start, end);
        const { report, totalPlanned, totalActual } = aggregate(categories, transactions, plans, meses);
        
        renderSummaryCards(totalPlanned, totalActual);
        renderMonths(report, meses);
        renderCategories(report);
        renderReportTable(report);
        setupExpansionListeners(report);
        
      } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        showAlert('Erro ao carregar dados. Tente novamente.', 'error');
      } finally {
        document.getElementById('refreshBtn').innerHTML = '<i class="fas fa-sync"></i>';
        document.getElementById('refreshBtn').disabled = false;
        hideLoading();
      }
    }

    function logout() {
      auth.signOut().then(() => {
        window.location.href = '/index.html';
      }).catch(error => {
        showAlert('Erro ao sair: ' + error.message, 'error');
      });
    }

    // Função auxiliar para formatar data para input month
    function formatDateForInput(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Preencher datas iniciais
    const hoje = new Date();
    const inic = new Date(hoje);
    inic.setMonth(hoje.getMonth() - 2);

    document.getElementById('startDate').value = formatDateForInput(inic);
    document.getElementById('endDate').value = formatDateForInput(hoje);

    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', buildReport);

    // Dropdown do usuário
    const dropdownButton = document.getElementById('dropdownButton');
    const dropdownMenu = document.getElementById('dropdownMenu');

    dropdownButton.addEventListener('click', () => {
        dropdownMenu.classList.toggle('hidden');
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (event) => {
        if (!dropdownButton.contains(event.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });
    
    // Verificar autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            // Chama a função global para carregar o nome e foto do usuário
            // A função `loadUserName` está definida no `user-profile.js`
            loadUserName(user);
            buildReport();
            setupPlanEditors();
        } else {
            window.location.href = '/index.html';
        }
    });
});