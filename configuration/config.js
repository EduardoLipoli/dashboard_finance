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
        loadCategories();
        
      } catch (error) {
        console.error("Erro ao atualizar dados do usuário:", error);
      }
    } else {
      console.error("Usuário não autenticado.");
      window.location.href = "/index.html";
    }
  });
});

// Função para atualizar o nome de exibição do usuário
async function updateDisplayName() {
  const newDisplayName = document.getElementById("newDisplayName").value;

  if (newDisplayName) {
    const user = auth.currentUser;

    try {
      await user.updateProfile({ displayName: newDisplayName });
      showAlert("Nome atualizado com sucesso!", "success");
    } catch (error) {
      showAlert("Erro ao atualizar nome: " + error.message, "error");
    }
  } else {
    showAlert("Digite um nome válido.", "error");
  }
}

// Função para alterar a senha do usuário
async function updatePassword() {
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;

  if (newPassword.length < 6) {
    showAlert("A nova senha deve ter pelo menos 6 caracteres.", "error");
    return;
  }

  const user = auth.currentUser;

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);

    showAlert("Senha atualizada com sucesso!", "success");
  } catch (error) {
    showAlert("Erro ao atualizar senha: " + error.message, "error");
  }
}

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

  let baseClasses =
    "flex items-center px-4 py-3 rounded shadow-md transition-opacity duration-300";

  // Classes por tipo
  let typeClasses = "";
  if (type === "success") {
    typeClasses =
      "bg-green-500 text-white hover:bg-green-600 transition-colors cursor-default select-none";
  } else if (type === "error") {
    typeClasses =
      "bg-red-500 text-white hover:bg-red-600 transition-colors cursor-default select-none";
  } else if (type === "info") {
    typeClasses =
      "bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-default select-none";
  } else if (type === "warning") {
    typeClasses =
      "bg-yellow-500 text-black hover:bg-yellow-600 transition-colors cursor-default select-none";
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
// Carregar nome do usuário ao iniciar a página
document.addEventListener("DOMContentLoaded", loadUserName);

// Função para salvar categoria no Firestore
function saveCategoryToFirestore(categoryName) {
  showLoading();

  const user = firebase.auth().currentUser;
  if (!user) {
    showAlert("Usuário não autenticado.", "error");
    hideLoading();
    return;
  }

  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid).collection("categories");

  userRef
    .add({
      name: categoryName,
      tipo: currentCategoryType // <-- pega dinamicamente
    })
    .then(() => {
      showAlert("Categoria salva com sucesso!", "success");
      loadCategories(currentCategoryType);
    })
    .catch((error) => {
      showAlert("Erro ao salvar categoria: " + error.message, "error");
    })
    .finally(() => {
      hideLoading();
    });
}

let currentCategoryType = "Gasto"; // Valor padrão

// Função para carregar categorias
function loadCategories(tipo = currentCategoryType) {
  showLoading();
  currentCategoryType = tipo; // <-- garante que tudo fique sincronizado

  const expenseBtn = document.getElementById("expenseBtn");
  const incomeBtn = document.getElementById("incomeBtn");

  // Resetar estilo dos dois botões
  expenseBtn.classList.remove("bg-green-500", "text-white");
  incomeBtn.classList.remove("bg-green-500", "text-white");

  expenseBtn.classList.add("bg-zinc-700");
  incomeBtn.classList.add("bg-zinc-700");

  // Marcar botão ativo
  if (tipo === "Gasto") {
    expenseBtn.classList.remove("bg-zinc-700");
    expenseBtn.classList.add("bg-green-500", "text-white");
  } else {
    incomeBtn.classList.remove("bg-zinc-700");
    incomeBtn.classList.add("bg-green-500", "text-white");
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    showAlert('Usuário não autenticado.', 'error');
    hideLoading();
    return;
  }

  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid).collection("categories");

  userRef.where("tipo", "==", tipo).get()
    .then((querySnapshot) => {
      const categoriesContainer = document.getElementById("categoriesContainer");
      categoriesContainer.innerHTML = '';  // Limpa a lista antes de renderizar novamente

      let selectedCategories = [];
      let allCheckboxes = [];

      // Criar container do seletor e botão de excluir
      const topActionsContainer = document.createElement("div");
      topActionsContainer.classList.add("flex", "items-center", "justify-between", "mb-2");

      // Criar checkbox "Selecionar Todos"
      const selectAllContainer = document.createElement("div");
      selectAllContainer.classList.add("flex", "items-center", "cursor-pointer", "select-none");

      const selectAllCheckbox = document.createElement("input");
      selectAllCheckbox.type = "checkbox";
      selectAllCheckbox.classList.add("ml-4", "accent-green-500");
      selectAllCheckbox.onchange = toggleAllSelections;

      const selectAllLabel = document.createElement("label");
      selectAllLabel.textContent = "Selecionar Todos";
      selectAllLabel.classList.add("text-zinc-200", "font-medium", "cursor-pointer","py-2", "px-4");
      selectAllLabel.onclick = () => {
        selectAllCheckbox.checked = !selectAllCheckbox.checked;
        toggleAllSelections();
      };

      selectAllContainer.appendChild(selectAllCheckbox);
      selectAllContainer.appendChild(selectAllLabel);

      // Criar botão de "Excluir Selecionados"
      const deleteSelectedButton = document.createElement("button");
      deleteSelectedButton.textContent = "Excluir Selecionados";
      deleteSelectedButton.classList.add(
        "hidden", "bg-red-500", "hover:bg-red-600", "text-white",
        "py-2", "px-4", "rounded-md"
      );
      deleteSelectedButton.onclick = () => openDeleteModal(
        selectedCategories,
        "Excluir Categorias",
        `Tem certeza que deseja excluir ${selectedCategories.length > 1 ? "as categorias selecionadas" : "esta categoria"}?`
      );

      topActionsContainer.appendChild(selectAllContainer);
      topActionsContainer.appendChild(deleteSelectedButton);
      categoriesContainer.appendChild(topActionsContainer);

      querySnapshot.forEach((doc) => {
        const category = doc.data().name;
        const listItem = document.createElement("li");
        listItem.classList.add(
          "flex", "items-center", "justify-between", "bg-zinc-700",
          "py-2", "px-4", "rounded-md", "border", "border-zinc-600", "cursor-pointer", "select-none",
        );
        listItem.setAttribute("data-id", doc.id);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add("mr-2", "checkbox-category", "accent-green-500");
        checkbox.onchange = () => {
          if (checkbox.checked) {
            selectedCategories.push({ id: doc.id, listItem });
            listItem.classList.add("bg-green-500/20", "border-green-600");
            listItem.classList.remove("bg-zinc-700");
          } else {
            selectedCategories = selectedCategories.filter(c => c.id !== doc.id);
            listItem.classList.remove("bg-green-500/20", "border-green-600");
            listItem.classList.add("bg-zinc-700");
          }
          toggleDeleteButton();
        };
        

        allCheckboxes.push(checkbox);

        const categoryText = document.createElement("span");
        categoryText.textContent = category;
        categoryText.classList.add("text-zinc-200", "font-medium");

        const actionsContainer = document.createElement("div");
        actionsContainer.classList.add("flex", "space-x-3");

        const editButton = document.createElement("button");
        editButton.classList.add("text-green-500", "hover:text-green-600");
        editButton.innerHTML = `<i class="fa-regular fa-pen-to-square"></i>`;
        editButton.onclick = (event) => {
          event.stopPropagation();
          openEditModal(doc.id, category, listItem);
        };

        actionsContainer.appendChild(editButton);

        listItem.appendChild(checkbox);
        listItem.appendChild(categoryText);
        listItem.appendChild(actionsContainer);

        listItem.onclick = (event) => {
          if (!event.target.closest("button")) { 
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
          }
        };

        categoriesContainer.appendChild(listItem);
      });

      function toggleAllSelections() {
        const isChecked = selectAllCheckbox.checked;
        allCheckboxes.forEach(checkbox => {
          checkbox.checked = isChecked;
          checkbox.dispatchEvent(new Event("change"));
        });
      }

      function toggleDeleteButton() {
        deleteSelectedButton.classList.toggle("hidden", selectedCategories.length === 0);
      }

      hideLoading();
    })
    .catch((error) => {
      showAlert('Erro ao carregar categorias: ' + error.message, 'error');
      hideLoading();
    });
}

// Função para abrir o modal de edição de categoria
function openEditModal(categoryId, oldCategoryName, listItem) {
  const modal = document.getElementById("editModal");
  const modalInput = document.getElementById("editCategoryInput");
  const saveButton = document.getElementById("saveEditCategory");
  const closeModalButton = document.getElementById("closeEditModal");

  modalInput.value = oldCategoryName;
  modal.classList.remove("hidden");

  function saveEdit() {
    const newCategoryName = modalInput.value.trim();

    if (!newCategoryName) {
      showAlert("O nome da categoria não foi alterado.", "success");
      return;
    }

    if (newCategoryName === oldCategoryName) {
      showAlert("O nome da categoria não foi alterado.", "error");
      closeEditModal();
      return;
    }

    updateCategoryInFirestore(categoryId, newCategoryName, listItem);
  }

  saveButton.onclick = saveEdit;
  closeModalButton.onclick = closeEditModal;

  modal.onclick = (e) => {
    if (e.target === modal) closeEditModal();
  };
}

// Função para fechar o modal de edição
function closeEditModal() {
  const modal = document.getElementById("editModal");
  modal.classList.add("hidden");
}

// Função para atualizar a categoria no Firestore
function updateCategoryInFirestore(categoryId, newCategoryName, listItem) {
  showLoading();

  const user = firebase.auth().currentUser;
  if (!user) {
    showAlert("Usuário não autenticado.", "error");
    hideLoading();
    return;
  }

  const db = firebase.firestore();
  const categoryRef = db
    .collection("users")
    .doc(user.uid)
    .collection("categories")
    .doc(categoryId);

  categoryRef
    .update({ name: newCategoryName })
    .then(() => {
      listItem.querySelector("span").textContent = newCategoryName;
      closeEditModal();
    })
    .catch((error) => {
      showAlert("Erro ao atualizar a categoria: " + error.message, "error");
    })
    .finally(() => {
      hideLoading();
    });
}

function handleAddCategory() {
  const newCategoryInput = document.getElementById("newCategory");
  const newCategoryName = newCategoryInput.value.trim();

  if (newCategoryName) {
    saveCategoryToFirestore(newCategoryName);
    newCategoryInput.value = "";
  } else {
    showAlert("O nome da categoria não pode estar vazio.", "error");
  }
}

function deleteCategory(categoryId, listItem) {
  openDeleteModal(
    categoryId,
    listItem,
    "Excluir Categoria",
    "Tem certeza que deseja excluir esta categoria?"
  );
}

function openDeleteModal(categoryData, title, message) {
  const modal = document.getElementById("deleteModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");
  const deleteConfirmButton = document.getElementById("deleteConfirmButton");
  const closeModalButton = document.getElementById("closeModalButton");
  const cancelDeleteButton = document.getElementById("cancelDeleteButton");

  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modal.classList.remove("hidden");

  deleteConfirmButton.onclick = function () {
    confirmDeleteMultipleCategories(categoryData);
  };

  closeModalButton.onclick = closeModal;
  cancelDeleteButton.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}

function confirmDeleteMultipleCategories(categories) {
  showLoading();
  const user = firebase.auth().currentUser;

  if (!user) {
    showAlert("Usuário não autenticado.", "error");
    hideLoading();
    return;
  }

  const db = firebase.firestore();
  const batch = db.batch();
  const userRef = db.collection("users").doc(user.uid).collection("categories");

  categories.forEach(({ id, listItem }) => {
    const categoryRef = userRef.doc(id);
    batch.delete(categoryRef);
    listItem.remove();
  });

  batch.commit()
    .then(() => {
      showAlert("Categorias excluídas com sucesso!", "success");
      checkIfCategoriesAreEmpty(user.uid);
    })
    .catch((error) => {
      showAlert("Erro ao excluir categorias: " + error.message, "error");
    })
    .finally(() => {
      hideLoading();
      closeModal();
    });
}

// Fecha o modal
function closeModal() {
  document.getElementById("deleteModal").classList.add("hidden");
}

document.getElementById("addCategoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const categoryInput = document.getElementById("categoryInput");
  const name = categoryInput.value.trim();

  if (name) {
    saveCategoryToFirestore(name); // já usa o tipo dinâmico
    categoryInput.value = "";
  } else {
    showAlert("O nome da categoria não pode estar vazio.", "error");
  }
});

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    if (localStorage.getItem("dontRestoreCategories") === "false") {
      return;
    }
    fixOldCategories(user.uid);
    checkAndCreateDefaultCategories(user.uid);
  }
});

function openCustomModal(title, message, onConfirm, onCancel = null) {
  const modal = document.getElementById("customModal");
  const modalTitle = document.getElementById("customModalTitle");
  const modalMessage = document.getElementById("customModalMessage");
  const confirmButton = document.getElementById("customConfirmButton");
  const closeModalButton = document.getElementById("closeCustomModalButton");
  const cancelButton = document.getElementById("customCancelButton");

  modalTitle.textContent = title;
  modalMessage.textContent = message;

  modal.classList.remove("hidden");

  confirmButton.onclick = function () {
    onConfirm(); 
    closeCustomModal();
  };

  closeModalButton.onclick = closeCustomModal;

  cancelButton.onclick = function () {
    if (onCancel) onCancel();
    closeCustomModal();
  };

  modal.onclick = (e) => {
    if (e.target === modal) closeCustomModal();
  };
}

function closeCustomModal() {
  document.getElementById("customModal").classList.add("hidden");
}

function closeCustomModal() {
  document.getElementById("customModal").classList.add("hidden");
}

function restoreDefaultCategories() {
  const user = firebase.auth().currentUser;

  if (!user) {
    showAlert(
      "Você precisa estar logado para restaurar as categorias.",
      "error"
    );
    return;
  }

  openCustomModal(
    "Restaurar Categorias",
    "Tem certeza que deseja restaurar as categorias padrão?",
    () => {
      localStorage.removeItem("dontRestoreCategories");
      addDefaultCategories(user.uid);
      showAlert("Categorias padrão restauradas com sucesso!", "success");
    }
  );
}

document
  .getElementById("restoreCategoriesBtn")
  .addEventListener("click", restoreDefaultCategories);

function checkAndCreateDefaultCategories(userId) {
  const db = firebase.firestore();
  const categoriesRef = db
    .collection("users")
    .doc(userId)
    .collection("categories");

  categoriesRef
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) {
        addDefaultCategories(userId);
      }
    })
    .catch((error) => {
      showAlert(
        "Erro ao verificar categorias padrão: " + error.message,
        "error"
      );
    });
}

function addDefaultCategories(userId) {
  const db = firebase.firestore();
  const categoriesRef = db.collection("users").doc(userId).collection("categories");

  // Categorias padrão separadas por tipo
  const defaultExpenseCategories = [
    "🚗 Transporte",
    "📞 Comunicação",
    "📚 Educação",
    "🏠 Moradia",
    "🛍️ Compras e Parcelamentos",
    "👨‍👩‍👧‍👦 Gastos Pessoais",
    "💳 Bancos e Créditos",
  ];

  const defaultIncomeCategories = [
    "💼 Salário",
    "🧾 Reembolso",
    "💸 Transferência recebida",
    "📈 Investimentos",
    "🎁 Presentes / Extras"
  ];

  categoriesRef.get()
    .then((querySnapshot) => {
      const existing = new Set();

      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.name && data.tipo) {
          existing.add(`${data.name}-${data.tipo}`);
        }
      });

      const missingExpenses = defaultExpenseCategories
        .filter(name => !existing.has(`${name}-Gasto`))
        .map(name => categoriesRef.add({ name, tipo: "Gasto" }));

      const missingIncomes = defaultIncomeCategories
        .filter(name => !existing.has(`${name}-Ganho`))
        .map(name => categoriesRef.add({ name, tipo: "Ganho" }));

      return Promise.all([...missingExpenses, ...missingIncomes]);
    })
    .then(() => {
      showAlert("Categorias padrão adicionadas com sucesso!", "success");
      loadCategories(currentCategoryType);
    })
    .catch((error) => {
      showAlert("Erro ao adicionar categorias padrão: " + error.message, "error");
    });
}

function fixOldCategories(userId) {
  const db = firebase.firestore();
  const categoriesRef = db.collection("users").doc(userId).collection("categories");

  categoriesRef.get()
    .then((querySnapshot) => {
      const batch = db.batch();
      let hasOldCategories = false;

      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (!data.tipo) {
          const categoryRef = categoriesRef.doc(doc.id);
          batch.update(categoryRef, { tipo: "Gasto" });
          hasOldCategories = true;
        }
      });

      if (hasOldCategories) {
        return batch.commit()
          .then(() => {
            console.log("Categorias antigas corrigidas com sucesso.");
          });
      } else {
        console.log("Nenhuma categoria antiga para corrigir.");
      }
    })
    .catch((error) => {
      console.error("Erro ao corrigir categorias antigas:", error);
    });
}



// Verifica se o usuario apagou todas as categorias
function checkIfCategoriesAreEmpty(userId) {
  const db = firebase.firestore();
  const categoriesRef = db
    .collection("users")
    .doc(userId)
    .collection("categories");

  categoriesRef
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) {
        if (localStorage.getItem("dontRestoreCategories") === "true") {
          console.log("Usuário optou por não restaurar as categorias padrão.");
          return;
        }

        openCustomModal(
          "Restaurar Categorias",
          "Você apagou todas as categorias. Deseja restaurar as categorias padrão?",
          () => {
            addDefaultCategories(userId);
          },
          () => {
            localStorage.setItem("dontRestoreCategories", "true");
          }
        );
      }
    })
    .catch((error) => {
      console.error("Erro ao verificar categorias:", error);
    });
}

function showSection(sectionId, e = null) {
  document.querySelectorAll("section").forEach((section) => {
    section.classList.add("hidden");
  });

  document.getElementById(sectionId).classList.remove("hidden");

  document.querySelectorAll("aside button").forEach((button) => {
    button.classList.remove("bg-zinc-700");
  });

  if (e && e.currentTarget) {
    e.currentTarget.classList.add("bg-zinc-700");
  } else {
    const defaultButton = document.getElementById("defaultActiveButton");
    if (defaultButton) {
      defaultButton.classList.add("bg-zinc-700");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  showSection('userSettings');
});
