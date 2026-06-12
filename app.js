// ==========================================
// 設定値
// ==========================================
const LIFF_ID = '2010370033-N6k69U5l'; 
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzACsGXbFTNU578DUOR-_vPz1jr4lO_i5ArVdQ0SPkheBG2KKt4NFJx2FttUYwfkRXsWw/exec'; 

let statusMessage;
let formContainer;
let submitBtn;

let originalShiftData = {}; 

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
// プルダウンの選択肢生成
// ==========================================
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
  originalShiftData = {}; 

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

    originalShiftData[dateStr] = {
      start: registeredStart,
      end: registeredEnd
    };

    const rowClass = isEditable ? '' : 'row-disabled';
    const disabledAttr = isEditable ? '' : 'disabled';

    html += `<tr class="${rowClass}" data-date="${dateStr}">
               <td>${displayDate}</td>
               <td>
                 <select class="start-select" ${disabledAttr}>
                   <option value="">休</option>`;
    startOptions.forEach(opt => {
      const selected = (opt === registeredStart) ? 'selected' : '';
      html += `<option value="${opt}" ${selected}>${opt}</option>`;
    });
    html += `    </select>
               </td>
               <td>
                 <select class="end-select" ${disabledAttr}>
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
    
    // ★ 変更点：データが読み込まれたら、無条件でボタンを押せるようにする
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

// ==========================================
// 提出処理（差分を送信）
// ==========================================
async function submitChanges() {
  const changedShifts = [];
  const rows = document.querySelectorAll('tr[data-date]');

  rows.forEach(row => {
    const dateStr = row.getAttribute('data-date');
    const startSelect = row.querySelector('.start-select');
    const endSelect = row.querySelector('.end-select');

    if (startSelect && endSelect && !startSelect.disabled) {
      const currentStart = startSelect.value;
      const currentEnd = endSelect.value;
      const original = originalShiftData[dateStr];

      if (currentStart !== original.start || currentEnd !== original.end) {
        changedShifts.push({
          date: dateStr,
          start: currentStart,
          end: currentEnd
        });
      }
    }
  });

  // ★ 変更が一つもなければお知らせして終了
  if (changedShifts.length === 0) {
    alert('変更されたシフトはありません。');
    return;
  }

  if (!confirm(`${changedShifts.length}件のシフトを提出しますか？`)) {
    return;
  }

  submitBtn.disabled = true;
  statusMessage.textContent = '送信中...';

  try {
    const idToken = liff.getIDToken();
    const payload = {
      action: 'updateShifts',
      idToken: idToken,
      changes: changedShifts 
    };

    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, 
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      alert('提出が完了しました！');
      fetchAnyCrossData(idToken); 
    } else {
      alert('エラーが発生しました:\n' + result.message);
      statusMessage.textContent = '送信エラー';
      submitBtn.disabled = false; 
    }
  } catch (error) {
    alert('通信エラーが発生しました。');
    statusMessage.textContent = '通信エラー';
    submitBtn.disabled = false;
  }
}

// ==========================================
// イベントリスナーの登録
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  statusMessage = document.getElementById('status-message');
  formContainer = document.getElementById('form-container');
  submitBtn = document.getElementById('submit-btn');
  
  if (submitBtn) {
    submitBtn.addEventListener('click', submitChanges);
  }
  
  initializeApp();
});