// ===== FIREBASE SETUP =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, set, get, push, onValue, off,
  update, remove, serverTimestamp, query, orderByChild
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDj2Ht94NvI7tOd2aK5EQjCzMS0OPxbSkc",
  authDomain: "telegramapp-b0bce.firebaseapp.com",
  databaseURL: "https://telegramapp-b0bce-default-rtdb.firebaseio.com",
  projectId: "telegramapp-b0bce",
  storageBucket: "telegramapp-b0bce.firebasestorage.app",
  messagingSenderId: "707008927852",
  appId: "1:707008927852:web:ed6bca0a6bca3c2bcd06049",
  measurementId: "G-KGZ45KGMBM"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== STATE =====
let currentUser = null;     // { uid, name, phone }
let activeConvId = null;    // conversation ID
let activePartner = null;   // { uid, name, phone }
let msgListener = null;     // Firebase listener ref
let convListener = null;    // conversations listener
let selectedMsgId = null;   // for context menu

// ===== HELPERS =====
const phoneToUid = (phone) => phone.replace(/\D/g, "");

const formatPhone = (raw) => {
  const digits = raw.replace(/\D/g, "");
  return "+" + digits;
};

const timeStr = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
};

const dateStr = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Bugün";
  if (d.toDateString() === yesterday.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
};

const convId = (uid1, uid2) => [uid1, uid2].sort().join("_");

const avatarLetter = (name) => (name || "?")[0].toUpperCase();

// ===== TOAST =====
let toastTimer;
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast"; }, 3000);
}

// ===== SCREEN SWITCHER =====
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===== REGISTER =====
document.getElementById("registerBtn").addEventListener("click", async () => {
  const name = document.getElementById("regName").value.trim();
  const phoneRaw = document.getElementById("regPhone").value.trim();
  if (!name) return showToast("Adını gir", "error");
  if (!phoneRaw) return showToast("Telefon numarasını gir", "error");

  const phone = formatPhone(phoneRaw);
  const uid = phoneToUid(phone);

  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) {
      return showToast("Bu numara zaten kayıtlı. Giriş yap.", "error");
    }
    await set(ref(db, `users/${uid}`), { name, phone, uid, createdAt: Date.now() });
    currentUser = { uid, name, phone };
    localStorage.setItem("alimesaj_user", JSON.stringify(currentUser));
    initApp();
  } catch (e) {
    showToast("Hata: " + e.message, "error");
  }
});

// ===== LOGIN =====
document.getElementById("loginBtn").addEventListener("click", async () => {
  const phoneRaw = document.getElementById("loginPhone").value.trim();
  if (!phoneRaw) return showToast("Telefon numarasını gir", "error");
  const phone = formatPhone(phoneRaw);
  const uid = phoneToUid(phone);
  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) return showToast("Kullanıcı bulunamadı. Önce kayıt ol.", "error");
    currentUser = snap.val();
    localStorage.setItem("alimesaj_user", JSON.stringify(currentUser));
    initApp();
  } catch (e) {
    showToast("Hata: " + e.message, "error");
  }
});

document.getElementById("goLogin").addEventListener("click", () => showScreen("loginScreen"));
document.getElementById("goRegister").addEventListener("click", () => showScreen("registerScreen"));

// ===== LOGOUT =====
document.getElementById("logoutBtn").addEventListener("click", () => {
  if (!confirm("Çıkış yapmak istiyor musun?")) return;
  localStorage.removeItem("alimesaj_user");
  location.reload();
});

// ===== INIT APP =====
function initApp() {
  document.getElementById("myName").textContent = currentUser.name;
  document.getElementById("myPhone").textContent = currentUser.phone;
  document.getElementById("myAvatar").textContent = avatarLetter(currentUser.name);
  showScreen("appScreen");
  loadConversations();
}

// ===== SEARCH USER =====
document.getElementById("searchBtn").addEventListener("click", searchUser);
document.getElementById("searchPhone").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchUser();
});

async function searchUser() {
  const phoneRaw = document.getElementById("searchPhone").value.trim();
  if (!phoneRaw) return showToast("Numara gir", "error");
  const phone = formatPhone(phoneRaw);
  const uid = phoneToUid(phone);

  if (uid === currentUser.uid) return showToast("Kendinle konuşamazsın 😄", "error");

  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) return showToast("Kullanıcı bulunamadı", "error");
    const partner = snap.val();
    document.getElementById("searchPhone").value = "";
    openChat(partner);
  } catch (e) {
    showToast("Hata: " + e.message, "error");
  }
}

// ===== LOAD CONVERSATIONS =====
function loadConversations() {
  const convRef = ref(db, `userConversations/${currentUser.uid}`);
  if (convListener) off(convRef);

  convListener = onValue(convRef, async (snap) => {
    const data = snap.val();
    const list = document.getElementById("conversationsList");
    list.innerHTML = "";

    if (!data) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-comments"></i>
          <p>Henüz sohbet yok</p>
          <small>Bir numara ara ve mesajlaş</small>
        </div>`;
      return;
    }

    const convArray = Object.entries(data).map(([cid, info]) => ({ cid, ...info }));
    convArray.sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));

    for (const conv of convArray) {
      try {
        const uSnap = await get(ref(db, `users/${conv.partnerUid}`));
        if (!uSnap.exists()) continue;
        const partner = uSnap.val();
        const item = buildConvItem(conv.cid, partner, conv.lastMsg, conv.lastAt);
        list.appendChild(item);
      } catch (_) { /* skip */ }
    }
  });
}

function buildConvItem(cid, partner, lastMsg, lastAt) {
  const div = document.createElement("div");
  div.className = "conv-item" + (cid === activeConvId ? " active" : "");
  div.dataset.cid = cid;
  div.innerHTML = `
    <div class="avatar">${avatarLetter(partner.name)}</div>
    <div class="conv-info">
      <div class="conv-name">${escHtml(partner.name)}</div>
      <div class="conv-preview">${lastMsg ? escHtml(lastMsg.slice(0, 40)) : "Sohbet başladı"}</div>
    </div>
    <div class="conv-time">${lastAt ? timeStr(lastAt) : ""}</div>
  `;
  div.addEventListener("click", () => openChat(partner));
  return div;
}

// ===== OPEN CHAT =====
async function openChat(partner) {
  activePartner = partner;
  activeConvId = convId(currentUser.uid, partner.uid);

  // Mark active in sidebar
  document.querySelectorAll(".conv-item").forEach(i => i.classList.remove("active"));
  const found = document.querySelector(`.conv-item[data-cid="${activeConvId}"]`);
  if (found) found.classList.add("active");

  // Build chat UI
  const chatArea = document.getElementById("chatArea");
  chatArea.innerHTML = `
    <div class="chat-header">
      <div class="avatar large">${avatarLetter(partner.name)}</div>
      <div class="chat-header-info">
        <div class="chat-header-name">${escHtml(partner.name)}</div>
        <div class="chat-header-phone">${escHtml(partner.phone)}</div>
      </div>
      <div class="online-dot"></div>
    </div>
    <div class="messages-container" id="messagesContainer"></div>
    <div class="chat-input-area">
      <div class="msg-textarea-wrap">
        <textarea id="msgInput" rows="1" placeholder="Mesaj yaz..."></textarea>
      </div>
      <button class="btn-send" id="sendBtn"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  `;

  // Auto-resize textarea
  const textarea = document.getElementById("msgInput");
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("sendBtn").addEventListener("click", sendMessage);

  // Listen to messages
  listenMessages();

  // Ensure conversation index exists
  ensureConvIndex(partner);
}

function ensureConvIndex(partner) {
  const cid = convId(currentUser.uid, partner.uid);
  const myRef = ref(db, `userConversations/${currentUser.uid}/${cid}`);
  const theirRef = ref(db, `userConversations/${partner.uid}/${cid}`);
  get(myRef).then(s => {
    if (!s.exists()) set(myRef, { partnerUid: partner.uid, lastMsg: "", lastAt: Date.now() });
  });
  get(theirRef).then(s => {
    if (!s.exists()) set(theirRef, { partnerUid: currentUser.uid, lastMsg: "", lastAt: Date.now() });
  });
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const input = document.getElementById("msgInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  input.style.height = "auto";

  const msgRef = push(ref(db, `conversations/${activeConvId}/messages`));
  const msgData = {
    id: msgRef.key,
    text,
    senderUid: currentUser.uid,
    senderName: currentUser.name,
    timestamp: Date.now(),
    edited: false
  };

  try {
    await set(msgRef, msgData);
    // Update conversation index
    const preview = { lastMsg: text, lastAt: Date.now() };
    await update(ref(db, `userConversations/${currentUser.uid}/${activeConvId}`), preview);
    await update(ref(db, `userConversations/${activePartner.uid}/${activeConvId}`), preview);
  } catch (e) {
    showToast("Mesaj gönderilemedi", "error");
  }
}

// ===== LISTEN MESSAGES =====
function listenMessages() {
  if (msgListener) {
    off(ref(db, `conversations/${msgListener}/messages`));
  }
  msgListener = activeConvId;

  const msgsRef = query(
    ref(db, `conversations/${activeConvId}/messages`),
    orderByChild("timestamp")
  );

  onValue(msgsRef, (snap) => {
    const container = document.getElementById("messagesContainer");
    if (!container) return;
    container.innerHTML = "";

    const data = snap.val();
    if (!data) return;

    let lastDate = null;
    Object.values(data).forEach(msg => {
      const msgDate = dateStr(msg.timestamp);
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const divider = document.createElement("div");
        divider.className = "date-divider";
        divider.textContent = msgDate;
        container.appendChild(divider);
      }
      container.appendChild(buildMsgEl(msg));
    });

    container.scrollTop = container.scrollHeight;
  });
}

// ===== BUILD MESSAGE ELEMENT =====
function buildMsgEl(msg) {
  const isMine = msg.senderUid === currentUser.uid;
  const wrapper = document.createElement("div");
  wrapper.className = `msg-wrapper ${isMine ? "mine" : "theirs"}`;
  wrapper.dataset.msgId = msg.id;

  wrapper.innerHTML = `
    <div class="msg-bubble" data-id="${msg.id}">
      ${escHtml(msg.text)}
    </div>
    <div class="msg-meta">
      <span class="msg-time">${timeStr(msg.timestamp)}</span>
      ${msg.edited ? '<span class="msg-edited">düzenlendi</span>' : ""}
    </div>
  `;

  if (isMine) {
    wrapper.querySelector(".msg-bubble").addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, msg.id, msg.text);
    });
    // Long press for mobile
    let pressTimer;
    wrapper.querySelector(".msg-bubble").addEventListener("touchstart", (e) => {
      pressTimer = setTimeout(() => {
        const touch = e.touches[0];
        showContextMenu(touch.clientX, touch.clientY, msg.id, msg.text);
      }, 600);
    });
    wrapper.querySelector(".msg-bubble").addEventListener("touchend", () => clearTimeout(pressTimer));
  }

  return wrapper;
}

// ===== CONTEXT MENU =====
const ctxMenu = document.getElementById("contextMenu");

function showContextMenu(x, y, msgId, msgText) {
  selectedMsgId = msgId;
  document.getElementById("editInput").value = msgText;

  // Position
  const menuW = 160, menuH = 110;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);
  ctxMenu.style.left = left + "px";
  ctxMenu.style.top = top + "px";
  ctxMenu.classList.add("show");
}

function hideContextMenu() {
  ctxMenu.classList.remove("show");
  selectedMsgId = null;
}

document.addEventListener("click", (e) => {
  if (!ctxMenu.contains(e.target)) hideContextMenu();
});

document.getElementById("ctxClose").addEventListener("click", hideContextMenu);

// Edit
document.getElementById("ctxEdit").addEventListener("click", () => {
  hideContextMenu();
  openEditModal();
});

// Delete
document.getElementById("ctxDelete").addEventListener("click", async () => {
  hideContextMenu();
  if (!selectedMsgId || !activeConvId) return;
  const id = selectedMsgId;
  if (!confirm("Bu mesajı silmek istediğine emin misin?")) return;
  try {
    await remove(ref(db, `conversations/${activeConvId}/messages/${id}`));
    showToast("Mesaj silindi", "success");
  } catch (e) {
    showToast("Silinemedi: " + e.message, "error");
  }
});

// ===== EDIT MODAL =====
const editModal = document.getElementById("editModal");

function openEditModal() {
  editModal.classList.add("show");
  setTimeout(() => document.getElementById("editInput").focus(), 100);
}

function closeEditModal() {
  editModal.classList.remove("show");
}

document.getElementById("editCancel").addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

document.getElementById("editSave").addEventListener("click", async () => {
  const newText = document.getElementById("editInput").value.trim();
  if (!newText) return showToast("Mesaj boş olamaz", "error");
  if (!selectedMsgId && !editModal._editId) return;

  const id = editModal._editId || selectedMsgId;
  try {
    await update(ref(db, `conversations/${activeConvId}/messages/${id}`), {
      text: newText,
      edited: true,
      editedAt: Date.now()
    });
    closeEditModal();
    showToast("Mesaj düzenlendi", "success");
  } catch (e) {
    showToast("Düzenlenemedi: " + e.message, "error");
  }
});

// Store edit target
document.getElementById("ctxEdit").addEventListener("click", () => {
  editModal._editId = selectedMsgId;
}, true);

// ===== HTML ESCAPE =====
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ===== AUTO LOGIN =====
(function init() {
  const saved = localStorage.getItem("alimesaj_user");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      initApp();
    } catch (_) {
      showScreen("registerScreen");
    }
  } else {
    showScreen("registerScreen");
  }
})();
