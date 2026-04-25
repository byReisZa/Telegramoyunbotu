// ===== FIREBASE =====
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
  appId: "1:707008927852:web:ed6bca0a6ca3c2bcd06049",
  measurementId: "G-KGZ45KGMBM"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ===== STATE =====
let currentUser  = null;
let activeConvId = null;
let activePartner= null;
let msgListenerRef = null;
let convListenerRef= null;
let selectedMsgId  = null;
let selectedMsgTxt = null;

// ===== UTILS =====
const esc = s => String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const phoneToUid  = p => p.replace(/\D/g,"");
const normPhone   = p => "+" + p.replace(/\D/g,"");
const avatarLetter= n => (n||"?")[0].toUpperCase();
const convId      = (a,b) => [a,b].sort().join("_");

const timeStr = ts => {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
};
const dateStr = ts => {
  if (!ts) return "";
  const d = new Date(ts);
  const t = new Date(); const y = new Date(t); y.setDate(t.getDate()-1);
  if (d.toDateString()===t.toDateString()) return "Bugün";
  if (d.toDateString()===y.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR",{day:"numeric",month:"long"});
};

// ===== TOAST =====
let _toastTimer;
function toast(msg, type="") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (type ? " "+type : "");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.className="toast", 2800);
}

// ===== PAGE / VIEW =====
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showView(id) {
  const views = document.querySelectorAll(".view");
  views.forEach(v => {
    v.classList.remove("active-view","slide-left");
  });
  const target = document.getElementById(id);
  if (id === "viewChat") {
    document.getElementById("viewChats").classList.add("slide-left");
    target.classList.add("active-view");
  } else {
    target.classList.add("active-view");
  }
}

// ===== BOTTOM SHEETS =====
function openSheet(overlayId) {
  const el = document.getElementById(overlayId);
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("visible"));
}
function closeSheet(overlayId) {
  const el = document.getElementById(overlayId);
  el.classList.remove("visible");
  setTimeout(() => el.classList.add("hidden"), 280);
}

// Tap outside to close
["ctxOverlay","editOverlay","newOverlay"].forEach(id => {
  document.getElementById(id).addEventListener("click", function(e){
    if (e.target === this) closeSheet(id);
  });
});

// ===== SPLASH =====
setTimeout(() => {
  const saved = localStorage.getItem("alimesaj_user");
  if (saved) {
    try { currentUser = JSON.parse(saved); initApp(); }
    catch { showPage("registerPage"); }
  } else {
    showPage("registerPage");
  }
}, 1900);

// ===== REGISTER =====
document.getElementById("registerBtn").addEventListener("click", async () => {
  const name = document.getElementById("regName").value.trim();
  const raw  = document.getElementById("regPhone").value.trim();
  if (!name) return toast("Adını gir", "err");
  if (!raw)  return toast("Telefon numarası gir", "err");

  const phone = normPhone(raw);
  const uid   = phoneToUid(phone);

  try {
    const snap = await get(ref(db,`users/${uid}`));
    if (snap.exists()) return toast("Bu numara kayıtlı. Giriş yap.", "err");
    await set(ref(db,`users/${uid}`), { uid, name, phone, createdAt: Date.now() });
    currentUser = { uid, name, phone };
    localStorage.setItem("alimesaj_user", JSON.stringify(currentUser));
    initApp();
  } catch(e) { toast("Hata: " + e.message, "err"); }
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const raw = document.getElementById("loginPhone").value.trim();
  if (!raw) return toast("Telefon numarası gir","err");
  const phone = normPhone(raw);
  const uid   = phoneToUid(phone);
  try {
    const snap = await get(ref(db,`users/${uid}`));
    if (!snap.exists()) return toast("Kullanıcı bulunamadı. Önce kayıt ol.","err");
    currentUser = snap.val();
    localStorage.setItem("alimesaj_user", JSON.stringify(currentUser));
    initApp();
  } catch(e) { toast("Hata: " + e.message,"err"); }
});

document.getElementById("goLogin").addEventListener("click", () => showPage("loginPage"));
document.getElementById("goRegister").addEventListener("click", () => showPage("registerPage"));

// ===== ONESIGNAL BİLDİRİM =====
const OS_APP_ID  = "36d8e7c0-5c78-4ee8-af96-c5b04e1cb7ee";
const OS_API_KEY = "2gs3dpkbpeb6mjkv4ray2jcgr";

async function saveOneSignalToken() {
  try {
    await new Promise(r => setTimeout(r, 2500)); // SDK yüklensin
    if (typeof OneSignal === "undefined") return;

    // Kullanıcıyı uid ile bağla
    await OneSignal.login(currentUser.uid);

    // Bildirim izni iste
    await OneSignal.Notifications.requestPermission();

    // Subscription ID'yi al ve Firebase'e kaydet
    const subId = OneSignal.User.PushSubscription.id;
    if (subId) {
      await set(ref(db, `userTokens/${currentUser.uid}`), subId);
      console.log("✅ OneSignal token kaydedildi:", subId);
    }
  } catch(e) {
    console.log("OneSignal token hatası:", e);
  }
}

async function sendPushNotification(partnerUid, senderName, text) {
  try {
    const snap = await get(ref(db, `userTokens/${partnerUid}`));
    if (!snap.exists()) return;
    const subscriptionId = snap.val();

    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + OS_API_KEY
      },
      body: JSON.stringify({
        app_id: OS_APP_ID,
        include_subscription_ids: [subscriptionId],
        headings: { tr: senderName, en: senderName },
        contents: { tr: text.slice(0, 100), en: text.slice(0, 100) },
        priority: 10,
        ttl: 86400,
        android_channel_id: "alimesaj_msgs"
      })
    });
    console.log("✅ Bildirim gönderildi →", partnerUid);
  } catch(e) {
    console.log("Bildirim gönderilemedi:", e);
  }
}

// ===== INIT APP =====
function initApp() {
  document.getElementById("myAv").textContent    = avatarLetter(currentUser.name);
  document.getElementById("myPhone2").textContent= currentUser.phone;
  showPage("appPage");
  showView("viewChats");
  loadConversations();
  saveOneSignalToken(); // 🔔 token kaydet
}

// ===== LOGOUT =====
document.getElementById("logoutBtn").addEventListener("click", () => {
  if (!confirm("Çıkış yapmak istiyor musun?")) return;
  if (convListenerRef) off(convListenerRef);
  if (msgListenerRef) off(msgListenerRef);
  localStorage.removeItem("alimesaj_user");
  location.reload();
});

// ===== SEARCH TOGGLE =====
document.getElementById("searchToggle").addEventListener("click", () => {
  const bar = document.getElementById("searchBar");
  const expanded = bar.classList.contains("expanded");
  if (expanded) {
    bar.classList.replace("expanded","collapsed");
  } else {
    bar.classList.replace("collapsed","expanded");
    setTimeout(() => document.getElementById("searchPhone").focus(), 150);
  }
});

// ===== SEARCH (topbar) =====
document.getElementById("searchBtn").addEventListener("click", doSearch);
document.getElementById("searchPhone").addEventListener("keydown", e => {
  if (e.key === "Enter") doSearch();
});

async function doSearch() {
  const raw = document.getElementById("searchPhone").value.trim();
  if (!raw) return toast("Numara gir","err");
  const phone = normPhone(raw);
  const uid   = phoneToUid(phone);
  if (uid === currentUser.uid) return toast("Kendinle konuşamazsın 😄","err");
  try {
    const snap = await get(ref(db,`users/${uid}`));
    if (!snap.exists()) return toast("Kullanıcı bulunamadı","err");
    document.getElementById("searchPhone").value = "";
    document.getElementById("searchBar").classList.replace("expanded","collapsed");
    openChat(snap.val());
  } catch(e) { toast("Hata: " + e.message,"err"); }
}

// ===== FAB =====
document.getElementById("fabBtn").addEventListener("click", () => openSheet("newOverlay"));
document.getElementById("newCancel").addEventListener("click", () => closeSheet("newOverlay"));
document.getElementById("newGo").addEventListener("click", async () => {
  const raw = document.getElementById("newPhone").value.trim();
  if (!raw) return toast("Numara gir","err");
  const phone = normPhone(raw);
  const uid   = phoneToUid(phone);
  if (uid === currentUser.uid) return toast("Kendinle konuşamazsın 😄","err");
  try {
    const snap = await get(ref(db,`users/${uid}`));
    if (!snap.exists()) return toast("Kullanıcı bulunamadı","err");
    document.getElementById("newPhone").value = "";
    closeSheet("newOverlay");
    openChat(snap.val());
  } catch(e) { toast("Hata: " + e.message,"err"); }
});

// ===== LOAD CONVERSATIONS =====
function loadConversations() {
  if (convListenerRef) off(convListenerRef);
  convListenerRef = ref(db, `userConversations/${currentUser.uid}`);

  onValue(convListenerRef, async snap => {
    const list = document.getElementById("chatsList");
    list.innerHTML = "";
    const data = snap.val();

    if (!data) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-ico"><i class="fa-regular fa-comments"></i></div>
          <div class="empty-t">Henüz sohbet yok</div>
          <div class="empty-s">Yeni sohbet başlatmak için<br/>sağ alttaki butona bas</div>
        </div>`;
      return;
    }

    const arr = Object.entries(data)
      .map(([cid,info]) => ({cid,...info}))
      .sort((a,b) => (b.lastAt||0) - (a.lastAt||0));

    for (const conv of arr) {
      try {
        const uSnap = await get(ref(db,`users/${conv.partnerUid}`));
        if (!uSnap.exists()) continue;
        const partner = uSnap.val();
        list.appendChild(buildChatItem(conv.cid, partner, conv.lastMsg, conv.lastAt));
      } catch(_) {}
    }
  });
}

function buildChatItem(cid, partner, lastMsg, lastAt) {
  const div = document.createElement("div");
  div.className = "chat-item" + (cid === activeConvId ? " active-chat" : "");
  div.dataset.cid = cid;
  div.innerHTML = `
    <div class="av">${avatarLetter(partner.name)}</div>
    <div class="chat-item-info">
      <div class="chat-item-top">
        <div class="chat-item-name">${esc(partner.name)}</div>
        <div class="chat-item-time">${lastAt ? timeStr(lastAt) : ""}</div>
      </div>
      <div class="chat-item-preview">${lastMsg ? esc(lastMsg.slice(0,45)) : "Sohbet başladı"}</div>
    </div>
  `;
  div.addEventListener("click", () => openChat(partner));
  return div;
}

// ===== OPEN CHAT =====
function openChat(partner) {
  activePartner = partner;
  activeConvId  = convId(currentUser.uid, partner.uid);

  document.getElementById("chatAv").textContent    = avatarLetter(partner.name);
  document.getElementById("chatName").textContent   = partner.name;

  showView("viewChat");
  buildInputArea();
  ensureConvIndex(partner);
  listenMessages();

  // highlight in list
  document.querySelectorAll(".chat-item").forEach(i => {
    i.classList.toggle("active-chat", i.dataset.cid === activeConvId);
  });
}

function ensureConvIndex(partner) {
  const cid = convId(currentUser.uid, partner.uid);
  const myR  = ref(db,`userConversations/${currentUser.uid}/${cid}`);
  const thR  = ref(db,`userConversations/${partner.uid}/${cid}`);
  get(myR).then(s => { if (!s.exists()) set(myR,{partnerUid:partner.uid,lastMsg:"",lastAt:Date.now()}); });
  get(thR).then(s => { if (!s.exists()) set(thR,{partnerUid:currentUser.uid,lastMsg:"",lastAt:Date.now()}); });
}

// ===== BACK BUTTON =====
document.getElementById("backBtn").addEventListener("click", () => {
  showView("viewChats");
  if (msgListenerRef) { off(msgListenerRef); msgListenerRef = null; }
});

// ===== BUILD INPUT AREA =====
function buildInputArea() {
  const ta = document.getElementById("msgInput");
  ta.value = "";
  ta.style.height = "auto";

  ta.oninput = () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };
  ta.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  document.getElementById("sendBtn").onclick = sendMsg;
}

// ===== SEND MESSAGE =====
async function sendMsg() {
  const ta   = document.getElementById("msgInput");
  const text = ta.value.trim();
  if (!text || !activeConvId) return;

  ta.value = "";
  ta.style.height = "auto";

  const msgRef = push(ref(db,`conversations/${activeConvId}/messages`));
  const msg = {
    id: msgRef.key,
    text,
    senderUid: currentUser.uid,
    senderName: currentUser.name,
    timestamp: Date.now(),
    edited: false
  };

  try {
    await set(msgRef, msg);
    const preview = { lastMsg: text, lastAt: Date.now() };
    await update(ref(db,`userConversations/${currentUser.uid}/${activeConvId}`), preview);
    await update(ref(db,`userConversations/${activePartner.uid}/${activeConvId}`), preview);

    // 🔔 Karşı tarafa bildirim gönder
    sendPushNotification(activePartner.uid, currentUser.name, text);
  } catch(e) { toast("Gönderilemedi","err"); }
}

// ===== LISTEN MESSAGES =====
function listenMessages() {
  if (msgListenerRef) { off(msgListenerRef); }
  msgListenerRef = query(
    ref(db,`conversations/${activeConvId}/messages`),
    orderByChild("timestamp")
  );

  onValue(msgListenerRef, snap => {
    const area = document.getElementById("messagesArea");
    if (!area) return;
    area.innerHTML = "";

    const data = snap.val();
    if (!data) return;

    let lastDate = null;
    Object.values(data).forEach(msg => {
      const ds = dateStr(msg.timestamp);
      if (ds !== lastDate) {
        lastDate = ds;
        const sep = document.createElement("div");
        sep.className = "date-sep";
        sep.textContent = ds;
        area.appendChild(sep);
      }
      area.appendChild(buildBubble(msg));
    });

    area.scrollTop = area.scrollHeight;
  });
}

// ===== BUILD BUBBLE =====
function buildBubble(msg) {
  const isMine = msg.senderUid === currentUser.uid;
  const row = document.createElement("div");
  row.className = `msg-row ${isMine ? "me" : "them"}`;
  row.dataset.id = msg.id;

  row.innerHTML = `
    <div class="bubble">${esc(msg.text)}</div>
    <div class="msg-foot">
      <span class="msg-time">${timeStr(msg.timestamp)}</span>
      ${msg.edited ? '<span class="msg-edited">düzenlendi</span>' : ""}
    </div>
  `;

  if (isMine) {
    const bubble = row.querySelector(".bubble");

    // Long press → context sheet
    let pressTimer;
    bubble.addEventListener("touchstart", () => {
      pressTimer = setTimeout(() => {
        selectedMsgId  = msg.id;
        selectedMsgTxt = msg.text;
        openSheet("ctxOverlay");
      }, 500);
    }, {passive:true});
    bubble.addEventListener("touchend",  () => clearTimeout(pressTimer));
    bubble.addEventListener("touchmove", () => clearTimeout(pressTimer));

    // Click (desktop/fallback)
    bubble.addEventListener("click", () => {
      selectedMsgId  = msg.id;
      selectedMsgTxt = msg.text;
      openSheet("ctxOverlay");
    });
  }

  return row;
}

// ===== CONTEXT SHEET =====
document.getElementById("bsClose").addEventListener("click",  () => closeSheet("ctxOverlay"));
document.getElementById("bsEdit").addEventListener("click",   () => {
  closeSheet("ctxOverlay");
  document.getElementById("editInput").value = selectedMsgTxt || "";
  setTimeout(() => openSheet("editOverlay"), 220);
});
document.getElementById("bsDelete").addEventListener("click", async () => {
  closeSheet("ctxOverlay");
  if (!selectedMsgId || !activeConvId) return;
  const id = selectedMsgId;
  try {
    await remove(ref(db,`conversations/${activeConvId}/messages/${id}`));
    toast("Mesaj silindi","ok");
  } catch(e) { toast("Silinemedi: "+e.message,"err"); }
});

// ===== EDIT SHEET =====
document.getElementById("editCancel").addEventListener("click", () => closeSheet("editOverlay"));
document.getElementById("editSave").addEventListener("click",   async () => {
  const txt = document.getElementById("editInput").value.trim();
  if (!txt) return toast("Mesaj boş olamaz","err");
  if (!selectedMsgId || !activeConvId) return;
  try {
    await update(ref(db,`conversations/${activeConvId}/messages/${selectedMsgId}`), {
      text: txt, edited: true, editedAt: Date.now()
    });
    closeSheet("editOverlay");
    toast("Mesaj düzenlendi","ok");
  } catch(e) { toast("Düzenlenemedi: "+e.message,"err"); }
});

// ===== ANDROID BACK BUTTON (PWA) =====
window.addEventListener("popstate", () => {
  const chatView = document.getElementById("viewChat");
  if (chatView.classList.contains("active-view")) {
    showView("viewChats");
    if (msgListenerRef) { off(msgListenerRef); msgListenerRef = null; }
  }
});
// Push dummy state so back button works
history.pushState(null, "", location.href);
