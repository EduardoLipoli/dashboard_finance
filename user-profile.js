// user-profile.js

// Função auxiliar para obter as iniciais do nome
function getInitials(name) {
  if (!name) return "?";
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return "?";
  if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
  const firstInitial = nameParts[0].charAt(0);
  const lastInitial = nameParts[nameParts.length - 1].charAt(0);
  return `${firstInitial}${lastInitial}`.toUpperCase();
}

// Função auxiliar para gerar uma cor de fundo consistente para o nome
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

// Função para exibir o nome e a foto/iniciais do usuário logado
function loadUserName(user) {
  const nameFromEmail = user.email ? user.email.split('@')[0] : "Usuário";
  const displayName = user.displayName || nameFromEmail;
  const email = user.email || "E-mail não disponível";
  const photoURL = user.photoURL;

  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");
  const photoEl = document.getElementById("user-photo");
  const initialsEl = document.getElementById("user-initials");
  const userGreetingEl = document.getElementById("user-greeting");
  const userModalEl = document.getElementById("user-modal");
  const avatarContainer = document.getElementById("avatar-container");

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = email;
  if (userGreetingEl) userGreetingEl.textContent = displayName;
  if (userModalEl) userModalEl.textContent = displayName;

  if (photoURL) {
    if (photoEl) {
      photoEl.src = photoURL;
      photoEl.classList.remove('hidden');
    }
    if (initialsEl) initialsEl.classList.add('hidden');
    if (avatarContainer) avatarContainer.classList.remove('hidden');
  } else {
    const initial = getInitials(displayName);
    const color = generateColorForName(displayName);
    
    if (initialsEl) {
      initialsEl.textContent = initial;
      initialsEl.style.backgroundColor = color;
      initialsEl.classList.remove('hidden');
    }
    if (photoEl) photoEl.classList.add('hidden');
    if (avatarContainer) avatarContainer.classList.remove('hidden');
  }
}