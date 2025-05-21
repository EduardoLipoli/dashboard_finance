const db   = firebase.firestore();
const auth = firebase.auth();

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

// Helpers
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

// 1) Fetch dados
async function fetchData(start, end) {
  const uid = auth.currentUser.uid;
  // categorias (incluindo tipo)
  const catSnap = await db.collection('users').doc(uid).collection('categories').get();
  const categories = catSnap.docs.map(d => ({
    id:   d.id,
    name: d.data().name,
    type: d.data().tipo  // Gasto ou Ganho
  }));

  // transações
  const txSnap = await db.collection('users').doc(uid)
    .collection('transactions')
    .where('dueDate', '>=', firebase.firestore.Timestamp.fromDate(start))
    .where('dueDate', '<=', firebase.firestore.Timestamp.fromDate(end))
    .get();
  const transactions = txSnap.docs.map(d => {
    const data = d.data();
    return {
      id:       d.id,
      name:     data.name,
      category: data.category,
      amount:   data.amount,
      dueDate:  data.dueDate.toDate(),
      type:     data.type,
    };
  });

  // planos
  const planSnap = await db.collection('users').doc(uid).collection('categoryPlans').get();
  const plans = {};
  planSnap.docs.forEach(d => plans[d.id] = d.data().plannedValue || 0);

  return { categories, transactions, plans };
}

// 1) Agregar - Modificar para incluir comparação do planejado com o real
function aggregate(categories, transactions, plans, meses) {
  const report = {};
  categories.forEach(cat => {
    report[cat.id] = {
      name:    cat.name,
      type:    cat.type,
      plan:    plans[cat.id] || 0,
      monthly: Object.fromEntries(meses.map(m => [m, { real: 0, withinPlan: false }])),  // Alterado para guardar valores reais e a comparação
      total:   0
    };
  });

  transactions.forEach(tx => {
    const m = `${tx.dueDate.getFullYear()}-${String(tx.dueDate.getMonth() + 1).padStart(2, '0')}`;
    if (!report[tx.category]) return;
    report[tx.category].monthly[m].real += tx.amount;
    report[tx.category].total          += tx.amount;
  });

  const totalG = Object.values(report).reduce((s, r) => s + r.total, 0);
  for (let id in report) {
    const vals = Object.values(report[id].monthly);
    report[id].min = Math.min(...vals.map(v => v.real));
    report[id].max = Math.max(...vals.map(v => v.real));
    report[id].avg = vals.reduce((a, b) => a + b.real, 0) / vals.length || 0;
    report[id].pct = totalG > 0 ? report[id].total / totalG * 100 : 0;

    // Comparar real vs planejado para cada mês
    for (let m in report[id].monthly) {
      const planned = report[id].plan;
      const real = report[id].monthly[m].real;
      report[id].monthly[m].withinPlan = real <= planned;
    }
  }

  return report;
}

// 2) Renderizar com Receitas + Subcategorias - Modificar para exibir visualmente a comparação
function renderTable(report, meses, transactions) {
  const thead = document.getElementById('reportHead');
  const tbody = document.getElementById('reportBody');
  tbody.innerHTML = '';

  // 1) calcula saldos mensais
  const monthlyBalances = meses.map(m => {
    let ganho = 0, gasto = 0;
    Object.values(report).forEach(r => {
      const v = r.monthly[m]?.real || 0;
      if (r.type === 'Ganho') ganho += v;
      else gasto += v;
    });
    return ganho - gasto;
  });

  // 2) monta o THEAD completo
  thead.innerHTML = `

    <!-- linha de Saldo Total + cards mensais -->
    <tr class="bg-zinc-800">
      <th colspan="6" class="px-6 py-2 text-right text-zinc-100 text-xl">Saldo Total:</th>
      ${monthlyBalances.map((sb, i) => {
        const color = sb >= 0 ? 'text-green-500' : 'text-red-500';
        return `
          <th class="px-2 py-2">
            <div class="bg-zinc-700 border border-zinc-600 rounded-lg p-2 text-xl text-center">
              <div class="${color}">${sb.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            </div>
          </th>
        `;
      }).join('')}
    </tr>
      <td colspan="99" class="py-2 bg-zinc-900 cursor-default"></td>
    <!-- linha de rótulos de colunas -->
    <tr class="bg-zinc-800 text-zinc-100 text-sm uppercase tracking-wider rounded-lg">
      <th class="px-6 py-3 text-left">Categoria</th>
      <th class="px-6 py-3 text-center">Planejado</th>
      <th class="px-6 py-3 text-center">%</th>
      <th class="px-6 py-3 text-center">Min</th>
      <th class="px-6 py-3 text-center">Méd</th>
      <th class="px-6 py-3 text-center">Max</th>
      ${meses.map(m => `<th class="px-6 py-3 text-center">${formatMonthLabel(m)}</th>`).join('')}
    </tr>
  `;

  // 3) desenha cada seção (Receitas / Despesas)
  function drawSection(title, catIds, labelClass) {
    const cats = catIds.map(id => report[id]).filter(Boolean);

    // totais da seção
    const planTotal = cats.reduce((sum, r) => sum + r.plan, 0);
    const actualsByMonth = meses.map(m =>
      cats.reduce((sum, r) => sum + (r.monthly[m]?.real || 0), 0)
    );
    const pctTotal = planTotal ? (actualsByMonth.reduce((a, b) => a + b, 0) / planTotal * 100) : 0;
    const minTotal = cats.reduce((s, r) => s + r.min, 0);
    const avgTotal = cats.reduce((s, r) => s + r.avg, 0);
    const maxTotal = cats.reduce((s, r) => s + r.max, 0);

    // Define a classe de fundo com base no título
    let bgClass = 'bg-zinc-800'; // padrão
    if (title.toLowerCase().includes('despesa')) {
      bgClass = 'border-t border-zinc-700 bg-red-700  hover:bg-red-800 transition cursor-pointer';
    } else if (title.toLowerCase().includes('receita')) {
      bgClass = 'border-t border-zinc-700 bg-green-700  hover:bg-green-800 transition cursor-pointer';
    }

    // linha de resumo da seção
    const summary = document.createElement('tr');
    summary.className = bgClass;
    summary.innerHTML = `
      <td class="px-6 py-3 font-semibold text-white">${title}</td>
      <td class="px-6 py-3 text-center font-semibold">${planTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
      <td class="px-6 py-3 text-center font-semibold">${pctTotal.toFixed(1)}%</td>
      <td class="px-6 py-3 text-center font-semibold">${minTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
      <td class="px-6 py-3 text-center font-semibold">${avgTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
      <td class="px-6 py-3 text-center font-semibold">${maxTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
      ${actualsByMonth.map(v => `
        <td class="px-6 py-3 text-center font-semibold">${v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
      `).join('')}
    `;
    tbody.appendChild(summary);


    // linhas de categoria e subcategoria
    catIds.forEach(catId => {
      const r = report[catId];
      if (!r) return;

      // linha de categoria (toggle)
      const catRow = document.createElement('tr');
      catRow.className = 'border-t border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition cursor-pointer';
      catRow.dataset.cat = catId;
      catRow.innerHTML = `
        <td class="px-6 py-2 font-medium text-zinc-100 pl-8">${r.name}</td>
        <td class="px-6 py-2 text-center">
          <div class="plan-display relative group" data-cat="${catId}">
            <span class="plan-value">${r.plan.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
            <button class="py-4 -translate-y-2 backdrop-blur-sm rounded-lg border border-zinc-700 edit-plan-btn absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-sm font-bold text-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              Editar
            </button>
          </div>
        </td>
        <td class="px-6 py-2 text-center text-zinc-400">${r.pct.toFixed(1)}%</td>
        <td class="px-6 py-2 text-center text-zinc-400">${r.min.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        <td class="px-6 py-2 text-center text-zinc-400">${r.avg.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        <td class="px-6 py-2 text-center text-zinc-400">${r.max.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        ${meses.map(m => {
          const md = r.monthly[m];
          const within = md.withinPlan;
          const cls = within ? 'bg-green-800 bg-opacity-25 text-green-500' : 'bg-red-900 bg-opacity-25 text-red-500';
          const icn = within ? '' : '<i class="bi bi-exclamation-triangle-fill mr-1 text-yellow-400"></i>';
          return `<td class="px-6 py-2 text-center ${cls}">${icn} ${md.real.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>`;
        }).join('')}
      `;
      tbody.appendChild(catRow);

      // subcategorias
      const mapNames = {};
      transactions.filter(tx => tx.category === catId)
        .forEach(tx => {
          if (!mapNames[tx.name]) mapNames[tx.name] = Object.fromEntries(meses.map(m => [m, 0]));
          const key = `${tx.dueDate.getFullYear()}-${String(tx.dueDate.getMonth()+1).padStart(2,'0')}`;
          mapNames[tx.name][key] += tx.amount;
        });

      Object.entries(mapNames).forEach(([name, monthly]) => {
        const sub = document.createElement('tr');
        sub.className = `bg-zinc-900/70 text-zinc-300 italic sub-row cat-${catId}`;
        sub.innerHTML = `
          <td class="px-6 py-2 pl-16">${name}</td>
          <td colspan="5"></td>
          ${meses.map(m => `
            <td class="px-6 py-2 text-center">${monthly[m].toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
          `).join('')}
        `;
        tbody.appendChild(sub);
      });
    });
  }

  // 4) renderiza RECEITAS e DESPESAS
  drawSection('RECEITAS', Object.keys(report).filter(id => report[id].type === 'Ganho'), 'text-green-400');
  drawSection('DESPESAS', Object.keys(report).filter(id => report[id].type === 'Gasto'), 'text-red-400');

  // 5) adiciona toggle de subcategorias após renderizar tudo
tbody.querySelectorAll('tr[data-cat]').forEach(row => {
  row.addEventListener('click', () => {
    const id = row.dataset.cat;
    tbody.querySelectorAll(`.sub-row.cat-${id}`)
      .forEach(r => r.classList.toggle('hidden'));
  });
});


  // 5) listeners de plan-input
  document.querySelectorAll('.plan-input').forEach(input => {
    input.addEventListener('blur', async e => {
      const catId = e.target.dataset.cat;
      const val = parseFloat(e.target.value) || 0;
      await db.collection('users').doc(auth.currentUser.uid)
        .collection('categoryPlans').doc(catId)
        .set({ plannedValue: val });
      e.target.classList.add('ring-2','ring-green-400');
      setTimeout(() => e.target.classList.remove('ring-2','ring-green-400'), 800);
    });
  });
}

document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('edit-plan-btn')) {
    const parent = e.target.closest('.plan-display');
    const catId = parent.dataset.cat;
    const valueText = parent.querySelector('.plan-value')
      .textContent.replace(/[^\d,-]+/g,'').replace(',','.');
    const value = parseFloat(valueText) || 0;

    // substitui pela input
    parent.innerHTML = `
      <input type="number" value="${value}" min="0"
             data-cat="${catId}"
             class="plan-input-edit border border-zinc-600 rounded w-24 px-2 py-1 bg-zinc-800 text-zinc-100 text-center" />
    `;
    const input = parent.querySelector('input');
    input.focus();

    input.addEventListener('blur', async () => {
      const val = parseFloat(input.value) || 0;
      await db.collection('users').doc(auth.currentUser.uid)
        .collection('categoryPlans').doc(catId)
        .set({ plannedValue: val });

      // **reconstroi o mesmo bloco com hover+blur**: 
      parent.innerHTML = `
        <div class="plan-display relative group" data-cat="${catId}">
          <span class="plan-value">${val.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
          <button class="py-4 -translate-y-2 rounded-lg border border-zinc-700 edit-plan-btn absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-sm font-bold text-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Editar
          </button>
        </div>
      `;
    });

    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') input.blur();
    });
  }
});



// 4) Build
async function buildReport() {
  document.getElementById('refreshBtn').disabled = true;

  const startInput = document.getElementById('startDate').value;
  const endInput = document.getElementById('endDate').value;

  if (!startInput || !endInput) {
    showAlert('Selecione as duas datas.', 'error');
    document.getElementById('refreshBtn').disabled = false;
    return;
  }

  const [startYear, startMonth] = startInput.split('-').map(Number);
  const [endYear, endMonth] = endInput.split('-').map(Number);

  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth - 1, 1);

  const diffMonths = (endYear - startYear) * 12 + (endMonth - startMonth);

  if (diffMonths > 3) {
    showAlert('Selecione no máximo 4 meses de diferença.', 'warning');
    document.getElementById('refreshBtn').disabled = false;
    return;
  }

  const meses = getMonthsBetween(start, end);
  const { categories, transactions, plans } = await fetchData(start, end);
  const report = aggregate(categories, transactions, plans, meses);
  renderTable(report, meses, transactions);

  document.getElementById('refreshBtn').disabled = false;
}

// 5) Inicialização e eventos
auth.onAuthStateChanged(user => {
  if (!user) return window.location.href = '/index.html';

  const hoje = new Date();
  const inic = new Date(hoje);
  inic.setMonth(hoje.getMonth() - 2);

  document.getElementById('startDate').value = inic.toISOString().slice(0, 7); // yyyy-mm
  document.getElementById('endDate').value = hoje.toISOString().slice(0, 7);

  buildReport();
});

document.getElementById('refreshBtn').addEventListener('click', buildReport);

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
