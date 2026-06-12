// ==========================================
// 設定値
// ==========================================
const LIFF_ID = '2010370033-N6k69U5l'; 
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzACsGXbFTNU578DUOR-_vPz1jr4lO_i5ArVdQ0SPkheBG2KKt4NFJx2FttUYwfkRXsWw/exec'; 

// DOM要素（変数の準備だけしておく）
let statusMessage;
let formContainer;

// ==========================================
// LIFF初期化・通信処理
// ==========================================
async function initializeApp() {
  try {
    await liff.init({ liffId: LIFF_ID });
    if (liff.isLoggedIn()) {
      statusMessage.textContent = 'データ取得中...';
      const idToken = liff.getIDToken();
      if (idToken) {
        fetchAnyCrossData(idToken);
      } else {
        throw new Error("IDトークンが取得できませんでした");
      }
    } else {
      liff.login();
    }
  } catch (error) {
    statusMessage.textContent = '初期化エラー';
    if (formContainer) formContainer.textContent = error.toString();
  }
}

async function fetchAnyCrossData(idToken) {
  try {
    const url = new URL(GAS_WEBAPP_URL);
    url.searchParams.append('action', 'fetch');
    url.searchParams.append('idToken', idToken);

    const response = await fetch(url.toString(), { method: 'GET' });
    const result = await response.json();

    if (result.success) {
      statusMessage.textContent = 'シフト読込完了';
      renderShiftForm(result.data || []); 
    } else {
      statusMessage.textContent = '取得エラー';
      if (formContainer) formContainer.textContent = result.message;
    }
  } catch (error) {
    statusMessage.textContent = '通信エラー';
    if (formContainer) formContainer.textContent = error.toString();
  }
}

// ==========================================
// プルダウンの選択肢生成（ルール反映）
// ==========================================

// ③ 出勤時間の生成 (12:00〜20:30)
function getStartOptions() {
  const options = [];
  const excludes = ['14:00', '14:15', '14:30', '14:45', '16:45', '18:45'];
  for (let h = 12; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 20 && m > 30) continue; 
      const timeStr = `${h}:${m === 0 ? '00' : m}`;
      if (!excludes.includes(timeStr)) options.push(timeStr);
    }
  }
  return options;
}

// ④ 退勤時間の生成 (12:30〜21:00)
function getEndOptions() {
  const options = [];
  const excludes = ['14:15', '14:30', '14:45', '15:00'];
  for (let h = 12; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 12 && m < 30) continue; 
      if (h === 21 && m > 0) continue;  
      const timeStr = `${h}:${m === 0 ? '00' : m}`;
      if (!excludes.includes(timeStr)) options.push(timeStr);
    }
  }
  return options;
}

// ==========================================
// UI生成処理
// ==========================================
function renderShiftForm(shiftDataArray) {
  const shiftMap = {};
  shiftDataArray.forEach(item => {
    if (item.fields && item.fields['勤務日']) {
      const d = new Date(item.fields['勤務日']);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      shiftMap[dateStr] = item.fields;
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  const year = today.getFullYear();
  const month = today.getMonth(); 
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const startOptions = getStartOptions();
  const endOptions = getEndOptions();

  let html = `<table class="shift-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>出勤</th>
                    <th>退勤</th>
                  </tr>
                </thead>
                <tbody>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const iterDate = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const displayDate = `${month + 1}/${day}`;
    
    const isEditable = iterDate > today; 
    
    const shift = shiftMap[dateStr];
    const registeredStart = shift && shift['出勤時間'] ? shift['出勤時間'] : '';
    const registeredEnd = shift && shift['退勤時間'] ? shift['退勤時間'] : '';

    const rowClass = isEditable ? '' : 'row-disabled';
    const disabledAttr = isEditable ? '' : 'disabled';

    html += `<tr class="${rowClass}">
               <td>${displayDate}</td>
               <td>
                 <select ${disabledAttr}>
                   <option value="">休</option>`;
    startOptions.forEach(opt => {
      const selected = (opt === registeredStart) ? 'selected' : '';
      html += `<option value="${opt}" ${selected}>${opt}</option>`;
    });
    html += `    </select>
               </td>
               <td>
                 <select ${disabledAttr}>
                   <option value="">休</option>`;
    endOptions.forEach(opt => {
      const selected = (opt === registeredEnd) ? 'selected' : '';
      html += `<option value="${opt}" ${selected}>${opt}</option>`;
    });
    html += `    </select>
               </td>
             </tr>`;
  }

  html += `  </tbody>
           </table>`;

  if (formContainer) {
    formContainer.innerHTML = html;
  }
}

// ==========================================
// イベントリスナーの登録
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // HTMLの読み込みが完全に終わってから要素を取得する
  statusMessage = document.getElementById('status-message');
  
  // 'form-container' が無ければ、古い 'result-box' を探すようにフォールバック（保険）
  formContainer = document.getElementById('form-container') || document.getElementById('result-box');
  
  // 要素が取得できたらLIFFを起動
  initializeApp();
});