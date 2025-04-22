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

function loadUserName(user) {
  const displayName = user.displayName || user.email || "Carregando...";
  document.getElementById("user-name").textContent = displayName;
}

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
  thead.innerHTML = `
    <tr>
      <th class="px-4 py-2">Categoria</th>
      <th class="px-4 py-2">Planejado</th>
      <th class="px-4 py-2">%</th>
      <th class="px-4 py-2">Min</th>
      <th class="px-4 py-2">Méd</th>
      <th class="px-4 py-2">Max</th>
      ${meses.map(m => `<th class="px-4 py-2">${formatMonthLabel(m)}</th>`).join('')}
    </tr>`;

  const tbody = document.getElementById('reportBody');
  tbody.innerHTML = '';

  function drawSection(title, catIds, labelClass) {
    const header = document.createElement('tr');
    header.innerHTML = `
      <td class="px-4 py-2 font-bold ${labelClass}">${title}</td>
      <td colspan="${5 + meses.length}"></td>
    `;
    tbody.appendChild(header);

    catIds.forEach(catId => {
      const r = report[catId];
      if (!r) return;

      const row = document.createElement('tr');
      row.className = 'border-t';

      const colsMes = meses.map(m => {
        const monthlyData = r.monthly[m];
        const isWithinPlan = monthlyData.withinPlan ? 'bg-green-800' : 'bg-red-800';
        return `
          <td class="px-4 py-2 text-right ${isWithinPlan}">
            ${monthlyData.real.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
          </td>`;
      }).join('');

      row.innerHTML = `
        <td class="px-4 py-2 font-medium">${r.name}</td>
        <td class="px-4 py-2">
          <input type="number" value="${r.plan}" min="0"
                 data-cat="${catId}" class="plan-input border rounded w-20 px-1 py-0.5" />
        </td>
        <td class="px-4 py-2">${r.pct.toFixed(1)}%</td>
        <td class="px-4 py-2">${r.min.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
        <td class="px-4 py-2">${r.avg.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
        <td class="px-4 py-2">${r.max.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
        ${colsMes}
      `;
      tbody.appendChild(row);

      // SUBCATEGORIAS (Agrupadas por nome)
      const namesMap = {};
      transactions.filter(tx => tx.category === catId).forEach(tx => {
        if (!namesMap[tx.name]) {
          namesMap[tx.name] = Object.fromEntries(meses.map(m => [m, 0]));
        }
        const m = `${tx.dueDate.getFullYear()}-${String(tx.dueDate.getMonth() + 1).padStart(2, '0')}`;
        if (namesMap[tx.name][m] !== undefined) {
          namesMap[tx.name][m] += tx.amount;
        }
      });

      Object.entries(namesMap).forEach(([name, monthly]) => {
        const subRow = document.createElement('tr');
        subRow.className = 'text-sm text-zinc-400 italic';
        subRow.innerHTML = `
          <td class="px-4 py-1 pl-6">${name}</td>
          <td colspan="5"></td>
          ${meses.map(m => `
            <td class="px-4 py-1 text-right">
              ${monthly[m].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </td>`).join('')}
        `;
        tbody.appendChild(subRow);
      });
    });
  }

  // Desenha Receitas e Despesas
  drawSection('Receitas', Object.keys(report).filter(id => report[id].type === 'Ganho'), 'text-green-600');
  drawSection('Despesas Mensais', Object.keys(report).filter(id => report[id].type === 'Gasto'), 'text-red-600');

  // Listener para salvar o planejado
  document.querySelectorAll('.plan-input').forEach(input => {
    input.addEventListener('blur', async e => {
      const catId = e.target.dataset.cat;
      const val   = parseFloat(e.target.value) || 0;
      await db.collection('users').doc(auth.currentUser.uid)
              .collection('categoryPlans').doc(catId)
              .set({ plannedValue: val });
      e.target.classList.add('ring-2', 'ring-green-400');
      setTimeout(() => e.target.classList.remove('ring-2', 'ring-green-400'), 800);
    });
  });
}



// 4) Build
async function buildReport() {
  document.getElementById('refreshBtn').disabled = true;
  const start = new Date(document.getElementById('startDate').value);
  const end   = new Date(document.getElementById('endDate').value);
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
  const inic = new Date(hoje); inic.setMonth(hoje.getMonth() - 2);
  document.getElementById('startDate').value = inic.toISOString().slice(0,10);
  document.getElementById('endDate').value   = hoje.toISOString().slice(0,10);
  buildReport();
});
document.getElementById('refreshBtn').addEventListener('click', buildReport);
