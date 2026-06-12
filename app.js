// ==========================================
// 設定値
// ==========================================
const LIFF_ID = '2010370033-N6k69U5l'; 
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzACsGXbFTNU578DUOR-_vPz1jr4lO_i5ArVdQ0SPkheBG2KKt4NFJx2FttUYwfkRXsWw/exec'; 

let statusMessage;
let formContainer;
let submitBtn;

// ★ 変更検知のために元のデータを記憶しておく変数
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
// プルダウンの選択肢生成（ルール反映）
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
  originalShiftData = {}; // 毎度リセット

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

    // ★ 現在の値を記憶しておく
    originalShiftData[dateStr] = {
      start: registeredStart,
      end: registeredEnd
    };

    const rowClass = isEditable ? '' : 'row-disabled';
    const disabledAttr = isEditable ? '' : 'disabled';

    // ★ trに data-date 属性をつけて、後から日付を特定しやすくする
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
    // フォームが生成されたら提出ボタンを表示
   if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

// ==========================================
// ★ 提出処理（差分を検知して送信）
// ==========================================
async function submitChanges() {
  const changedShifts = [];
  const rows = document.querySelectorAll('tr[data-date]');

  // 行ごとに変更がないかチェック
  rows.forEach(row => {
    const dateStr = row.getAttribute('data-date');
    const startSelect = row.querySelector('.start-select');
    const endSelect = row.querySelector('.end-select');

    // 操作可能な行（明日以降）だけチェック
    if (startSelect && endSelect && !startSelect.disabled) {
      const currentStart = startSelect.value;
      const currentEnd = endSelect.value;
      const original = originalShiftData[dateStr];

      // 元のデータと違う場合（出勤・退勤のどちらか一方でも変わっていれば）
      if (currentStart !== original.start || currentEnd !== original.end) {
        changedShifts.push({
          date: dateStr,
          start: currentStart,
          end: currentEnd
        });
      }
    }
  });

  // 変更が一つもなければ処理を中断
  if (changedShifts.length === 0) {
    alert('変更されたシフトはありません。');
    return;
  }

  // ユーザーに確認
  if (!confirm(`${changedShifts.length}件のシフトを提出しますか？`)) {
    return;
  }

  // GASへ送信
  submitBtn.disabled = true;
  statusMessage.textContent = '送信中...';

  try {
    const idToken = liff.getIDToken();
    const payload = {
      action: 'updateShifts',
      idToken: idToken,
      changes: changedShifts // ★ 変更されたデータの配列
    };

    // 複雑なデータなので POST で送る
    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // CORS回避用
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      alert('提出が完了しました！');
      // 送信成功したら、再度データを読み込んでリセットする
      fetchAnyCrossData(idToken); 
    } else {
      alert('エラーが発生しました:\n' + result.message);
      statusMessage.textContent = '送信エラー';
    }
  } catch (error) {
    alert('通信エラーが発生しました。');
    statusMessage.textContent = '通信エラー';
  } finally {
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